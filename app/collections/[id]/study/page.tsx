import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StudySession from "@/components/StudySession";

export const dynamic = "force-dynamic";

export default async function StudyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cid = Number(id);
  if (!cid) notFound();

  const collection = await prisma.collection.findUnique({
    where: { id: cid },
    include: { cards: true },
  });
  if (!collection) notFound();

  if (collection.cards.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="text-xl font-bold">{collection.name}</h1>
        <p className="text-muted">В коллекции нет карточек для тренировки.</p>
      </div>
    );
  }

  return (
    <StudySession
      collectionId={collection.id}
      collectionName={collection.name}
      cards={collection.cards.map((c) => ({
        id: c.id,
        word: c.word,
        translation: c.translation,
        example: c.example,
        context: c.context,
        starred: c.starred,
        dueDate: c.dueDate.toISOString(),
      }))}
    />
  );
}
