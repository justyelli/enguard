import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayKey } from "@/lib/workbook";
import { awardXp, XP } from "@/lib/gamify";

// POST /api/workbook/complete  { completed: boolean }
export async function POST(req: NextRequest) {
  let completed = false;
  try {
    ({ completed } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const day = todayKey();
  const existing = await prisma.workbook.findUnique({ where: { day } });
  if (!existing) {
    return NextResponse.json(
      { error: "воркбук на сегодня не найден" },
      { status: 404 }
    );
  }
  // XP за выполнение выдаём ровно один раз (нельзя нафармить пере-отметкой)
  const shouldAward = !!completed && !existing.rewardedXp;
  await prisma.workbook.update({
    where: { day },
    data: { completed: !!completed, ...(shouldAward ? { rewardedXp: true } : {}) },
  });
  const award = shouldAward ? await awardXp(XP.workbook) : null;
  return NextResponse.json({ ok: true, award });
}
