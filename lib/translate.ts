import { prisma } from "@/lib/prisma";
import { getOpenAI, hasOpenAI, OPENAI_MODEL } from "@/lib/openai";

// Структура умного перевода — используется и в ридере (поповер),
// и на странице переводчика.
export type SmartTranslation = {
  term: string;
  translation: string; // короткий перевод на русский
  partOfSpeech?: string; // часть речи
  transcription?: string; // транскрипция (по возможности)
  meaning?: string; // пояснение значения на русском
  examples: { en: string; ru: string }[];
  synonyms: { word: string; note: string }[]; // синонимы с оттенком
  differences: { word: string; note: string }[]; // отличия от похожих слов
  fallback?: boolean; // true, если OpenAI недоступен
  full?: boolean; // true, если есть синонимы/отличия (полный режим)
};

export function normalizeTerm(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, "");
}

// Лёгкий режим: только самое нужное — быстро (для ридера).
const SYSTEM_LITE = `Ты — преподаватель английского для русскоязычных.
Дают английское слово/фразу (иногда с контекстом). Верни СТРОГО JSON без markdown:
{
  "translation": "краткий перевод на русский (1-4 слова)",
  "partOfSpeech": "часть речи на русском",
  "transcription": "IPA, напр. /əˈbændən/",
  "meaning": "одно короткое предложение: что значит, на русском",
  "examples": [ {"en": "пример", "ru": "перевод примера"} ]
}
Один пример. Если есть контекст — выбери подходящее значение. Будь краток.`;

// Полный режим: с синонимами и отличиями (для переводчика и «Подробнее»).
const SYSTEM_FULL = `Ты — опытный преподаватель английского для русскоязычных студентов.
Дают английское слово/фразу (иногда с контекстом). Верни СТРОГО JSON без markdown:
{
  "translation": "краткий перевод на русский (1-4 слова)",
  "partOfSpeech": "часть речи на русском",
  "transcription": "IPA, напр. /əˈbændən/",
  "meaning": "1-2 предложения: что значит, на русском",
  "examples": [ {"en": "пример", "ru": "перевод"} ],
  "synonyms": [ {"word": "synonym", "note": "оттенок различия, на русском"} ],
  "differences": [ {"word": "похожее слово", "note": "в чём разница, на русском"} ]
}
2 примера, 3 синонима, 2 отличия. Если есть контекст — выбери подходящее значение.`;

function fallbackTranslation(term: string): SmartTranslation {
  return {
    term,
    translation: "—",
    meaning:
      "Умный перевод появится после того, как ты вставишь ключ OpenAI в файл .env (поле OPENAI_API_KEY).",
    examples: [],
    synonyms: [],
    differences: [],
    fallback: true,
  };
}

async function callOpenAI(
  term: string,
  context: string | undefined,
  lite: boolean
): Promise<SmartTranslation> {
  const openai = getOpenAI();
  const userContent = context
    ? `Слово/фраза: "${term}"\nКонтекст: "${context}"`
    : `Слово/фраза: "${term}"`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    max_tokens: lite ? 280 : 700,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: lite ? SYSTEM_LITE : SYSTEM_FULL },
      { role: "user", content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let p: Partial<SmartTranslation> = {};
  try {
    p = JSON.parse(raw) as Partial<SmartTranslation>;
  } catch {
    p = {};
  }

  const examples = (Array.isArray(p.examples) ? p.examples : [])
    .filter((e) => e && typeof e.en === "string" && typeof e.ru === "string")
    .slice(0, 4);
  const synonyms = (Array.isArray(p.synonyms) ? p.synonyms : [])
    .filter((s) => s && typeof s.word === "string" && typeof s.note === "string")
    .slice(0, 4);
  const differences = (Array.isArray(p.differences) ? p.differences : [])
    .filter((d) => d && typeof d.word === "string" && typeof d.note === "string")
    .slice(0, 4);

  return {
    term,
    translation: typeof p.translation === "string" ? p.translation : "—",
    partOfSpeech: typeof p.partOfSpeech === "string" ? p.partOfSpeech : undefined,
    transcription:
      typeof p.transcription === "string" ? p.transcription : undefined,
    meaning: typeof p.meaning === "string" ? p.meaning : undefined,
    examples,
    synonyms,
    differences,
    full: !lite,
  };
}

/**
 * Возвращает умный перевод термина. Кэширует результат в таблице Translation.
 * lite=true — быстрый облегчённый перевод (для ридера).
 */
export async function getTranslation(
  rawTerm: string,
  context?: string,
  opts?: { lite?: boolean }
): Promise<SmartTranslation> {
  const lite = opts?.lite ?? false;
  const term = normalizeTerm(rawTerm);
  if (!term) return fallbackTranslation(rawTerm);

  // 1. Кэш
  const cached = await prisma.translation.findUnique({ where: { term } });
  if (cached) {
    try {
      const parsed = JSON.parse(cached.payload) as SmartTranslation;
      const isFull =
        parsed.full ||
        (parsed.synonyms?.length ?? 0) > 0 ||
        (parsed.differences?.length ?? 0) > 0;
      // Лёгкий запрос довольствуется любым кэшем; полный — только полным.
      if (lite || isFull) return { ...parsed, term };
      // иначе: запрошен полный, а в кэше лёгкий → до-генерируем ниже
    } catch {
      // битый кэш — перезапишем
    }
  }

  // 2. Нет ключа — фолбэк (не кэшируем)
  if (!hasOpenAI()) {
    return fallbackTranslation(term);
  }

  // 3. Запрос к OpenAI + кэш
  const result = await callOpenAI(term, context, lite);
  await prisma.translation.upsert({
    where: { term },
    create: { term, payload: JSON.stringify(result) },
    update: { payload: JSON.stringify(result) },
  });
  return result;
}
