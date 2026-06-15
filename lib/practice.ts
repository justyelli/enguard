import { getOpenAI, hasOpenAI, OPENAI_MODEL } from "@/lib/openai";

export type Level = "easy" | "medium" | "hard";

// ─────────────────────────── Общий вызов OpenAI с JSON ───────────────────────────

async function askJSON<T>(
  system: string,
  user: string,
  fallback: T,
  maxTokens = 900
): Promise<T> {
  if (!hasOpenAI()) return fallback;
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.6,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error("practice openai error", e);
    return fallback;
  }
}

// ─────────────────────────── Listening: предложения для диктанта ───────────────────────────

const LISTEN_SYS = `Ты — преподаватель английского. Сгенерируй короткие осмысленные английские предложения для аудирования (диктанта) под заданный уровень.
Верни СТРОГО JSON: { "sentences": ["...", "..."] }
Требования: 6 предложений; easy — 4-7 слов, простая лексика; medium — 8-12 слов; hard — 12-18 слов, естественные конструкции. Без нумерации, без кавычек внутри. Если даны слова студента — постарайся использовать часть из них.`;

const FALLBACK_LISTEN: Record<Level, string[]> = {
  easy: [
    "The cat sleeps on the warm bed.",
    "She drinks coffee every morning.",
    "We walk to school together.",
    "He likes to read good books.",
    "The sun is bright today.",
    "They play in the green park.",
  ],
  medium: [
    "My brother usually takes the bus to work in the morning.",
    "She was reading a fascinating novel when the phone rang.",
    "We decided to visit the museum before it started raining.",
    "The teacher explained the difficult lesson very clearly.",
    "I have never tasted such delicious homemade bread before.",
    "They are planning a long trip to the mountains next summer.",
  ],
  hard: [
    "Although it was raining heavily, the determined hikers continued their challenging journey up the mountain.",
    "The scientist carefully explained how the experiment could change our understanding of the universe.",
    "Despite numerous obstacles, the small startup eventually became one of the most successful companies in the region.",
    "She wondered whether the ancient manuscript could finally reveal the secret that historians had sought for centuries.",
    "By the time we arrived at the station, the last train had already departed without us.",
    "The committee debated the controversial proposal for hours before reaching a reluctant compromise.",
  ],
};

export async function generateListening(
  level: Level,
  words: string[] = []
): Promise<{ sentences: string[]; usedAI: boolean }> {
  const fallback = { sentences: FALLBACK_LISTEN[level], usedAI: false };
  if (!hasOpenAI()) return fallback;
  const user =
    `Уровень: ${level}.` +
    (words.length ? ` Слова студента (по возможности используй): ${words.join(", ")}.` : "");
  const res = await askJSON<{ sentences?: string[] }>(LISTEN_SYS, user, {});
  const sentences = Array.isArray(res.sentences)
    ? res.sentences.filter((s) => typeof s === "string" && s.trim().length > 0).slice(0, 6)
    : [];
  if (sentences.length < 3) return fallback;
  return { sentences, usedAI: true };
}

// ─────────────────────────── Writing: промпт + проверка ───────────────────────────

const WRITE_PROMPT_SYS = `Ты — преподаватель английского. Придумай ОДНО короткое задание на письмо для студента (на русском языке формулировка), которое можно выполнить в 3-5 предложениях на английском.
Верни СТРОГО JSON: { "prompt": "..." }
Если даны слова студента — попроси использовать некоторые из них.`;

export async function generateWritingPrompt(words: string[] = []): Promise<string> {
  const fallbacks = [
    "Опиши свой обычный день. Напиши 3-5 предложений на английском.",
    "Расскажи о любимом фильме или книге и почему он тебе нравится (3-5 предложений).",
    "Опиши место, которое хотел бы посетить, и почему (3-5 предложений).",
    "Напиши о своих планах на выходные (3-5 предложений).",
  ];
  const fb = fallbacks[Math.floor(Date.now() / 86400000) % fallbacks.length];
  if (!hasOpenAI()) return fb;
  const user = words.length ? `Слова студента: ${words.join(", ")}.` : "Без особых слов.";
  const res = await askJSON<{ prompt?: string }>(WRITE_PROMPT_SYS, user, {}, 200);
  return typeof res.prompt === "string" && res.prompt.trim() ? res.prompt.trim() : fb;
}

export type WritingFeedback = {
  corrections: { original: string; fixed: string; explanation: string }[];
  improved: string;
  score: number; // 0..100
  comment: string;
  fallback?: boolean;
};

const WRITE_GRADE_SYS = `Ты — доброжелательный преподаватель английского для русскоязычного студента.
Тебе дают задание и ответ студента на английском. Проверь грамматику, лексику и стиль.
Верни СТРОГО JSON без markdown:
{
  "corrections": [ { "original": "ошибочный фрагмент", "fixed": "исправленный", "explanation": "пояснение на русском" } ],
  "improved": "улучшенная версия всего текста на английском",
  "score": 0-100,
  "comment": "короткий ободряющий комментарий на русском с главным советом"
}
Будь точным: corrections только для реальных ошибок (до 8). Если ошибок нет — пустой массив и высокий score.`;

