"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkbookData } from "@/lib/workbook";

export default function WorkbookView({
  initial,
}: {
  initial: { data: WorkbookData; completed: boolean } | null;
}) {
  const router = useRouter();
  const [data, setData] = useState<WorkbookData | null>(initial?.data ?? null);
  const [completed, setCompleted] = useState(initial?.completed ?? false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(regenerate = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/workbook/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка");
      setData(json.data);
      setCompleted(json.completed);
      setShowAnswers(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  async function toggleComplete() {
    const next = !completed;
    setCompleted(next);
    await fetch("/api/workbook/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: next }),
    });
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="mb-4 text-muted">
            Воркбук на сегодня ещё не создан. Я составлю персональный лист по
            словам, которые ты читал, переводил и повторял.
          </p>
          <button
            onClick={() => generate(false)}
            disabled={loading}
            className="rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {loading ? "Составляю…" : "📝 Создать воркбук на сегодня"}
          </button>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Управление — не печатается */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Header />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            🖨 Печать / PDF
          </button>
          <button
            onClick={() => setShowAnswers((s) => !s)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            {showAnswers ? "Скрыть ответы" : "✓ Показать ответы"}
          </button>
          <button
            onClick={toggleComplete}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              completed
                ? "bg-success/15 text-success"
                : "border border-border hover:bg-surface"
            }`}
          >
            {completed ? "✓ Выполнено" : "Отметить выполненным"}
          </button>
          <button
            onClick={() => generate(true)}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
            title="Составить заново"
            aria-label="Составить воркбук заново"
          >
            ♻
          </button>
        </div>
      </div>

      {error && <p className="no-print text-sm text-danger">{error}</p>}

      {/* Печатный лист A4 */}
      <div className="print-sheet mx-auto max-w-[800px] rounded-xl border border-border bg-white p-4 text-black shadow-sm sm:p-8">
        <div className="mb-1 flex items-baseline justify-between border-b-2 border-black pb-2">
          <h2 className="text-xl font-bold">{data.title}</h2>
          <span className="text-sm">{data.day}</span>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Имя: __________________   ·   Enguard — рабочий лист дня
        </p>

        <div className="workbook-cols">
          {data.sections.map((sec, si) => (
            <section key={si} className="workbook-section mb-4 break-inside-avoid">
              <h3 className="font-semibold">{sec.title}</h3>
              <p className="mb-1.5 text-sm text-gray-600">{sec.instruction}</p>
              <ol className="space-y-1">
                {sec.items.map((item, ii) => (
                  <li key={ii} className="workbook-item flex gap-1.5 text-sm">
                    <span className="text-gray-400">{ii + 1}.</span>
                    <span className="flex-1">
                      {item.q}
                      {!showAnswers && (
                        <span className="ml-2 inline-block min-w-20 border-b border-dotted border-gray-400">
                          &nbsp;
                        </span>
                      )}
                      {showAnswers && (
                        <span className="ml-2 font-medium text-green-700">
                          {item.a}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>

      <p className="no-print text-center text-xs text-muted">
        Распечатай лист, выполни на бумаге, затем нажми «Показать ответы» и
        сверься.
      </p>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold">📅 Воркбук дня</h1>
      <p className="text-sm text-muted">
        Персональный лист заданий по твоим словам.
      </p>
    </div>
  );
}
