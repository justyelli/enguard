import { prisma } from "@/lib/prisma";
import { normalizeTerm } from "@/lib/translate";

export type WeakWord = {
  word: string;
  translation: string;
  example: string | null;
};

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Собирает «слабые» слова на основе активности:
 *  - карточки с ошибками (lapses) и просроченные;
 *  - слова, по которым недавно кликали/переводили.
 * Возвращает до `limit` слов с переводом и примером (если есть).
 */
export async function getWeakWords(limit = 12): Promise<WeakWord[]> {
  const since = daysAgo(7);

  const [cards, lookups, translations] = await Promise.all([
    prisma.card.findMany(),
    prisma.wordLookup.findMany({
      where: { createdAt: { gte: since } },
    }),
    prisma.translation.findMany(),
  ]);

  const now = new Date();
  const transMap = new Map(translations.map((t) => [t.term, t]));

  type Entry = {
    word: string;
    translation: string;
    example: string | null;
    score: number;
  };
  const map = new Map<string, Entry>();

  // Карточки
  for (const c of cards) {
    const key = normalizeTerm(c.word);
    if (!key) continue;
    const due = c.dueDate <= now;
    const score = c.lapses * 3 + (due ? 2 : 0) + 1;
    map.set(key, {
      word: c.word,
      translation: c.translation,
      example: c.example,
      score,
    });
  }

  // Клики/переводы
  const lookupCounts = new Map<string, number>();
  for (const l of lookups) {
    lookupCounts.set(l.word, (lookupCounts.get(l.word) || 0) + 1);
  }
  for (const [word, count] of lookupCounts) {
    const existing = map.get(word);
    if (existing) {
      existing.score += count;
    } else {
      const t = transMap.get(word);
      if (t) {
        try {
          const payload = JSON.parse(t.payload);
          map.set(word, {
            word,
            translation: payload.translation || "—",
            example: payload.examples?.[0]?.en ?? null,
            score: count,
          });
        } catch {
          /* пропускаем битый кэш */
        }
      }
    }
  }

  return Array.from(map.values())
    .filter((e) => e.translation && e.translation !== "—")
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ word, translation, example }) => ({ word, translation, example }));
}

export type DailyStats = {
  lookupsToday: number;
  reviewsToday: number;
  accuracyToday: number; // 0..100
  cardsTotal: number;
  dueCount: number;
  streak: number; // дней подряд с активностью
};

