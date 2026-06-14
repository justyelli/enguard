import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PUT /api/collections/[id]  { name?, description? }
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cid = Number(id);
  if (!cid) return NextResponse.json({ error: "bad id" }, { status: 400 });

  let body: { name?: unknown; description?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const data: Record<string, string | null> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string")
    data.description = body.description.trim() || null;

  try {
    const collection = await prisma.collection.update({ where: { id: cid }, data });
    return NextResponse.json({ collection });
  } catch {
    return NextResponse.json({ error: "не найдено" }, { status: 404 });
  }
}

// DELETE /api/collections/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cid = Number(id);
  if (!cid) return NextResponse.json({ error: "bad id" }, { status: 400 });

  try {
    await prisma.collection.delete({ where: { id: cid } });
  } catch {
    return NextResponse.json({ error: "не найдено" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
