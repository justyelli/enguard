"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Feedback = {
  corrections: { original: string; fixed: string; explanation: string }[];
  improved: string;
  score: number;
  comment: string;
  fallback?: boolean;
};

export default function WritingPage() {
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(true);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPrompt() {
    setPromptLoading(true);
    setFeedback(null);
    setText("");
    setError(null);
    try {
      const res = await fetch("/api/practice/writing/prompt", { method: "POST" });
      const data = await res.json();
      setPrompt(data.prompt || "Напиши 3-5 предложений на английском на любую тему.");
    } catch {
      setPrompt("Напиши 3-5 предложений на английском на любую тему.");
    } finally {
      setPromptLoading(false);
    }
  }

  useEffect(() => {
    loadPrompt();
  }, []);

  async function grade() {
    if (text.trim().length < 3) {
      setError("Напиши хотя бы пару предложений.");
      return;
    }
    setGrading(true);
    setError(null);
    try {
      const res = await fetch("/api/practice/writing/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setFeedback(data.feedback);
      window.dispatchEvent(new CustomEvent("enguard:xp"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setGrading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">✍️ Письмо</h1>
        <Link href="/practice" className="text-sm text-muted hover:text-foreground">
          ← К практике
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-muted">Задание</span>
          <button
            onClick={loadPrompt}
            className="text-xs text-primary hover:underline"
            disabled={promptLoading}
          >
            новое задание
          </button>
        </div>
        <p className="text-base">{promptLoading ? "Загружаю задание…" : prompt}</p>
      </div>

      {!feedback && (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Пиши свой ответ на английском…"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:border-primary"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">{text.trim().split(/\s+/).filter(Boolean).length} слов</span>
            <button
              onClick={grade}
              disabled={grading}
              className="rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {grading ? "Проверяю…" : "Проверить"}
            </button>
          </div>
          {error && <div className="text-sm text-danger">{error}</div>}
        </div>
      )}

      {feedback && (
        <div className="space-y-4">
          {!feedback.fallback && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="text-3xl font-bold text-primary">{feedback.score}</div>
              <div className="text-sm text-muted">из 100 · {feedback.comment}</div>
            </div>
          )}
          {feedback.fallback && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {feedback.comment}
            </div>
          )}

          {feedback.corrections.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 text-xs font-semibold uppercase text-muted">
                Исправления
              </div>
              <ul className="space-y-3">
                {feedback.corrections.map((c, i) => (
                  <li key={i} className="text-sm">
                    <span className="text-danger line-through">{c.original}</span>{" "}
                    <span className="text-success">→ {c.fixed}</span>
                    <div className="text-muted">{c.explanation}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.corrections.length === 0 && !feedback.fallback && (
            <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm text-success">
              Отлично — серьёзных ошибок не найдено! 🎉
            </div>
          )}

          {!feedback.fallback && feedback.improved && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-1 text-xs font-semibold uppercase text-muted">
                Улучшенная версия
              </div>
              <p className="text-sm leading-7">{feedback.improved}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setFeedback(null)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
            >
              Редактировать
            </button>
            <button
              onClick={loadPrompt}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Новое задание
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
