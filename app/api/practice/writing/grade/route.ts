import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gradeWriting } from "@/lib/practice";
import { awardXp, practiceXp } from "@/lib/gamify";

// POST /api/practice/writing/grade  { prompt, text }
export async function POST(req: NextRequest) {
  let prompt = "";
  let text = "";
  try {
    ({ prompt, text } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (typeof text !== "string" || text.trim().length < 3) {
    return NextResponse.json({ error: "Напиши хотя бы пару предложений" }, { status: 400 });
  }

  try {
    const feedback = await gradeWriting(String(prompt || ""), text.trim());

    // сохраняем работу и лог практики (если был реальный разбор)
    await prisma.writingSubmission.create({
      data: {
        prompt: String(prompt || "").slice(0, 500),
        text: text.trim(),
        score: feedback.score,
        feedback: JSON.stringify(feedback),
      },
    });
    let award = null;
    if (!feedback.fallback) {
      await prisma.practiceLog.create({
        data: { skill: "writing", score: feedback.score, total: 100 },
      });
      award = await awardXp(practiceXp(feedback.score, 100));
    }

    return NextResponse.json({ feedback, award });
  } catch (e) {
    console.error("writing grade error", e);
    return NextResponse.json({ error: "Не удалось проверить текст" }, { status: 500 });
  }
}
