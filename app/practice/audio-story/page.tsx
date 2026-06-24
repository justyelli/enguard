"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ClickableText from "@/components/ClickableText";

type Level = "A2" | "B1" | "B2" | "C1";
type Question = { question: string; options: string[]; answer: number };
type Story = { title: string; text: string; questions: Question[]; usedAI: boolean };

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

export default function AudioStoryPage() {
  const [level, setLevel] = useState<Level>("B1");
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [rate, setRate] = useState(1);
  const [showText, setShowText] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopAudio() {
    if (playTimer.current) clearTimeout(playTimer.current);
    try {
      speechSynthesis.cancel();
    } catch {
      /* игнор */
    }
  }

  useEffect(() => stopAudio, []);

  async function start() {
    stopAudio(); // отменяем прежнюю озвучку/таймер (важно при «Ещё история»)
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/practice/audio-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      const data = await res.json();
      const s: Story | undefined = data.story;
      if (!res.ok || !s || !Array.isArray(s.questions) || s.questions.length === 0) {
        setErr("Не удалось подготовить историю. Попробуй ещё раз.");
        setStory(null);
        return;
      }
      setStory(s);
      setAnswers(new Array(s.questions.length).fill(-1));
      setChecked(false);
      setShowText(false);
      // автозапуск озвучки (с очищаемым таймером)
      playTimer.current = setTimeout(() => speak(s.text, rate), 250);
    } catch {
      setErr("Сеть недоступна. Попробуй ещё раз.");
      setStory(null);
    } finally {
      setLoading(false);
    }
  }

  function pick(qi: number, oi: number) {
    if (checked) return;
    setAnswers((a) => {
      const copy = [...a];
      copy[qi] = oi;
      return copy;
    });
  }

  function check() {
    if (!story) return;
    setChecked(true);
    setShowText(true);
    try {
      speechSynthesis.cancel();
    } catch {
      /* игнор */
    }
    const correct = story.questions.reduce(
      (n, q, i) => n + (answers[i] === q.answer ? 1 : 0),
      0
    );
    fetch("/api/practice/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skill: "listening",
        detail: "story",
        score: correct,
        total: story.questions.length,
      }),
    })
      .then(() => window.dispatchEvent(new CustomEvent("enguard:xp")))
      .catch(() => {});
  }

  function reset() {
    stopAudio();
    setStory(null);
  }

  // ── выбор уровня ──
  if (!story) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <Link href="/practice" className="text-sm text-muted hover:text-foreground">
          ← К практике
        </Link>
        <h1 className="text-xl font-bold sm:text-2xl">🎧 Аудио-истории</h1>
        <p className="text-muted">
          Слушай короткую историю и отвечай на вопросы по смыслу — не подглядывая в
          текст. Слушание ради понимания — главный двигатель к C1. Текст откроется
          после ответов.
        </p>
        <div className="flex gap-2">
          {(["A2", "B1", "B2", "C1"] as Level[]).map((v) => (
            <button
              key={v}
              onClick={() => setLevel(v)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                level === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <button
          onClick={start}
          disabled={loading}
          className="h-12 w-full rounded-lg bg-primary font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Готовлю историю…" : "Начать"}
        </button>
      </div>
    );
  }

  const correctCount = story.questions.reduce(
    (n, q, i) => n + (answers[i] === q.answer ? 1 : 0),
    0
  );
  const allAnswered = answers.every((a) => a >= 0);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm">
        <button onClick={reset} className="flex h-10 items-center text-muted hover:text-foreground">
          ✕ Выйти
        </button>
        <span className="text-muted">🎧 {level}</span>
      </div>

      {/* плеер */}
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="font-display text-lg font-bold">{story.title}</div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => speak(story.text, rate)}
            className="btn3d bg-primary px-5 py-2.5 text-white"
          >
            🔊 Слушать
          </button>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {[0.8, 1].map((r) => (
              <button
                key={r}
                onClick={() => setRate(r)}
                className={`px-3 py-2 text-sm ${rate === r ? "bg-primary text-white" : "hover:bg-background"}`}
              >
                {r === 1 ? "1×" : "0.8×"}
              </button>
            ))}
          </div>
        </div>
        {!showText && (
          <p className="mt-3 text-xs text-muted">
            Слушай столько раз, сколько нужно. Текст откроется после проверки.
          </p>
        )}
      </div>

      {/* транскрипт после проверки */}
      {showText && (
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="mb-1 text-xs uppercase text-muted">
            Транскрипт · нажми на незнакомое слово для перевода
          </div>
          <ClickableText text={story.text} />
        </div>
      )}

      {/* вопросы */}
      <div className="space-y-4">
        <div className="text-sm font-medium text-muted">Вопросы на понимание:</div>
        {story.questions.map((q, qi) => (
          <div key={qi} className="rounded-2xl border border-border bg-surface p-4">
            <p className="font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-2 grid gap-2">
              {q.options.map((opt, oi) => {
                let cls =
                  "rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:border-primary";
                if (checked) {
                  if (oi === q.answer)
                    cls = "rounded-lg border border-success bg-success/10 px-3 py-2 text-left text-sm";
                  else if (oi === answers[qi])
                    cls = "rounded-lg border border-danger bg-danger/10 px-3 py-2 text-left text-sm";
                  else cls = "rounded-lg border border-border bg-background px-3 py-2 text-left text-sm opacity-50";
                } else if (answers[qi] === oi) {
                  cls = "rounded-lg border-2 border-primary bg-primary/10 px-3 py-2 text-left text-sm";
                }
                return (
                  <button key={oi} disabled={checked} onClick={() => pick(qi, oi)} className={cls}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!checked ? (
        <button
          onClick={check}
          disabled={!allAnswered}
          className="btn3d w-full bg-primary py-3 text-white disabled:opacity-50"
        >
          {allAnswered ? "Проверить" : "Ответь на все вопросы"}
        </button>
      ) : (
        <div className="space-y-3 text-center">
          <div className="font-display text-xl font-bold">
            {correctCount} / {story.questions.length} верно{" "}
            {correctCount === story.questions.length ? "🎉" : correctCount > 0 ? "👍" : "💪"}
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={start} className="btn3d bg-primary px-5 py-3 text-white">
              Ещё история
            </button>
            <Link href="/practice" className="rounded-lg border border-border px-5 py-3 font-bold hover:bg-surface">
              К практике
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
