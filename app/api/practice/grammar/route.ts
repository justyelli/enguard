import { NextRequest, NextResponse } from "next/server";
import { generateGrammarQuiz, type Level } from "@/lib/practice";

const LEVELS: Level[] = ["easy", "medium", "hard"];

// POST /api/practice/grammar  { topic, level }
export async function POST(req: NextRequest) {
  let topic = "Времена (Tenses)";
  let level: Level = "medium";
  try {
    const body = await req.json();
    if (typeof body.topic === "string" && body.topic.trim()) topic = body.topic.trim();
    if (LEVELS.includes(body.level)) level = body.level;
  } catch {
    /* ок */
  }
  try {
    const quiz = await generateGrammarQuiz(topic, level);
    return NextResponse.json(quiz);
  } catch (e) {
    console.error("grammar error", e);
    return NextResponse.json({ error: "Не удалось создать квиз" }, { status: 500 });
  }
}
