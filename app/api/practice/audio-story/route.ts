import { NextRequest, NextResponse } from "next/server";
import { generateStory, STORY_LEVELS, type Level } from "@/lib/listening-story";

// POST /api/practice/audio-story  { level } → история + вопросы
export async function POST(req: NextRequest) {
  let level: Level = "A2";
  try {
    const body = await req.json();
    if (STORY_LEVELS.includes(body.level)) level = body.level;
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const story = await generateStory(level);
  return NextResponse.json({ story });
}
