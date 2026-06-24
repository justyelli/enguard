import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  unaddedWords,
  VOCAB_BANDS,
  VOCAB_COLLECTION_PREFIX,
  type Band,
} from "@/lib/vocab";

// POST /api/vocab/add  { band, count? }
// Добавляет следующую порцию ещё не добавленных core-слов уровня в карточки.
export async function POST(req: NextRequest) {
  let band: Band = "A2";
  let count = 10;
  try {
    const body = await req.json();
    if (VOCAB_BANDS.includes(body.band)) band = body.band;
    else return NextResponse.json({ error: "bad band" }, { status: 400 });
    if (Number.isFinite(body.count)) count = Math.max(1, Math.min(30, Math.floor(body.count)));
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const toAdd = (await unaddedWords(band)).slice(0, count);
  if (toAdd.length === 0) {
    return NextResponse.json({ added: 0, collectionId: null, done: true });
  }

  const name = `${VOCAB_COLLECTION_PREFIX} · ${band}`;
  // find-or-create коллекцию уровня (name не уникален в схеме — ищем вручную)
  const existing = await prisma.collection.findFirst({ where: { name } });
  const collection =
    existing ??
    (await prisma.collection.create({
      data: { name, description: `Базовые слова уровня ${band} для повторения.` },
    }));

  // дедуп внутри коллекции на случай гонок
  const siblings = await prisma.card.findMany({
    where: { collectionId: collection.id },
    select: { word: true },
  });
  const have = new Set(siblings.map((c) => c.word.toLowerCase()));
  const fresh = toAdd.filter((w) => !have.has(w.w.toLowerCase()));

  if (fresh.length > 0) {
    await prisma.card.createMany({
      data: fresh.map((w) => ({
        collectionId: collection.id,
        word: w.w,
        translation: w.t,
        example: w.ex,
      })),
    });
  }

  return NextResponse.json({
    added: fresh.length,
    collectionId: collection.id,
    done: toAdd.length < count,
  });
}
