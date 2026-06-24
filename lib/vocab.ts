import { prisma } from "@/lib/prisma";
import { normalizeTerm } from "@/lib/translate";
import { getOpenAI, hasOpenAI, OPENAI_MODEL } from "@/lib/openai";

// ─────────────────────────────────────────────────────────────────────────────
// Ядро лексики по уровням CEFR.
//
// Принцип Парето в словаре: сначала учим самые частотные/полезные слова — они
// дают основное покрытие речи. Здесь — курируемое ядро на каждый уровень
// (A2→C1). Слова не дублируют между уровнями и подобраны по реальной пользе.
// Любое слово можно одним нажатием добавить в SRS-карточки и далее повторять
// штатным механизмом интервальных повторений.
// ─────────────────────────────────────────────────────────────────────────────

export type Band = "A2" | "B1" | "B2" | "C1";
export const VOCAB_BANDS: Band[] = ["A2", "B1", "B2", "C1"];

export type VocabWord = { w: string; t: string; ex: string };

export const CORE_VOCAB: Record<Band, VocabWord[]> = {
  A2: [
    { w: "borrow", t: "брать в долг, одалживать", ex: "Can I borrow your pen?" },
    { w: "lend", t: "давать в долг, одалживать", ex: "She lent me her umbrella." },
    { w: "arrive", t: "прибывать, приезжать", ex: "We arrived at the station early." },
    { w: "remember", t: "помнить, вспоминать", ex: "I don't remember his name." },
    { w: "forget", t: "забывать", ex: "Don't forget your keys." },
    { w: "enough", t: "достаточно", ex: "We have enough food for everyone." },
    { w: "already", t: "уже", ex: "I have already finished." },
    { w: "maybe", t: "может быть", ex: "Maybe she will come later." },
    { w: "busy", t: "занятой", ex: "I'm busy this afternoon." },
    { w: "afraid", t: "боящийся, испуганный", ex: "I'm afraid of dogs." },
    { w: "expensive", t: "дорогой", ex: "This phone is too expensive." },
    { w: "cheap", t: "дешёвый", ex: "We found a cheap hotel." },
    { w: "dangerous", t: "опасный", ex: "Swimming here is dangerous." },
    { w: "quiet", t: "тихий", ex: "Please be quiet." },
    { w: "healthy", t: "здоровый", ex: "She eats healthy food." },
    { w: "weather", t: "погода", ex: "The weather is nice today." },
    { w: "travel", t: "путешествовать", ex: "I love to travel." },
    { w: "decide", t: "решать", ex: "We decided to stay home." },
    { w: "improve", t: "улучшать(ся)", ex: "I want to improve my English." },
    { w: "prepare", t: "готовить(ся)", ex: "She prepared dinner." },
    { w: "explain", t: "объяснять", ex: "Can you explain this?" },
    { w: "choose", t: "выбирать", ex: "Choose your favourite colour." },
    { w: "hurry", t: "спешить", ex: "Hurry up, we're late!" },
    { w: "worry", t: "беспокоиться", ex: "Don't worry about it." },
    { w: "believe", t: "верить", ex: "I believe you." },
    { w: "agree", t: "соглашаться", ex: "I agree with you." },
    { w: "allow", t: "разрешать", ex: "Smoking is not allowed here." },
    { w: "enjoy", t: "наслаждаться", ex: "We enjoyed the trip." },
    { w: "receive", t: "получать", ex: "I received your letter." },
    { w: "return", t: "возвращать(ся)", ex: "She returned the book." },
  ],
  B1: [
    { w: "manage", t: "справляться, удаваться", ex: "She managed to finish on time." },
    { w: "achieve", t: "достигать", ex: "He achieved his goal." },
    { w: "avoid", t: "избегать", ex: "Try to avoid mistakes." },
    { w: "realize", t: "осознавать", ex: "I realized I was wrong." },
    { w: "mention", t: "упоминать", ex: "She mentioned your name." },
    { w: "recognize", t: "узнавать, признавать", ex: "I recognized her immediately." },
    { w: "admit", t: "признавать(ся)", ex: "He admitted his mistake." },
    { w: "deny", t: "отрицать", ex: "She denied everything." },
    { w: "encourage", t: "поощрять, ободрять", ex: "My teacher encouraged me." },
    { w: "require", t: "требовать(ся)", ex: "This job requires patience." },
    { w: "provide", t: "предоставлять", ex: "We provide free coffee." },
    { w: "prevent", t: "предотвращать", ex: "Exercise prevents illness." },
    { w: "reduce", t: "снижать, уменьшать", ex: "We need to reduce costs." },
    { w: "increase", t: "увеличивать(ся)", ex: "Prices increased last year." },
    { w: "afford", t: "позволить себе", ex: "I can't afford a new car." },
    { w: "complain", t: "жаловаться", ex: "He complained about the noise." },
    { w: "apologize", t: "извиняться", ex: "She apologized for being late." },
    { w: "discover", t: "обнаруживать", ex: "They discovered a new planet." },
    { w: "expect", t: "ожидать", ex: "I expect good results." },
    { w: "succeed", t: "преуспевать, добиваться успеха", ex: "She succeeded in business." },
    { w: "opportunity", t: "возможность", ex: "A great opportunity." },
    { w: "experience", t: "опыт", ex: "She has a lot of experience." },
    { w: "advice", t: "совет", ex: "Thanks for your advice." },
    { w: "solution", t: "решение (проблемы)", ex: "We found a solution." },
    { w: "benefit", t: "польза, выгода", ex: "Exercise has many benefits." },
    { w: "reason", t: "причина", ex: "Give me a reason." },
    { w: "suggest", t: "предлагать", ex: "She suggested a restaurant." },
    { w: "consider", t: "рассматривать, обдумывать", ex: "Consider all the options." },
    { w: "describe", t: "описывать", ex: "Describe your hometown." },
    { w: "purpose", t: "цель, назначение", ex: "What is the purpose of this?" },
  ],
  B2: [
    { w: "acknowledge", t: "признавать", ex: "He acknowledged the problem." },
    { w: "assume", t: "предполагать", ex: "I assume you're ready." },
    { w: "emphasize", t: "подчёркивать", ex: "She emphasized the importance." },
    { w: "implement", t: "внедрять, осуществлять", ex: "We implemented the plan." },
    { w: "maintain", t: "поддерживать, сохранять", ex: "Maintain a healthy diet." },
    { w: "obtain", t: "получать, добывать", ex: "He obtained a degree." },
    { w: "pursue", t: "преследовать (цель)", ex: "She pursued her dream." },
    { w: "reluctant", t: "неохотный", ex: "He was reluctant to help." },
    { w: "significant", t: "значительный", ex: "A significant change." },
    { w: "sufficient", t: "достаточный", ex: "We have sufficient time." },
    { w: "inevitable", t: "неизбежный", ex: "Change is inevitable." },
    { w: "crucial", t: "решающий, критически важный", ex: "This step is crucial." },
    { w: "demonstrate", t: "демонстрировать", ex: "She demonstrated the method." },
    { w: "consequence", t: "последствие", ex: "Face the consequences." },
    { w: "estimate", t: "оценивать (количественно)", ex: "We estimate the cost." },
    { w: "appropriate", t: "подходящий, уместный", ex: "Wear appropriate clothes." },
    { w: "considerable", t: "значительный", ex: "Considerable effort was needed." },
    { w: "distinguish", t: "различать", ex: "Distinguish right from wrong." },
    { w: "flexible", t: "гибкий", ex: "A flexible schedule." },
    { w: "genuine", t: "подлинный, искренний", ex: "A genuine smile." },
    { w: "overcome", t: "преодолевать", ex: "Overcome your fears." },
    { w: "priority", t: "приоритет", ex: "Safety is a priority." },
    { w: "reliable", t: "надёжный", ex: "A reliable friend." },
    { w: "remarkable", t: "выдающийся, замечательный", ex: "A remarkable achievement." },
    { w: "struggle", t: "бороться, с трудом справляться", ex: "She struggled with maths." },
    { w: "tend", t: "иметь тенденцию, склоняться", ex: "Prices tend to rise." },
    { w: "thorough", t: "тщательный", ex: "A thorough review." },
    { w: "evident", t: "очевидный", ex: "It was evident that he lied." },
    { w: "approach", t: "подход; приближаться", ex: "A new approach to teaching." },
    { w: "concern", t: "беспокойство; касаться", ex: "Your health is my concern." },
  ],
  C1: [
    { w: "ambiguous", t: "двусмысленный", ex: "An ambiguous answer." },
    { w: "coherent", t: "связный, последовательный", ex: "A coherent argument." },
    { w: "compelling", t: "убедительный", ex: "A compelling reason." },
    { w: "comprehensive", t: "всеобъемлющий", ex: "A comprehensive guide." },
    { w: "contradict", t: "противоречить", ex: "His actions contradict his words." },
    { w: "diminish", t: "уменьшать(ся), ослаблять", ex: "Interest began to diminish." },
    { w: "elaborate", t: "детально разрабатывать; подробный", ex: "Could you elaborate?" },
    { w: "explicit", t: "явный, чёткий", ex: "Explicit instructions." },
    { w: "implicit", t: "подразумеваемый", ex: "An implicit assumption." },
    { w: "inherent", t: "присущий, неотъемлемый", ex: "Risks inherent in the plan." },
    { w: "nuance", t: "нюанс, оттенок", ex: "Subtle nuances of meaning." },
    { w: "plausible", t: "правдоподобный", ex: "A plausible explanation." },
    { w: "profound", t: "глубокий", ex: "A profound impact." },
    { w: "prevail", t: "преобладать, восторжествовать", ex: "Justice will prevail." },
    { w: "scrutiny", t: "тщательная проверка", ex: "Under close scrutiny." },
    { w: "subtle", t: "тонкий, едва уловимый", ex: "A subtle difference." },
    { w: "undermine", t: "подрывать", ex: "This undermines trust." },
    { w: "versatile", t: "разносторонний, универсальный", ex: "A versatile tool." },
    { w: "viable", t: "жизнеспособный", ex: "A viable option." },
    { w: "arbitrary", t: "произвольный", ex: "An arbitrary decision." },
    { w: "cease", t: "прекращать(ся)", ex: "The noise finally ceased." },
    { w: "intricate", t: "замысловатый, запутанный", ex: "An intricate design." },
    { w: "mitigate", t: "смягчать", ex: "Measures to mitigate the risks." },
    { w: "notion", t: "понятие, представление", ex: "A vague notion." },
    { w: "proponent", t: "сторонник", ex: "A proponent of reform." },
    { w: "reconcile", t: "примирять, согласовывать", ex: "Reconcile your differences." },
    { w: "resilient", t: "устойчивый, жизнестойкий", ex: "A resilient economy." },
    { w: "meticulous", t: "дотошный, скрупулёзный", ex: "Meticulous attention to detail." },
    { w: "prevalent", t: "распространённый", ex: "The custom is still prevalent." },
    { w: "subsequent", t: "последующий", ex: "Subsequent events proved him right." },
  ],
};

