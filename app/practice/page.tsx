import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const modules = [
  {
    href: "/practice/listening",
    icon: "🎧",
    title: "Аудирование",
    skill: "listening",
    desc: "Слушай предложения и записывай услышанное — диктант с проверкой по словам.",
  },
  {
    href: "/practice/audio-story",
    icon: "📻",
    title: "Аудио-истории",
    skill: "story",
    desc: "Слушай связную историю по уровню и отвечай на вопросы по смыслу — понятный ввод на слух.",
  },
  {
    href: "/practice/speaking",
    icon: "🗣️",
    title: "Говорение",
    skill: "speaking",
    desc: "Повторяй слова и фразы вслух — браузер распознаёт речь и оценивает произношение.",
  },
  {
    href: "/practice/shadowing",
    icon: "🎙️",
    title: "Шэдоуинг",
    skill: "shadowing",
    desc: "Слушай диктора и тут же повторяй, копируя ритм. Можно на фразах из твоих книг и в замедлении.",
  },
  {
    href: "/practice/writing",
    icon: "✍️",
    title: "Письмо",
    skill: "writing",
    desc: "Пиши по заданию — AI находит ошибки, объясняет и предлагает улучшенную версию.",
  },
  {
    href: "/practice/grammar",
    icon: "📐",
    title: "Грамматика",
    skill: "grammar",
    desc: "Квизы по темам: времена, артикли, предлоги, условные — с пояснениями.",
  },
  {
    href: "/practice/tutor",
    icon: "💬",
    title: "AI-репетитор",
    skill: "tutor",
    desc: "Живой диалог по сценариям с мягкими исправлениями ошибок.",
  },
];

export default async function PracticeHub() {
  let counts: Record<string, number> = {};
  try {
    const grouped = await prisma.practiceLog.groupBy({
      by: ["skill"],
      _count: { _all: true },
    });
    counts = Object.fromEntries(grouped.map((g) => [g.skill, g._count._all]));
  } catch {
    counts = {};
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">🏋️ Практика</h1>
        <p className="mt-1 text-sm text-muted">
          Чтение и словарь у тебя уже идут в книгах и карточках. Здесь — остальные
          четыре навыка: аудирование, говорение, письмо и грамматика.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group rounded-2xl border border-border bg-surface p-5 transition-all hover:border-primary hover:shadow-md sm:p-6"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-3xl">{m.icon}</div>
              {counts[m.skill] ? (
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted">
                  {counts[m.skill]} занятий
                </span>
              ) : null}
            </div>
            <h2 className="mb-1 text-lg font-semibold group-hover:text-primary">
              {m.title}
            </h2>
            <p className="text-sm text-muted">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
