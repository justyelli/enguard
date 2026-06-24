import { NextRequest, NextResponse } from "next/server";
import { recordMistakes, type MistakeInput, type MistakeSource } from "@/lib/mistakes";

const SOURCES: MistakeSource[] = ["writing", "tutor", "grammar"];

// POST /api/mistakes/record  { items: [{ source, wrong, correct, note?, category? }] }
// Используется клиентскими модулями (грамм-квиз) для записи ошибок.
export async function POST(req: NextRequest) {
  let items: MistakeInput[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body.items)) {
      items = body.items
        .filter(
          (i: unknown): i is MistakeInput =>
            !!i &&
            SOURCES.includes((i as MistakeInput).source) &&
            typeof (i as MistakeInput).wrong === "string" &&
            typeof (i as MistakeInput).correct === "string"
        )
        .slice(0, 30);
    }
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const added = await recordMistakes(items);
  return NextResponse.json({ ok: true, added });
}
