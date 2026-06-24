import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateVocabBatch,
  existingCardWords,
  CORE_VOCAB,
  VOCAB_BANDS,
  VOCAB_KIND_COLLECTION,
  type Band,
  type VocabKind,
} from "@/lib/vocab";
import { hasOpenAI } from "@/lib/openai";

const KINDS: VocabKind[] = ["words", "collocations", "phrasals"];

// POST /api/vocab/generate  { band, count?, kind? }
// ИИ подбирает следующую порцию частотных слов/сочетаний/фразовых глаголов уровня
// (минус уже известные), добавляет в коллекцию по виду как карточки.
export async function POST(req: NextRequest) {
  let band: Band = "A2";
  let count = 10;
  let kind: VocabKind = "words";
  try {
    const body = await req.json();
    if (VOCAB_BANDS.includes(body.band)) band = body.band;
    else return NextResponse.json({ error: "bad band" }, { status: 400 });
    if (Number.isFinite(body.count)) count = Math.max(1, Math.min(20, Math.floor(body.count)));
    if (KINDS.includes(body.kind)) kind = body.kind;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  if (!hasOpenAI()) {
    return NextResponse.json({ added: 0, ai: false, reason: "no_openai" });
  }

  // исключаем всё, что уже есть в карточках, и всё курируемое ядро всех уровней
  const cardWords = await existingCardWords();
  const coreWords = VOCAB_BANDS.flatMap((b) => CORE_VOCAB[b].map((w) => w.w));
  const exclude = [...new Set([...cardWords, ...coreWords])];

  const batch = await generateVocabBatch(band, exclude, count, kind);
  if (batch.length === 0) {
    return NextResponse.json({ added: 0, ai: true });
  }

  const name = VOCAB_KIND_COLLECTION[kind](band);
  const existing = await prisma.collection.findFirst({ where: { name } });
  const collection =
    existing ??
    (await prisma.collection.create({
      data: { name, description: `${name} — для повторения.` },
    }));

  const siblings = await prisma.card.findMany({
    where: { collectionId: collection.id },
    select: { word: true },
  });
  const have = new Set(siblings.map((c) => c.word.toLowerCase()));
  const fresh = batch.filter((w) => !have.has(w.w.toLowerCase()));

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

  return NextResponse.json({ added: fresh.length, ai: true, collectionId: collection.id });
}
