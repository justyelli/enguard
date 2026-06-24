"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Level = "easy" | "medium" | "hard";
type Source = "level" | "reading";

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

// Точность совпадения по словам без учёта порядка (shadowing — про звучание,
// небольшие перестановки распознавания не должны сильно штрафовать).
function accuracy(target: string, said: string): number {
  const t = words(target);
  const u = words(said);
  if (t.length === 0) return 0;
  const pool = [...u];
  let ok = 0;
  for (const w of t) {
    const i = pool.indexOf(w);
    if (i >= 0) {
      ok++;
      pool.splice(i, 1);
    }
  }
  return Math.round((ok / t.length) * 100);
}

export default function ShadowingPage() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [source, setSource] = useState<Source>("level");
  const [level, setLevel] = useState<Level>("medium");
  const [sentences, setSentences] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [scores, setScores] = useState<(number | null)[]>([]);
  const [rate, setRate] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<SRInstance | null>(null);
  const rateRef = useRef(1);
  const listenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupported(!!getSR());
  }, []);

  useEffect(() => {
    return () => {
      if (listenTimer.current) clearTimeout(listenTimer.current);
      try {
        recRef.current?.abort();
        speechSynthesis.cancel();
      } catch {
        /* игнор */
      }
    };
  }, []);

  const cur = sentences[idx];
  const done = started && idx >= sentences.length;

  // Авто-проигрывание эталона при появлении новой фразы (суть shadowing).
  useEffect(() => {
    if (started && cur) speak(cur, rateRef.current);
    // намеренно зависим только от строки и факта старта (rate берём из ref)
  }, [idx, started, cur]);

  async function start() {
    setLoading(true);
    setErr(null);
    try {
      let s: string[] = [];
      if (source === "reading") {
        const res = await fetch("/api/reading/sentences", { cache: "no-store" });
        s = res.ok ? (await res.json()).sentences || [] : [];
        if (s.length === 0) {
          setErr("Пока нет предложений из чтения. Почитай книгу и понажимай на слова — потом возвращайся.");
          return;
        }
      } else {
        const res = await fetch("/api/practice/listening", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level }),
        });
        s = res.ok ? (await res.json()).sentences || [] : [];
        if (s.length === 0) {
          setErr("Не удалось загрузить фразы. Попробуй ещё раз.");
          return;
        }
      }
      setSentences(s);
      setScores(new Array(s.length).fill(null));
      setIdx(0);
      setHeard(null);
      setStarted(true);
    } catch {
      setErr("Сеть недоступна. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  function setScoreAt(i: number, value: number) {
    setScores((prev) => {
      const copy = [...prev];
      copy[i] = value;
      return copy;
    });
  }

  function changeRate(r: number) {
    setRate(r);
    rateRef.current = r;
  }

  function clearListenTimer() {
    if (listenTimer.current) {
      clearTimeout(listenTimer.current);
      listenTimer.current = null;
    }
  }

  function listen() {
    const SR = getSR();
    if (!SR || !cur || listening) return;
    try {
      recRef.current?.abort();
      speechSynthesis.cancel();
    } catch {
      /* игнор */
    }
    clearListenTimer();
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    setListening(true);
    rec.onresult = (e: SREvent) => {
      clearListenTimer();
      const t = e.results[0]?.[0]?.transcript ?? "";
      setHeard(t);
      setScoreAt(idx, t.trim() ? accuracy(cur, t) : 0);
    };
    rec.onerror = () => {
      clearListenTimer();
      setListening(false);
      setHeard("");
      setScoreAt(idx, 0);
    };
    rec.onend = () => {
      clearListenTimer();
      setListening(false);
    };
    try {
      rec.start();
      // страховка: некоторые сборки Chrome/WebView могут не вызвать ни один
      // колбэк — иначе «🎤 Слушаю…» залипнет навсегда. Через 12с выходим сами.
      listenTimer.current = setTimeout(() => {
        try {
          recRef.current?.abort();
        } catch {
          /* игнор */
        }
        setListening(false);
      }, 12000);
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
      const avg = Math.round(filled.reduce((a, b) => a + b, 0) / Math.max(1, sentences.length));
      fetch("/api/practice/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill: "speaking", detail: "shadowing", score: avg, total: 100 }),
      })
        .then(() => window.dispatchEvent(new CustomEvent("enguard:xp")))
        .catch(() => {});
    }
  }

  // ── фолбэк ──
  if (supported === false) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Link href="/practice" className="text-sm text-muted hover:text-foreground">
          ← К практике
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">🎙️ Шэдоуинг</h1>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          Распознавание речи доступно в Chrome (десктоп или Android). Открой приложение
          в Chrome, чтобы получать оценку. Слушать эталон и повторять можно и без этого.
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
        <p className="text-muted">Средняя близость к эталону: {avg}%</p>
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
        <h1 className="text-xl font-bold sm:text-2xl">🎙️ Шэдоуинг</h1>
        <p className="text-muted">
          Послушай фразу диктора и тут же повтори, копируя ритм и интонацию. Шэдоуинг —
          лучший способ поставить произношение и беглость. Замедли при необходимости.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium">Материал</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSource("level")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                source === "level" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface"
              }`}
            >
              По уровню
            </button>
            <button
              onClick={() => setSource("reading")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                source === "reading" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface"
              }`}
            >
              Из моего чтения
            </button>
          </div>
        </div>

        {source === "level" && (
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
        )}

        {err && <p className="text-sm text-danger">{err}</p>}

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
        <div className="text-xs uppercase text-muted">Слушай и повтори</div>
        <p className="mt-2 text-lg font-medium">{cur}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => speak(cur, rate)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background"
          >
            🔊 Эталон
          </button>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[0.7, 1].map((r) => (
              <button
                key={r}
                onClick={() => changeRate(r)}
                className={`px-3 py-1.5 text-sm ${
                  rate === r ? "bg-primary text-white" : "hover:bg-background"
                }`}
              >
                {r === 1 ? "1×" : "0.7×"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!answered ? (
        <button
          onClick={listen}
          disabled={listening}
          className={`h-14 w-full rounded-lg font-medium text-white ${
            listening ? "bg-danger animate-pulse" : "bg-primary hover:bg-primary-hover"
          }`}
        >
          {listening ? "🎤 Слушаю…" : "🎤 Повторить за диктором"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className={`rounded-xl p-4 ${(acc ?? 0) >= 70 ? "bg-success/10" : "bg-amber-500/10"}`}>
            <div className="text-xs uppercase text-muted">Распознано</div>
            <p className="mt-1">{heard || "— (ничего не услышал)"}</p>
            <div className="mt-2 text-sm font-medium">Близость к эталону: {acc}%</div>
            <button
              onClick={() => speak(cur, rate)}
              className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-background"
            >
              🔊 Сравнить с эталоном
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setHeard(null);
                speak(cur, rate);
              }}
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

      <p className="text-center text-xs text-muted">
        Совет: повтори фразу 2-3 раза подряд, добиваясь того же ритма и ударений, что у
        диктора. Сначала медленно (0.7×), потом на нормальной скорости.
      </p>
    </div>
  );
}
