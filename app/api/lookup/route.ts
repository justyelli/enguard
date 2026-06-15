import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTranslation, normalizeTerm } from "@/lib/translate";
import { awardXp, XP } from "@/lib/gamify";

// POST /api/lookup  { term, context?, bookId? }
// Возвращает умный перевод и логирует клик по слову.
export async function POST(req: NextRequest) {
  try {
    const { term, context, bookId, log = true, lite = false } = await req.json();
    if (!term || typeof term !== "string") {
      return NextResponse.json({ error: "term обязателен" }, { status: 400 });
    }

    const translation = await getTranslation(term, context, { lite });

    if (log) {
      const word = normalizeTerm(term);
      if (word) {
        // XP только за первое обращение к слову за день (без фарма повторными кликами)
        const startToday = new Date();
        startToday.setHours(0, 0, 0, 0);
        const seenToday = await prisma.wordLookup.count({
          where: { word, createdAt: { gte: startToday } },
        });
        await prisma.wordLookup.create({
          data: {
            word,
            context: typeof context === "string" ? context.slice(0, 500) : null,
            bookId: typeof bookId === "number" ? bookId : null,
          },
        });
        if (seenToday === 0) await awardXp(XP.lookup);
      }
    }

    return NextResponse.json({ translation });
  } catch (e) {
    console.error("lookup error", e);
    return NextResponse.json(
      { error: "Не удалось получить перевод" },
      { status: 500 }
    );
  }
}
