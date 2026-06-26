import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTerm } from "@/lib/translate";

// GET /api/match → { pairs: [{ word, translation }] } — до 6 случайных пар из карточек.
export async function GET() {
  const cards = await prisma.card.findMany({ select: { word: true, translation: true } });

  const seen = new Set<string>();
  const valid = cards.filter((c) => {
    const w = c.word.trim();
    const t = c.translation.trim();
    if (!w || !t || t === "—") return false;
    const k = normalizeTerm(w);
    if (!k || seen.has(k)) return false; // без дублей слова
    seen.add(k);
    return true;
  });

  // перемешиваем (Фишер–Йейтс)
  for (let i = valid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [valid[i], valid[j]] = [valid[j], valid[i]];
  }

  const pairs = valid.slice(0, 6).map((c) => ({
    word: c.word.trim(),
    translation: c.translation.trim(),
  }));
  return NextResponse.json({ pairs });
}
