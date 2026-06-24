"use client";

import { useState } from "react";

// Кнопка генерации мнемоники для трудного слова (показывает подсказку под словом).
export default function LeechHook({
  word,
  translation,
}: {
  word: string;
  translation: string;
}) {
  const [hook, setHook] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function gen() {
    setBusy(true);
    try {
      const res = await fetch("/api/leeches/hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, translation }),
      });
      const d = await res.json();
      setHook(typeof d.hook === "string" && d.hook ? d.hook : "Не удалось придумать подсказку.");
    } catch {
      setHook("Ошибка. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  if (hook) {
    return (
      <div className="mt-2 rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm">
        <span className="font-bold text-accent">💡 </span>
        {hook}
        <button
          onClick={gen}
          disabled={busy}
          className="ml-2 text-xs text-muted underline hover:text-foreground disabled:opacity-50"
        >
          {busy ? "…" : "другая"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={gen}
      disabled={busy}
      className="mt-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-primary hover:bg-background disabled:opacity-50"
    >
      {busy ? "Придумываю…" : "💡 Подсказка для запоминания"}
    </button>
  );
}
