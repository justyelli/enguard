import Link from "next/link";
import type { WeeklyInsight as Insight } from "@/lib/coach";

export default function WeeklyInsight({ insight }: { insight: Insight }) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-[0_6px_20px_-12px_rgba(80,60,20,0.4)] sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">🧭 Совет недели</h2>
        <span className="text-xs text-muted">{insight.activeDays}/7 активных дней</span>
      </div>
      <p className="mt-1 font-display text-xl font-bold text-primary">{insight.headline}</p>

      {insight.wins.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {insight.wins.map((w, i) => (
            <span
              key={i}
              className="rounded-lg bg-success/10 px-2.5 py-1 text-xs font-bold text-success"
            >
              {w}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-accent/40 bg-accent/5 p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-accent">
          Фокус недели
        </div>
        <div className="mt-0.5 font-display font-bold">{insight.focusTitle}</div>
        <p className="mt-1 text-sm text-muted">{insight.focusWhy}</p>
        <p className="mt-2 text-sm">{insight.focusAction}</p>
        <Link
          href={insight.focusHref}
          className="btn3d mt-3 inline-block bg-primary px-4 py-2 text-sm text-white"
        >
          Взяться →
        </Link>
      </div>
    </section>
  );
}
