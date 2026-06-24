import { getOpenAI, hasOpenAI, OPENAI_MODEL } from "@/lib/openai";
import { LEVELS } from "@/lib/gamify";

// ─────────────────────────────────────────────────────────────────────────────
// Диагностика уровня (placement test).
//
// Зачем: «знай свою точку старта». Реальный A2-ученик не должен начинать с A1/0 XP —
// тогда план и нормативы будут заниженными. Короткий адаптивный по сложности тест
// (грамматика + лексика, по 3 вопроса на каждый бэнд A2/B1/B2/C1) оценивает CEFR и
// выставляет стартовую базовую линию XP (только вверх).
// ─────────────────────────────────────────────────────────────────────────────

export type Band = "A2" | "B1" | "B2" | "C1";
export const BANDS: Band[] = ["A2", "B1", "B2", "C1"];

export type PlacementQuestion = {
  level: Band;
  skill: "grammar" | "vocab";
  question: string;
  options: string[];
  answer: number; // индекс правильного варианта
};

// ─────────────────────────── Статический фолбэк ───────────────────────────
// По 3 вопроса на бэнд. Однозначные, проверенные.
const FALLBACK: PlacementQuestion[] = [
  // A2
  { level: "A2", skill: "grammar", question: "She ___ to school every day.", options: ["go", "goes", "going", "gone"], answer: 1 },
  { level: "A2", skill: "grammar", question: "There ___ some milk in the fridge.", options: ["is", "are", "am", "be"], answer: 0 },
  { level: "A2", skill: "vocab", question: "I'm tired. I want to ___ .", options: ["sleep", "eat a key", "drive a book", "run a soup"], answer: 0 },
  // B1
  { level: "B1", skill: "grammar", question: "If it rains tomorrow, we ___ at home.", options: ["stay", "will stay", "stayed", "would stay"], answer: 1 },
  { level: "B1", skill: "grammar", question: "I have lived here ___ 2015.", options: ["for", "since", "from", "during"], answer: 1 },
  { level: "B1", skill: "vocab", question: "He was ___ when he heard the good news.", options: ["delighted", "boring", "missing", "spending"], answer: 0 },
  // B2
  { level: "B2", skill: "grammar", question: "By the time we arrived, the film ___ .", options: ["already started", "has already started", "had already started", "was already start"], answer: 2 },
  { level: "B2", skill: "grammar", question: "I'd rather you ___ smoke in here.", options: ["don't", "didn't", "won't", "not"], answer: 1 },
  { level: "B2", skill: "vocab", question: "The new policy was met with ___ criticism.", options: ["widespread", "wide-open", "broadminded", "largely"], answer: 0 },
  // C1
  { level: "C1", skill: "grammar", question: "Not until she apologised ___ to speak to her again.", options: ["I agreed", "did I agree", "I did agree", "agreed I"], answer: 1 },
  { level: "C1", skill: "grammar", question: "___ his inexperience, he handled the crisis remarkably well.", options: ["Despite of", "In spite", "Notwithstanding", "Although"], answer: 2 },
  { level: "C1", skill: "vocab", question: "Her argument was compelling, if somewhat ___ .", options: ["convoluted", "convenient", "consecutive", "considerate"], answer: 0 },
];

const SYS = `Ты — экзаменатор английского. Составь диагностический тест уровня (placement) с множественным выбором.
Верни СТРОГО JSON без markdown:
{ "questions": [ { "level": "A2|B1|B2|C1", "skill": "grammar|vocab", "question": "предложение с ___ или вопрос на английском", "options": ["a","b","c","d"], "answer": 0 } ] }
Требования: РОВНО 12 вопросов — по 3 на каждый уровень A2, B1, B2, C1, в порядке возрастания сложности. Ровно 4 варианта. "answer" — индекс (0-3) единственно верного варианта. Дистракторы правдоподобны. Вопросы на английском, без перевода. Смешивай grammar и vocab.`;

function validate(qs: unknown): PlacementQuestion[] {
  if (!Array.isArray(qs)) return [];
  const out: PlacementQuestion[] = [];
  for (const q of qs) {
    if (
      q &&
      BANDS.includes(q.level) &&
      (q.skill === "grammar" || q.skill === "vocab") &&
      typeof q.question === "string" &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.every((o: unknown) => typeof o === "string" && o.trim()) &&
      Number.isInteger(q.answer) &&
      q.answer >= 0 &&
      q.answer < 4
    ) {
      out.push({
        level: q.level,
        skill: q.skill,
        question: q.question,
        options: q.options,
        answer: q.answer,
      });
    }
  }
  return out;
}

export async function generatePlacement(): Promise<{ questions: PlacementQuestion[]; usedAI: boolean }> {
  if (!hasOpenAI()) return { questions: FALLBACK, usedAI: false };
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.5,
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: "Сгенерируй тест." },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { questions?: unknown };
    const valid = validate(parsed.questions);
    // нужны все 4 бэнда, иначе оценка некорректна
    const haveAllBands = BANDS.every((b) => valid.some((q) => q.level === b));
    if (valid.length >= 8 && haveAllBands) return { questions: valid, usedAI: true };
    return { questions: FALLBACK, usedAI: false };
  } catch (e) {
    console.error("placement generate error", e);
    return { questions: FALLBACK, usedAI: false };
  }
}

export type Bands = Record<Band, { correct: number; total: number }>;

// Оценка уровня: идём A2→C1, уровень = самый высокий бэнд, пройденный подряд
// (≥60% верных), при условии что все нижние бэнды тоже пройдены.
export function estimateLevel(bands: Bands): string {
  let assessed = "A1";
  for (const b of BANDS) {
    const r = bands[b];
    if (!r || r.total === 0) break;
    const pass = r.correct / r.total >= 0.6;
    if (pass) assessed = b;
    else break;
  }
  return assessed;
}

export function baselineXpFor(cefr: string): number {
  const lvl = LEVELS.find((l) => l.cefr === cefr);
  return lvl ? lvl.minXp : 0;
}
