import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generatePlacement,
  estimateLevel,
  baselineXpFor,
  BANDS,
  type Band,
  type Bands,
  type PlacementQuestion,
} from "@/lib/placement";
import { setBaselineXp } from "@/lib/gamify";

// GET /api/placement → вопросы диагностики
export async function GET() {
  const { questions, usedAI } = await generatePlacement();
  return NextResponse.json({ questions, usedAI });
}

// POST /api/placement  { questions: PlacementQuestion[], answers: number[] }
// → оценивает уровень, выставляет стартовую базовую линию XP, логирует.
export async function POST(req: NextRequest) {
  let questions: PlacementQuestion[] = [];
  let answers: number[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body.questions)) questions = body.questions;
    if (Array.isArray(body.answers)) answers = body.answers.map((a: unknown) => Number(a));
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (questions.length === 0 || answers.length !== questions.length) {
    return NextResponse.json({ error: "bad data" }, { status: 400 });
  }
  // структурная проверка элементов — иначе битый questions роняет оценку в 500
  const wellFormed = questions.every(
    (q) =>
      q &&
      typeof q === "object" &&
      typeof (q as PlacementQuestion).level === "string" &&
      Number.isInteger((q as PlacementQuestion).answer)
  );
  if (!wellFormed) {
    return NextResponse.json({ error: "bad questions" }, { status: 400 });
  }

  const bands: Bands = {
    A2: { correct: 0, total: 0 },
    B1: { correct: 0, total: 0 },
    B2: { correct: 0, total: 0 },
    C1: { correct: 0, total: 0 },
  };
  let totalCorrect = 0;
  questions.forEach((q, i) => {
    const lvl = q.level as Band;
    if (!BANDS.includes(lvl)) return;
    bands[lvl].total += 1;
    if (Number(answers[i]) === Number(q.answer)) {
      bands[lvl].correct += 1;
      totalCorrect += 1;
    }
  });

  const level = estimateLevel(bands);
  const baselineXp = baselineXpFor(level);
  const newTotalXp = await setBaselineXp(baselineXp);

  await prisma.practiceLog.create({
    data: {
      skill: "placement",
      detail: level,
      score: totalCorrect,
      total: questions.length,
    },
  });

  return NextResponse.json({
    level,
    baselineXp,
    newTotalXp,
    correct: totalCorrect,
    total: questions.length,
    bands,
  });
}
