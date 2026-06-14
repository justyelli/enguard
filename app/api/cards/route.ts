import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/cards  { collectionId, word, translation, example?, context? }
// Добавляет карточку в коллекцию (без дублей одного слова в одной коллекции).
export async function POST(req: NextRequest) {
  try {
    const { collectionId, word, translation, example, context } =
      await req.json();

    if (!collectionId || !word || !translation) {
      return NextResponse.json(
        { error: "collectionId, word и translation обязательны" },
        { status: 400 }
      );
    }

    const cleanWord = String(word).trim();
    // дедуп без учёта регистра (SQLite '=' регистрозависим)
    const siblings = await prisma.card.findMany({
      where: { collectionId: Number(collectionId) },
      select: { id: true, word: true },
    });
    const dup = siblings.find(
      (c) => c.word.toLowerCase() === cleanWord.toLowerCase()
    );
    if (dup) {
      return NextResponse.json({ card: dup, duplicate: true });
    }

    const card = await prisma.card.create({
      data: {
        collectionId: Number(collectionId),
        word: cleanWord,
        translation: String(translation).trim(),
        example: example ? String(example).trim() : null,
        context: context ? String(context).trim() : null,
      },
    });

    return NextResponse.json({ card });
  } catch (e) {
    console.error("card create error", e);
    return NextResponse.json(
      { error: "Не удалось добавить карточку" },
      { status: 500 }
    );
  }
}
