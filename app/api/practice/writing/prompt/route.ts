import { NextResponse } from "next/server";
import { generateWritingPrompt } from "@/lib/practice";
import { getWeakWords } from "@/lib/analytics";

// POST /api/practice/writing/prompt → { prompt, words }
// words — целевые слова ученика для продуктивного использования в тексте.
export async function POST() {
  try {
    const weak = (await getWeakWords(8).catch(() => [])).slice(0, 5);
    const prompt = await generateWritingPrompt(weak.map((w) => w.word));
    return NextResponse.json({
      prompt,
      words: weak.map((w) => ({ word: w.word, translation: w.translation })),
    });
  } catch (e) {
    console.error("writing prompt error", e);
    return NextResponse.json({ error: "Не удалось получить задание" }, { status: 500 });
  }
}
