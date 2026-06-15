import { NextResponse } from "next/server";
import { generateWritingPrompt } from "@/lib/practice";
import { getWeakWords } from "@/lib/analytics";

// POST /api/practice/writing/prompt → { prompt }
export async function POST() {
  try {
    const weak = await getWeakWords(8).catch(() => []);
    const prompt = await generateWritingPrompt(weak.map((w) => w.word));
    return NextResponse.json({ prompt });
  } catch (e) {
    console.error("writing prompt error", e);
    return NextResponse.json({ error: "Не удалось получить задание" }, { status: 500 });
  }
}
