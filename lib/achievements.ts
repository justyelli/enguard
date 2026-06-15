import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/gamify";

export type Achievement = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
  current: number;
  target: number;
};

type Def = { id: string; icon: string; title: string; desc: string; target: number; value: () => number };

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

  const defs: Def[] = [
    { id: "streak7", icon: "🔥", title: "Неделя подряд", desc: "Серия 7 дней", target: 7, value: () => profile.longestStreak },
    { id: "streak30", icon: "🏆", title: "Месяц подряд", desc: "Серия 30 дней", target: 30, value: () => profile.longestStreak },
    { id: "streak100", icon: "💎", title: "Сто дней", desc: "Серия 100 дней", target: 100, value: () => profile.longestStreak },
    { id: "xp1000", icon: "⚡", title: "1000 XP", desc: "Набери 1000 XP", target: 1000, value: () => profile.totalXp },
    { id: "xp5000", icon: "🌟", title: "5000 XP", desc: "Набери 5000 XP", target: 5000, value: () => profile.totalXp },
    { id: "words50", icon: "📚", title: "Полиглот", desc: "Выучи 50 слов", target: 50, value: () => learned },
    { id: "words200", icon: "🧠", title: "Словарный запас", desc: "Выучи 200 слов", target: 200, value: () => learned },
    { id: "cards100", icon: "🃏", title: "Коллекционер", desc: "100 карточек", target: 100, value: () => cards },
    { id: "reviews500", icon: "🔁", title: "Повторение — мать", desc: "500 повторений", target: 500, value: () => reviews },
    { id: "lookups200", icon: "🔍", title: "Любопытный", desc: "200 переводов слов", target: 200, value: () => lookups },
    { id: "books1", icon: "📖", title: "Первая книга", desc: "Добавь книгу", target: 1, value: () => books },
    { id: "writing5", icon: "✍️", title: "Писатель", desc: "5 письменных работ", target: 5, value: () => writings },
    { id: "practice20", icon: "🏋️", title: "Тренировка навыков", desc: "20 занятий практикой", target: 20, value: () => practice },
  ];

  return defs.map((d) => {
    const current = d.value();
    return {
      id: d.id,
      icon: d.icon,
      title: d.title,
      desc: d.desc,
      target: d.target,
      current: Math.min(current, d.target),
      unlocked: current >= d.target,
    };
  });
}
