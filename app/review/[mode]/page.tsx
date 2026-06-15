import Link from "next/link";
import { notFound } from "next/navigation";
import { getDueCards, getMistakeCards } from "@/lib/analytics";
import StudySession from "@/components/StudySession";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  due: "Повторить сегодня",
  mistakes: "Мои ошибки",
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ mode: string }>;
}) {
  const { mode } = await params;
  if (mode !== "due" && mode !== "mistakes") notFound();

  const cards = mode === "due" ? await getDueCards(40) : await getMistakeCards(40);
  const title = TITLES[mode];

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10 text-center">
        <div className="text-5xl">{mode === "due" ? "✅" : "🎯"}</div>
        <h1 className="font-display text-xl font-bold">{title}</h1>
        <p className="text-muted">
          {mode === "due"
            ? "Сейчас нечего повторять — возвращайся позже."
            : "Ошибок пока нет. Так держать!"}
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-hover"
        >
          На главную
        </Link>
      </div>
    );
  }

  return (
    <StudySession
      collectionId={0}
      collectionName={title}
      cards={cards.map((c) => ({
        id: c.id,
        word: c.word,
        translation: c.translation,
        example: c.example,
        context: c.context,
        starred: c.starred,
        dueDate: c.dueDate,
      }))}
    />
  );
}
