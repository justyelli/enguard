import { NextRequest, NextResponse } from "next/server";
import { getOrCreateTodayWorkbook } from "@/lib/workbook";

// POST /api/workbook/generate  { regenerate?: boolean }
export async function POST(req: NextRequest) {
  try {
    let regenerate = false;
    try {
      const body = await req.json();
      regenerate = !!body.regenerate;
    } catch {
      /* пустое тело — ок */
    }
    const result = await getOrCreateTodayWorkbook(regenerate);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("workbook generate error", e);
    return NextResponse.json(
      { error: "Не удалось создать воркбук" },
      { status: 500 }
    );
  }
}
