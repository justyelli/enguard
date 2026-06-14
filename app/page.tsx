import Link from "next/link";
import { getDailyStats, getWeakWords } from "@/lib/analytics";
import WordOfDay from "@/components/WordOfDay";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    return await getDailyStats();
  } catch {
    return {
      lookupsToday: 0,
      reviewsToday: 0,
      accuracyToday: 0,
      cardsTotal: 0,
      dueCount: 0,
      streak: 0,
    };
  }
}

// Детерминированно по дате выбираем «слово дня».
async function getWordOfDay() {
  try {
    const words = await getWeakWords(30);
    if (words.length === 0) return null;
    const now = new Date();
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
    );
    return words[dayOfYear % words.length];
  } catch {
    return null;
  }
}

const modules = [
  {
    href: "/books",
    icon: "📖",
    title: "Книги",
    desc: "Читай книги и нажимай на слова — перевод появится сразу. Каждое слово можно добавить в коллекцию.",
  },
  {
    href: "/translate",
    icon: "🔍",
    title: "Умный переводчик",
    desc: "Не просто перевод: примеры употребления, отличия от похожих слов и синонимы с оттенками.",
  },
  {
    href: "/collections",
    icon: "🃏",
    title: "Коллекции и тренажёр",
    desc: "Собирай слова в карточки и заучивай разными упражнениями с интервальными повторениями.",
  },
  {
    href: "/workbook",
    icon: "📅",
    title: "Ежедневный воркбук",
    desc: "Каждый день — лист A4 с заданиями по твоим словам. Распечатай, реши, сверься с ответами.",
  },
];

export default async function HomePage() {
  const [stats, wod] = await Promise.all([getStats(), getWordOfDay()]);

  const statCards = [
    { label: "🔥 Серия дней", value: stats.streak },
    { label: "Слов в карточках", value: stats.cardsTotal },
    { label: "Переведено сегодня", value: stats.lookupsToday },
    { label: "К повторению", value: stats.dueCount },
    { label: "Повторов сегодня", value: stats.reviewsToday },
    { label: "Точность сегодня", value: `${stats.accuracyToday}%` },
  ];

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Добро пожаловать в Enguard 👋
        </h1>
        <p className="max-w-2xl text-muted">
          Личное пространство для изучения английского: чтение с переводом по клику,
          умный словарь, карточки и персональный воркбук каждый день.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => (
          <Link
            href="/stats"
            key={s.label}
            className="rounded-xl border border-border bg-surface p-3 transition-colors hover:border-primary sm:p-4"
          >
            <div className="text-xl font-bold sm:text-2xl">{s.value}</div>
            <div className="text-xs text-muted">{s.label}</div>
          </Link>
        ))}
      </section>

      {wod && (
        <WordOfDay
          word={wod.word}
          translation={wod.translation}
          example={wod.example}
        />
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-2xl border border-border bg-surface p-5 transition-all hover:border-primary hover:shadow-md sm:p-6"
          >
            <div className="mb-3 text-3xl">{m.icon}</div>
            <h2 className="mb-1 text-lg font-semibold group-hover:text-primary">
              {m.title}
            </h2>
            <p className="text-sm text-muted">{m.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
