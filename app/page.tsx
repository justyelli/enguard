import Link from "next/link";
import { getWeakWords } from "@/lib/analytics";
import WordOfDay from "@/components/WordOfDay";
import GameDashboard from "@/components/GameDashboard";

export const dynamic = "force-dynamic";

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
    desc: "Читай и нажимай на слова — перевод сразу. +2 XP за каждое новое слово.",
  },
  {
    href: "/practice",
    icon: "🏋️",
    title: "Практика",
    desc: "Аудирование, говорение, письмо и грамматика — все навыки и XP.",
  },
  {
    href: "/collections",
    icon: "🃏",
    title: "Карточки",
    desc: "Заучивай слова в Quizlet-стиле и зарабатывай XP за повторения.",
  },
  {
    href: "/workbook",
    icon: "📅",
    title: "Воркбук",
    desc: "Лист заданий на день. Выполни и получи +25 XP.",
  },
];

export default async function HomePage() {
  const wod = await getWordOfDay();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          С возвращением 👋
        </h1>
        <p className="text-muted">Держи серию и двигайся к C1.</p>
      </section>

      <GameDashboard />

      {wod && (
        <WordOfDay
          word={wod.word}
          translation={wod.translation}
          example={wod.example}
        />
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-3xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_10px_24px_-14px_rgba(80,60,20,0.5)]"
          >
            <div className="mb-2 text-3xl">{m.icon}</div>
            <h2 className="mb-1 font-display text-lg font-bold group-hover:text-primary">
              {m.title}
            </h2>
            <p className="text-sm text-muted">{m.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
