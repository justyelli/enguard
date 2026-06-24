"use client";

import { useState } from "react";

// Кнопка добавления следующей порции core-слов уровня в SRS-карточки.
export default function AddVocab({
  band,
  remaining,
}: {
  band: string;
  remaining: number;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (remaining <= 0) {
    return (
      <span className="text-sm font-bold text-success">
        Все слова уровня в карточках ✓
      </span>
    );
  }

  async function add() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/vocab/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ band, count: 10 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка");
      setMsg(`Добавлено ${d.added} в карточки — обновляю…`);
      // перечитываем серверный прогресс
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
        disabled={busy}
        className="btn3d bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Добавляю…" : `+ ${Math.min(10, remaining)} в карточки`}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
