import Link from "next/link";
import type { TodayPlan } from "@/lib/studyplan";

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

export default function TodayPlan({ plan }: { plan: TodayPlan }) {
  const pct = Math.round((plan.doneMinutes / Math.max(1, plan.totalMinutes)) * 100);

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
        {plan.blocks.map((b, i) => (
          <li key={b.key}>
            <Link
              href={b.href}
              className={`group flex items-center gap-3 rounded-2xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${
                b.done
                  ? "border-success/40 bg-success/5"
                  : b.focus
                    ? "border-accent/50 bg-accent/5"
                    : "border-border bg-background"
              }`}
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
        ))}
      </ol>

      <p className="mt-3 text-center text-xs text-muted">
        Порядок не случаен: сложное и повторение — пока внимание свежее. Делай по
        силам, но старайся закрывать все каналы — баланс важнее объёма.
      </p>
    </section>
  );
}
