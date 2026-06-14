import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayKey } from "@/lib/workbook";

// POST /api/workbook/complete  { completed: boolean }
export async function POST(req: NextRequest) {
  let completed = false;
  try {
    ({ completed } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const day = todayKey();
  const res = await prisma.workbook.updateMany({
    where: { day },
    data: { completed: !!completed },
  });
  if (res.count === 0) {
    return NextResponse.json(
      { error: "воркбук на сегодня не найден" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
