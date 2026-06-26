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

      <Link
        href="/reading"
        className="flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div>
          <div className="font-display font-bold">📄 Текст по уровню</div>
          <div className="text-sm text-muted">
            Нет книги нужной сложности? Сгенерирую короткий текст точно под твой уровень —
            читай с переводом по клику.
          </div>
        </div>
        <span className="btn3d shrink-0 bg-primary px-4 py-2 text-sm text-white">Открыть</span>
      </Link>

      {books.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted">
          Пока нет своих книг — добавь текст кнопкой выше или начни с «Текста по уровню»,
          который подберётся под твою сложность.
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
