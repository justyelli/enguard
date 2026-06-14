import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// GET /api/collections/[id]/export → CSV (word,translation,example)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cid = Number(id);
  if (!cid) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const collection = await prisma.collection.findUnique({
    where: { id: cid },
    include: { cards: { orderBy: { createdAt: "asc" } } },
  });
  if (!collection) {
    return NextResponse.json({ error: "не найдено" }, { status: 404 });
  }

  const rows = ["word,translation,example"];
  for (const c of collection.cards) {
    rows.push(
      [c.word, c.translation, c.example ?? ""].map(csvCell).join(",")
    );
  }
  const csv = rows.join("\n");
  const safeName = collection.name.replace(/[^\p{L}\p{N}_-]+/gu, "_");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName || "collection"}.csv"`,
    },
  });
}
