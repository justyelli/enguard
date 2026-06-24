import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { READING_COLLECTION } from "@/lib/reading-words";

type InWord = { word: string; translation: string; context?: string };

// POST /api/reading/add  { words: [{ word, translation, context? }] }
// Превращает слова из чтения в карточки С КОНТЕКСТОМ (коллекция «Слова из чтения»).
export async function POST(req: NextRequest) {
  let words: InWord[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body.words)) {
      words = body.words
        .filter(
          (w: unknown): w is InWord =>
            !!w &&
            typeof (w as InWord).word === "string" &&
            typeof (w as InWord).translation === "string" &&
            (w as InWord).word.trim().length > 0 &&
            (w as InWord).translation.trim().length > 0
        )
        .slice(0, 60);
    }
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (words.length === 0) {
    return NextResponse.json({ added: 0, collectionId: null });
  }

  const existing = await prisma.collection.findFirst({ where: { name: READING_COLLECTION } });
  const collection =
    existing ??
    (await prisma.collection.create({
      data: { name: READING_COLLECTION, description: "Слова, встреченные при чтении — с контекстом." },
    }));

  const siblings = await prisma.card.findMany({
    where: { collectionId: collection.id },
    select: { word: true },
  });
  const have = new Set(siblings.map((c) => c.word.toLowerCase()));

  const seen = new Set<string>();
  const fresh = words.filter((w) => {
    const k = w.word.trim().toLowerCase();
    if (have.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (fresh.length > 0) {
    await prisma.card.createMany({
      data: fresh.map((w) => ({
        collectionId: collection.id,
        word: w.word.trim(),
        translation: w.translation.trim(),
        context: w.context ? String(w.context).slice(0, 500) : null,
      })),
    });
  }

  return NextResponse.json({ added: fresh.length, collectionId: collection.id });
}
