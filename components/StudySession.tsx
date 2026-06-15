"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

export type StudyCard = {
  id: number;
  word: string;
  translation: string;
  example: string | null;
  context: string | null;
  starred?: boolean;
  dueDate?: string;
};

type Mode =
  | "flashcard"
  | "mix"
  | "choose"
  | "reverse"
  | "type"
  | "listen"
  | "match"
  | "context"
  | "sprint";

const MODES: { id: Mode; icon: string; label: string; desc: string }[] = [
  { id: "flashcard", icon: "🃏", label: "Карточки", desc: "Переворачивай как в Quizlet" },
  { id: "mix", icon: "🎲", label: "Микс", desc: "Разные упражнения подряд" },
  { id: "choose", icon: "✅", label: "Выбор перевода", desc: "Слово → варианты" },
  { id: "reverse", icon: "🔁", label: "Обратный выбор", desc: "Перевод → слова" },
  { id: "type", icon: "⌨️", label: "Впиши слово", desc: "По переводу набери слово" },
  { id: "listen", icon: "🔊", label: "Аудирование", desc: "Услышь и запиши" },
  { id: "match", icon: "🔗", label: "Сопоставление", desc: "Соедини пары" },
  { id: "context", icon: "📝", label: "Контекст", desc: "Вставь слово в предложение" },
  { id: "sprint", icon: "⚡", label: "Спринт", desc: "Успей за 60 секунд" },
];

const QUESTION_MODES: Mode[] = ["choose", "reverse", "type", "context", "listen"];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}'’\s-]/gu, "")
    .replace(/\s+/g, " ");
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* нет поддержки */
  }
}

async function recordReview(cardId: number, mode: string, correct: boolean) {
  try {
    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, mode, correct }),
    });
    window.dispatchEvent(new CustomEvent("enguard:xp"));
  } catch {
    /* офлайн — пропускаем */
  }
}

