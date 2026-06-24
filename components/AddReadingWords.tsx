"use client";

import { useState } from "react";

type W = { word: string; translation: string; context: string };

// Кнопка: превратить все показанные слова из чтения в карточки с контекстом.
export default function AddReadingWords({ words }: { words: W[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reading/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка");
      setMsg(`Добавлено ${d.added} — обновляю…`);
      window.location.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={add}
        disabled={busy || words.length === 0}
        className="btn3d bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Добавляю…" : `+ ${words.length} в карточки`}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