export const VOCAB_COLLECTION_PREFIX = "Ядро лексики";

export type WordStatus = "new" | "added" | "known";
export type VocabWordView = VocabWord & { status: WordStatus };
export type BandProgress = {
  band: Band;
  total: number;
  added: number; // есть карточка
  known: number; // карточка с reps>0
  words: VocabWordView[];
};
export type VocabProgress = {
  bands: BandProgress[];
  totalWords: number;
  totalKnown: number;
};

// Карта: нормализованное слово → максимальные reps среди карточек с этим словом.
async function cardRepsMap(): Promise<Map<string, number>> {
  const cards = await prisma.card.findMany({ select: { word: true, reps: true } });
  const map = new Map<string, number>();
  for (const c of cards) {
    const k = normalizeTerm(c.word);
    if (!k) continue;
    const prev = map.get(k);
    if (prev === undefined || c.reps > prev) map.set(k, c.reps);
  }
  return map;
}

export async function getVocabProgress(): Promise<VocabProgress> {
  const reps = await cardRepsMap();
  let totalWords = 0;
  let totalKnown = 0;

  const bands: BandProgress[] = VOCAB_BANDS.map((band) => {
    const list = CORE_VOCAB[band];
    let added = 0;
    let known = 0;
    const words: VocabWordView[] = list.map((vw) => {
      const r = reps.get(normalizeTerm(vw.w));
      let status: WordStatus = "new";
      if (r !== undefined) {
        if (r > 0) {
          status = "known";
          known++;
        } else {
          status = "added";
        }
        added++;
      }
      return { ...vw, status };
    });
    totalWords += list.length;
    totalKnown += known;
    return { band, total: list.length, added, known, words };
  });

  return { bands, totalWords, totalKnown };
}

