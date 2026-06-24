import { NextResponse } from "next/server";
import { getOpenMistakes, getOpenMistakeCount } from "@/lib/mistakes";

// GET /api/mistakes → неотработанные ошибки + их число
export async function GET() {
  const [mistakes, count] = await Promise.all([
    getOpenMistakes(20),
    getOpenMistakeCount(),
  ]);
  return NextResponse.json({ mistakes, count });
}
