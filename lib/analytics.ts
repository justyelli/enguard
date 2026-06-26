import { prisma } from "@/lib/prisma";
import { normalizeTerm } from "@/lib/translate";
import { LEECH_LAPSES } from "@/lib/srs";
import { dayKey, diffDays } from "@/lib/gamify";

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

// «Умная практика» (как Practice у Duolingo): одна смешанная колода из самых
// нужных к повторению карточек. Чередуем проблемные (lapses) и просроченные
// (due) — интерливинг + адресность по слабым местам эффективнее блочной зубрёжки.
export async function getSmartReviewCards(limit = 20): Promise<ReviewCard[]> {
  const [due, mistakes] = await Promise.all([getDueCards(40), getMistakeCards(40)]);
  const out: ReviewCard[] = [];
  const seen = new Set<number>();
  const push = (c: ReviewCard) => {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  };
  let i = 0;
  let j = 0;
  // чередуем: одно проблемное, одно просроченное
  while (out.length < limit && (i < mistakes.length || j < due.length)) {
    while (i < mistakes.length && seen.has(mistakes[i].id)) i++;
    if (i < mistakes.length) push(mistakes[i++]);
    if (out.length >= limit) break;
    while (j < due.length && seen.has(due[j].id)) j++;
    if (j < due.length) push(due[j++]);
  }
  return out.slice(0, limit);
}

// «Личи» — хронически проваливаемые карточки (нужна адресная проработка).
export async function getLeechCount(): Promise<number> {
  return prisma.card.count({ where: { lapses: { gte: LEECH_LAPSES } } });
}

// Сами лич-карточки — для отдельного списка/проработки.
export async function getLeechCards(limit = 40): Promise<ReviewCard[]> {
  const cards = await prisma.card.findMany({
    where: { lapses: { gte: LEECH_LAPSES } },
    orderBy: { lapses: "desc" },
    take: limit,
  });
  return cards.map(toReviewCard);
}

// ─────────────────────────── Прогноз повторений (как в Anki) ───────────────────────────
// График предстоящей нагрузки по dueDate карточек — делает SRS прозрачным и
// помогает планировать. Границы суток считаем через dayKey/diffDays (как серия/
// цель), чтобы не плыло в продакшене (Vercel=UTC + APP_TZ_OFFSET).

export type ForecastDay = { key: string; label: string; count: number; today: boolean };
export type ReviewForecast = {
  days: ForecastDay[];
  later: number; // карточки со сроком дальше горизонта
  max: number;
  total: number;
};

const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export async function getReviewForecast(days = 14): Promise<ReviewForecast> {
  const now = new Date();
  const cards = await prisma.card.findMany({ select: { dueDate: true } });
  const todayKey = dayKey(now);

  const counts = new Array(days).fill(0);
  let later = 0;
  for (const c of cards) {
    if (c.dueDate <= now) {
      counts[0]++; // просроченные и due сегодня
      continue;
    }
    const d = diffDays(todayKey, dayKey(c.dueDate));
    if (d <= 0) counts[0]++;
    else if (d < days) counts[d]++;
    else later++;
  }

  const out: ForecastDay[] = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + i);
    const key = dayKey(dt);
    // день недели берём из того же offset-aware ключа (полдень UTC устойчив к
    // смещению и DST), иначе на проде (UTC + APP_TZ_OFFSET) подпись съезжает на день
    out.push({
      key,
      label: i === 0 ? "Сег" : WD[new Date(key + "T12:00:00Z").getUTCDay()],
      count: counts[i],
      today: i === 0,
    });
  }

  const max = Math.max(1, ...counts);
  const total = counts.reduce((s, n) => s + n, 0) + later;
  return { days: out, later, max, total };
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
