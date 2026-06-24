"use client";

import { useRef, useState } from "react";
import type { SmartTranslation } from "@/lib/translate";
import TranslationView from "@/components/TranslationView";
import AddToCollection from "@/components/AddToCollection";

// Переиспользуемый кликабельный текст: тап по слову → перевод в панели
// (как в ридере). Логирует WordLookup → слово попадает в мост «Слова из чтения».
// Используется в транскрипте аудио-историй, можно и в других местах.

const WORD_RE = /[\p{L}\p{N}'’-]+/u;

function tokenize(text: string): string[] {
  return text.match(/[\p{L}\p{N}'’-]+|[^\p{L}\p{N}'’-]+/gu) ?? [];
}

export default function ClickableText({ text }: { text: string }) {
  const [selected, setSelected] = useState<{ word: string; context: string } | null>(null);
  const [translation, setTranslation] = useState<SmartTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [looked, setLooked] = useState<Set<string>>(new Set());
  const reqSeq = useRef(0);

  const context = text.replace(/\s+/g, " ").trim().slice(0, 400);

  async function fetchTranslation(word: string, lite: boolean) {
    const myReq = ++reqSeq.current;
    const res = await fetch("/api/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: word, context, lite, log: lite }),
    });
    const data = await res.json();
    if (myReq !== reqSeq.current) return null;
    if (lite) {
      try {
        window.dispatchEvent(new CustomEvent("enguard:xp"));
      } catch {
        /* игнор */
      }
    }
    return data.translation as SmartTranslation;
  }

  async function onWordClick(word: string) {
    const clean = word.toLowerCase();
    setSelected({ word, context });
    setTranslation(null);
    setLoading(true);
    setLooked((prev) => new Set(prev).add(clean));
    try {
      const t = await fetchTranslation(word, true);
      if (t) setTranslation(t);
    } catch {
      setTranslation(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!selected) return;
    setLoadingMore(true);
    try {
      const t = await fetchTranslation(selected.word, false);
      if (t) setTranslation(t);
    } catch {
      /* оставляем как есть */
    } finally {
      setLoadingMore(false);
    }
  }

  const tokens = tokenize(text);

  return (
    <>
      <p className="leading-relaxed">
        {tokens.map((tok, ti) => {
          if (WORD_RE.test(tok)) {
            const low = tok.toLowerCase();
            return (
              <span
                key={ti}
                className={`reader-word${looked.has(low) ? " looked-up" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`Перевести «${tok}»`}
                onClick={() => onWordClick(tok)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onWordClick(tok);
                  }
                }}
              >
                {tok}
              </span>
            );
          }
          return <span key={ti}>{tok}</span>;
        })}
      </p>

      {selected && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            onClick={() => setSelected(null)}
          />
          <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-4 pb-6 shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-80 sm:rounded-2xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted">Перевод</span>
              <button
                onClick={() => setSelected(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-foreground"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {loading && (
              <div className="py-6 text-center text-sm text-muted">Загружаю перевод…</div>
            )}

            {!loading && translation && (
              <div className="space-y-4">
                <TranslationView t={translation} full />
                {!translation.fallback &&
                  !translation.full &&
                  translation.synonyms.length === 0 && (
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="w-full rounded-lg border border-border py-2 text-sm font-medium text-primary hover:bg-background disabled:opacity-50"
                    >
                      {loadingMore ? "Загружаю…" : "Подробнее: синонимы и отличия"}
                    </button>
                  )}
                <div className="border-t border-border pt-3">
                  <AddToCollection
                    word={translation.term}
                    translation={translation.translation}
                    example={translation.examples[0]?.en}
                    context={selected.context}
                  />
                </div>
              </div>
            )}

            {!loading && !translation && (
              <div className="py-6 text-center text-sm text-danger">
                Не удалось получить перевод.
              </div>
            )}
          </aside>
        </>
      )}
    </>
  );
}
