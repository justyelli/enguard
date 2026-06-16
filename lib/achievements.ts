import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/gamify";

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  unit: string;
  level: number; // достигнутый уровень (0 = ещё не открыт)
  maxLevel: number;
  value: number; // текущее значение метрики
  base: number; // порог текущего уровня
  next: number | null; // порог следующего уровня (null = максимум)
  unlocked: boolean; // level >= 1
};

type Track = {
  id: string;
  icon: string;
  title: string;
  unit: string;
  thresholds: number[]; // по возрастанию
  value: number;
};

function build(t: Track): Achievement {
  const level = t.thresholds.filter((th) => t.value >= th).length;
  const base = level > 0 ? t.thresholds[level - 1] : 0;
  const next = level < t.thresholds.length ? t.thresholds[level] : null;
  return {
    id: t.id,
    icon: t.icon,
    title: t.title,
    unit: t.unit,
    level,
    maxLevel: t.thresholds.length,
    value: t.value,
    base,
    next,
    unlocked: level >= 1,
  };
}

// Серия: уровни по неделям (1 нед = 7 дней, 2 нед = 14, ... до года).
const WEEKLY = Array.from({ length: 52 }, (_, i) => (i + 1) * 7);

export async function getAchievements(): Promise<Achievement[]> {
  const [profile, cards, learned, books, reviews, lookups, writings, practice] =
    await Promise.all([
      getProfile(),
      prisma.card.count(),
      prisma.card.count({ where: { reps: { gt: 0 } } }),
      prisma.book.count(),
      prisma.reviewLog.count(),
      prisma.wordLookup.count(),
      prisma.writingSubmission.count(),
      prisma.practiceLog.count(),
    ]);

  const tracks: Track[] = [
    { id: "streak", icon: "🔥", title: "Серия дней", unit: "дней", thresholds: WEEKLY, value: profile.longestStreak },
    { id: "xp", icon: "⚡", title: "Опыт", unit: "XP", thresholds: [1000, 5000, 10000, 25000, 50000, 100000, 200000], value: profile.totalXp },
    { id: "words", icon: "🧠", title: "Выучено слов", unit: "слов", thresholds: [10, 50, 100, 250, 500, 1000, 2000], value: learned },
    { id: "cards", icon: "🃏", title: "Карточек создано", unit: "карт.", thresholds: [25, 100, 250, 500, 1000], value: cards },
    { id: "reviews", icon: "🔁", title: "Повторений", unit: "повт.", thresholds: [100, 500, 1000, 5000, 10000], value: reviews },
    { id: "lookups", icon: "🔍", title: "Переводов слов", unit: "перев.", thresholds: [100, 500, 2000, 5000], value: lookups },
    { id: "practice", icon: "🏋️", title: "Занятий практикой", unit: "зан.", thresholds: [10, 50, 150, 400], value: practice },
    { id: "writing", icon: "✍️", title: "Письменных работ", unit: "работ", thresholds: [1, 10, 30, 100], value: writings },
    { id: "books", icon: "📖", title: "Книг добавлено", unit: "книг", thresholds: [1, 3, 10, 25], value: books },
  ];

  return tracks.map(build);
}
