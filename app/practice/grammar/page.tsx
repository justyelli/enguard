"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Level = "easy" | "medium" | "hard";
type Question = {
  type: "choice" | "fill" | "correct";
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
};

const TOPICS = [
  "Времена (Tenses)",
  "Артикли (a/an/the)",
  "Предлоги (Prepositions)",
  "Условные предложения (Conditionals)",
  "Модальные глаголы (Modals)",
  "Множественное число и исчисляемость",
  "Порядок слов",
  "Степени сравнения",
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}'’\s-]/gu, "")
    .replace(/\s+/g, " ");
}

export default function GrammarPage() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [level, setLevel] = useState<Level>("medium");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  // тема, в которой ученик чаще всего ошибается (рекомендация)
  const [recommended, setRecommended] = useState<{ topic: string; count: number } | null>(null);
  // накопитель неверных ответов для журнала ошибок (ref — чтобы не зависеть от ре-рендеров)
  const wrongRef = useRef<{ source: "grammar"; wrong: string; correct: string; note: string; category: string }[]>([]);

  // подтягиваем слабую тему и преднастраиваем её
  useEffect(() => {
    fetch("/api/practice/grammar/weak", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.topic && d.count >= 2 && TOPICS.includes(d.topic)) {
          setRecommended({ topic: d.topic, count: d.count });
          setTopic(d.topic);
        }
      })
      .catch(() => {});
  }, []);

  async function start() {
    wrongRef.current = [];
    setLoading(true);
    try {
      const res = await fetch("/api/practice/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level }),
      });
      const data = await res.json();
      setQuestions(data.questions || []);
      setIdx(0);
      setCorrectCount(0);
      setAnswered(false);
      setPicked(null);
      setTyped("");
      setStarted(true);
    } finally {
      setLoading(false);
    }
  }

  const q = questions[idx];
  const done = started && idx >= questions.length;

  function submitAnswer(value: string) {
    if (answered) return;
    const ok =
      q.type === "choice" ? value === q.answer : norm(value) === norm(q.answer);
    setPicked(value);
    setAnswered(true);
    if (ok) setCorrectCount((c) => c + 1);
    else
      wrongRef.current.push({
        source: "grammar",
        wrong: q.question,
        correct: q.answer,
        note: q.explanation,
        category: topic,
      });
  }

  function next() {
    const ni = idx + 1;
    setIdx(ni);
    setAnswered(false);
    setPicked(null);
    setTyped("");
    if (ni >= questions.length) {
      fetch("/api/practice/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: "grammar",
          detail: topic,
          score: correctCount,
          total: questions.length,
        }),
      })
        .then(() => window.dispatchEvent(new CustomEvent("enguard:xp")))
        .catch(() => {});
      // отправляем неверные ответы в журнал ошибок
      if (wrongRef.current.length > 0) {
        fetch("/api/mistakes/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: wrongRef.current }),
        }).catch(() => {});
      }
    }
  }

  if (done) {
    const pct = Math.round((correctCount / Math.max(1, questions.length)) * 100);
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="text-6xl">{pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪"}</div>
        <h1 className="text-2xl font-bold">Готово!</h1>
        <p className="text-muted">
          {topic}: {correctCount} из {questions.length} ({pct}%)
        </p>
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
        <h1 className="text-xl font-bold sm:text-2xl">📐 Грамматика</h1>
        <p className="text-muted">Выбери тему — соберу квиз с пояснениями.</p>

        {recommended && (
          <div className="rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-sm">
            💡 Ты чаще всего ошибаешься в теме{" "}
            <b className="text-accent">«{recommended.topic}»</b> — давай потренируем
            её. Тема уже выбрана; можешь сменить ниже.
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Тема</label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 outline-none focus:border-primary"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

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
          {loading ? "Собираю квиз…" : "Начать"}
        </button>
      </div>
    );
  }

  const isCorrect =
    answered &&
    (q.type === "choice" ? picked === q.answer : norm(typed) === norm(q.answer));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm">
        <button onClick={() => setStarted(false)} className="flex h-10 items-center text-muted hover:text-foreground">
          ✕ Выйти
        </button>
        <span className="text-muted">
          {idx + 1} / {questions.length} · ✓ {correctCount}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(idx / questions.length) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="text-xs uppercase text-muted">
          {q.type === "correct" ? "Найди и исправь ошибку" : q.type === "fill" ? "Заполни пропуск" : "Выбери вариант"}
        </div>
        <p className="mt-2 text-lg">{q.question}</p>
      </div>

      {q.type === "choice" && q.options ? (
        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            let cls =
              "rounded-lg border border-border bg-surface px-4 py-3 text-left hover:border-primary";
            if (answered) {
              if (opt === q.answer)
                cls = "rounded-lg border border-success bg-success/10 px-4 py-3 text-left";
              else if (opt === picked)
                cls = "rounded-lg border border-danger bg-danger/10 px-4 py-3 text-left";
              else cls = "rounded-lg border border-border bg-surface px-4 py-3 text-left opacity-50";
            }
            return (
              <button key={i} disabled={answered} onClick={() => submitAnswer(opt)} className={cls}>
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        !answered && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAnswer(typed);
            }}
            className="flex gap-2"
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoCapitalize="off"
              placeholder="Твой ответ…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:border-primary"
            />
            <button className="rounded-lg bg-primary px-5 font-medium text-white hover:bg-primary-hover">
              OK
            </button>
          </form>
        )
      )}

      {answered && (
        <div className="space-y-3">
          <div
            className={`rounded-xl p-4 ${
              isCorrect ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            <div className="font-medium">
              {isCorrect ? "✓ Верно!" : "✗ Неверно"}
              {!isCorrect && (
                <>
                  {" "}— правильно: <b>{q.answer}</b>
                </>
              )}
            </div>
            <div className="mt-1 text-sm text-foreground/80">{q.explanation}</div>
          </div>
          <button
            onClick={next}
            className="h-12 w-full rounded-lg bg-primary font-medium text-white hover:bg-primary-hover"
          >
            {idx + 1 < questions.length ? "Дальше →" : "Завершить"}
          </button>
        </div>
      )}
    </div>
  );
}
