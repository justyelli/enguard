import { NextResponse } from "next/server";
import { getReadingSentences } from "@/lib/reading-words";

// GET /api/reading/sentences → предложения из чтения для shadowing
export async function GET() {
  const sentences = await getReadingSentences(10);
  return NextResponse.json({ sentences });
}
