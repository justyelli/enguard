import { prisma } from "@/lib/prisma";
import { normalizeTerm } from "@/lib/translate";

// ─────────────────────────────────────────────────────────────────────────────
// Размер словарного запаса — метрика в духе LingQ.
//
// Объём словаря — научно самый сильный предиктор понимания (чтения и речи) и
// мощный мотиватор: число растёт с каждым новым словом. Считаем РАЗНЫЕ слова,
// с которыми ученик реально работал: карточки (учит) + слова, которые смотрел
// при чтении (встречал). Нормализуем, чтобы формы одного слова не двоились.
// ─────────────────────────────────────────────────────────────────────────────

const LADDER = [100, 250, 500, 1000, 1500, 2000, 3000, 4000, 5000, 7000, 10000];

export type VocabSize = {
  total: number; // разных слов в работе (карточки ∪ просмотренные)
  learned: number; // карточки с reps>0 (уже повторял верно)
  learning: number; // карточки reps==0 (добавлены, ещё не закреплены)
  encountered: number; // просмотренные при чтении, ещё не в карточках
  nextMilestone: number | null;
  prevMilestone: number;
  pct: number; // прогресс к следующей вехе
};

export async function getVocabSize(): Promise<VocabSize> {
  const [cards, lookups] = await Promise.all([
    prisma.card.findMany({ select: { word: true, reps: true } }),
    prisma.wordLookup.findMany({ select: { word: true } }),
  ]);

  // нормализованное слово → максимальные reps среди карточек с этим словом
  const cardReps = new Map<string, number>();
  for (const c of cards) {
    const k = normalizeTerm(c.word);
    if (!k) continue;
    cardReps.set(k, Math.max(cardReps.get(k) ?? 0, c.reps));
  }

  let learned = 0;
  let learning = 0;
  for (const reps of cardReps.values()) {
    if (reps > 0) learned++;
    else learning++;
  }

  const cardSet = new Set(cardReps.keys());
  const lookSet = new Set<string>();
  for (const l of lookups) {
    const k = normalizeTerm(l.word);
    if (k && !cardSet.has(k)) lookSet.add(k);
  }
  const encountered = lookSet.size;
  const total = cardSet.size + encountered;

  const nextMilestone = LADDER.find((m) => m > total) ?? null;
  const prevMilestone = [...LADDER].reverse().find((m) => m <= total) ?? 0;
  const pct = nextMilestone
    ? Math.round(((total - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;

  return { total, learned, learning, encountered, nextMilestone, prevMilestone, pct };
}