// Слова уровня, которых ещё нет в карточках (для добавления следующей порции).
export async function unaddedWords(band: Band): Promise<VocabWord[]> {
  const reps = await cardRepsMap();
  return CORE_VOCAB[band].filter((vw) => !reps.has(normalizeTerm(vw.w)));
}

// ─────────────────────────── AI-догенерация лексики ───────────────────────────
// Лексический объём — главный барьер к C1 (нужно тысячи слов). Курируемое ядро
// конечно, поэтому докидываем следующие по полезности/частотности слова уровня
// через ИИ, исключая уже известные. Возвращает [] без ключа OpenAI или при сбое.

// Режим догенерации: одиночные слова, устойчивые сочетания (коллокации) или
// фразовые глаголы. Чанки (collocations/phrasals) — главный двигатель беглости
// на B2→C1: именно они отличают естественную речь от ученической.
export type VocabKind = "words" | "collocations" | "phrasals";

const GEN_SYS_BY_KIND: Record<VocabKind, string> = {
  words: `Ты — преподаватель английского для русскоязычных. Дай следующую порцию самых ПОЛЕЗНЫХ слов заданного уровня CEFR, по убыванию частотности и практической ценности (не редкие и не оффенсив).
Верни СТРОГО JSON без markdown: { "words": [ { "w": "english word", "t": "краткий перевод (1-3 слова, рус.)", "ex": "короткий естественный пример на английском" } ] }
Все слова — нижним регистром (кроме имён собственных). НЕ повторяй из списка исключений. Ровно запрошенное число.`,
  collocations: `Ты — преподаватель английского для русскоязычных. Дай следующую порцию самых ПОЛЕЗНЫХ устойчивых СЛОВОСОЧЕТАНИЙ (коллокаций) заданного уровня CEFR, по убыванию частотности (примеры: make a decision, heavy rain, take a risk, pay attention). Это естественные сочетания, которые отличают беглую речь.
Верни СТРОГО JSON без markdown: { "words": [ { "w": "english collocation", "t": "перевод (рус.)", "ex": "короткий естественный пример с этим сочетанием" } ] }
НЕ повторяй из списка исключений. Ровно запрошенное число.`,
  phrasals: `Ты — преподаватель английского для русскоязычных. Дай следующую порцию самых ЧАСТОТНЫХ ФРАЗОВЫХ ГЛАГОЛОВ заданного уровня CEFR (примеры: give up, put off, come across, look forward to). Это классический барьер на пути к C1.
Верни СТРОГО JSON без markdown: { "words": [ { "w": "phrasal verb", "t": "перевод (рус.)", "ex": "короткий естественный пример с этим фразовым глаголом" } ] }
НЕ повторяй из списка исключений. Ровно запрошенное число.`,
};

