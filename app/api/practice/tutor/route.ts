import { NextRequest, NextResponse } from "next/server";
import { tutorReply, type TutorTurn } from "@/lib/practice";
import { awardXp } from "@/lib/gamify";
import { recordMistakesSafe } from "@/lib/mistakes";

// POST /api/practice/tutor  { scenario, messages: [{role, content}] }
export async function POST(req: NextRequest) {
  let scenario = "Свободный разговор на любую тему";
  let messages: TutorTurn[] = [];
  try {
    const body = await req.json();
    if (typeof body.scenario === "string" && body.scenario.trim()) {
      scenario = body.scenario.trim().slice(0, 200);
    }
    if (Array.isArray(body.messages)) {
      messages = body.messages
        .filter(
          (m: unknown): m is TutorTurn =>
            !!m &&
            typeof (m as TutorTurn).content === "string" &&
            ((m as TutorTurn).role === "user" || (m as TutorTurn).role === "assistant")
        )
        .map((m: TutorTurn) => ({ role: m.role, content: m.content.slice(0, 1000) }))
        .slice(-12);
    }
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  try {
    const result = await tutorReply(scenario, messages);
    // XP за реплику студента (последнее сообщение — user)
    let award = null;
    if (!result.fallback && messages.length > 0 && messages[messages.length - 1].role === "user") {
      award = await awardXp(4);
    }
    // в журнал ошибок — мягкое исправление репетитора
    if (result.correction) {
      await recordMistakesSafe([
        {
          source: "tutor",
          wrong: result.correction.original,
          correct: result.correction.fixed,
          note: result.correction.note,
        },
      ]);
    }
    return NextResponse.json({ ...result, award });
  } catch (e) {
    console.error("tutor route error", e);
    return NextResponse.json({ error: "Ошибка репетитора" }, { status: 500 });
  }
}
