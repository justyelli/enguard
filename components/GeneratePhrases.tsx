"use client";

import { useState } from "react";

const BANDS = ["A2", "B1", "B2", "C1"];

// AI-генерация лексических чанков: устойчивых сочетаний и фразовых глаголов —
// главного двигателя беглости на B2→C1. Кладёт их в отдельные коллекции (SRS).
export default function GeneratePhrases() {
  const [band, setBand] = useState("B2");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function gen(kind: "collocations" | "phrasals") {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch("/api/vocab/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ band, kind, count: 10 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ошибка");
      if (d.ai === false) {
        setMsg("Нужен ключ OpenAI для подбора.");
        return;
      }
      if (d.added === 0) {
        setMsg("Новых не нашлось — попробуй другой уровень.");
        return;
      }
      const what = kind === "phrasals" ? "фразовых глаголов" : "сочетаний";
      setMsg(`✓ Добавлено ${d.added} ${what} (${band}) в карточки — учи их в «Коллекциях».`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">🔗 Фразы для беглости</h2>
      <p className="mt-1 text-sm text-muted">
        На пути к C1 беглость даёт не запас одиночных слов, а <b>чанки</b> — устойчивые
        сочетания (<i>make a decision</i>) и фразовые глаголы (<i>come across</i>). Подберу
        порцию под уровень — они уйдут в отдельные коллекции и в повторение.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Уровень:</span>
        {BANDS.map((b) => (
          <button
            key={b}
            onClick={() => setBand(b)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${
              band === b ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:bg-background"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => gen("collocations")}
          disabled={!!busy}
          className="btn3d bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy === "collocations" ? "Подбираю…" : "✨ Сочетания"}
        </button>
        <button
          onClick={() => gen("phrasals")}
          disabled={!!busy}
          className="btn3d bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy === "phrasals" ? "Подбираю…" : "✨ Фразовые глаголы"}
        </button>
      </div>

      {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
    </section>
  );
}
