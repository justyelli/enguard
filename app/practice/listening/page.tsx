"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Level = "easy" | "medium" | "hard";

function speak(text: string, rate = 1) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = rate;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* нет поддержки */
  }
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’\s-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

// Пословная точность диктанта (по позициям).
function accuracy(target: string, typed: string): number {
  const t = words(target);
  const u = words(typed);
  if (t.length === 0) return 0;
  let ok = 0;
  for (let i = 0; i < t.length; i++) if (u[i] === t[i]) ok++;
  return Math.round((ok / t.length) * 100);
}

export default function ListeningPage() {
  const [level, setLevel] = useState<Level>("medium");
  const [sentences, setSentences] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  // остановить озвучку при уходе со страницы
  useEffect(() => {
    return () => {
      try {
        speechSynthesis.cancel();
      } catch {
        /* игнор */
      }
    };
  }, []);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/practice/listening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      const data = await res.json();
      setSentences(data.sentences || []);
      setIdx(0);
      setScores([]);
      setTyped("");
      setChecked(false);
      setStarted(true);
      setTimeout(() => speak((data.sentences || [])[0] ?? ""), 400);
    } finally {
      setLoading(false);
    }
  }

  const cur = sentences[idx];
  const done = started && idx >= sentences.length;

  function check() {
    setChecked(true);
    setScores((s) => [...s, accuracy(cur, typed)]);
  }

  function next() {
    const ni = idx + 1;
    setIdx(ni);
    setTyped("");
    setChecked(false);
    if (ni < sentences.length) setTimeout(() => speak(sentences[ni]), 300);
    else {
      const avg = Math.round(
        [...scores].reduce((a, b) => a + b, 0) / Math.max(1, scores.length)
      );
      fetch("/api/practice/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: "listening", detail: level, score: avg, total: 100 }),
      })
        .then(() => window.dispatchEvent(new CustomEvent("enguard:xp")))
        .catch(() => {});
    }
  }

  if (done) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length));
    return (
      <Result
        avg={avg}
        onAgain={() => setStarted(false)}
        msg={`Средняя точность: ${avg}%`}
      />
    );
  }

  if (!started) {
    return (
      <Intro
        title="🎧 Аудирование"
        desc="Нажми «Слушать», набери услышанное предложение и проверь себя по словам."
        level={level}
        setLevel={setLevel}
        onStart={start}
        loading={loading}
      />
    );
  }

  const tWords = words(cur);
  const uWords = words(typed);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <TopBar idx={idx} total={sentences.length} onExit={() => setStarted(false)} />

      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={() => speak(cur)}
          className="rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-primary-hover"
        >
          🔊 Слушать
        </button>
        <button
          onClick={() => speak(cur, 0.6)}
          className="rounded-lg border border-border px-4 py-3 font-medium hover:bg-surface"
        >
          🐢 Медленнее
        </button>
      </div>

      {!checked ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
          className="space-y-3"
        >
          <textarea
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Запиши, что услышал…"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:border-primary"
          />
          <button className="h-12 w-full rounded-lg bg-primary font-medium text-white hover:bg-primary-hover">
            Проверить
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-1 text-xs uppercase text-muted">Правильно</div>
            <p className="leading-7">
              {tWords.map((w, i) => (
                <span
                  key={i}
                  className={
                    uWords[i] === w
                      ? "text-success"
                      : "rounded bg-danger/15 text-danger"
                  }
                >
                  {w}{" "}
                </span>
              ))}
            </p>
            <div className="mt-2 text-sm text-muted">Точность: {accuracy(cur, typed)}%</div>
          </div>
          <button
            onClick={next}
            className="h-12 w-full rounded-lg bg-primary font-medium text-white hover:bg-primary-hover"
          >
            {idx + 1 < sentences.length ? "Дальше →" : "Завершить"}
          </button>
        </div>
      )}
    </div>
  );
}

function Intro({
  title,
  desc,
  level,
  setLevel,
  onStart,
  loading,
}: {
  title: string;
  desc: string;
  level: Level;
  setLevel: (l: Level) => void;
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href="/practice" className="text-sm text-muted hover:text-foreground">
        ← К практике
      </Link>
      <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
      <p className="text-muted">{desc}</p>
      <LevelPicker level={level} setLevel={setLevel} />
      <button
        onClick={onStart}
        disabled={loading}
        className="h-12 w-full rounded-lg bg-primary font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {loading ? "Готовлю…" : "Начать"}
      </button>
    </div>
  );
}

function LevelPicker({ level, setLevel }: { level: Level; setLevel: (l: Level) => void }) {
  const opts: { v: Level; l: string }[] = [
    { v: "easy", l: "Лёгкий" },
    { v: "medium", l: "Средний" },
    { v: "hard", l: "Сложный" },
  ];
  return (
    <div className="flex gap-2">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => setLevel(o.v)}
          className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
            level === o.v
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:bg-surface"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function TopBar({ idx, total, onExit }: { idx: number; total: number; onExit: () => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <button onClick={onExit} className="flex h-10 items-center text-muted hover:text-foreground">
        ✕ Выйти
      </button>
      <span className="text-muted">
        {idx + 1} / {total}
      </span>
    </div>
  );
}

function Result({ avg, onAgain, msg }: { avg: number; onAgain: () => void; msg: string }) {
  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <div className="text-6xl">{avg >= 80 ? "🎉" : avg >= 50 ? "👍" : "💪"}</div>
      <h1 className="text-2xl font-bold">Готово!</h1>
      <p className="text-muted">{msg}</p>
      <div className="flex justify-center gap-2">
        <button
          onClick={onAgain}
          className="rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-primary-hover"
        >
          Ещё раз
        </button>
        <Link
          href="/practice"
          className="rounded-lg border border-border px-5 py-3 font-medium hover:bg-surface"
        >
          К практике
        </Link>
      </div>
    </div>
  );
}
