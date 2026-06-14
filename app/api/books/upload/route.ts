import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEpub } from "@/lib/epub";

export const runtime = "nodejs";

// POST /api/books/upload  (multipart/form-data, поле "file" — .epub)
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }
    if (!/\.epub$/i.test(file.name)) {
      return NextResponse.json(
        { error: "Нужен файл в формате .epub" },
        { status: 400 }
      );
    }
    const MAX = 30 * 1024 * 1024; // 30 МБ
    if (file.size > MAX) {
      return NextResponse.json(
        { error: "Файл слишком большой (максимум 30 МБ)" },
        { status: 413 }
      );
    }

    const buffer = await file.arrayBuffer();
    const parsed = await parseEpub(buffer);

    const book = await prisma.book.create({
      data: {
        title: parsed.title,
        author: parsed.author,
        chapters: {
          create: parsed.chapters.map((c, index) => ({
            index,
            title: c.title,
            content: c.content,
          })),
        },
        progress: { create: {} },
      },
    });

    return NextResponse.json({ book: { id: book.id, title: book.title } });
  } catch (e) {
    console.error("epub upload error", e);
    // показываем только наши «дружелюбные» сообщения (кириллица), не внутренние ошибки библиотек
    const raw = e instanceof Error ? e.message : "";
    const safe = /[А-Яа-я]/.test(raw)
      ? raw
      : "Не удалось обработать файл — проверь, что это корректный EPUB.";
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}
