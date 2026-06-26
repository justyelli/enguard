import { NextRequest, NextResponse } from "next/server";
import { generateStory, STORY_LEVELS, type Level } from "@/lib/listening-story";

// POST /api/reading/passage  { level, topic? } → короткий текст по уровню + вопросы
export async function POST(req: NextRequest) {
  let level: Level = "B1";
  let topic = "";
  try {
    const body = await req.json();
    if (STORY_LEVELS.includes(body.level)) level = body.level;
    if (typeof body.topic === "string") topic = body.topic.trim().slice(0, 80);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const story = await generateStory(level, topic);
  return NextResponse.json({ story });
}
