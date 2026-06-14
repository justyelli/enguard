"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SmartTranslation } from "@/lib/translate";
import TranslationView from "@/components/TranslationView";
import AddToCollection from "@/components/AddToCollection";

type Chapter = { index: number; title: string | null; content: string };
export type WordStatus = Record<string, "known" | "hard">;

type Props = {
  bookId: number;
  title: string;
  author: string | null;
  chapters: Chapter[];
  initialChapter: number;
  initialScroll: number;
  wordStatus?: WordStatus;
};

const WORD_RE = /[\p{L}\p{N}'’-]+/u;

function tokenize(text: string): string[] {
  return text.match(/[\p{L}\p{N}'’-]+|[^\p{L}\p{N}'’-]+/gu) ?? [];
}

export default function Reader({
  bookId,
  title,
  author,
  chapters,
  initialChapter,
  initialScroll,
  wordStatus,
}: Props) {
  const safeInitial = Math.max(0, Math.min(initialChapter, chapters.length - 1));
  const [chapterIdx, setChapterIdx] = useState(safeInitial);
  const [selected, setSelected] = useState<{ word: string; context: string } | null>(
    null
  );
  const [translation, setTranslation] = useState<SmartTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [looked, setLooked] = useState<Set<string>>(new Set());

  // чтение вслух
  const [speakingPara, setSpeakingPara] = useState<number | null>(null);
  const speakingRef = useRef(false);

  const reqSeq = useRef(0);

  const chapter = chapters[chapterIdx];
  const paragraphs = useMemo(
    () => chapter.content.split(/\n{2,}/).filter((p) => p.trim().length > 0),
    [chapter.content]
  );

  // ─── Прогресс ───
  const saveProgress = useCallback(
    (idx: number, scrollPct: number) => {
      fetch(`/api/books/${bookId}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterIndex: idx, scrollPct }),
      }).catch(() => {});
    },
    [bookId]
  );

  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    function onScroll() {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        const h = document.documentElement;
        const scrollable = h.scrollHeight - h.clientHeight;
        if (scrollable <= 0) return; // не затираем прогресс нулём на коротких главах
        saveProgress(chapterIdx, h.scrollTop / scrollable);
      }, 800);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [chapterIdx, saveProgress]);

  // Восстановление позиции после готовности шрифтов/раскладки
  useEffect(() => {
    if (initialScroll <= 0) return;
    let cancelled = false;
    const restore = () => {
      if (cancelled) return;
      const h = document.documentElement;
      const scrollable = h.scrollHeight - h.clientHeight;
      if (scrollable > 0) window.scrollTo(0, initialScroll * scrollable);
    };
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => requestAnimationFrame(restore));
    } else {
      requestAnimationFrame(() => requestAnimationFrame(restore));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Чтение вслух ───
  const stopReading = useCallback(() => {
    speakingRef.current = false;
    try {
      speechSynthesis.cancel();
    } catch {
      /* нет поддержки */
    }
    setSpeakingPara(null);
  }, []);

  const readFrom = useCallback(
    (start: number) => {
      try {
        speechSynthesis.cancel();
      } catch {
        return;
      }
      speakingRef.current = true;
      let i = start;
      const speakNext = () => {
        if (!speakingRef.current || i >= paragraphs.length) {
          speakingRef.current = false;
          setSpeakingPara(null);
          return;
        }
        setSpeakingPara(i);
        const u = new SpeechSynthesisUtterance(paragraphs[i]);
        u.lang = "en-US";
        u.rate = 0.95;
        u.onend = () => {
          i += 1;
          speakNext();
        };
        u.onerror = () => {
          i += 1;
          speakNext();
        };
        speechSynthesis.speak(u);
      };
      speakNext();
    },
    [paragraphs]
  );

  // остановить чтение при смене главы/размонтировании
  useEffect(() => stopReading, [chapterIdx, stopReading]);

  function changeChapter(idx: number) {
    stopReading();
    setChapterIdx(idx);
    setSelected(null);
    setTranslation(null);
    window.scrollTo(0, 0);
    saveProgress(idx, 0);
  }

  async function fetchTranslation(word: string, context: string, lite: boolean) {
    const myReq = ++reqSeq.current;
    const res = await fetch("/api/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ term: word, context, bookId, lite, log: lite }),
    });
    const data = await res.json();
    // игнорируем устаревший ответ (пользователь успел кликнуть другое слово)
    if (myReq !== reqSeq.current) return null;
    return data.translation as SmartTranslation;
  }

  async function onWordClick(word: string, context: string) {
    const clean = word.toLowerCase();
    setSelected({ word, context });
    setTranslation(null);
    setLoading(true);
    setLooked((prev) => new Set(prev).add(clean));
    try {
      const t = await fetchTranslation(word, context, true);
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
      const t = await fetchTranslation(selected.word, selected.context, false);
      if (t) setTranslation(t);
    } catch {
      /* оставляем как есть */
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="relative flex gap-6">
      <article className="min-w-0 flex-1">
        <header className="mb-6 border-b border-border pb-4">
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          {author && <p className="text-muted">{author}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {chapters.length > 1 && (
              <>
                <select
                  value={chapterIdx}
                  onChange={(e) => changeChapter(Number(e.target.value))}
                  className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                >
                  {chapters.map((c, i) => (
                    <option key={i} value={i}>
                      {c.title || `Глава ${i + 1}`}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted">
                  {chapterIdx + 1} из {chapters.length}
                </span>
              </>
            )}
            <button
              onClick={() => (speakingRef.current ? stopReading() : readFrom(0))}
              className="ml-auto rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
            >
              {speakingPara !== null ? "⏹ Стоп" : "🔊 Слушать главу"}
            </button>
          </div>
        </header>

        <div className="space-y-4 text-[1.05rem] leading-9 sm:leading-8">
          {paragraphs.map((para, pi) => {
            const context = para.replace(/\s+/g, " ").trim().slice(0, 400);
            const tokens = tokenize(para);
            return (
              <p
                key={pi}
                className={
                  pi === speakingPara ? "rounded bg-primary/10 px-1" : undefined
                }
              >
                {tokens.map((tok, ti) => {
                  if (WORD_RE.test(tok)) {
                    const low = tok.toLowerCase();
                    const status = wordStatus?.[low];
                    const cls = `reader-word${looked.has(low) ? " looked-up" : ""}${
                      status ? ` ${status}` : ""
                    }`;
                    return (
                      <span
                        key={ti}
                        className={cls}
                        role="button"
                        tabIndex={0}
                        aria-label={`Перевести «${tok}»`}
                        onClick={() => onWordClick(tok, context)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onWordClick(tok, context);
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
            );
          })}
        </div>

        {chapters.length > 1 && (
          <div className="mt-8 flex justify-between border-t border-border pt-4">
            <button
              disabled={chapterIdx === 0}
              onClick={() => changeChapter(chapterIdx - 1)}
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
            >
              ← Предыдущая
            </button>
            <button
              disabled={chapterIdx === chapters.length - 1}
              onClick={() => changeChapter(chapterIdx + 1)}
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
            >
              Следующая →
            </button>
          </div>
        )}
      </article>

      {/* Панель перевода */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20 lg:hidden"
            onClick={() => setSelected(null)}
          />
          <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 pb-6 shadow-xl lg:sticky lg:top-20 lg:inset-auto lg:z-0 lg:max-h-[calc(100vh-6rem)] lg:w-80 lg:rounded-2xl lg:pb-4 lg:shadow-sm">
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
              <div className="py-6 text-center text-sm text-muted">
                Загружаю перевод…
              </div>
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
    </div>
  );
}
