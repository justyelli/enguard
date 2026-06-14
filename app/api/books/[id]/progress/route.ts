import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/books/[id]/progress  { chapterIndex, scrollPct }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bookId = Number(id);
  if (!bookId) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  let body: { chapterIndex?: unknown; scrollPct?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const chapterIndex = Math.max(0, Math.floor(Number(body.chapterIndex) || 0));
  const scrollPct = Math.min(1, Math.max(0, Number(body.scrollPct) || 0));

  try {
    await prisma.readingProgress.upsert({
      where: { bookId },
      create: { bookId, chapterIndex, scrollPct },
      update: { chapterIndex, scrollPct },
    });
  } catch {
    // книга могла быть удалена (нарушение внешнего ключа) — мягко игнорируем
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
