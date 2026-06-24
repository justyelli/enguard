// Упрощённый алгоритм интервальных повторений (на основе SM-2).

export type Grade = "again" | "hard" | "good" | "easy";

export type SrsState = {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
};

export type SrsUpdate = SrsState & { dueDate: Date };

const MIN_EASE = 1.3;

// «Лич» — слово, которое раз за разом проваливается: SRS-зубрёжка ему не
// помогает. Такие карточки помечаем (для адресной проработки) и не гоняем по
// кругу в одной сессии, а откладываем — это эффективнее, чем биться о них.
export const LEECH_LAPSES = 8;
export function isLeech(lapses: number): boolean {
  return lapses >= LEECH_LAPSES;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// Для повтора «сегодня» (again) ставим due через несколько минут,
// чтобы карточка вернулась в текущей сессии.
function inMinutes(base: Date, min: number): Date {
  return new Date(base.getTime() + min * 60_000);
}

// Размытие интервала (как в Anki/FSRS): когда добавляешь пачку слов разом, без
// fuzz все они приходят на повтор в один день и создают пики, ломающие режим.
// Разброс растёт с интервалом, но ограничен. Размываем ТОЛЬКО дату повтора —
// сам intervalDays храним «чистым», чтобы дрейф не накапливался.
export function fuzzDays(interval: number, rnd: () => number = Math.random): number {
  if (interval < 3) return interval;
  const pct = interval < 7 ? 0.15 : interval < 30 ? 0.1 : 0.05;
  const spread = Math.max(1, Math.round(interval * pct));
  const delta = Math.round((rnd() * 2 - 1) * spread);
  return Math.max(1, interval + delta);
}

export function review(state: SrsState, grade: Grade, now = new Date()): SrsUpdate {
  let { ease, intervalDays, reps, lapses } = state;

  if (grade === "again") {
    ease = Math.max(MIN_EASE, ease - 0.2);
    lapses += 1;
    reps = 0;
    intervalDays = 0;
    // лич не гоняем по кругу в сессии — даём отлежаться до завтра
    const dueDate = isLeech(lapses) ? addDays(now, 1) : inMinutes(now, 10);
    return { ease, intervalDays, reps, lapses, dueDate };
  }

  reps += 1;

  if (grade === "hard") {
    ease = Math.max(MIN_EASE, ease - 0.15);
    intervalDays = reps === 1 ? 1 : Math.max(1, Math.round(intervalDays * 1.2));
  } else if (grade === "good") {
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 3;
    else intervalDays = Math.max(1, Math.round(intervalDays * ease));
  } else if (grade === "easy") {
    ease = ease + 0.15;
    if (reps === 1) intervalDays = 2;
    else intervalDays = Math.max(1, Math.round(intervalDays * ease * 1.3));
  }

  // intervalDays — чистый (для будущих умножений), дату повтора размываем
  return { ease, intervalDays, reps, lapses, dueDate: addDays(now, fuzzDays(intervalDays)) };
}

// Для бинарных упражнений (верно/неверно) маппим на grade.
export function gradeFromCorrect(correct: boolean): Grade {
  return correct ? "good" : "again";
}
