import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE /api/books/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bookId = Number(id);
  if (!bookId) return NextResponse.json({ error: "bad id" }, { status: 400 });

  try {
    await prisma.book.delete({ where: { id: bookId } });
  } catch {
    return NextResponse.json({ error: "не найдено" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
