"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewBookPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EPUB
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadEpub(file: File) {
    setError(null);
    if (!/\.epub$/i.test(file.name)) {
      setError("Поддерживается только формат .epub");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/books/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
      router.push(`/books/${data.book.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !text.trim()) {
      setError("Заполни название и текст.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, author, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      router.push(`/books/${data.book.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Добавить книгу</h1>

      {/* Загрузка EPUB */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted">
          Загрузить файл EPUB
        </h2>
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) uploadEpub(f);
          }}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-surface hover:border-primary"
          }`}
        >
          {uploading ? (
            <div className="text-muted">Обрабатываю EPUB…</div>
          ) : (
            <>
              <div className="text-3xl">📚</div>
              <div className="mt-2 font-medium">
                Перетащи сюда .epub или нажми, чтобы выбрать
              </div>
              <div className="text-xs text-muted">
                Главы и название определятся автоматически
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".epub,application/epub+zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadEpub(f);
            }}
          />
        </div>
      </section>

      <div className="flex items-center gap-3 text-xs uppercase text-muted">
        <div className="h-px flex-1 bg-border" />
        или вставь текст вручную
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Ручная вставка */}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Название *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
            placeholder="Например: The Little Prince"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Автор</label>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
            placeholder="Необязательно"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Текст (на английском) *
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-primary"
            placeholder="Вставь текст книги или главы…"
          />
          <p className="mt-1 text-xs text-muted">
            Совет: чтобы разбить на главы, вставь между ними отдельную строку из
            трёх дефисов <code className="rounded bg-background px-1">---</code>.
          </p>
        </div>

        {error && <div className="text-sm text-danger">{error}</div>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? "Сохраняю…" : "Сохранить и читать"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/books")}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