async function toggleStar(cardId: number, starred: boolean) {
  try {
    await fetch(`/api/cards/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    });
  } catch {
    /* игнор */
  }
}

// Уникальные «обманки» (без заглушек «—») — не больше, чем реально есть.
function distractors(
  card: StudyCard,
  pool: StudyCard[],
  key: "word" | "translation",
  max: number
): string[] {
  const set = new Set<string>();
  for (const c of shuffle(pool)) {
    if (c.id === card.id) continue;
    const v = c[key];
    if (v && v !== "—" && v !== card[key]) set.add(v);
    if (set.size >= max) break;
  }
  return [...set];
}

function countDistinct(cards: StudyCard[], key: "word" | "translation"): number {
  return new Set(
    cards.map((c) => c[key]).filter((v) => v && v !== "—")
  ).size;
}

// Сортировка: сначала просроченные/новые, потом перемешанные.
function prioritize(cards: StudyCard[]): StudyCard[] {
  const now = Date.now();
  const due = cards.filter((c) => !c.dueDate || new Date(c.dueDate).getTime() <= now);
  const rest = cards.filter((c) => c.dueDate && new Date(c.dueDate).getTime() > now);
  return [...shuffle(due), ...shuffle(rest)];
}

// ─────────────────────────── Диспетчер ───────────────────────────

export default function StudySession({
  collectionId,
  collectionName,
  cards,
}: {
  collectionId: number;
  collectionName: string;
  cards: StudyCard[];
}) {
  const [mode, setMode] = useState<Mode | null>(null);

  if (!mode) {
    return (
      <ModePicker collectionName={collectionName} cards={cards} onPick={setMode} />
    );
  }
  if (mode === "flashcard") {
    return <FlashcardDeck cards={cards} onExit={() => setMode(null)} />;
  }
  if (mode === "match") {
    return <MatchGame cards={cards} onExit={() => setMode(null)} />;
  }
  if (mode === "sprint") {
    return <Sprint cards={cards} onExit={() => setMode(null)} />;
  }
  return (
    <QuizSession
      mode={mode}
      cards={cards}
      collectionName={collectionName}
      onExit={() => setMode(null)}
    />
  );
}

// ─────────────────────────── Выбор режима ───────────────────────────

function ModePicker({
  collectionName,
  cards,
  onPick,
}: {
  collectionName: string;
  cards: StudyCard[];
  onPick: (m: Mode) => void;
}) {
  const nWords = countDistinct(cards, "word");
  const nTrans = countDistinct(cards, "translation");

  function disabledReason(m: Mode): string | null {
    if (m === "choose" && nTrans < 2) return "нужно ≥2 разных перевода";
    if (m === "reverse" && nWords < 2) return "нужно ≥2 разных слова";
    if (m === "sprint" && nTrans < 2) return "нужно ≥2 разных перевода";
    if (m === "match" && cards.length < 2) return "нужно ≥2 карточки";
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Тренировка: {collectionName}</h1>
        <p className="text-sm text-muted">{cards.length} карточек · выбери режим</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODES.map((m) => {
          const reason = disabledReason(m.id);
          return (
            <button
              key={m.id}
              onClick={() => !reason && onPick(m.id)}
              disabled={!!reason}
              className={`rounded-xl border p-4 text-left transition-all ${
                reason
                  ? "cursor-not-allowed border-border bg-surface opacity-50"
                  : "border-border bg-surface hover:border-primary hover:shadow-md active:scale-[0.99]"
              }`}
            >
              <div className="text-2xl">{m.icon}</div>
              <div className="mt-1 font-semibold">{m.label}</div>
              <div className="text-xs text-muted">{reason ?? m.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────── Карточки (Quizlet-стиль) ───────────────────────────

function FlashcardDeck({
  cards,
  onExit,
}: {
  cards: StudyCard[];
  onExit: () => void;
}) {
  const [shuffleOn, setShuffleOn] = useState(true);
  const [autoAudio, setAutoAudio] = useState(false);
  const [deck, setDeck] = useState<StudyCard[]>(() => prioritize(cards));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // результат по карточке в текущем раунде: 'known' | 'learning'
  const [results, setResults] = useState<Record<number, "known" | "learning">>({});
  const [stars, setStars] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(cards.map((c) => [c.id, !!c.starred]))
  );
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);

  const card = deck[pos];
  const done = pos >= deck.length;

  const known = Object.values(results).filter((v) => v === "known").length;
  const learning = Object.values(results).filter((v) => v === "learning").length;

  const advance = useCallback(() => {
    setFlipped(false);
    setPos((p) => p + 1);
  }, []);

  const grade = useCallback(
    (status: "known" | "learning") => {
      if (!card) return;
      setResults((r) => ({ ...r, [card.id]: status }));
      recordReview(card.id, "flashcard", status === "known");
      advance();
    },
    [card, advance]
  );

  const goPrev = useCallback(() => {
    setFlipped(false);
    setPos((p) => Math.max(0, p - 1));
  }, []);

  // авто-озвучка при смене карточки
  useEffect(() => {
    if (card && autoAudio && !flipped) speak(card.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  // клавиатура
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        grade("known");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        grade("learning");
      } else if (e.key === "ArrowUp" || e.key === "Backspace") {
        e.preventDefault();
        goPrev();
      } else if (e.key.toLowerCase() === "s") {
        if (card) speak(card.word);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, grade, goPrev, card]);

  function restart(onlyLearning: boolean) {
    const base = onlyLearning
      ? cards.filter((c) => results[c.id] === "learning")
      : cards;
    setDeck(shuffleOn ? prioritize(base) : base);
    setPos(0);
    setFlipped(false);
    setResults({});
  }

  function doToggleStar() {
    if (!card) return;
    const next = !stars[card.id];
    setStars((s) => ({ ...s, [card.id]: next }));
    toggleStar(card.id, next);
  }

  if (done) {
    const learnCards = cards.filter((c) => results[c.id] === "learning");
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="text-6xl">{learning === 0 ? "🎉" : "💪"}</div>
        <h1 className="text-2xl font-bold">Раунд пройден!</h1>
        <p className="text-muted">
          Знаю: <b className="text-success">{known}</b> · Ещё учу:{" "}
          <b className="text-amber-600">{learning}</b>
        </p>
        <div className="flex flex-col items-stretch gap-2">
          {learnCards.length > 0 && (
            <button
              onClick={() => restart(true)}
              className="rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-primary-hover"
            >
              Повторить «ещё учу» ({learnCards.length})
            </button>
          )}
          <button
            onClick={() => restart(false)}
            className="rounded-lg border border-border px-5 py-3 font-medium hover:bg-surface"
          >
            Вся колода заново
          </button>
          <button
            onClick={onExit}
            className="rounded-lg px-5 py-2 text-sm text-muted hover:text-foreground"
          >
            К режимам
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* верхняя панель */}
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={onExit}
          className="flex h-10 items-center text-muted hover:text-foreground"
        >
          ✕ Выйти
        </button>
        <span className="text-muted">
          {pos + 1} / {deck.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShuffleOn((v) => !v)}
            title="Перемешивать"
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              shuffleOn ? "text-primary" : "text-muted"
            } hover:bg-surface`}
          >
            🔀
          </button>
          <button
            onClick={() => setAutoAudio((v) => !v)}
            title="Авто-озвучка"
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              autoAudio ? "text-primary" : "text-muted"
            } hover:bg-surface`}
          >
            🔈
          </button>
        </div>
      </div>

      {/* сегментированный прогресс */}
      <div className="flex gap-1">
        {deck.map((c, i) => (
          <div
            key={c.id}
            className={`h-1.5 flex-1 rounded-full ${
              results[c.id] === "known"
                ? "bg-success"
                : results[c.id] === "learning"
                  ? "bg-amber-500"
                  : i === pos
                    ? "bg-primary"
                    : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* карта */}
      <div
        className="flip-perspective h-64 sm:h-80"
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
          touchY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null || touchY.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          const dy = e.changedTouches[0].clientY - touchY.current;
          touchX.current = null;
          touchY.current = null;
          // только явный горизонтальный свайп (не вертикальная прокрутка)
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
          if (dx > 0) grade("known");
          else grade("learning");
        }}
      >
        <div
          className={`flip-inner h-full w-full ${flipped ? "flipped" : ""}`}
          onClick={() => setFlipped((f) => !f)}
        >
          {/* лицо: слово */}
          <div className="flip-face rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <CardControls
              starred={!!stars[card.id]}
              onStar={(e) => {
                e.stopPropagation();
                doToggleStar();
              }}
              onSpeak={(e) => {
                e.stopPropagation();
                speak(card.word);
              }}
            />
            <div className="text-3xl font-bold">{card.word}</div>
            <div className="mt-4 text-xs text-muted">нажми, чтобы перевернуть</div>
          </div>
          {/* обратная сторона: перевод */}
          <div className="flip-face flip-back rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <CardControls
              starred={!!stars[card.id]}
              onStar={(e) => {
                e.stopPropagation();
                doToggleStar();
              }}
              onSpeak={(e) => {
                e.stopPropagation();
                speak(card.word);
              }}
            />
            <div className="text-2xl font-semibold text-primary">{card.translation}</div>
            {card.example && (
              <div className="mt-3 max-w-sm text-center text-sm text-muted">
                {card.example}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* действия */}
      <div className="flex items-center gap-2">
        <button
          onClick={goPrev}
          disabled={pos === 0}
          className="flex h-12 w-12 items-center justify-center rounded-lg border border-border text-lg disabled:opacity-30"
          title="Назад"
        >
          ↩
        </button>
        <button
          onClick={() => grade("learning")}
          className="h-12 flex-1 rounded-lg bg-amber-500/15 font-medium text-amber-600 hover:bg-amber-500/25"
        >
          Ещё учу
        </button>
        <button
          onClick={() => grade("known")}
          className="h-12 flex-1 rounded-lg bg-success/15 font-medium text-success hover:bg-success/25"
        >
          Знаю
        </button>
      </div>
      <p className="text-center text-xs text-muted">
        Пробел — перевернуть · → знаю · ← ещё учу · ↑ назад
      </p>
    </div>
  );
}

