"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Question = {
  level: string;
  skill: string;
  question: string;
  options: string[];
  answer: number;
};

type Result = {
  level: string;
  baselineXp: number;
  newTotalXp: number;
  correct: number;
  total: number;
};

const LEVEL_NOTE: Record<string, string> = {
  A1: "Основы. Начинаем с фундамента — это нормальная стартовая точка.",
  A2: "Бытовой английский. Отличный старт для рывка к C1.",
  B1: "Уверенный средний уровень. Дальше — нюансы и беглость.",
  B2: "Сильный уровень. До C1 уже близко — добиваем точность и идиоматичность.",
  C1: "Продвинутый уровень. Цель почти достигнута — держим и шлифуем!",
};

export default function PlacementPage() {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/placement", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.questions) && d.questions.length > 0) {
          setQuestions(d.questions);
          setAnswers(new Array(d.questions.length).fill(-1));
        } else {
          setError("Не удалось загрузить тест.");
        }
      })
      .catch(() => setError("Не удалось загрузить тест."));
  }, []);

  async function submit(finalAnswers: number[]) {
    if (!questions) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, answers: finalAnswers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (picked === null || !questions) return;
    const updated = [...answers];
    updated[idx] = picked;
    setAnswers(updated);
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setPicked(updated[idx + 1] >= 0 ? updated[idx + 1] : null);
    } else {
      submit(updated);
    }
  }

  // ── Результат ──
  if (result) {
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="text-sm text-muted">Твой стартовый уровень</div>
        <div className="font-display text-6xl font-bold text-primary">{result.level}</div>
        <p className="text-muted">{LEVEL_NOTE[result.level] ?? ""}</p>
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Верных ответов</span>
            <b>
              {result.correct} / {result.total}
            </b>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted">Стартовая база</span>
            <b>{result.baselineXp.toLocaleString("ru")} XP</b>
          </div>
        </div>
        <p className="text-sm text-muted">
          Мы поставили тебя на эту точку пути — план и нормативы теперь рассчитаны
          от неё. Дальше идём к C1!
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/path" className="btn3d bg-primary px-6 py-3 text-white">
            Посмотреть путь к C1 →
          </Link>
          <Link href="/" className="rounded-xl border border-border px-6 py-3 font-bold text-muted hover:bg-surface">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  // ── Загрузка / ошибка ──
  if (error && !questions) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="text-danger">{error}</p>
        <Link href="/" className="rounded-xl border border-border px-6 py-3 font-bold">
          На главную
        </Link>
      </div>
    );
  }
  if (!questions) {
    return <div className="mx-auto h-64 max-w-md animate-pulse rounded-3xl bg-surface" />;
  }

  // ── Вопрос ──
  const q = questions[idx];
  const progress = Math.round((idx / questions.length) * 100);

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-display font-bold">🎯 Тест уровня</span>
          <span className="text-muted">
            {idx + 1} / {questions.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-3 text-lg font-medium leading-relaxed">{q.question}</div>
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => setPicked(i)}
              className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${
                picked === i
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background hover:border-primary/40"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={next}
        disabled={picked === null || submitting}
        className="btn3d w-full bg-primary py-3 text-white disabled:opacity-50"
      >
        {submitting
          ? "Считаем уровень…"
          : idx + 1 < questions.length
            ? "Дальше →"
            : "Узнать уровень"}
      </button>

      <p className="text-center text-xs text-muted">
        Отвечай честно и не угадывай — точная оценка задаёт правильную нагрузку.
        Если не знаешь — выбери самый вероятный вариант.
      </p>
    </div>
  );
}
