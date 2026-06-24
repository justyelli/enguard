import { prisma } from "@/lib/prisma";
import { getProfile, levelInfo, LEVELS, XP, practiceXp, dayKey, diffDays } from "@/lib/gamify";

// ─────────────────────────────────────────────────────────────────────────────
// «Путь к C1» — честный трекер темпа к цели за 3 месяца (90 дней).
//
// Модель уровня в приложении — пороги XP (см. LEVELS в gamify). C1 = 120000 XP.
// Здесь мы НЕ выдаём это за измерение реальной речевой компетенции, а считаем
// планировочную метрику: при каком темпе занятий (XP/день) ученик дойдёт до C1
// внутри программы. Это превращает абстрактную цель «за 3 месяца» в конкретный
// дневной норматив и показывает, идёт человек по графику или отстаёт.
//
// Старт пути выводится из самой ранней активности (без изменения схемы БД).
// Темп оценивается по последним 14 дням, реконструируя примерный XP из логов.
// ─────────────────────────────────────────────────────────────────────────────

export const PROGRAM_DAYS = 90;
const TARGET = LEVELS[LEVELS.length - 1]; // C1
const TARGET_XP = TARGET.minXp;

export type JourneyStatus = "ahead" | "ontrack" | "behind" | "reached" | "nodata";

export type Milestone = {
  cefr: string;
  xp: number;
  reached: boolean;
  current: boolean;
  daysAtPace: number | null; // прогноз дней до достижения при текущем темпе
};

export type Journey = {
  startDay: string;
  dayNumber: number; // какой это день пути (1-based)
  programDays: number;
  daysLeft: number; // сколько дней программы осталось
  totalXp: number;
  cefr: string;
  nextCefr: string | null;
  targetXp: number;
  xpLeft: number;
  pacePerDay: number; // текущий темп (оценка XP/день за 14 дней)
  neededPerDay: number; // сколько нужно/день, чтобы успеть к C1 в срок
  projectedDate: string | null; // дата выхода на C1 при текущем темпе
  projectedDayNumber: number | null; // на какой день пути это придётся
  status: JourneyStatus;
  onTrackPct: number; // pace / needed, 0..100+ (для индикатора)
  milestones: Milestone[];
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

// Примерный XP, начисленный за последние `windowDays` дней (без учёта бустов).
async function estimateRecentXp(windowDays: number): Promise<number> {
  const since = daysAgo(windowDays - 1);
  const [reviews, lookups, practice, workbooks] = await Promise.all([
    prisma.reviewLog.findMany({
      where: { createdAt: { gte: since } },
      select: { correct: true },
    }),
    prisma.wordLookup.count({ where: { createdAt: { gte: since } } }),
    prisma.practiceLog.findMany({
      where: { createdAt: { gte: since } },
      select: { score: true, total: true },
    }),
    prisma.workbook.count({
      where: { completed: true, createdAt: { gte: since } },
    }),
  ]);

  let xp = 0;
  for (const r of reviews) xp += r.correct ? XP.reviewCorrect : XP.reviewWrong;
  xp += lookups * XP.lookup;
  for (const p of practice) xp += practiceXp(p.score, p.total);
  xp += workbooks * XP.workbook;
  return xp;
}

// Самая ранняя активность ученика — точка старта пути.
async function findStartDate(): Promise<Date | null> {
  const [r, l, p, c] = await Promise.all([
    prisma.reviewLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.wordLookup.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.practiceLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.card.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const dates = [r?.createdAt, l?.createdAt, p?.createdAt, c?.createdAt].filter(
    (d): d is Date => !!d
  );
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min));
}

export async function getJourney(): Promise<Journey> {
  const now = new Date();
  const [profile, start] = await Promise.all([getProfile(), findStartDate()]);
  const lvl = levelInfo(profile.totalXp);
  const totalXp = profile.totalXp;

  const startDate = start ?? now;
  // Границы суток считаем так же, как dayKey (с APP_TZ_OFFSET), чтобы номер дня
  // пути не расходился с серией/целью/датой старта в продакшене (Vercel=UTC).
  const elapsed = Math.max(0, diffDays(dayKey(startDate), dayKey(now)));
  const dayNumber = elapsed + 1;
  const daysLeft = Math.max(1, PROGRAM_DAYS - elapsed);

  // Темп: окно 14 дней (или меньше, если путь короче), календарное усреднение —
  // дни без занятий честно тянут темп вниз. Дробный темп (paceExact) используем
  // для всех проекций, чтобы скромная активность не округлялась в «нет данных».
  const windowDays = Math.min(14, Math.max(1, dayNumber));
  const recentXp = await estimateRecentXp(windowDays);
  const paceExact = recentXp / windowDays;
  const pacePerDay = Math.round(paceExact); // для отображения
  const hasPace = recentXp > 0;

  const xpLeft = Math.max(0, TARGET_XP - totalXp);
  const neededPerDay = Math.ceil(xpLeft / daysLeft);

  const reached = totalXp >= TARGET_XP;
  let projectedDate: string | null = null;
  let projectedDayNumber: number | null = null;
  if (!reached && paceExact > 0) {
    const daysToTarget = Math.ceil(xpLeft / paceExact);
    const d = new Date(now);
    d.setDate(d.getDate() + daysToTarget);
    projectedDate = dayKey(d);
    projectedDayNumber = dayNumber + daysToTarget;
  }

  let status: JourneyStatus;
  if (reached) status = "reached";
  else if (!hasPace) status = "nodata";
  else {
    const ratio = paceExact / Math.max(1, neededPerDay);
    if (ratio >= 1.1) status = "ahead";
    else if (ratio >= 0.9) status = "ontrack";
    else status = "behind";
  }
  const onTrackPct = neededPerDay > 0 ? Math.round((paceExact / neededPerDay) * 100) : 100;

  const curIdx = LEVELS.findIndex((l) => l.cefr === lvl.cefr);
  const milestones: Milestone[] = LEVELS.map((l, i) => {
    const reachedM = totalXp >= l.minXp;
    let daysAtPace: number | null = null;
    if (!reachedM && paceExact > 0) {
      daysAtPace = Math.ceil((l.minXp - totalXp) / paceExact);
    }
    return {
      cefr: l.cefr,
      xp: l.minXp,
      reached: reachedM,
      current: i === curIdx,
      daysAtPace,
    };
  });

  return {
    startDay: dayKey(startDate),
    dayNumber,
    programDays: PROGRAM_DAYS,
    daysLeft,
    totalXp,
    cefr: lvl.cefr,
    nextCefr: lvl.next,
    targetXp: TARGET_XP,
    xpLeft,
    pacePerDay,
    neededPerDay,
    projectedDate,
    projectedDayNumber,
    status,
    onTrackPct,
    milestones,
  };
}

// Рекомендованная дневная цель XP из доступных пресетов, ближайшая снизу к нужному темпу.
export function recommendGoal(neededPerDay: number, presets = [50, 150, 300, 450, 600]): number {
  let best = presets[0];
  for (const g of presets) if (g <= neededPerDay) best = g;
  // если нужно больше максимального пресета — берём максимальный
  if (neededPerDay > presets[presets.length - 1]) best = presets[presets.length - 1];
  return best;
}