function CardControls({
  starred,
  onStar,
  onSpeak,
}: {
  starred: boolean;
  onStar: (e: React.MouseEvent) => void;
  onSpeak: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="absolute right-2 top-2 flex gap-1">
      <button
        onClick={onSpeak}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-background"
        title="Озвучить"
      >
        🔊
      </button>
      <button
        onClick={onStar}
        className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-background"
        title="В избранное"
      >
        {starred ? "⭐" : "☆"}
      </button>
    </div>
  );
}

// ─────────────────────────── Викторины ───────────────────────────

type Question = {
  card: StudyCard;
  qmode: Mode;
  options?: string[];
};

function blankOut(sentence: string, word: string): string | null {
  if (!sentence) return null;
  const re = new RegExp(`(^|[^\\p{L}])(${escapeRe(word)})($|[^\\p{L}])`, "iu");
  if (!re.test(sentence)) return null;
  return sentence.replace(re, (_m, a, _w, b) => `${a}______${b}`);
}

function buildQueue(cards: StudyCard[], mode: Mode): Question[] {
  const pool = prioritize(cards).slice(0, 20);

  return pool.map((card) => {
    let qmode = mode;
    if (mode === "mix") {
      qmode = QUESTION_MODES[Math.floor(Math.random() * QUESTION_MODES.length)];
    }
    // context требует пример с этим словом — иначе type
    if (qmode === "context") {
      const ex = card.example || card.context || "";
      if (blankOut(ex, card.word) === null) qmode = "type";
    }
    // choose/reverse требуют хотя бы одну обманку
    let options: string[] | undefined;
    if (qmode === "choose") {
      const d = distractors(card, cards, "translation", 3);
      if (d.length === 0) qmode = "type";
      else options = shuffle([card.translation, ...d]);
    } else if (qmode === "reverse") {
      const d = distractors(card, cards, "word", 3);
      if (d.length === 0) qmode = "type";
      else options = shuffle([card.word, ...d]);
    }
    return { card, qmode, options };
  });
}

