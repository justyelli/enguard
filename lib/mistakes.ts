import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Журнал ошибок → точечная проработка.
//
// Самая «дырозакрывающая» техника — целенаправленная практика по собственным
// ошибкам (deliberate practice). Исправления из разбора письма, реплик
// репетитора и грамм-квиза раньше показывались один раз и терялись. Теперь они
// копятся и возвращаются, пока не отработаны верно несколько раз (мини-SRS).
// ─────────────────────────────────────────────────────────────────────────────

export type MistakeSource = "writing" | "tutor" | "grammar";

export type MistakeInput = {
  source: MistakeSource;
  wrong: string;
  correct: string;
  note?: string | null;
  category?: string | null;
};

export type MistakeView = {
  id: number;
  source: string;
  wrong: string;
  correct: string;
  note: string | null;
  category: string | null;
  reps: number;
};

const RESOLVE_AT = 2; // верных повторений подряд до «отработано»

function dedupKey(wrong: string, correct: string): string {
  return `${wrong}→${correct}`.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Сохраняет ошибки, пропуская дубли (по паре wrong→correct среди НЕотработанных).
 * Возвращает число реально добавленных.
 */
export async function recordMistakes(items: MistakeInput[]): Promise<number> {
  const clean = items
    .map((i) => ({
      source: i.source,
      wrong: String(i.wrong ?? "").trim().slice(0, 500),
      correct: String(i.correct ?? "").trim().slice(0, 500),
      note: i.note ? String(i.note).trim().slice(0, 500) : null,
      category: i.category ? String(i.category).trim().slice(0, 80) : null,
    }))
    .filter(
      (i) => i.wrong && i.correct && i.wrong.toLowerCase() !== i.correct.toLowerCase()
    );
  if (clean.length === 0) return 0;

  const existing = await prisma.mistake.findMany({
    where: { resolved: false },
    select: { wrong: true, correct: true },
  });
  const seen = new Set(existing.map((e) => dedupKey(e.wrong, e.correct)));

  const toCreate = clean.filter((i) => {
    const k = dedupKey(i.wrong, i.correct);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (toCreate.length === 0) return 0;

  await prisma.mistake.createMany({ data: toCreate });
  return toCreate.length;
}

// Безопасная обёртка: захват ошибок никогда не должен ронять основное действие.
export async function recordMistakesSafe(items: MistakeInput[]): Promise<void> {
  try {
    await recordMistakes(items);
  } catch (e) {
    console.error("recordMistakes error", e);
  }
}

export async function getOpenMistakeCount(): Promise<number> {
  return prisma.mistake.count({ where: { resolved: false } });
}

// Неотработанные ошибки: давно/никогда не виденные — первыми (интервал).
export async function getOpenMistakes(limit = 20): Promise<MistakeView[]> {
  const rows = await prisma.mistake.findMany({
    where: { resolved: false },
    orderBy: [{ lastSeen: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: limit,
  });
  return rows.map((m) => ({
    id: m.id,
    source: m.source,
    wrong: m.wrong,
    correct: m.correct,
    note: m.note,
    category: m.category,
    reps: m.reps,
  }));
}

export async function reviewMistake(
  id: number,
  correct: boolean
): Promise<{ resolved: boolean } | null> {
  const m = await prisma.mistake.findUnique({ where: { id } });
  if (!m) return null;
  const reps = correct ? m.reps + 1 : 0;
  const resolved = reps >= RESOLVE_AT;
  await prisma.mistake.update({
    where: { id },
    data: { reps, resolved, lastSeen: new Date() },
  });
  return { resolved };
}
