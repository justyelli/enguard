import { prisma } from "@/lib/prisma";
import { normalizeTerm } from "@/lib/translate";

// ─────────────────────────────────────────────────────────────────────────────
// Мост «чтение → карточки с контекстом».
//
// Самая полезная лексика — та, что встретилась тебе в живом тексте. При чтении
// каждый клик по слову логируется в WordLookup (со словом и предложением), но
// большинство просмотренных слов так и не становятся карточками. Здесь мы
// собираем такие слова (ещё не в карточках, с готовым переводом из кэша) и
// одним нажатием превращаем в карточки С КОНТЕКСТОМ — они идут в SRS и в режим
// cloze («вставь слово в предложение»), где учатся в исходном контексте.
// ─────────────────────────────────────────────────────────────────────────────

export type ReadingWord = {
  word: string;
  translation: string;
  context: string;
  count: number; // сколько раз встретилось/смотрелось
  book: string | null;
};

export async function getReadingWordCandidates(limit = 24): Promise<ReadingWord[]> {
  const [lookups, cards, translations] = await Promise.all([
    prisma.wordLookup.findMany({
      where: { context: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { book: { select: { title: true } } },
    }),
    prisma.card.findMany({ select: { word: true } }),
    prisma.translation.findMany(),
  ]);

  const carded = new Set(cards.map((c) => normalizeTerm(c.word)));
  const transMap = new Map(translations.map((t) => [t.term, t.payload]));

  type Agg = { word: string; context: string; count: number; book: string | null };
  const map = new Map<string, Agg>();
  for (const l of lookups) {
    const key = normalizeTerm(l.word);
    if (!key || carded.has(key)) continue;
    const ex = map.get(key);
    if (ex) {
      ex.count++;
      if (!ex.context && l.context) ex.context = l.context;
    } else {
      map.set(key, {
        word: l.word,
        context: l.context ?? "",
        count: 1,
        book: l.book?.title ?? null,
      });
    }
  }

  const out: ReadingWord[] = [];
  for (const [key, agg] of map) {
    const payload = transMap.get(key);
    let translation = "";
    if (payload) {
      try {
        translation = JSON.parse(payload).translation || "";
      } catch {
        /* битый кэш — пропускаем */
      }
    }
    if (!translation || translation === "—") continue; // без перевода карточка бессмысленна
    out.push({
      word: agg.word,
      translation,
      context: agg.context,
      count: agg.count,
      book: agg.book,
    });
  }

  out.sort((a, b) => b.count - a.count);
  return out.slice(0, limit);
}

export const READING_COLLECTION = "Слова из чтения";

// Предложения из чтения (контексты просмотренных слов) — для shadowing на
// аутентичном материале. Длинные пассажи ужимаем до первого предложения.
export async function getReadingSentences(limit = 10): Promise<string[]> {
  const lookups = await prisma.wordLookup.findMany({
    where: { context: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { context: true },
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lookups) {
    let c = (l.context ?? "").trim();
    if (c.length > 180) c = c.split(/(?<=[.!?])\s+/)[0].trim(); // первое предложение
    if (c.length < 12 || c.length > 200) continue;
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}
