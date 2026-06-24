"use client";

import { useState } from "react";

// Кнопка AI-догенерации частотной лексики уровня (сверх курируемого ядра).
export default function GenerateVocab({ band }: { band: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function gen() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/vocab/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ band, count: 10 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка");
      if (d.ai === false) {
        setMsg("Нужен ключ OpenAI");
        setBusy(false);
        return;
      }
      if (d.added === 0) {
        setMsg("Новых не нашлось");
        setBusy(false);
        return;
      }
      setMsg(`+${d.added} — обновляю…`);
      window.location.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={gen}
        disabled={busy}
        className="rounded-lg border border-primary/50 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/5 disabled:opacity-50"
      >
        {busy ? "Подбираю…" : "✨ Ещё (AI)"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
