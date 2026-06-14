import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CardsTable from "@/components/CardsTable";
import CollectionActions from "@/components/CollectionActions";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cid = Number(id);
  if (!cid) notFound();

  const collection = await prisma.collection.findUnique({
    where: { id: cid },
    include: { cards: { orderBy: { createdAt: "desc" } } },
  });
  if (!collection) notFound();

  const now = new Date();
  const dueCount = collection.cards.filter((c) => c.dueDate <= now).length;

  return (
    <div className="space-y-6">
      <Link href="/collections" className="text-sm text-muted hover:text-foreground">
        ← К коллекциям
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{collection.name}</h1>
          <p className="text-sm text-muted">
            {collection.cards.length} карточек · {dueCount} к повторению
          </p>
        </div>
        {collection.cards.length > 0 && (
          <Link
            href={`/collections/${cid}/study`}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            ▶ Тренировка
          </Link>
        )}
      </div>

      <CollectionActions collectionId={cid} />

      <CardsTable
        cards={collection.cards.map((c) => ({
          id: c.id,
          word: c.word,
          translation: c.translation,
          example: c.example,
          reps: c.reps,
          dueDate: c.dueDate.toISOString(),
          starred: c.starred,
        }))}
      />
    </div>
  );
}
