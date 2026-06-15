import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { review, gradeFromCorrect, type Grade } from "@/lib/srs";
import { awardXp, XP } from "@/lib/gamify";

// POST /api/review  { cardId, mode, correct?, grade? }
// Обновляет SRS-состояние карточки и пишет лог повтора.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cardId = Number(body.cardId);
    const mode: string = body.mode || "flashcard";
    if (!cardId) {
      return NextResponse.json({ error: "cardId обязателен" }, { status: 400 });
    }

    const card = await prisma.card.findUnique({ where: { id: cardId } });
    if (!card) {
      return NextResponse.json({ error: "карточка не найдена" }, { status: 404 });
    }

    const VALID: Grade[] = ["again", "hard", "good", "easy"];
    const grade: Grade = VALID.includes(body.grade)
      ? body.grade
      : gradeFromCorrect(!!body.correct);
    const correct = grade !== "again";

    const upd = review(
      {
        ease: card.ease,
        intervalDays: card.intervalDays,
        reps: card.reps,
        lapses: card.lapses,
      },
      grade
    );

    await prisma.$transaction([
      prisma.card.update({
        where: { id: cardId },
        data: {
          ease: upd.ease,
          intervalDays: upd.intervalDays,
          reps: upd.reps,
          lapses: upd.lapses,
          dueDate: upd.dueDate,
          lastReviewed: new Date(),
        },
      }),
      prisma.reviewLog.create({
        data: { cardId, mode, correct },
      }),
    ]);

    const award = await awardXp(correct ? XP.reviewCorrect : XP.reviewWrong);

    return NextResponse.json({ ok: true, dueDate: upd.dueDate, award });
  } catch (e) {
    console.error("review error", e);
    return NextResponse.json({ error: "Ошибка повтора" }, { status: 500 });
  }
}