export async function getDailyStats(): Promise<DailyStats> {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const now = new Date();

  const [lookupsToday, reviewsToday, reviewsTodayCorrect, cardsTotal, dueCount, activityDays] =
    await Promise.all([
      prisma.wordLookup.count({ where: { createdAt: { gte: startToday } } }),
      prisma.reviewLog.count({ where: { createdAt: { gte: startToday } } }),
      prisma.reviewLog.count({
        where: { createdAt: { gte: startToday }, correct: true },
      }),
      prisma.card.count(),
      prisma.card.count({ where: { dueDate: { lte: now } } }),
      // дни активности для streak: повторы + переводы + практика
      Promise.all([
        prisma.reviewLog.findMany({ select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
        prisma.wordLookup.findMany({ select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
        prisma.practiceLog.findMany({ select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
      ]).then((arrs) => arrs.flat()),
    ]);

  // streak: дни подряд с любой активностью (повтор / перевод / практика)
  const daySet = new Set(
    activityDays.map((r) => {
      const d = new Date(r.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (daySet.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    lookupsToday,
    reviewsToday,
    accuracyToday:
      reviewsToday > 0
        ? Math.round((reviewsTodayCorrect / reviewsToday) * 100)
        : 0,
    cardsTotal,
    dueCount,
    streak,
  };
}

// Карта статусов слов для подсветки в ридере.
export async function getKnownWordsMap(): Promise<Record<string, "known" | "hard">> {
  const cards = await prisma.card.findMany({
    select: { word: true, reps: true, lapses: true },
  });
  const map: Record<string, "known" | "hard"> = {};
  for (const c of cards) {
    const key = normalizeTerm(c.word);
    if (!key) continue;
    if (c.lapses >= 2) map[key] = "hard";
    else if (c.reps > 0 && map[key] !== "hard") map[key] = "known";
  }
  return map;
}

export type ReviewCard = {
  id: number;
  word: string;
  translation: string;
  example: string | null;
  context: string | null;
  starred: boolean;
  dueDate: string;
};

function toReviewCard(c: {
  id: number;
  word: string;
  translation: string;
  example: string | null;
  context: string | null;
  starred: boolean;
  dueDate: Date;
}): ReviewCard {
  return {
    id: c.id,
    word: c.word,
    translation: c.translation,
    example: c.example,
    context: c.context,
    starred: c.starred,
    dueDate: c.dueDate.toISOString(),
  };
}

// Карточки к повторению (срок подошёл) по всем коллекциям.
export async function getDueCards(limit = 40): Promise<ReviewCard[]> {
  const cards = await prisma.card.findMany({
    where: { dueDate: { lte: new Date() } },
    orderBy: { dueDate: "asc" },
    take: limit,
  });
  return cards.map(toReviewCard);
}

export async function getDueCount(): Promise<number> {
  return prisma.card.count({ where: { dueDate: { lte: new Date() } } });
}

// Карточки-ошибки (были провалены хотя бы раз) по всем коллекциям.
export async function getMistakeCards(limit = 40): Promise<ReviewCard[]> {
  const cards = await prisma.card.findMany({
    where: { lapses: { gt: 0 } },
    orderBy: { lapses: "desc" },
    take: limit,
  });
  return cards.map(toReviewCard);
}

export async function getMistakeCount(): Promise<number> {
  return prisma.card.count({ where: { lapses: { gt: 0 } } });
}

export type SkillStat = { skill: string; sessions: number; avgScore: number };

// Сводка по навыкам практики (speaking/listening/grammar/writing) за 30 дней.
export async function getPracticeSummary(): Promise<SkillStat[]> {
  const since = daysAgo(30);
  const logs = await prisma.practiceLog.findMany({
    where: { createdAt: { gte: since } },
    select: { skill: true, score: true, total: true },
  });
  const map = new Map<string, { sessions: number; pctSum: number }>();
  for (const l of logs) {
    const cur = map.get(l.skill) ?? { sessions: 0, pctSum: 0 };
    cur.sessions += 1;
    cur.pctSum += l.total > 0 ? (l.score / l.total) * 100 : 0;
    map.set(l.skill, cur);
  }
  return ["listening", "speaking", "writing", "grammar"].map((skill) => {
    const v = map.get(skill);
    return {
      skill,
      sessions: v?.sessions ?? 0,
      avgScore: v && v.sessions ? Math.round(v.pctSum / v.sessions) : 0,
    };
  });
}

export type DayPoint = {
  day: string; // YYYY-MM-DD
  reviews: number;
  correct: number;
  lookups: number;
  practice: number;
};

// Активность по дням за последние `days` дней (для графиков).
export async function getDailySeries(days = 30): Promise<DayPoint[]> {
  const since = daysAgo(days - 1);
  since.setHours(0, 0, 0, 0);

  const [reviews, lookups, practice] = await Promise.all([
    prisma.reviewLog.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, correct: true },
    }),
    prisma.wordLookup.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.practiceLog.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ]);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const map = new Map<string, DayPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    map.set(fmt(d), { day: fmt(d), reviews: 0, correct: 0, lookups: 0, practice: 0 });
  }
  for (const r of reviews) {
    const k = fmt(new Date(r.createdAt));
    const p = map.get(k);
    if (p) {
      p.reviews++;
      if (r.correct) p.correct++;
    }
  }
  for (const l of lookups) {
    const k = fmt(new Date(l.createdAt));
    const p = map.get(k);
    if (p) p.lookups++;
  }
  for (const pl of practice) {
    const k = fmt(new Date(pl.createdAt));
    const p = map.get(k);
    if (p) p.practice++;
  }
  return [...map.values()];
}
