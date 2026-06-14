import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Разбивает текст на главы по строкам-разделителям "---" (3+ дефиса).
// Если разделителей нет — одна глава.
function splitChapters(text: string): { title: string | null; content: string }[] {
  const parts = text
    .split(/\n\s*-{3,}\s*\n/g)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks = parts.length > 0 ? parts : [text.trim()];

  return chunks.map((chunk, i) => {
    const lines = chunk.split("\n");
    const first = lines[0]?.trim() ?? "";
    // Короткая первая строка считается заголовком главы.
    const isHeading = first.length > 0 && first.length <= 80 && lines.length > 1;
    return {
      title: isHeading ? first : `Глава ${i + 1}`,
      content: isHeading ? lines.slice(1).join("\n").trim() : chunk,
    };
  });
}

// POST /api/books  { title, author?, text }
export async function POST(req: NextRequest) {
  try {
    const { title, author, text } = await req.json();
    if (!title || !text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "title и text обязательны" },
        { status: 400 }
      );
    }

    const chapters = splitChapters(text);

    const book = await prisma.book.create({
      data: {
        title: String(title).trim(),
        author: author ? String(author).trim() : null,
        chapters: {
          create: chapters.map((c, index) => ({
            index,
            title: c.title,
            content: c.content,
          })),
        },
        progress: { create: {} },
      },
      include: { _count: { select: { chapters: true } } },
    });

    return NextResponse.json({ book });
  } catch (e) {
    console.error("book create error", e);
    return NextResponse.json(
      { error: "Не удалось создать книгу" },
      { status: 500 }
    );
  }
}
