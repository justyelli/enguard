"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmButton from "@/components/ConfirmButton";

export default function BookCard({
  id,
  title,
  author,
  chapters,
  currentChapter,
}: {
  id: number;
  title: string;
  author: string | null;
  chapters: number;
  currentChapter: number;
}) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    setRemoving(true);
    await fetch(`/api/books/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <Link
      href={`/books/${id}`}
      className={`group relative block rounded-xl border border-border bg-surface p-5 transition-all hover:border-primary hover:shadow-md ${
        removing ? "opacity-50" : ""
      }`}
    >
      <div className="absolute right-2 top-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
        <ConfirmButton onConfirm={remove} label={`Удалить книгу «${title}»`} />
      </div>
      <div className="pr-6 font-semibold">{title}</div>
      {author && <div className="text-sm text-muted">{author}</div>}
      <div className="mt-2 text-xs text-muted">
        {chapters} гл. · читаешь главу {currentChapter + 1}
      </div>
    </Link>
  );
}
