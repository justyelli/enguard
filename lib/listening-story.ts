import { getOpenAI, hasOpenAI, OPENAI_MODEL } from "@/lib/openai";

// ─────────────────────────────────────────────────────────────────────────────
// Аудирование-истории = расширенный понятный ввод на слух.
//
// Объём понятного ввода (особенно на слух) — главный двигатель к C1. Диктант
// тренирует точность, но не «слушание ради смысла». Здесь ИИ генерирует короткую
// связную историю/диалог под уровень, ученик слушает (TTS), отвечает на вопросы
// на понимание, затем сверяется с транскриптом. AI + статический фолбэк.
// ─────────────────────────────────────────────────────────────────────────────

export type Level = "A2" | "B1" | "B2" | "C1";
export const STORY_LEVELS: Level[] = ["A2", "B1", "B2", "C1"];

export type StoryQuestion = { question: string; options: string[]; answer: number };
export type ListeningStory = {
  title: string;
  text: string;
  questions: StoryQuestion[];
  usedAI: boolean;
};

const FALLBACK: Record<Level, ListeningStory> = {
  A2: {
    title: "A Busy Morning",
    text: "Tom wakes up at seven o'clock. He is late for work today. He drinks a quick coffee and runs to the bus stop. But the bus is already gone. Tom decides to walk. On the way, he meets his old friend Sara. They talk and laugh. In the end, Tom is happy he missed the bus.",
    questions: [
      { question: "What time does Tom wake up?", options: ["Six", "Seven", "Eight", "Nine"], answer: 1 },
      { question: "Why does Tom walk to work?", options: ["He likes walking", "The bus is gone", "It is sunny", "He has no money"], answer: 1 },
      { question: "How does Tom feel at the end?", options: ["Angry", "Tired", "Happy", "Sad"], answer: 2 },
    ],
    usedAI: false,
  },
  B1: {
    title: "The Job Interview",
    text: "Maria had prepared for the interview all week. When she arrived, the office was quieter than she expected. The manager asked her about her previous experience and why she wanted the job. Maria felt nervous at first, but she soon relaxed and answered clearly. A few days later, she received an email offering her the position.",
    questions: [
      { question: "How long did Maria prepare?", options: ["One day", "All week", "One month", "She didn't"], answer: 1 },
      { question: "How did Maria feel at first?", options: ["Confident", "Bored", "Nervous", "Angry"], answer: 2 },
      { question: "What was the result?", options: ["She was rejected", "She got the job", "She left early", "She forgot the date"], answer: 1 },
    ],
    usedAI: false,
  },
  B2: {
    title: "A Change of Plans",
    text: "Daniel had always assumed he would become an engineer, just like his father. However, during his second year at university, he took an elective course in psychology that completely changed his perspective. Although switching subjects meant losing a year, he was convinced it was worth it. His parents were initially reluctant, but eventually they came to respect his decision.",
    questions: [
      { question: "What did Daniel originally plan to be?", options: ["A doctor", "An engineer", "A teacher", "A psychologist"], answer: 1 },
      { question: "What changed his mind?", options: ["A book", "His father", "A psychology course", "A trip"], answer: 2 },
      { question: "How did his parents react in the end?", options: ["They refused", "They respected it", "They ignored him", "They were proud immediately"], answer: 1 },
    ],
    usedAI: false,
  },
  C1: {
    title: "The Unexpected Discovery",
    text: "While sorting through her late grandmother's belongings, Eleanor stumbled upon a bundle of letters tied with a faded ribbon. At first glance, they appeared to be ordinary correspondence, yet as she read on, a far more intricate story emerged. The letters hinted at a long-buried family secret that, had it surfaced earlier, might have altered the course of several lives. Eleanor was left wondering whether some truths are better left undisturbed.",
    questions: [
      { question: "Where did Eleanor find the letters?", options: ["In a shop", "Among her grandmother's belongings", "At a library", "In her own attic"], answer: 1 },
      { question: "What did the letters reveal?", options: ["A recipe", "A family secret", "A business deal", "A travel diary"], answer: 1 },
      { question: "What does Eleanor wonder at the end?", options: ["Whether to sell them", "Whether some truths should stay hidden", "Who wrote them", "Where to travel"], answer: 1 },
    ],
    usedAI: false,
  },
};

const SYS = `Ты — преподаватель английского. Сгенерируй короткую СВЯЗНУЮ историю или диалог на английском под уровень CEFR для аудирования, плюс вопросы на понимание.
Верни СТРОГО JSON без markdown:
{ "title": "короткий заголовок (англ.)", "text": "история на английском", "questions": [ { "question": "вопрос на английском", "options": ["a","b","c","d"], "answer": 0 } ] }
Требования: text естественный, 5-9 предложений; сложность строго под уровень (A2 — простые времена и лексика; C1 — идиоматично, сложные конструкции). Ровно 3 вопроса на понимание смысла (не на дословные мелочи), 4 варианта, "answer" — индекс верного (0-3).`;

function validate(p: unknown): ListeningStory | null {
  const o = p as Partial<ListeningStory>;
  if (!o || typeof o.title !== "string" || typeof o.text !== "string") return null;
  if (!Array.isArray(o.questions)) return null;
  const questions = o.questions
    .filter(
      (q): q is StoryQuestion =>
        !!q &&
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every((x) => typeof x === "string" && x.trim()) &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < 4
    )
    .slice(0, 3);
  if (questions.length < 2 || o.text.trim().length < 40) return null;
  return { title: o.title.trim(), text: o.text.trim(), questions, usedAI: true };
}

export async function generateStory(level: Level, topic?: string): Promise<ListeningStory> {
  if (!hasOpenAI()) return FALLBACK[level];
  const cleanTopic = typeof topic === "string" ? topic.trim().slice(0, 80) : "";
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.8,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS },
        {
          role: "user",
          content: cleanTopic
            ? `Уровень: ${level}. Тема: ${cleanTopic}.`
            : `Уровень: ${level}.`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const story = validate(JSON.parse(raw));
    return story ?? FALLBACK[level];
  } catch (e) {
    console.error("generateStory error", e);
    return FALLBACK[level];
  }
}
