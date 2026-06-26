"use client";

import { useState } from "react";
import Link from "next/link";
import ClickableText from "@/components/ClickableText";

type Level = "A2" | "B1" | "B2" | "C1";
type Question = { question: string; options: string[]; answer: number };
type Story = { title: string; text: string; questions: Question[]; usedAI: boolean };

export default function ReadingPage() {
  const [level, setLevel] = useState<Level>("B1");
  const [topic, setTopic] = useState("");
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/reading/passage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, topic }),
      });
      const data = await res.json();
      const s: Story | undefined = data.story;
      if (!res.ok || !s || !Array.isArray(s.questions)) {
        setErr("Не удалось подготовить текст. Попробуй ещё раз.");
        return;
      }
      setStory(s);
      setAnswers(new Array(s.questions.length).fill(-1));
      setChecked(false);
    } catch {
      setErr("Сеть недоступна. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  function pick(qi: number, oi: number) {
    if (checked) return;
    setAnswers((a) => {
      const c = [...a];
      c[qi] = oi;
      return c;
    });
  }

  const correctCount = story
    ? story.questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0)
    : 0;
  const allAnswered = answers.length > 0 && answers.every((a) => a >= 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            📄 Текст по уровню
          </h1>
          <Link href="/books" className="text-sm text-muted hover:text-foreground">
            ← К книгам
          </Link>
        </div>
        <p className="text-muted">
          Нет под рукой книги нужной сложности? Сгенерирую короткий текст точно под твой
          уровень. Читай, нажимай на незнакомые слова — перевод сразу, а слово уйдёт в
          карточки. Чтение «чуть выше уровня» (i+1) — главный двигатель к C1.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Уровень</label>
            <div className="flex gap-2">
              {(["A2", "B1", "B2", "C1"] as Level[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setLevel(v)}
                  className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                    level === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:bg-background"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-sm font-medium">Тема (необязательно)</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="напр. путешествия, работа, космос…"
              maxLength={80}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
        <button
          onClick={generate}
          disabled={loading}
          className="btn3d mt-3 bg-primary px-5 py-2.5 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Готовлю текст…" : story ? "Новый текст" : "Сгенерировать"}
        </button>
      </section>

      {story && (
        <>
          <article className="rounded-3xl border border-border bg-surface p-5 text-[1.05rem] leading-8 sm:p-6">
            <h2 className="mb-3 font-display text-xl font-bold">{story.title}</h2>
            <ClickableText text={story.text} />
          </article>

          <section className="space-y-3">
            <h3 className="font-display font-bold">Проверь понимание</h3>
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

            {!checked ? (
              <button
                onClick={() => setChecked(true)}
                disabled={!allAnswered}
                className="btn3d w-full bg-primary py-3 text-white disabled:opacity-50"
              >
                {allAnswered ? "Проверить" : "Ответь на все вопросы"}
              </button>
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-4 text-center font-display text-lg font-bold">
                {correctCount} / {story.questions.length} верно{" "}
                {correctCount === story.questions.length ? "🎉" : correctCount > 0 ? "👍" : "💪"}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
