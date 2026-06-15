"use client";

import { useCallback, useEffect, useState } from "react";

type Profile = {
  totalXp: number;
  todayXp: number;
  dailyGoalXp: number;
  streak: number;
  longestStreak: number;
  activeToday: boolean;
  gems: number;
  freezes: number;
  boost2: number;
  boost3: number;
  boostMult: number;
  boostSecondsLeft: number;
};
type Level = { cefr: string; next: string | null; pct: number; toNext: number; intoLevel: number; levelSpan: number };

const CEFR = ["A1", "A2", "B1", "B2", "C1"];
const GOALS = [20, 30, 50, 80, 120];

function refreshHud() {
  try {
    window.dispatchEvent(new CustomEvent("enguard:xp"));
  } catch {
    /* игнор */
  }
}

function Ring({ pct, today, goal }: { pct: number; today: number; goal: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const done = pct >= 100;
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={done ? "var(--success)" : "var(--xp)"}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (Math.min(100, pct) / 100) * c}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="55" textAnchor="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 800 }}>
        {today}
      </text>
      <text x="60" y="74" textAnchor="middle" className="fill-muted" style={{ fontSize: 11 }}>
        из {goal} XP
      </text>
    </svg>
  );
}

export default function GameDashboard() {
  const [p, setP] = useState<Profile | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/profile", { cache: "no-store" });
    const data = await res.json();
    setP(data.profile);
    setLevel(data.level);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(url: string, body: object, okMsg?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      if (okMsg) setMsg(okMsg);
      await load();
      refreshHud();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!p || !level) {
    return <div className="h-48 animate-pulse rounded-3xl bg-surface" />;
  }

  const curIdx = CEFR.indexOf(level.cefr);
  const overall = Math.min(
    100,
    ((curIdx + (level.next ? level.pct / 100 : 1)) / (CEFR.length - 1)) * 100
  );
  const goalPct = Math.round((p.todayXp / Math.max(1, p.dailyGoalXp)) * 100);
  const boostActive = p.boostMult > 1 && p.boostSecondsLeft > 0;

  return (
    <div className="space-y-4">
      {/* Цель дня + путь до C1 */}
      <section className="rounded-3xl border border-border bg-surface p-5 shadow-[0_6px_20px_-12px_rgba(80,60,20,0.4)] sm:p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
          <div className="relative shrink-0">
            <Ring pct={goalPct} today={p.todayXp} goal={p.dailyGoalXp} />
          </div>
          <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
            <div>
              <div className="text-sm text-muted">Цель на сегодня</div>
              <div className="font-display text-xl font-bold">
                {goalPct >= 100 ? "Цель выполнена! 🎉 +10 💎" : `Ещё ${Math.max(0, p.dailyGoalXp - p.todayXp)} XP до цели`}
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => act("/api/profile/goal", { goalXp: g }, `Цель: ${g} XP в день`)}
                  disabled={busy}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                    p.dailyGoalXp === g
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:bg-background"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* путь до C1 */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-display font-bold">Путь до C1</span>
            <span className="text-muted">
              {level.next ? `${level.toNext} XP до ${level.next}` : "Максимум достигнут!"}
            </span>
          </div>
          <div className="relative">
            <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border" />
            <div
              className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
              style={{ width: `${overall}%`, backgroundColor: "var(--primary)" }}
            />
            <div className="relative flex justify-between">
              {CEFR.map((c, i) => {
                const reached = i <= curIdx;
                return (
                  <div key={c} className="flex flex-col items-center gap-1">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${
                        reached
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-surface text-muted"
                      }`}
                    >
                      {c === level.cefr ? "📍" : reached ? "✓" : ""}
                    </div>
                    <span className={`text-xs font-bold ${reached ? "text-foreground" : "text-muted"}`}>{c}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Серия + Бусты */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* серия */}
        <section className="rounded-3xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className={`text-4xl ${p.activeToday ? "" : "grayscale"}`}>🔥</div>
            <div>
              <div className="font-display text-2xl font-bold" style={{ color: "var(--streak)" }}>
                {p.streak} {p.streak === 1 ? "день" : "дней"}
              </div>
              <div className="text-xs text-muted">рекорд: {p.longestStreak}</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">
            {p.activeToday
              ? "Серия в безопасности на сегодня 👍"
              : "Позанимайся сегодня, чтобы не потерять серию!"}
          </p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-background p-3">
            <span className="text-sm">
              ❄️ Заморозки: <b>{p.freezes}</b>/2
              <span className="block text-xs text-muted">спасают серию при пропуске</span>
            </span>
            <button
              onClick={() => act("/api/profile/shop", { item: "freeze" }, "Заморозка куплена ❄️")}
              disabled={busy || p.freezes >= 2 || p.gems < 50}
              className="btn3d bg-gem px-3 py-2 text-xs text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--gem)", boxShadow: "0 4px 0 0 color-mix(in srgb, var(--gem) 70%, black)" }}
            >
              Купить · 50 💎
            </button>
          </div>
        </section>

        {/* бусты */}
        <section className="rounded-3xl border border-border bg-surface p-5">
          <div className="font-display text-lg font-bold">⚡ Бусты XP</div>
          {boostActive ? (
            <p className="mt-1 text-sm font-bold text-accent">
              Активен {p.boostMult}x — лови момент!
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Удвой или утрой XP — но их мало, береги!</p>
          )}

          <div className="mt-3 space-y-2">
            <BoostRow
              label="2x на 15 мин"
              owned={p.boost2}
              onUse={() => act("/api/profile/boost", { kind: 2 }, "2x активирован! ⚡")}
              onBuy={() => act("/api/profile/shop", { item: "boost2" }, "Куплен 2x")}
              price={40}
              gems={p.gems}
              busy={busy || boostActive}
            />
            <BoostRow
              label="3x на 10 мин ✨"
              owned={p.boost3}
              onUse={() => act("/api/profile/boost", { kind: 3 }, "3x активирован! ✨")}
              onBuy={() => act("/api/profile/shop", { item: "boost3" }, "Куплен 3x")}
              price={100}
              gems={p.gems}
              busy={busy || boostActive}
              rare
            />
          </div>
          <p className="mt-2 text-xs text-muted">3x-жетон даётся за новый уровень CEFR.</p>
        </section>
      </div>

      {msg && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-center text-sm font-medium text-primary">
          {msg}
        </div>
      )}
    </div>
  );
}

function BoostRow({
  label,
  owned,
  onUse,
  onBuy,
  price,
  gems,
  busy,
  rare,
}: {
  label: string;
  owned: number;
  onUse: () => void;
  onBuy: () => void;
  price: number;
  gems: number;
  busy: boolean;
  rare?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl p-2.5 ${rare ? "bg-accent/10" : "bg-background"}`}>
      <span className="text-sm font-bold">
        {label}
        <span className="ml-1 font-normal text-muted">· у тебя {owned}</span>
      </span>
      <div className="flex gap-1.5">
        <button
          onClick={onUse}
          disabled={busy || owned <= 0}
          className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-40"
        >
          Включить
        </button>
        <button
          onClick={onBuy}
          disabled={busy || gems < price}
          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-muted hover:bg-background disabled:opacity-40"
        >
          {price} 💎
        </button>
      </div>
    </div>
  );
}
