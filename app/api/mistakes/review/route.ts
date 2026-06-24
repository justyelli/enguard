import { NextRequest, NextResponse } from "next/server";
import { reviewMistake } from "@/lib/mistakes";
import { awardXp } from "@/lib/gamify";

// POST /api/mistakes/review  { id, correct }
export async function POST(req: NextRequest) {
  let id: number;
  let correct: boolean;
  try {
    const body = await req.json();
    id = Number(body.id);
    correct = !!body.correct;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const res = await reviewMistake(id, correct);
  if (!res) return NextResponse.json({ error: "not found" }, { status: 404 });

  // небольшая награда за верную отработку ошибки
  const award = correct ? await awardXp(3) : null;
  return NextResponse.json({ ...res, award });
}