export async function gradeWriting(
  prompt: string,
  text: string
): Promise<WritingFeedback> {
  const fallback: WritingFeedback = {
    corrections: [],
    improved: text,
    score: 0,
    comment:
      "AI-проверка недоступна без ключа OpenAI. Текст сохранён. Добавь ключ в .env, чтобы получать разбор.",
    fallback: true,
  };
  if (!hasOpenAI()) return fallback;
  const res = await askJSON<Partial<WritingFeedback>>(
    WRITE_GRADE_SYS,
    `Задание: ${prompt}\n\nОтвет студента:\n${text}`,
    {},
    1200
  );
  const corrections = Array.isArray(res.corrections)
    ? res.corrections
        .filter(
          (c) =>
            c &&
            typeof c.original === "string" &&
            typeof c.fixed === "string" &&
            typeof c.explanation === "string"
        )
        .slice(0, 8)
    : [];
  return {
    corrections,
    improved: typeof res.improved === "string" ? res.improved : text,
    score: typeof res.score === "number" ? Math.max(0, Math.min(100, res.score)) : 0,
    comment: typeof res.comment === "string" ? res.comment : "",
  };
}

// ─────────────────────────── Grammar: квиз ───────────────────────────

export const GRAMMAR_TOPICS = [
  "Времена (Tenses)",
  "Артикли (a/an/the)",
  "Предлоги (Prepositions)",
  "Условные предложения (Conditionals)",
  "Модальные глаголы (Modals)",
  "Множественное число и исчисляемость",
  "Порядок слов",
  "Степени сравнения",
];

export type GrammarQuestion = {
  type: "choice" | "fill" | "correct";
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
};

const GRAMMAR_SYS = `Ты — преподаватель английского для русскоязычных студентов. Сгенерируй грамматический квиз по заданной теме и уровню.
Верни СТРОГО JSON без markdown:
{
  "questions": [
    { "type": "choice", "question": "предложение с пропуском ___ или вопрос", "options": ["a","b","c","d"], "answer": "правильный вариант (точно из options)", "explanation": "почему, на русском" },
    { "type": "fill", "question": "предложение с ___", "answer": "слово(а) в пропуск", "explanation": "на русском" },
    { "type": "correct", "question": "предложение с ОДНОЙ ошибкой", "answer": "исправленное предложение целиком", "explanation": "на русском" }
  ]
}
Сделай 6 вопросов разных типов по теме. Для choice — ровно 4 варианта, answer обязан совпадать с одним из options дословно. Пояснения краткие, на русском.`;

const FALLBACK_GRAMMAR: GrammarQuestion[] = [
  {
    type: "choice",
    question: "She ___ to the gym every day.",
    options: ["go", "goes", "going", "gone"],
    answer: "goes",
    explanation: "Present Simple, 3-е лицо ед. числа → глагол с -es.",
  },
  {
    type: "choice",
    question: "I have lived here ___ 2010.",
    options: ["for", "since", "from", "during"],
    answer: "since",
    explanation: "since + момент времени (точка), for + период.",
  },
  {
    type: "fill",
    question: "There ___ (be) many people at the party yesterday.",
    answer: "were",
    explanation: "Past Simple, множественное число → were.",
  },
  {
    type: "correct",
    question: "He don't like coffee.",
    answer: "He doesn't like coffee.",
    explanation: "3-е лицо ед. числа в отрицании → doesn't.",
  },
  {
    type: "choice",
    question: "This is ___ interesting book.",
    options: ["a", "an", "the", "—"],
    answer: "an",
    explanation: "Перед гласным звуком используется an.",
  },
  {
    type: "fill",
    question: "If it ___ (rain), we will stay home.",
    answer: "rains",
    explanation: "First Conditional: if + Present Simple, main → will.",
  },
];

export async function generateGrammarQuiz(
  topic: string,
  level: Level
): Promise<{ topic: string; questions: GrammarQuestion[]; usedAI: boolean }> {
  const fallback = { topic, questions: FALLBACK_GRAMMAR, usedAI: false };
  if (!hasOpenAI()) return fallback;
  const res = await askJSON<{ questions?: GrammarQuestion[] }>(
    GRAMMAR_SYS,
    `Тема: ${topic}. Уровень: ${level}.`,
    {},
    1400
  );
  const questions = Array.isArray(res.questions)
    ? res.questions
        .filter(
          (q) =>
            q &&
            typeof q.question === "string" &&
            typeof q.answer === "string" &&
            typeof q.explanation === "string"
        )
        .map((q): GrammarQuestion => {
          let type: GrammarQuestion["type"] = ["choice", "fill", "correct"].includes(
            q.type
          )
            ? q.type
            : "fill";
          let options: string[] | undefined;
          if (type === "choice") {
            const opts = (Array.isArray(q.options) ? q.options : [])
              .map((o) => String(o))
              .filter((o) => o.trim().length > 0);
            // вариант ответа обязан присутствовать; иначе делаем вопрос с вводом
            if (opts.length >= 2 && opts.includes(q.answer)) {
              // не отрезаем правильный вариант при срезе до 4
              if (opts.length > 4) {
                const others = opts.filter((o) => o !== q.answer).slice(0, 3);
                options = [q.answer, ...others];
              } else {
                options = opts;
              }
            } else {
              type = "fill";
            }
          }
          return {
            type,
            question: q.question,
            options,
            answer: q.answer,
            explanation: q.explanation,
          };
        })
        .slice(0, 8)
    : [];
  if (questions.length < 3) return fallback;
  return { topic, questions, usedAI: true };
}
