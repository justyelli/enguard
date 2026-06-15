"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Correction = { original: string; fixed: string; note: string };
type Msg = { role: "user" | "assistant"; content: string; correction?: Correction | null };

const SCENARIOS = [
  { icon: "💬", label: "Свободный разговор", text: "Свободный разговор на любую тему, дружеская беседа." },
  { icon: "☕", label: "В кафе", text: "Ты официант в кафе, студент — посетитель. Прими заказ." },
  { icon: "✈️", label: "В аэропорту", text: "Ты сотрудник аэропорта на стойке регистрации." },
  { icon: "💼", label: "Собеседование", text: "Ты интервьюер на собеседовании на работу мечты студента." },
  { icon: "🛍️", label: "Магазин", text: "Ты продавец в магазине одежды, помоги покупателю." },
  { icon: "🩺", label: "У врача", text: "Ты врач, студент — пациент, который описывает симптомы." },
];

function speak(text: string) {
  if (!text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* нет поддержки */
  }
}

function stopSpeech() {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
  } catch {
    /* игнор */
  }
}

export default function TutorPage() {
  const [scenario, setScenario] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // остановить озвучку при уходе со страницы
  useEffect(() => stopSpeech, []);

  async function start(text: string) {
    stopSpeech();
    setScenario(text);
    setMessages([]);
    setSending(true);
    try {
      const res = await fetch("/api/practice/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: text, messages: [] }),
      });
      const data = await res.json();
      const reply = res.ok && data.reply ? data.reply : "Hello! Let's practice English. What would you like to talk about?";
      setMessages([{ role: "assistant", content: reply }]);
      speak(reply);
    } catch {
      setMessages([{ role: "assistant", content: "Hello! Let's practice English. (Проверь соединение.)" }]);
    } finally {
      setSending(false);
    }
  }

  function changeScenario() {
    stopSpeech();
    setScenario(null);
    setMessages([]);
  }

  async function send() {
    const text = input.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    const userMsg: Msg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/practice/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      window.dispatchEvent(new CustomEvent("enguard:xp"));
      const reply: string = res.ok && data.reply ? data.reply : "Sorry, can you say that again?";
      const correction: Correction | null = data.correction ?? null;
      setMessages((prev) => {
        const copy = [...prev];
        // привязываем исправление к последней реплике пользователя
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "user") {
            if (correction) copy[i] = { ...copy[i], correction };
            break;
          }
        }
        copy.push({ role: "assistant", content: reply });
        return copy;
      });
      speak(reply);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Try again." }]);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (!scenario) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <Link href="/practice" className="text-sm text-muted hover:text-foreground">
          ← К практике
        </Link>
        <h1 className="font-display text-xl font-bold sm:text-2xl">💬 AI-репетитор</h1>
        <p className="text-muted">Выбери сценарий и поговори вживую — я отвечаю и мягко исправляю ошибки.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.label}
              onClick={() => start(s.text)}
              className="rounded-2xl border border-border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary"
            >
              <div className="text-2xl">{s.icon}</div>
              <div className="mt-1 font-display font-bold">{s.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-12rem)] max-w-xl flex-col">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={changeScenario} className="text-sm text-muted hover:text-foreground">
          ← Сменить сценарий
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-primary text-white" : "bg-background"
              }`}
            >
              {m.content}
              {m.role === "assistant" && (
                <button onClick={() => speak(m.content)} className="ml-2 text-muted hover:text-primary" aria-label="Озвучить">
                  🔊
                </button>
              )}
            </div>
            {m.role === "user" && m.correction && (
              <div className="mt-1 rounded-lg bg-amber-500/10 px-3 py-1.5 text-left text-xs text-amber-700 dark:text-amber-300">
                ✏️ <span className="line-through">{m.correction.original}</span> → <b>{m.correction.fixed}</b>
                {m.correction.note && <span className="text-muted"> · {m.correction.note}</span>}
              </div>
            )}
          </div>
        ))}
        {sending && <div className="text-sm text-muted">…печатает</div>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напиши ответ по-английски…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:border-primary"
        />
        <button
          disabled={sending || !input.trim()}
          className="rounded-lg bg-primary px-5 font-bold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
