"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Card = {
  id: number;
  word: string;
  translation: string;
  example: string | null;
  reps: number;
  dueDate: string;
  starred: boolean;
};

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* игнор */
  }
}

function StatusBadge({ reps, dueDate }: { reps: number; dueDate: string }) {
  const due = new Date(dueDate).getTime() <= Date.now();
  if (reps === 0)
    return (
      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
        новое
      </span>
    );
  if (due)
    return (
      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
        повторить
      </span>
    );
  return (
    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-500/20 dark:text-green-300">
      выучено
    </span>
  );
}

export default function CardsTable({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [list, setList] = useState(cards);
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ word: "", translation: "", example: "" });

  async function remove(id: number) {
    setList((l) => l.filter((c) => c.id !== id));
    setConfirmId(null);
    await fetch(`/api/cards/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function star(id: number, value: boolean) {
    setList((l) => l.map((c) => (c.id === id ? { ...c, starred: value } : c)));
    await fetch(`/api/cards/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: value }),
    });
  }

  function startEdit(c: Card) {
    setEditId(c.id);
    setDraft({ word: c.word, translation: c.translation, example: c.example ?? "" });
  }

  async function saveEdit(id: number) {
    setList((l) =>
      l.map((c) =>
        c.id === id
          ? { ...c, word: draft.word, translation: draft.translation, example: draft.example }
          : c
      )
    );
    setEditId(null);
    await fetch(`/api/cards/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    router.refresh();
  }

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
        В коллекции пока нет карточек.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-border bg-surface p-3 sm:p-4"
        >
          {editId === c.id ? (
            <div className="space-y-2">
              <input
                value={draft.word}
                onChange={(e) => setDraft({ ...draft, word: e.target.value })}
                placeholder="Слово"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={draft.translation}
                onChange={(e) => setDraft({ ...draft, translation: e.target.value })}
                placeholder="Перевод"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <input
                value={draft.example}
                onChange={(e) => setDraft({ ...draft, example: e.target.value })}
                placeholder="Пример (необязательно)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(c.id)}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  Сохранить
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => star(c.id, !c.starred)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-background"
                title="Избранное"
              >
                {c.starred ? "⭐" : "☆"}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.word}</span>
                  <button
                    onClick={() => speak(c.word)}
                    className="text-muted hover:text-primary"
                    title="Озвучить"
                  >
                    🔊
                  </button>
                </div>
                <div className="truncate text-sm text-muted">{c.translation}</div>
              </div>
              <StatusBadge reps={c.reps} dueDate={c.dueDate} />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => startEdit(c)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-foreground"
                  title="Изменить"
                >
                  ✏️
                </button>
                {confirmId === c.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => remove(c.id)}
                      className="rounded-lg bg-danger px-2 py-1 text-xs font-medium text-white"
                    >
                      Удалить
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="rounded-lg border border-border px-2 py-1 text-xs"
                    >
                      Нет
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(c.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-danger"
                    title="Удалить"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
