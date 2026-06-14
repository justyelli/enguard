import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/cards/[id]  { word?, translation?, example? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cardId = Number(id);
  if (!cardId) return NextResponse.json({ error: "bad id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const data: Record<string, string | boolean> = {};
  if (typeof body.word === "string") data.word = body.word.trim();
  if (typeof body.translation === "string")
    data.translation = body.translation.trim();
  if (typeof body.example === "string") data.example = body.example.trim();
  if (typeof body.starred === "boolean") data.starred = body.starred;

  try {
    const card = await prisma.card.update({ where: { id: cardId }, data });
    return NextResponse.json({ card });
  } catch {
    return NextResponse.json({ error: "карточка не найдена" }, { status: 404 });
  }
}

// DELETE /api/cards/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cardId = Number(id);
  if (!cardId) return NextResponse.json({ error: "bad id" }, { status: 400 });

  try {
    await prisma.card.delete({ where: { id: cardId } });
  } catch {
    return NextResponse.json({ error: "карточка не найдена" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
