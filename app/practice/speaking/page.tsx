"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Level = "easy" | "medium" | "hard";

type SRAlt = { transcript: string };
type SREvent = { results: ArrayLike<ArrayLike<SRAlt>> };
interface SRInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getSR(): (new () => SRInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SRInstance;
    webkitSpeechRecognition?: new () => SRInstance;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

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

// Позиционная точность (учитывает порядок), как в аудировании.
function accuracy(target: string, said: string): number {
  const t = words(target);
  const u = words(said);
  if (t.length === 0) return 0;
  let ok = 0;
  for (let i = 0; i < t.length; i++) if (u[i] === t[i]) ok++;
  return Math.round((ok / t.length) * 100);
}

export default function SpeakingPage() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [level, setLevel] = useState<Level>("medium");
  const [sentences, setSentences] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [scores, setScores] = useState<(number | null)[]>([]);
  const recRef = useRef<SRInstance | null>(null);

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  // остановить распознавание при размонтировании
  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
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
      const s: string[] = data.sentences || [];
      setSentences(s);
      setScores(new Array(s.length).fill(null));
      setIdx(0);
      setHeard(null);
      setStarted(true);
    } finally {
      setLoading(false);
    }
  }

  const cur = sentences[idx];
  const done = started && idx >= sentences.length;

  function setScoreAt(i: number, value: number) {
    setScores((s) => {
      const copy = [...s];
      copy[i] = value;
      return copy;
    });
  }

  function listen() {
    const SR = getSR();
    if (!SR || !cur || listening) return;
    try {
      recRef.current?.abort();
    } catch {
      /* игнор */
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    setListening(true);
    rec.onresult = (e: SREvent) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      setHeard(t);
      setScoreAt(idx, t.trim() ? accuracy(cur, t) : 0);
    };
    rec.onerror = () => {
      setListening(false);
      setHeard(""); // показать результат-блок, чтобы не застрять
      setScoreAt(idx, 0);
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function exit() {
    try {
      recRef.current?.abort();
      speechSynthesis.cancel();
    } catch {
      /* игнор */
    }
    setStarted(false);
  }

  function next() {
    const ni = idx + 1;
    setIdx(ni);
    setHeard(null);
    if (ni >= sentences.length) {
      const filled = scores.map((x) => x ?? 0);
      const avg = Math.round(
        filled.reduce((a, b) => a + b, 0) / Math.max(1, sentences.length)
      );
      fetch("/api/practice/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: "speaking", detail: level, score: avg, total: 100 }),
      })
        .then(() => window.dispatchEvent(new CustomEvent("enguard:xp")))
        .catch(() => {});
    }
  }

  // ── фолбэк для не-Chrome ──
  if (supported === false) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Link href="/practice" className="text-sm text-muted hover:text-foreground">
          ← К практике
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">🗣️ Говорение</h1>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          Распознавание речи доступно в браузере Chrome (десктоп или Android). Открой
          приложение в Chrome, чтобы тренировать произношение с оценкой. А пока можешь
          слушать эталон и повторять вслух.
        </div>
      </div>
    );
  }

  if (done) {
    const filled = scores.map((x) => x ?? 0);
    const avg = Math.round(filled.reduce((a, b) => a + b, 0) / Math.max(1, sentences.length));
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="text-6xl">{avg >= 80 ? "🎉" : avg >= 50 ? "👍" : "💪"}</div>
        <h1 className="text-2xl font-bold">Готово!</h1>
        <p className="text-muted">Средняя точность произношения: {avg}%</p>
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setStarted(false)}
            className="rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-primary-hover"
          >
            Ещё раз
          </button>
          <Link href="/practice" className="rounded-lg border border-border px-5 py-3 font-medium hover:bg-surface">
            К практике
          </Link>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <Link href="/practice" className="text-sm text-muted hover:text-foreground">
          ← К практике
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">🗣️ Говорение</h1>
        <p className="text-muted">
          Слушай эталон, затем нажми «Говорить» и произнеси фразу. Браузер распознает
          речь и оценит, насколько точно ты её сказал.
        </p>
        <div className="flex gap-2">
          {(["easy", "medium", "hard"] as Level[]).map((v) => (
            <button
              key={v}
              onClick={() => setLevel(v)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                level === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface"
              }`}
            >
              {v === "easy" ? "Лёгкий" : v === "medium" ? "Средний" : "Сложный"}
            </button>
          ))}
        </div>
        <button
          onClick={start}
          disabled={loading}
          className="h-12 w-full rounded-lg bg-primary font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Готовлю…" : "Начать"}
        </button>
      </div>
    );
  }

  const answered = heard !== null;
  const acc = answered ? scores[idx] ?? 0 : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm">
        <button onClick={exit} className="flex h-10 items-center text-muted hover:text-foreground">
          ✕ Выйти
        </button>
        <span className="text-muted">{idx + 1} / {sentences.length}</span>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="text-xs uppercase text-muted">Произнеси вслух</div>
        <p className="mt-2 text-lg font-medium">{cur}</p>
        <button
          onClick={() => speak(cur)}
          className="mt-3 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background"
        >
          🔊 Эталон
        </button>
      </div>

      {!answered ? (
        <button
          onClick={listen}
          disabled={listening}
          className={`h-14 w-full rounded-lg font-medium text-white ${
            listening ? "bg-danger animate-pulse" : "bg-primary hover:bg-primary-hover"
          }`}
        >
          {listening ? "🎤 Слушаю…" : "🎤 Говорить"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className={`rounded-xl p-4 ${(acc ?? 0) >= 70 ? "bg-success/10" : "bg-amber-500/10"}`}>
            <div className="text-xs uppercase text-muted">Распознано</div>
            <p className="mt-1">{heard || "— (ничего не услышал)"}</p>
            <div className="mt-2 text-sm font-medium">Точность: {acc}%</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setHeard(null)}
              className="h-12 flex-1 rounded-lg border border-border font-medium hover:bg-surface"
            >
              Ещё раз
            </button>
            <button
              onClick={next}
              className="h-12 flex-1 rounded-lg bg-primary font-medium text-white hover:bg-primary-hover"
            >
              {idx + 1 < sentences.length ? "Дальше →" : "Завершить"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
