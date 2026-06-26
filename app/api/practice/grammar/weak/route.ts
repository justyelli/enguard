import { NextResponse } from "next/server";
import { getWeakGrammarTopic } from "@/lib/mistakes";

// GET /api/practice/grammar/weak → { topic, count } | { topic: null }
// Тема, в которой ученик чаще всего ошибается (для преднастройки квиза).
export async function GET() {
  try {
    const weak = await getWeakGrammarTopic();
    return NextResponse.json(weak ?? { topic: null });
  } catch {
    return NextResponse.json({ topic: null });
  }
}
