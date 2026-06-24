import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/gamify";

const ALLOWED = [50, 150, 300, 450, 600];

// POST /api/profile/goal  { goalXp }
export async function POST(req: NextRequest) {
  let goalXp = 50;
  try {
    ({ goalXp } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!ALLOWED.includes(Number(goalXp))) {
    return NextResponse.json({ error: "bad goal" }, { status: 400 });
  }
  const p = await getProfile();
  await prisma.profile.update({
    where: { id: p.id },
    data: { dailyGoalXp: Number(goalXp) },
  });
  return NextResponse.json({ ok: true });
}
