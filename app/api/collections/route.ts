import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/collections — список коллекций с числом карточек
export async function GET() {
  const collections = await prisma.collection.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cards: true } } },
  });
  return NextResponse.json({
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      count: c._count.cards,
    })),
  });
}

// POST /api/collections  { name, description? } — создать коллекцию
export async function POST(req: NextRequest) {
  let name: unknown, description: unknown;
  try {
    ({ name, description } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name обязателен" }, { status: 400 });
  }
  const desc =
    typeof description === "string" && description.trim() ? description.trim() : null;
  const collection = await prisma.collection.create({
    data: { name: name.trim(), description: desc },
  });
  return NextResponse.json({ collection });
}
