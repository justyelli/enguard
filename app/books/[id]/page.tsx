import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Reader from "@/components/Reader";
import { getKnownWordsMap } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function BookReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bookId = Number(id);
  if (!bookId) notFound();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      chapters: { orderBy: { index: "asc" } },
      progress: true,
    },
  });

  if (!book) notFound();

  const wordStatus = await getKnownWordsMap();

  return (
    <div className="space-y-4">
      <Link
        href="/books"
        className="no-print text-sm text-muted hover:text-foreground"
      >
        ← К библиотеке
      </Link>
      <Reader
        bookId={book.id}
        title={book.title}
        author={book.author}
        chapters={book.chapters.map((c) => ({
          index: c.index,
          title: c.title,
          content: c.content,
        }))}
        initialChapter={book.progress?.chapterIndex ?? 0}
        initialScroll={book.progress?.scrollPct ?? 0}
        wordStatus={wordStatus}
      />
    </div>
  );
}
