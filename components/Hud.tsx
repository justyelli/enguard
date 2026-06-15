"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type Profile = {
  totalXp: number;
  todayXp: number;
  dailyGoalXp: number;
  streak: number;
  activeToday: boolean;
  gems: number;
  boost2: number;
  boost3: number;
  boostMult: number;
  boostSecondsLeft: number;
};
type Level = { cefr: string; next: string | null; pct: number; toNext: number };

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Hud() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [boostLeft, setBoostLeft] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = await res.json();
      setProfile(data.profile);
      setLevel(data.level);
      setBoostLeft(data.profile.boostSecondsLeft || 0);
    } catch {
      /* игнор */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    const onXp = () => load();
    const onFocus = () => load();
    window.addEventListener("enguard:xp", onXp);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("enguard:xp", onXp);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // отсчёт буста
  useEffect(() => {
    if (tick.current) clearInterval(tick.current);
    if (boostLeft > 0) {
      tick.current = setInterval(() => {
        setBoostLeft((s) => {
          if (s <= 1) {
            if (tick.current) clearInterval(tick.current);
            load();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [boostLeft > 0, load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile || !level) return null;

  const goalPct = Math.min(
    100,
    Math.round((profile.todayXp / Math.max(1, profile.dailyGoalXp)) * 100)
  );

  return (
    <div className="no-print border-b border-border bg-surface/70">
      <Link
        href="/"
        className="mx-auto flex max-w-5xl items-center gap-3 overflow-x-auto px-3 py-1.5 text-sm [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {/* серия */}
        <span
          className="flex shrink-0 items-center gap-1 font-bold"
          style={{ color: "var(--streak)" }}
          title={profile.activeToday ? "Серия в безопасности" : "Позанимайся, чтобы не потерять серию!"}
        >
          <span className={profile.activeToday ? "" : "grayscale"}>🔥</span>
          {profile.streak}
        </span>

        {/* уровень + прогресс к следующему */}
        <span className="flex min-w-0 shrink-0 items-center gap-2">
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs font-bold text-white">
            {level.cefr}
          </span>
          <span className="hidden h-2 w-24 overflow-hidden rounded-full bg-border sm:block">
            <span
              className="block h-full rounded-full"
              style={{ width: `${level.pct}%`, backgroundColor: "var(--xp)" }}
            />
          </span>
        </span>

        {/* XP сегодня / цель */}
        <span className="flex shrink-0 items-center gap-1 font-bold" style={{ color: "var(--xp)" }}>
          ⚡ {profile.todayXp}
          <span className="font-normal text-muted">/{profile.dailyGoalXp}</span>
          {goalPct >= 100 && <span title="Цель дня выполнена">✅</span>}
        </span>

        {/* гемы */}
        <span className="flex shrink-0 items-center gap-1 font-bold" style={{ color: "var(--gem)" }}>
          💎 {profile.gems}
        </span>

        {/* активный буст */}
        {profile.boostMult > 1 && boostLeft > 0 && (
          <span className="ml-auto flex shrink-0 animate-pulse items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
            ⚡{profile.boostMult}x · {fmt(boostLeft)}
          </span>
        )}
      </Link>
    </div>
  );
}
