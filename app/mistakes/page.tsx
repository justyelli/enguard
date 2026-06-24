"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Mistake = {
  id: number;
  source: string;
  wrong: string;
  correct: string;
  note: string | null;
  category: string | null;
  reps: number;
};

const SOURCE_LABEL: Record<string, string> = {
  writing: "✍️ из письма",
  tutor: "💬 от репетитора",
  grammar: "📐 из грамматики",
};

export default function MistakesPage() {
  const [list, setList] = useState<Mistake[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fixedCount, setFixedCount] = useState(0);

  useEffect(() => {
    fetch("/api/mistakes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setList(Array.isArray(d.mistakes) ? d.mistakes : []))
      .catch(() => setList([]));
  }, []);

  async function grade(correct: boolean) {
    if (!list) return;
    const m = list[idx];
    setBusy(true);
    try {
      await fetch("/api/mistakes/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, correct }),
      });
      if (correct) {
        setFixedCount((c) => c + 1);
        window.dispatchEvent(new CustomEvent("enguard:xp"));
      }
    } catch {
      /* игнор — не блокируем поток */
    } finally {
      setBusy(false);
      setIdx((i) => i + 1);
      setTyped("");
      setRevealed(false);
    }
  }

  // загрузка
  if (!list) {
    return <div className="mx-auto h-64 max-w-md animate-pulse rounded-3xl bg-surface" />;
  }

  // пусто или сессия завершена
  if (list.length === 0 || idx >= list.length) {
    const clean = list.length === 0;
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="text-6xl">{clean ? "✨" : "💪"}</div>
        <h1 className="font-display text-2xl font-bold">
          {clean ? "Журнал ошибок пуст" : "Сессия завершена!"}
        </h1>
        <p className="text-muted">
          {clean
            ? "Ошибки появляются автоматически из проверки письма, диалогов с репетитором и грамматических квизов. Занимайся — а я помогу проработать слабые места."
            : `Проработано верно: ${fixedCount} из ${list.length}. Те, что остались, вернутся в следующий раз.`}
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/practice" className="btn3d bg-primary px-6 py-3 text-white">
            К практике
          </Link>
          <Link href="/" className="rounded-xl border border-border px-6 py-3 font-bold text-muted hover:bg-surface">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  const m = list[idx];
  const progress = Math.round((idx / list.length) * 100);

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-display font-bold">🛠️ Работа над ошибками</span>
          <span className="text-muted">
            {idx + 1} / {list.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted">
          <span className="rounded-md bg-background px-2 py-0.5 font-medium">
            {SOURCE_LABEL[m.source] ?? m.source}
          </span>
          {m.category && <span>· {m.category}</span>}
        </div>

        <div className="text-xs text-muted">Так было (с ошибкой):</div>
        <div className="mt-1 rounded-xl bg-danger/10 px-3 py-2 text-danger line-through decoration-danger/50">
          {m.wrong}
        </div>

        {!revealed ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium">Как правильно? Вспомни и проверь себя:</label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="off"
              placeholder="Напиши правильный вариант (по желанию)…"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
            />
            <button
              onClick={() => setRevealed(true)}
              className="btn3d w-full bg-primary py-3 text-white"
            >
              Показать правильный вариант
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="text-xs text-muted">Правильно:</div>
            <div className="rounded-xl bg-success/10 px-3 py-2 font-medium text-success">
              {m.correct}
            </div>
            {m.note && <p className="text-sm text-muted">{m.note}</p>}

            <div className="text-center text-sm font-medium">Вспомнил без подсказки?</div>
            <div className="flex gap-2">
              <button
                onClick={() => grade(false)}
                disabled={busy}
                className="flex-1 rounded-xl border-2 border-border py-3 font-bold text-muted hover:bg-background disabled:opacity-50"
              >
                Ещё разок
              </button>
              <button
                onClick={() => grade(true)}
                disabled={busy}
                className="btn3d flex-1 bg-success py-3 font-bold text-white disabled:opacity-50"
                style={{ boxShadow: "0 4px 0 0 color-mix(in srgb, var(--success) 70%, black)" }}
              >
                Вспомнил ✓
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted">
        Ошибка уходит из журнала после двух верных повторов. Возвращаемся к слабым
        местам, пока они не закрепятся — так растёт точность речи.
      </p>
    </div>
  );
}
