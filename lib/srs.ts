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

export function review(state: SrsState, grade: Grade, now = new Date()): SrsUpdate {
  let { ease, intervalDays, reps, lapses } = state;

  if (grade === "again") {
    ease = Math.max(MIN_EASE, ease - 0.2);
    lapses += 1;
    reps = 0;
    intervalDays = 0;
    return { ease, intervalDays, reps, lapses, dueDate: inMinutes(now, 10) };
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

  return { ease, intervalDays, reps, lapses, dueDate: addDays(now, intervalDays) };
}

// Для бинарных упражнений (верно/неверно) маппим на grade.
export function gradeFromCorrect(correct: boolean): Grade {
  return correct ? "good" : "again";
}
