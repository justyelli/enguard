import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { awardXp, practiceXp } from "@/lib/gamify";

const SKILLS = ["speaking", "listening", "grammar", "writing"];

// POST /api/practice/log  { skill, detail?, score, total, noAward? }
// noAward=true — записать сессию без начисления XP (репетитор уже даёт XP за реплику).
export async function POST(req: NextRequest) {
  let body: {
    skill?: string;
    detail?: string;
    score?: number;
    total?: number;
    noAward?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!body.skill || !SKILLS.includes(body.skill)) {
    return NextResponse.json({ error: "bad skill" }, { status: 400 });
  }
  const score = Math.max(0, Math.floor(Number(body.score) || 0));
  const total = Math.max(0, Math.floor(Number(body.total) || 0));
  await prisma.practiceLog.create({
    data: {
      skill: body.skill,
      detail: typeof body.detail === "string" ? body.detail.slice(0, 100) : null,
      score,
      total,
    },
  });
  const award = body.noAward ? null : await awardXp(practiceXp(score, total));
  return NextResponse.json({ ok: true, award });
}
