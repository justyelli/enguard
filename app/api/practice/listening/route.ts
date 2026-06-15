import { NextRequest, NextResponse } from "next/server";
import { generateListening, type Level } from "@/lib/practice";
import { getWeakWords } from "@/lib/analytics";

const LEVELS: Level[] = ["easy", "medium", "hard"];

// POST /api/practice/listening  { level }
export async function POST(req: NextRequest) {
  let level: Level = "medium";
  try {
    const body = await req.json();
    if (LEVELS.includes(body.level)) level = body.level;
  } catch {
    /* пустое тело — ок */
  }
  try {
    const weak = await getWeakWords(12).catch(() => []);
    const result = await generateListening(
      level,
      weak.map((w) => w.word)
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("listening error", e);
    return NextResponse.json({ error: "Не удалось получить предложения" }, { status: 500 });
  }
}
