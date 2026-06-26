"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TodayPlan } from "@/lib/studyplan";

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

const BUDGETS: { label: string; v: number | null }[] = [
  { label: "1 ч", v: 60 },
  { label: "2 ч", v: 120 },
  { label: "Всё", v: null },
];

const STORAGE_KEY = "enguard:planBudget";

export default function TodayPlan({ plan }: { plan: TodayPlan }) {
  // null = весь план (поведение по умолчанию). Иначе — лимит минут на сегодня.
  const [budget, setBudget] = useState<number | null>(null);

  // читаем сохранённый выбор после монтирования (без рассинхрона гидратации)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "60" || raw === "120") setBudget(Number(raw));
      else if (raw === "all") setBudget(null);
    } catch {
      /* игнор */
    }
  }, []);

  function pickBudget(v: number | null) {
    setBudget(v);
    try {
      localStorage.setItem(STORAGE_KEY, v === null ? "all" : String(v));
    } catch {
      /* игнор */
    }
  }

  const pct = Math.round((plan.doneMinutes / Math.max(1, plan.totalMinutes)) * 100);

  // Какие шаги в приоритете при выбранном бюджете: блоки уже упорядочены по
  // важности, поэтому берём префикс, который целиком влезает в лимит (минимум
  // один шаг). Граничный блок не включаем, чтобы не переполнять бюджет.
  let acc = 0;
  let stopped = false;
  const inBudget = plan.blocks.map((b, i) => {
    if (budget === null) return true;
    if (stopped) return false;
    if (i === 0 || acc + b.minutes <= budget) {
      acc += b.minutes;
      return true;
    }
    stopped = true;
    return false;
  });
  const coreMinutes = acc;
  const coreCount = inBudget.filter(Boolean).length;
  const trimmed = budget !== null && coreCount < plan.blocks.length;

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-[0_6px_20px_-12px_rgba(80,60,20,0.4)] sm:p-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">🗺️ План на сегодня</h2>
          <p className="text-sm text-muted">
            Сбалансированный день для пути {plan.cefr}
            {plan.next ? `→${plan.next}` : ""} · ~{fmtMinutes(plan.totalMinutes)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-bold text-primary">
            {plan.doneCount}/{plan.blocks.length}
          </div>
          <div className="text-xs text-muted">шагов</div>
        </div>
      </div>

      {/* выбор времени на сегодня */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Сегодня у меня:</span>
        {BUDGETS.map((b) => (
          <button
            key={b.label}
            onClick={() => pickBudget(b.v)}
            className={`rounded-lg border px-3 py-1 text-sm font-bold ${
              budget === b.v
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:bg-background"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {trimmed && (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-muted">
          Мало времени? Сделай первые <b className="text-foreground">{coreCount}</b>{" "}
          {coreCount === 1 ? "шаг" : "шага"} (~{fmtMinutes(coreMinutes)}) — это самое
          важное. Остальное — если останется время.
        </div>
      )}

      {/* общий прогресс по времени */}
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: plan.allDone ? "var(--success)" : "var(--primary)",
          }}
        />
      </div>

      {plan.allDone && (
        <div className="mb-4 rounded-xl border border-success/40 bg-success/10 px-4 py-2.5 text-center text-sm font-bold text-success">
          🎉 Полный день закрыт! Именно из таких дней и складывается C1.
        </div>
      )}

      <ol className="space-y-2.5">
        {plan.blocks.map((b, i) => {
          const later = !inBudget[i] && !b.done;
          return (
            <li key={b.key}>
              <Link
                href={b.href}
                className={`group flex items-center gap-3 rounded-2xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${
                  b.done
                    ? "border-success/40 bg-success/5"
                    : b.focus
                      ? "border-accent/50 bg-accent/5"
                      : "border-border bg-background"
                } ${later ? "opacity-55" : ""}`}
              >
                {/* статус-кружок с номером шага */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    b.done
                      ? "bg-success text-white"
                      : "border-2 border-border bg-surface text-muted"
                  }`}
                >
                  {b.done ? "✓" : i + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-display font-bold">
                      {b.icon} {b.title}
                    </span>
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted">
                      {b.tech}
                    </span>
                    {b.focus && !b.done && (
                      <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] font-bold text-accent">
                        ⭐ фокус дня
                      </span>
                    )}
                    {later && (
                      <span className="rounded-md bg-background px-1.5 py-0.5 text-[11px] font-bold text-muted">
                        потом
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{b.why}</p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className="text-xs font-bold text-muted">{b.minutes} мин</span>
                  {b.progress && (
                    <span className="text-[11px] text-muted">{b.progress}</span>
                  )}
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                      b.done
                        ? "text-success"
                        : "bg-primary text-white group-hover:bg-primary-hover"
                    }`}
                  >
                    {b.done ? "готово" : b.cta}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-center text-xs text-muted">
        Порядок не случаен: сложное и повторение — пока внимание свежее. Делай по
        силам, но старайся закрывать все каналы — баланс важнее объёма.
      </p>
    </section>
  );
}
