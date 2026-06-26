"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Pair = { word: string; translation: string };
type Tile = { id: number; pairId: number; text: string; kind: "word" | "tr" };

const BEST_KEY = "enguard:matchBest";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildTiles(pairs: Pair[]): Tile[] {
  const tiles: Tile[] = [];
  pairs.forEach((p, i) => {
    tiles.push({ id: i * 2, pairId: i, text: p.word, kind: "word" });
    tiles.push({ id: i * 2 + 1, pairId: i, text: p.translation, kind: "tr" });
  });
  return shuffle(tiles);
}

export default function MatchPage() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tooFew, setTooFew] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newGame = useCallback(async () => {
    setLoading(true);
    setFinished(false);
    setMatched(new Set());
    setSelected(null);
    setWrong(null);
    setElapsed(0);
    setStartedAt(null);
    try {
      const res = await fetch("/api/match", { cache: "no-store" });
      const data = await res.json();
      const pairs: Pair[] = Array.isArray(data.pairs) ? data.pairs : [];
      if (pairs.length < 2) {
        setTooFew(true);
        setTiles([]);
      } else {
        setTooFew(false);
        setTiles(buildTiles(pairs));
      }
    } catch {
      setTooFew(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const b = localStorage.getItem(BEST_KEY);
      if (b) setBest(Number(b));
    } catch {
      /* игнор */
    }
    newGame();
  }, [newGame]);

  // таймер: тикает, пока игра идёт
  useEffect(() => {
    if (startedAt === null || finished) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [startedAt, finished]);

  useEffect(() => {
    return () => {
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
    };
  }, []);

  function tap(tile: Tile) {
    if (finished || matched.has(tile.id) || wrong) return;
    if (startedAt === null) setStartedAt(Date.now());
    if (selected === null) {
      setSelected(tile.id);
      return;
    }
    if (selected === tile.id) {
      setSelected(null);
      return;
    }
    const prev = tiles.find((t) => t.id === selected)!;
    if (prev.pairId === tile.pairId) {
      // совпало
      const next = new Set(matched);
      next.add(prev.id);
      next.add(tile.id);
      setMatched(next);
      setSelected(null);
      if (next.size === tiles.length) {
        const total = Date.now() - (startedAt ?? Date.now());
        setElapsed(total);
        setFinished(true);
        setBest((b) => {
          const nb = b === null || total < b ? total : b;
          try {
            localStorage.setItem(BEST_KEY, String(nb));
          } catch {
            /* игнор */
          }
          return nb;
        });
      }
    } else {
      // не совпало — мигаем красным
      setWrong([selected, tile.id]);
      setSelected(null);
      wrongTimer.current = setTimeout(() => setWrong(null), 650);
    }
  }

  const secs = (elapsed / 1000).toFixed(1);
  const bestSecs = best !== null ? (best / 1000).toFixed(1) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold sm:text-2xl">🎮 Игра «Пары»</h1>
        <Link href="/collections" className="text-sm text-muted hover:text-foreground">
          ← К коллекциям
        </Link>
      </div>
      <p className="text-sm text-muted">
        Соедини слово с переводом как можно быстрее. Тапни слово, затем его пару.
      </p>

      <div className="flex items-center gap-4">
        <div className="rounded-xl border border-border bg-surface px-4 py-2">
          <span className="font-display text-2xl font-bold tabular-nums">{secs}</span>
          <span className="ml-1 text-sm text-muted">сек</span>
        </div>
        {bestSecs && (
          <div className="text-sm text-muted">
            Лучшее: <b className="text-foreground">{bestSecs} сек</b>
          </div>
        )}
        <button
          onClick={newGame}
          className="ml-auto rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface"
        >
          ↻ Новая игра
        </button>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-surface" />
      ) : tooFew ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
          Для игры нужно хотя бы 2 слова в карточках. Добавь слова из чтения, переводчика
          или «Ядра лексики» и возвращайся.
        </div>
      ) : finished ? (
        <div className="space-y-4 rounded-3xl border border-success/40 bg-success/5 p-8 text-center">
          <div className="text-5xl">🎉</div>
          <div className="font-display text-2xl font-bold">Готово за {secs} сек!</div>
          {best !== null && elapsed <= best && (
            <div className="font-bold text-success">Новый рекорд! 🏆</div>
          )}
          <button
            onClick={newGame}
            className="btn3d bg-primary px-6 py-3 text-white"
          >
            Сыграть ещё
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {tiles.map((t) => {
            const isMatched = matched.has(t.id);
            const isSelected = selected === t.id;
            const isWrong = wrong?.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => tap(t)}
                disabled={isMatched}
                className={`flex min-h-[64px] items-center justify-center rounded-2xl border-2 px-2 py-3 text-center text-sm font-medium transition-all ${
                  isMatched
                    ? "invisible"
                    : isWrong
                      ? "border-danger bg-danger/10 text-danger"
                      : isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface hover:border-primary/50"
                }`}
              >
                {t.text}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
