import { prisma } from "@/lib/prisma";

// ─────────────────────────── Уровни CEFR ───────────────────────────

export const LEVELS = [
  { cefr: "A1", minXp: 0 },
  { cefr: "A2", minXp: 600 },
  { cefr: "B1", minXp: 1800 },
  { cefr: "B2", minXp: 4000 },
  { cefr: "C1", minXp: 8000 },
];

function levelIndex(xp: number): number {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i].minXp) idx = i;
  return idx;
}

export type LevelInfo = {
  cefr: string;
  next: string | null;
  intoLevel: number; // xp набрано внутри текущего уровня
  levelSpan: number; // сколько xp в текущем уровне всего
  toNext: number; // сколько до следующего
  pct: number; // 0..100 прогресс к следующему уровню
};

export function levelInfo(totalXp: number): LevelInfo {
  const i = levelIndex(totalXp);
  const cur = LEVELS[i];
  const nxt = LEVELS[i + 1];
  if (!nxt) {
    return { cefr: cur.cefr, next: null, intoLevel: 0, levelSpan: 0, toNext: 0, pct: 100 };
  }
  const span = nxt.minXp - cur.minXp;
  const into = totalXp - cur.minXp;
  return {
    cefr: cur.cefr,
    next: nxt.cefr,
    intoLevel: into,
    levelSpan: span,
    toNext: nxt.minXp - totalXp,
    pct: Math.round((into / span) * 100),
  };
}

// ─────────────────────────── Даты ───────────────────────────

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffDays(fromKey: string, toKey: string): number {
  const a = new Date(fromKey + "T00:00:00");
  const b = new Date(toKey + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ─────────────────────────── Профиль ───────────────────────────

// Singleton с фиксированным id=1 — upsert защищает от гонки двойного создания.
export async function getProfile() {
  return prisma.profile.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export type AwardResult = {
  gained: number;
  mult: number;
  leveledTo: string | null;
  goalJustReached: boolean;
  totalXp: number;
  streak: number;
};

// XP за активности (до множителя).
export const XP = {
  lookup: 2,
  reviewCorrect: 3,
  reviewWrong: 1,
  workbook: 25,
};

export function practiceXp(score: number, total: number): number {
  const pct = total > 0 ? Math.max(0, Math.min(1, score / total)) : 0;
  return 5 + Math.round(pct * 15); // 5..20
}

/**
 * Начисляет XP, обновляет серию, уровень, дневную цель и валюту.
 * Безопасно: при ошибке возвращает null и не роняет основное действие.
 */
export async function awardXp(rawAmount: number): Promise<AwardResult | null> {
  try {
    // Интерактивная транзакция: чтение+запись сериализуются (SQLite/better-sqlite3),
    // поэтому параллельные начисления не теряют XP/гемы/серию.
    return await prisma.$transaction(async (tx) => {
      const p = await tx.profile.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });
      const now = new Date();
      const today = dayKey(now);

      const boostActive =
        p.boostMult > 1 && p.boostExpires && p.boostExpires > now;
      const mult = boostActive ? p.boostMult : 1;
      const gained = Math.max(0, Math.round(rawAmount * mult));

      let {
        streak,
        longestStreak,
        lastActiveDay,
        todayXp,
        todayDay,
        gems,
        freezes,
        goalRewardedDay,
      } = p;

      if (todayDay !== today) {
        todayXp = 0;
        todayDay = today;
      }

      if (lastActiveDay !== today) {
        if (!lastActiveDay) {
          streak = 1;
        } else {
          const gap = diffDays(lastActiveDay, today);
          if (gap === 1) streak = streak + 1;
          else if (gap === 2 && freezes > 0) {
            freezes -= 1;
            streak = streak + 1;
          } else {
            streak = 1;
          }
        }
        lastActiveDay = today;
        longestStreak = Math.max(longestStreak, streak);
      }

      todayXp += gained;
      const totalXp = p.totalXp + gained;

      const leveledUp = levelIndex(totalXp) > levelIndex(p.totalXp);
      let leveledTo: string | null = null;
      if (leveledUp) {
        leveledTo = LEVELS[levelIndex(totalXp)].cefr;
        gems += 25;
      }
      const boost3 = p.boost3 + (leveledUp ? 1 : 0);

      let goalJustReached = false;
      if (todayXp >= p.dailyGoalXp && goalRewardedDay !== today) {
        goalRewardedDay = today;
        gems += 10;
        goalJustReached = true;
      }

      await tx.profile.update({
        where: { id: p.id },
        data: {
          totalXp,
          todayXp,
          todayDay,
          streak,
          longestStreak,
          lastActiveDay,
          gems,
          freezes,
          boost3,
          goalRewardedDay,
          boostMult: boostActive ? p.boostMult : 1,
          boostExpires: boostActive ? p.boostExpires : null,
        },
      });

      return { gained, mult, leveledTo, goalJustReached, totalXp, streak };
    });
  } catch (e) {
    console.error("awardXp error", e);
    return null;
  }
}
