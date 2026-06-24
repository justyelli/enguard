import Link from "next/link";
import { getJourney, recommendGoal, type JourneyStatus } from "@/lib/progress";

export const dynamic = "force-dynamic";

const STATUS: Record<JourneyStatus, { label: string; color: string; bg: string }> = {
  ahead: { label: "Опережаешь график 🚀", color: "var(--success)", bg: "var(--success)" },
  ontrack: { label: "Идёшь по графику ✅", color: "var(--primary)", bg: "var(--primary)" },
  behind: { label: "Отстаёшь от графика ⏳", color: "var(--accent)", bg: "var(--accent)" },
  reached: { label: "Цель C1 достигнута! 🏆", color: "var(--success)", bg: "var(--success)" },
  nodata: { label: "Нужно больше занятий для прогноза", color: "var(--muted)", bg: "var(--muted)" },
};

function fmtDate(day: string): string {
  // day = YYYY-MM-DD → DD.MM.YYYY
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

export default async function PathPage() {
  const j = await getJourney();
  const st = STATUS[j.status];
  const progressPct = Math.min(100, Math.round((j.totalXp / j.targetXp) * 100));
  const programPct = Math.min(100, Math.round((j.dayNumber / j.programDays) * 100));
  const paceBar = Math.min(100, j.onTrackPct);
  const recommended = recommendGoal(j.neededPerDay);

  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            🧭 Путь к C1
          </h1>
          <p className="text-muted">
            За 3 месяца (90 дней) по 2-3 часа в день — реально, если держать темп.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-bold text-primary">
            День {j.dayNumber}
          </div>
          <div className="text-xs text-muted">из {j.programDays}</div>
        </div>
      </section>

      {/* Статус + прогноз */}
      <section
        className="rounded-3xl border p-5 sm:p-6"
        style={{ borderColor: st.color, backgroundColor: `color-mix(in srgb, ${st.bg} 7%, var(--surface))` }}
      >
        <div className="font-display text-xl font-bold" style={{ color: st.color }}>
          {st.label}
        </div>

        {j.status !== "reached" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Metric
              label="Твой темп"
              value={`${j.pacePerDay}`}
              unit="XP/день"
              hint="оценка за 14 дней"
            />
            <Metric
              label="Нужно держать"
              value={`${j.neededPerDay}`}
              unit="XP/день"
              hint={`чтобы успеть к C1 за ${j.daysLeft} дн.`}
              accent
            />
            <Metric
              label="Прогноз выхода на C1"
              value={j.projectedDate ? fmtDate(j.projectedDate) : "—"}
              unit={j.projectedDayNumber ? `день ${j.projectedDayNumber}` : "начни заниматься"}
              hint="при текущем темпе"
            />
          </div>
        )}

        {/* индикатор темпа vs норматива */}
        {j.status !== "reached" && j.status !== "nodata" && (
          <div className="mt-5">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Темп к нормативу</span>
              <span style={{ color: st.color }}>{j.onTrackPct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${paceBar}%`, backgroundColor: st.bg }}
              />
            </div>
            {j.status === "behind" && (
              <p className="mt-2 text-sm text-muted">
                Чтобы войти в график, подними дневную цель примерно до{" "}
                <b className="text-accent">{recommended} XP</b> и закрывай «План на
                сегодня» полностью.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Два прогресс-бара: по XP и по календарю */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-surface p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-display font-bold">Прогресс к C1</span>
            <span className="text-sm text-muted">{progressPct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full"
              style={{ width: `${progressPct}%`, backgroundColor: "var(--xp)" }}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            {j.totalXp.toLocaleString("ru")} / {j.targetXp.toLocaleString("ru")} XP
            {j.xpLeft > 0 ? ` · осталось ${j.xpLeft.toLocaleString("ru")}` : ""}
          </p>
        </div>
        <div className="rounded-3xl border border-border bg-surface p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-display font-bold">Время программы</span>
            <span className="text-sm text-muted">{programPct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full"
              style={{ width: `${programPct}%`, backgroundColor: "var(--primary)" }}
            />
          </div>
          <p className="mt-2 text-sm text-muted">
            Прошло {j.dayNumber - 1} дн. · осталось {j.daysLeft} дн.
          </p>
        </div>
      </section>

      {/* Майлстоуны CEFR */}
      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-bold">Ступени CEFR</h2>
        <ol className="space-y-2">
          {j.milestones.map((m) => (
            <li
              key={m.cefr}
              className={`flex items-center gap-3 rounded-2xl border p-3 ${
                m.current
                  ? "border-primary bg-primary/5"
                  : m.reached
                    ? "border-success/30 bg-success/5"
                    : "border-border bg-background"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  m.reached
                    ? "bg-success text-white"
                    : m.current
                      ? "bg-primary text-white"
                      : "border-2 border-border bg-surface text-muted"
                }`}
              >
                {m.reached ? "✓" : m.current ? "📍" : ""}
              </div>
              <div className="flex-1">
                <span className="font-display font-bold">{m.cefr}</span>
                <span className="ml-2 text-xs text-muted">
                  {m.xp.toLocaleString("ru")} XP
                </span>
              </div>
              <div className="shrink-0 text-right text-xs">
                {m.reached ? (
                  <span className="font-bold text-success">пройдено</span>
                ) : m.daysAtPace != null ? (
                  <span className="text-muted">
                    ~{m.daysAtPace} дн. при темпе
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-center text-xs text-muted">
        Прогноз считается по темпу набора XP за последние 2 недели и помогает
        планировать нагрузку. Это ориентир усилий, а не замер реальной речевой
        компетенции — её растят регулярные занятия по всем навыкам.
      </p>

      <div className="text-center">
        <Link
          href="/"
          className="btn3d inline-block bg-primary px-6 py-3 text-white"
        >
          К плану на сегодня →
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  hint,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-surface/60 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-display text-2xl font-bold ${accent ? "text-accent" : ""}`}>
        {value}
      </div>
      <div className="text-xs font-medium text-muted">{unit}</div>
      <div className="mt-0.5 text-[11px] text-muted">{hint}</div>
    </div>
  );
}