function QuizSession({
  mode,
  cards,
  collectionName,
  onExit,
}: {
  mode: Mode;
  cards: StudyCard[];
  collectionName: string;
  onExit: () => void;
}) {
  const queue = useMemo(() => buildQueue(cards, mode), [cards, mode]);
  const [idx, setIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const q = queue[idx];
  const done = idx >= queue.length;
  const isInputMode =
    q && (q.qmode === "type" || q.qmode === "context" || q.qmode === "listen");

  useEffect(() => {
    if (q?.qmode === "listen" && !answered) speak(q.card.word);
    if (isInputMode && inputRef.current) inputRef.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, q, answered]);

  const next = useCallback(() => {
    setAnswered(false);
    setTyped("");
    setIdx((i) => i + 1);
  }, []);

  const finishAnswer = useCallback(
    (correct: boolean) => {
      if (!q || answered) return;
      setAnswered(true);
      setWasCorrect(correct);
      if (correct) setCorrectCount((c) => c + 1);
      recordReview(q.card.id, mode === "mix" ? q.qmode : mode, correct);
    },
    [q, answered, mode]
  );

  // горячие клавиши для choose/reverse: 1-4 + Enter «дальше»
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!q) return;
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA";
      if (answered && (e.key === "Enter" || e.key === " ")) {
        if (!inField) {
          e.preventDefault();
          next();
        }
        return;
      }
      if (!answered && (q.qmode === "choose" || q.qmode === "reverse") && q.options) {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= q.options.length) {
          const opt = q.options[n - 1];
          const correctVal = q.qmode === "choose" ? q.card.translation : q.card.word;
          finishAnswer(opt === correctVal);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, answered, finishAnswer, next]);

  if (queue.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="text-muted">Недостаточно карточек для этого режима.</p>
        <button onClick={onExit} className="text-primary underline">
          К режимам
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <Result
        correct={correctCount}
        total={queue.length}
        title={collectionName}
        onAgain={onExit}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm">
        <button onClick={onExit} className="flex h-10 items-center text-muted hover:text-foreground">
          ✕ Выйти
        </button>
        <span className="text-muted">
          {idx + 1} / {queue.length} · ✓ {correctCount}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${queue.length ? (idx / queue.length) * 100 : 0}%` }}
        />
      </div>

      {/* Choose / Reverse */}
      {(q.qmode === "choose" || q.qmode === "reverse") && q.options && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <div className="text-xs uppercase text-muted">
              {q.qmode === "choose" ? "Переведи слово" : "Какое это слово?"}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-2xl font-bold">
              {q.qmode === "choose" ? q.card.word : q.card.translation}
              {q.qmode === "choose" && (
                <button
                  onClick={() => speak(q.card.word)}
                  className="flex h-10 w-10 items-center justify-center text-muted"
                >
                  🔊
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            {q.options.map((opt, i) => {
              const correctVal =
                q.qmode === "choose" ? q.card.translation : q.card.word;
              const isCorrect = opt === correctVal;
              let cls =
                "flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-left hover:border-primary active:scale-[0.99]";
              if (answered) {
                if (isCorrect)
                  cls =
                    "flex items-center gap-2 rounded-lg border border-success bg-success/10 px-4 py-3 text-left";
                else
                  cls =
                    "flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-left opacity-50";
              }
              return (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => finishAnswer(isCorrect)}
                  className={cls}
                >
                  <span className="hidden text-xs text-muted sm:inline">{i + 1}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
          {answered && <NextButton onNext={next} correct={wasCorrect} />}
        </div>
      )}

      {/* Type / Listen / Context */}
      {(q.qmode === "type" || q.qmode === "listen" || q.qmode === "context") && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            {q.qmode === "type" && (
              <>
                <div className="text-xs uppercase text-muted">Набери слово</div>
                <div className="mt-2 text-xl font-bold text-primary">
                  {q.card.translation}
                </div>
              </>
            )}
            {q.qmode === "listen" && (
              <>
                <div className="text-xs uppercase text-muted">Что ты услышал?</div>
                <button
                  onClick={() => speak(q.card.word)}
                  className="mx-auto mt-2 flex h-14 w-14 items-center justify-center rounded-full text-4xl hover:bg-background"
                >
                  🔊
                </button>
              </>
            )}
            {q.qmode === "context" && (
              <>
                <div className="text-xs uppercase text-muted">Вставь слово</div>
                <div className="mt-2 text-lg">
                  {blankOut(q.card.example || q.card.context || "", q.card.word) ??
                    "______"}
                </div>
                <div className="mt-1 text-sm text-muted">{q.card.translation}</div>
              </>
            )}
          </div>

          {!answered ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                finishAnswer(normalize(typed) === normalize(q.card.word));
              }}
              className="flex gap-2"
            >
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-4 py-3 outline-none focus:border-primary"
                placeholder="Твой ответ…"
              />
              <button className="rounded-lg bg-primary px-5 font-medium text-white hover:bg-primary-hover">
                OK
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div
                className={`rounded-lg p-4 text-center ${
                  wasCorrect ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                }`}
              >
                {wasCorrect ? "✓ Верно!" : "✗ Неверно"} — правильно: <b>{q.card.word}</b>
              </div>
              <NextButton onNext={next} correct={wasCorrect} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NextButton({ onNext, correct }: { onNext: () => void; correct: boolean }) {
  return (
    <button
      onClick={onNext}
      autoFocus
      className={`h-12 w-full rounded-lg font-medium text-white ${
        correct ? "bg-success hover:opacity-90" : "bg-primary hover:bg-primary-hover"
      }`}
    >
      Дальше →
    </button>
  );
}

// ─────────────────────────── Сопоставление ───────────────────────────

function MatchGame({ cards, onExit }: { cards: StudyCard[]; onExit: () => void }) {
  const batches = useMemo(() => {
    const shuffled = shuffle(cards);
    const out: StudyCard[][] = [];
    for (let i = 0; i < shuffled.length; i += 5) out.push(shuffled.slice(i, i + 5));
    return out;
  }, [cards]);

  const [batchIdx, setBatchIdx] = useState(0);
  const batch = batches[batchIdx] || [];
  const [leftSel, setLeftSel] = useState<number | null>(null);
  const [rightSel, setRightSel] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);
  // карточки, по которым была ошибка — в ref, чтобы не попадать в зависимости эффекта
  const erroredRef = useRef<Set<number>>(new Set());
  const [erroredCount, setErroredCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  const rights = useMemo(() => shuffle(batch), [batch]);

  useEffect(() => {
    if (leftSel == null || rightSel == null) return;
    if (leftSel === rightSel) {
      // верная пара — логируем один раз; correct, если по ней не было ошибки
      recordReview(leftSel, "match", !erroredRef.current.has(leftSel));
      setMatched((m) => new Set(m).add(leftSel));
      setLeftSel(null);
      setRightSel(null);
    } else {
      setMistakes((n) => n + 1);
      if (!erroredRef.current.has(leftSel)) {
        erroredRef.current.add(leftSel);
        setErroredCount((n) => n + 1);
      }
      setWrong(rightSel);
      const t = setTimeout(() => {
        setWrong(null);
        setLeftSel(null);
        setRightSel(null);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [leftSel, rightSel]);

  const allMatched = batch.length > 0 && matched.size === batch.length;

  if (batchIdx >= batches.length) {
    const total = cards.length;
    const correct = Math.max(0, total - erroredCount);
    return (
      <Result
        correct={correct}
        total={total}
        title="Сопоставление"
        onAgain={onExit}
        customMessage={`Сопоставлено ${total} пар, ошибок: ${mistakes}`}
      />
    );
  }

  function nextBatch() {
    setMatched(new Set());
    setLeftSel(null);
    setRightSel(null);
    setBatchIdx((b) => b + 1);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between text-sm">
        <button onClick={onExit} className="flex h-10 items-center text-muted hover:text-foreground">
          ✕ Выйти
        </button>
        <span className="text-muted">
          Набор {batchIdx + 1} / {batches.length}
        </span>
      </div>
      <p className="text-center text-sm text-muted">Соедини слово с переводом</p>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="space-y-2">
          {batch.map((c) => (
            <button
              key={c.id}
              disabled={matched.has(c.id)}
              onClick={() => setLeftSel(c.id)}
              className={`w-full break-words rounded-lg border px-2 py-3 text-left text-xs sm:px-3 sm:text-sm ${
                matched.has(c.id)
                  ? "border-success bg-success/10 opacity-60"
                  : leftSel === c.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface hover:border-primary"
              }`}
            >
              {c.word}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rights.map((c) => (
            <button
              key={c.id}
              disabled={matched.has(c.id)}
              onClick={() => setRightSel(c.id)}
              className={`w-full break-words rounded-lg border px-2 py-3 text-left text-xs sm:px-3 sm:text-sm ${
                matched.has(c.id)
                  ? "border-success bg-success/10 opacity-60"
                  : wrong === c.id
                    ? "border-danger bg-danger/10"
                    : rightSel === c.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:border-primary"
              }`}
            >
              {c.translation}
            </button>
          ))}
        </div>
      </div>

      {allMatched && (
        <button
          onClick={nextBatch}
          className="h-12 w-full rounded-lg bg-primary font-medium text-white hover:bg-primary-hover"
        >
          {batchIdx + 1 < batches.length ? "Следующий набор →" : "Завершить"}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────── Спринт ───────────────────────────

function Sprint({ cards, onExit }: { cards: StudyCard[]; onExit: () => void }) {
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [q, setQ] = useState<Question | null>(null);
  const [running, setRunning] = useState(true);

  const makeQuestion = useCallback((): Question => {
    const card = cards[Math.floor(Math.random() * cards.length)];
    const d = distractors(card, cards, "translation", 3);
    return { card, qmode: "choose", options: shuffle([card.translation, ...d]) };
  }, [cards]);

  useEffect(() => {
    setQ(makeQuestion());
  }, [makeQuestion]);

  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, running]);

  if (!running) {
    return (
      <Result
        correct={score}
        total={score}
        title="Спринт окончен"
        onAgain={onExit}
        customMessage={`Ты набрал ${score} очков за 60 секунд!`}
      />
    );
  }

  function answer(opt: string) {
    if (!q) return;
    const correct = opt === q.card.translation;
    if (correct) setScore((s) => s + 1);
    recordReview(q.card.id, "sprint", correct);
    setQ(makeQuestion());
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex h-10 items-center text-sm text-muted hover:text-foreground">
          ✕ Выйти
        </button>
        <div className="text-sm font-medium">⚡ {score}</div>
        <div className={`text-lg font-bold ${timeLeft <= 10 ? "text-danger" : ""}`}>
          {timeLeft}s
        </div>
      </div>

      {q && (
        <>
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <div className="text-2xl font-bold">{q.card.word}</div>
          </div>
          <div className="grid gap-2">
            {q.options!.map((opt, i) => (
              <button
                key={i}
                onClick={() => answer(opt)}
                className="rounded-lg border border-border bg-surface px-4 py-3 text-left hover:border-primary active:scale-[0.99]"
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────── Результат ───────────────────────────

function Result({
  correct,
  total,
  title,
  onAgain,
  customMessage,
}: {
  correct: number;
  total: number;
  title: string;
  onAgain: () => void;
  customMessage?: string;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <div className="text-6xl">{pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "💪"}</div>
      <h1 className="text-2xl font-bold">Готово!</h1>
      <p className="text-muted">
        {customMessage || `${title}: ${correct} из ${total} верно (${pct}%)`}
      </p>
      <div className="flex justify-center gap-2">
        <button
          onClick={onAgain}
          className="rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-primary-hover"
        >
          Ещё раз
        </button>
        <Link
          href="/collections"
          className="rounded-lg border border-border px-5 py-3 font-medium hover:bg-surface"
        >
          К коллекциям
        </Link>
      </div>
    </div>
  );
}
