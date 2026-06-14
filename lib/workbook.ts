import { prisma } from "@/lib/prisma";
import { getOpenAI, hasOpenAI, OPENAI_MODEL } from "@/lib/openai";
import { getWeakWords, type WeakWord } from "@/lib/analytics";

export type WorkbookItem = { q: string; a: string };
export type WorkbookSection = {
  title: string;
  instruction: string;
  items: WorkbookItem[];
};
export type WorkbookData = {
  title: string;
  day: string;
  sections: WorkbookSection[];
};

export function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SYSTEM = `Ты — методист английского языка для русскоязычных студентов.
По списку слов (слово — перевод — пример) составь персональный рабочий лист (worksheet)
для печати на одном листе A4. Он должен помочь закрепить именно эти слова.
Верни СТРОГО JSON без markdown:
{
  "title": "короткий заголовок листа",
  "sections": [
    {
      "title": "название раздела",
      "instruction": "что делать (на русском)",
      "items": [ { "q": "задание/предложение с пропуском ___", "a": "правильный ответ" } ]
    }
  ]
}
Сделай 4 раздела:
1. Перевод EN→RU (q = английское слово, a = русский перевод).
2. Перевод RU→EN (q = русское слово, a = английское слово).
3. Заполни пропуск: предложение с "___" вместо изучаемого слова (a = это слово).
4. Составь предложение или выбери синоним — короткое творческое задание (a = пример ответа).
Используй ВСЕ переданные слова, распределив их по разделам. Пиши примеры естественно.`;

function buildFallback(words: WeakWord[]): WorkbookData {
  const enRu: WorkbookItem[] = words.map((w) => ({ q: w.word, a: w.translation }));
  const ruEn: WorkbookItem[] = words.map((w) => ({ q: w.translation, a: w.word }));
  const gaps: WorkbookItem[] = words
    .filter((w) => w.example)
    .map((w) => ({
      q: w.example!.replace(
        new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
        "______"
      ),
      a: w.word,
    }));

  const sections: WorkbookSection[] = [
    {
      title: "1. Переведи на русский",
      instruction: "Напиши перевод каждого слова.",
      items: enRu,
    },
    {
      title: "2. Переведи на английский",
      instruction: "Напиши английское слово.",
      items: ruEn,
    },
  ];
  if (gaps.length > 0) {
    sections.push({
      title: "3. Заполни пропуски",
      instruction: "Вставь подходящее слово.",
      items: gaps,
    });
  }

  return { title: "Рабочий лист дня", day: todayKey(), sections };
}

async function generateWithAI(words: WeakWord[]): Promise<WorkbookData> {
  const openai = getOpenAI();
  const list = words
    .map((w) => `${w.word} — ${w.translation}${w.example ? ` (${w.example})` : ""}`)
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Слова:\n${list}` },
    ],
  });

  let parsed: { title?: string; sections?: unknown };
  try {
    parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  } catch {
    return buildFallback(words);
  }
  const sections: WorkbookSection[] = Array.isArray(parsed.sections)
    ? parsed.sections
        .map((s: Partial<WorkbookSection>) => ({
          title: String(s.title ?? ""),
          instruction: String(s.instruction ?? ""),
          items: Array.isArray(s.items)
            ? s.items
                .filter((i: Partial<WorkbookItem>) => i && i.q)
                .map((i: Partial<WorkbookItem>) => ({
                  q: String(i.q),
                  a: String(i.a ?? ""),
                }))
            : [],
        }))
        .filter((s: WorkbookSection) => s.items.length > 0)
    : [];

  if (sections.length === 0) return buildFallback(words);

  return {
    title: String(parsed.title || "Рабочий лист дня"),
    day: todayKey(),
    sections,
  };
}

/**
 * Возвращает (создаёт при отсутствии) воркбук на сегодня.
 * regenerate=true пересоздаёт его заново.
 */
export async function getOrCreateTodayWorkbook(
  regenerate = false
): Promise<{ data: WorkbookData; completed: boolean; usedAI: boolean } | { error: string }> {
  const day = todayKey();

  if (!regenerate) {
    const existing = await prisma.workbook.findUnique({ where: { day } });
    if (existing) {
      return {
        data: JSON.parse(existing.answers) as WorkbookData,
        completed: existing.completed,
        usedAI: true,
      };
    }
  }

  const words = await getWeakWords(12);
  if (words.length < 3) {
    return {
      error:
        "Пока мало данных для воркбука. Почитай книгу, попереводи слова и добавь карточки — и я составлю персональный лист.",
    };
  }

  const usedAI = hasOpenAI();
  const data = usedAI ? await generateWithAI(words) : buildFallback(words);

  // tasks — версия без ответов (для отображения)
  const tasks: WorkbookData = {
    ...data,
    sections: data.sections.map((s) => ({
      ...s,
      items: s.items.map((i) => ({ q: i.q, a: "" })),
    })),
  };

  await prisma.workbook.upsert({
    where: { day },
    create: {
      day,
      title: data.title,
      tasks: JSON.stringify(tasks),
      answers: JSON.stringify(data),
      completed: false,
    },
    update: {
      title: data.title,
      tasks: JSON.stringify(tasks),
      answers: JSON.stringify(data),
      completed: false,
    },
  });

  return { data, completed: false, usedAI };
}
