import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BookCard from "@/components/BookCard";

export const dynamic = "force-dynamic";

export default async function BooksPage() {
  const books = await prisma.book.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { chapters: true } },
      progress: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">📖 Библиотека</h1>
        <Link
          href="/books/new"
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          + Добавить книгу
        </Link>
      </div>

      {books.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted">
          Пока нет книг. Нажми «Добавить книгу» и вставь текст — например главу
          из любимой книги на английском.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {books.map((b) => (
            <BookCard
              key={b.id}
              id={b.id}
              title={b.title}
              author={b.author}
              chapters={b._count.chapters}
              currentChapter={b.progress?.chapterIndex ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
