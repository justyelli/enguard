import { NextRequest, NextResponse } from "next/server";
import { generateHook } from "@/lib/leech-hook";

// POST /api/leeches/hook  { word, translation } → мнемоника для запоминания
export async function POST(req: NextRequest) {
  let word = "";
  let translation = "";
  try {
    const body = await req.json();
    word = typeof body.word === "string" ? body.word.trim().slice(0, 80) : "";
    translation = typeof body.translation === "string" ? body.translation.trim().slice(0, 120) : "";
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!word || !translation) {
    return NextResponse.json({ error: "word и translation обязательны" }, { status: 400 });
  }
  const res = await generateHook(word, translation);
  return NextResponse.json(res);
}
