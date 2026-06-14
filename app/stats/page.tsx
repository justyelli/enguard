import Link from "next/link";
import { getDailySeries, getDailyStats, type DayPoint } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function BarChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.reviews));
  const W = 720;
  const H = 160;
  const pad = 20;
  const bw = (W - pad * 2) / data.length;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Повторы по дням"
    >
      {data.map((d, i) => {
        const x = pad + i * bw;
        const total = (d.reviews / max) * (H - pad * 2);
        const correct = d.reviews ? (d.correct / d.reviews) * total : 0;
        const y = H - pad - total;
        return (
          <g key={d.day}>
            <rect
              x={x + bw * 0.15}
              y={y}
              width={bw * 0.7}
              height={total}
              rx={2}
              fill="var(--border)"
            />
            <rect
              x={x + bw * 0.15}
              y={H - pad - correct}
              width={bw * 0.7}
              height={correct}
              rx={2}
              fill="var(--success)"
            />
          </g>
        );
      })}
      <line
        x1={pad}
        y1={H - pad}
        x2={W - pad}
        y2={H - pad}
        stroke="var(--border)"
        strokeWidth={1}
      />
    </svg>
  );
}

function Heatmap({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.reviews + d.lookups));
  function shade(v: number) {
    if (v === 0) return "var(--border)";
    const t = Math.min(1, v / max);
    if (t < 0.25) return "color-mix(in srgb, var(--primary) 25%, var(--border))";
    if (t < 0.5) return "color-mix(in srgb, var(--primary) 50%, transparent)";
    if (t < 0.75) return "color-mix(in srgb, var(--primary) 75%, transparent)";
    return "var(--primary)";
  }
  return (
    <div className="flex flex-wrap gap-1">
      {data.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.reviews} повторов, ${d.lookups} переводов`}
          className="h-5 w-5 rounded"
          style={{ backgroundColor: shade(d.reviews + d.lookups) }}
        />
      ))}
    </div>
  );
}

export default async function StatsPage() {
  const [series, stats] = await Promise.all([
    getDailySeries(30),
    getDailyStats(),
  ]);

  const totalReviews = series.reduce((s, d) => s + d.reviews, 0);
  const totalLookups = series.reduce((s, d) => s + d.lookups, 0);

  const cards = [
    { label: "🔥 Серия дней", value: stats.streak },
    { label: "Повторов за 30 дней", value: totalReviews },
    { label: "Переводов за 30 дней", value: totalLookups },
    { label: "Точность сегодня", value: `${stats.accuracyToday}%` },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">📊 Статистика</h1>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← На главную
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-muted">{c.label}</div>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-semibold">Повторы по дням (30 дней)</h2>
        <p className="text-xs text-muted">
          Зелёным — верные ответы, серым — всего.
        </p>
        <BarChart data={series} />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-semibold">Активность</h2>
        <p className="text-xs text-muted">Повторы + переводы по дням.</p>
        <Heatmap data={series} />
      </section>
    </div>
  );
}