export const VOCAB_KIND_COLLECTION: Record<VocabKind, (band: Band) => string> = {
  words: (b) => `${VOCAB_COLLECTION_PREFIX} · ${b}`,
  collocations: (b) => `Сочетания · ${b}`,
  phrasals: (b) => `Фразовые глаголы · ${b}`,
};

export async function generateVocabBatch(
  band: Band,
  exclude: string[],
  count = 10,
  kind: VocabKind = "words"
): Promise<VocabWord[]> {
  if (!hasOpenAI()) return [];
  const excludeSet = new Set(exclude.map((w) => normalizeTerm(w)));
  // в промпт кладём ограниченный список-подсказку, жёсткий дедуп — ниже
  const hint = exclude.slice(0, 200).join(", ");
  const unit = kind === "words" ? "слов" : kind === "collocations" ? "сочетаний" : "фразовых глаголов";
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: GEN_SYS_BY_KIND[kind] },
        {
          role: "user",
          content: `Уровень: ${band}. Сколько ${unit}: ${count}. Исключи (уже есть): ${hint || "—"}.`,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { words?: unknown };
    if (!Array.isArray(parsed.words)) return [];
    const out: VocabWord[] = [];
    const seen = new Set<string>();
    for (const it of parsed.words) {
      const w = it as Partial<VocabWord>;
      if (
        !w ||
        typeof w.w !== "string" ||
        typeof w.t !== "string" ||
        typeof w.ex !== "string"
      )
        continue;
      const word = w.w.trim();
      const key = normalizeTerm(word);
      if (!key || excludeSet.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ w: word, t: w.t.trim(), ex: w.ex.trim() });
      if (out.length >= count) break;
    }
    return out;
  } catch (e) {
    console.error("generateVocabBatch error", e);
    return [];
  }
}

// Все слова, которые уже есть в карточках (для исключения при генерации).
export async function existingCardWords(): Promise<string[]> {
  const cards = await prisma.card.findMany({ select: { word: true } });
  return cards.map((c) => c.word);
}
