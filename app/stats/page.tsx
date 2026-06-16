import Link from "next/link";
import {
  getDailySeries,
  getPracticeSummary,
  type DayPoint,
} from "@/lib/analytics";
import { getAchievements } from "@/lib/achievements";
import { getProfile } from "@/lib/gamify";

export const dynamic = "force-dynamic";

const SKILL_META: Record<string, { icon: string; label: string }> = {
  listening: { icon: "🎧", label: "Аудирование" },
  speaking: { icon: "🗣️", label: "Говорение" },
  writing: { icon: "✍️", label: "Письмо" },
  grammar: { icon: "📐", label: "Грамматика" },
};

function BarChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.reviews));
  const W = 720;
  const H = 160;
  const pad = 20;
  const bw = (W - pad * 2) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Повторы по дням">
      {data.map((d, i) => {
        const x = pad + i * bw;
        const total = (d.reviews / max) * (H - pad * 2);
        const correct = d.reviews ? (d.correct / d.reviews) * total : 0;
        return (
          <g key={d.day}>
            <rect x={x + bw * 0.15} y={H - pad - total} width={bw * 0.7} height={total} rx={2} fill="var(--border)" />
            <rect x={x + bw * 0.15} y={H - pad - correct} width={bw * 0.7} height={correct} rx={2} fill="var(--success)" />
          </g>
        );
      })}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--border)" strokeWidth={1} />
    </svg>
  );
}

function Calendar({ data }: { data: DayPoint[] }) {
  const val = (d: DayPoint) => d.reviews + d.lookups + d.practice;
  const max = Math.max(1, ...data.map(val));
  function shade(v: number) {
    if (v === 0) return "var(--border)";
    const t = Math.min(1, v / max);
    if (t < 0.25) return "color-mix(in srgb, var(--primary) 30%, var(--border))";
    if (t < 0.5) return "color-mix(in srgb, var(--primary) 55%, transparent)";
    if (t < 0.75) return "color-mix(in srgb, var(--primary) 78%, transparent)";
    return "var(--primary)";
  }
  // выравнивание по понедельнику
  const firstDow = (new Date(data[0].day + "T00:00:00").getDay() + 6) % 7;
  const pad = Array.from({ length: firstDow }, () => null);
  const cells: (DayPoint | null)[] = [...pad, ...data];

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ width: "max-content" }}>
        {cells.map((c, i) =>
          c ? (
            <div
              key={c.day}
              title={`${c.day}: ${c.reviews} повт., ${c.lookups} перев., ${c.practice} практ.`}
              className="h-3.5 w-3.5 rounded-sm"
              style={{ backgroundColor: shade(val(c)) }}
            />
          ) : (
            <div key={`p${i}`} className="h-3.5 w-3.5" />
          )
        )}
      </div>
    </div>
  );
}

export default async function StatsPage() {
  const [series, skills, achievements, profile] = await Promise.all([
    getDailySeries(84),
    getPracticeSummary(),
    getAchievements(),
    getProfile(),
  ]);

  const last30 = series.slice(-30);
  const totalReviews = last30.reduce((s, d) => s + d.reviews, 0);
  const totalLookups = last30.reduce((s, d) => s + d.lookups, 0);
  const totalLevels = achievements.reduce((s, a) => s + a.level, 0);

  const cards = [
    { label: "🔥 Серия дней", value: profile.streak },
    { label: "Повторов за 30 дней", value: totalReviews },
    { label: "Переводов за 30 дней", value: totalLookups },
    { label: "🏅 Уровней ачивок", value: totalLevels },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold sm:text-2xl">📊 Статистика</h1>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← На главную
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-surface p-4">
            <div className="font-display text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-muted">{c.label}</div>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-display font-bold">Календарь активности</h2>
        <p className="text-xs text-muted">Повторы + переводы + практика за 12 недель.</p>
        <Calendar data={series} />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-display font-bold">Повторы по дням (30 дней)</h2>
        <p className="text-xs text-muted">Зелёным — верные ответы, серым — всего.</p>
        <BarChart data={last30} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-bold">🏅 Достижения</h2>
        <p className="text-xs text-muted">Каждое — многоуровневое: дойди до следующего порога, чтобы поднять уровень.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {achievements.map((a) => {
            const pct = a.next
              ? Math.round(((a.value - a.base) / (a.next - a.base)) * 100)
              : 100;
            return (
              <div
                key={a.id}
                className={`rounded-2xl border p-4 ${
                  a.unlocked ? "border-primary/40 bg-primary/5" : "border-border bg-surface"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`text-3xl ${a.unlocked ? "" : "grayscale opacity-60"}`}>
                    {a.icon}
                  </div>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
                      a.unlocked ? "bg-primary text-white" : "bg-border text-muted"
                    }`}
                    title={`Уровень ${a.level} из ${a.maxLevel}`}
                  >
                    ур. {a.level}
                  </span>
                </div>
                <div className="mt-1 font-display text-sm font-bold">{a.title}</div>
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-muted">
                    {a.next
                      ? `${a.value} / ${a.next} ${a.unit}`
                      : `макс · ${a.value} ${a.unit}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-bold">Навыки (практика за 30 дней)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {skills.map((s) => {
            const meta = SKILL_META[s.skill];
            return (
              <div key={s.skill} className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-2xl">{meta.icon}</div>
                <div className="mt-1 text-sm font-medium">{meta.label}</div>
                <div className="text-xs text-muted">
                  {s.sessions > 0 ? `${s.sessions} занятий · ${s.avgScore}%` : "ещё не начато"}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
