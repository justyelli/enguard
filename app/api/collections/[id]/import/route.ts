import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Полноценный разбор CSV/TSV одним проходом: кавычки переносятся между
// физическими строками (поле в кавычках может содержать перевод строки).
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delim) {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch === "\r") {
      // игнорируем
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

// POST /api/collections/[id]/import  (multipart: file CSV/TSV; word,translation[,example])
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cid = Number(id);
    if (!cid) return NextResponse.json({ error: "bad id" }, { status: 400 });

    const exists = await prisma.collection.findUnique({ where: { id: cid } });
    if (!exists) return NextResponse.json({ error: "не найдено" }, { status: 404 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "файл не передан" }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "файл слишком большой" }, { status: 413 });
    }

    const text = await file.text();
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const delim = firstLine.includes("\t") ? "\t" : ",";

    const rows = parseCsv(text, delim);
    if (rows.length === 0) {
      return NextResponse.json({ error: "пустой файл" }, { status: 400 });
    }

    // пропускаем строку-заголовок, если она похожа на заголовок
    let start = 0;
    const head = rows[0].map((s) => s.trim().toLowerCase());
    if (head[0] === "word" || head[1] === "translation") start = 1;

    const existing = new Set(
      (await prisma.card.findMany({ where: { collectionId: cid }, select: { word: true } }))
        .map((c) => c.word.toLowerCase())
    );

    const toCreate: {
      collectionId: number;
      word: string;
      translation: string;
      example: string | null;
    }[] = [];
    for (let i = start; i < rows.length; i++) {
      const cells = rows[i];
      const word = (cells[0] ?? "").trim();
      const translation = (cells[1] ?? "").trim();
      const example = (cells[2] ?? "").trim() || null;
      if (!word || !translation) continue;
      if (existing.has(word.toLowerCase())) continue;
      existing.add(word.toLowerCase());
      toCreate.push({ collectionId: cid, word, translation, example });
    }

    if (toCreate.length > 0) {
      await prisma.card.createMany({ data: toCreate });
    }

    return NextResponse.json({ added: toCreate.length });
  } catch (e) {
    console.error("import error", e);
    return NextResponse.json({ error: "не удалось импортировать" }, { status: 400 });
  }
}
