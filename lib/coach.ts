import { getDailySeries, getPracticeSummary, getDailyStats, getDueCount } from "@/lib/analytics";
import { getJourney } from "@/lib/progress";

// ─────────────────────────────────────────────────────────────────────────────
// «Совет недели» — коуч, синтезирующий аналитику в ОДИН конкретный фокус.
//
// Главные риски не дойти до C1 за 90 дней — не нехватка функций, а срыв
// регулярности и распыление усилий. У приложения много данных (серия, точность,
// навыки, темп), но ученику нужен вывод: что идёт хорошо и за что взяться.
// Логика детерминированная (без AI) — надёжно и воспроизводимо.
// ─────────────────────────────────────────────────────────────────────────────

type SkillKey = "listening" | "speaking" | "writing" | "grammar";

const SKILL_RU: Record<SkillKey, string> = {
  listening: "аудирование",
  speaking: "говорение",
  writing: "письмо",
  grammar: "грамматику",
};
const SKILL_HREF: Record<SkillKey, string> = {
  listening: "/practice/audio-story",
  speaking: "/practice/shadowing",
  writing: "/practice/writing",
  grammar: "/practice/grammar",
};
const SKILL_ACTION: Record<SkillKey, string> = {
  listening: "Слушай по одной аудио-истории в день — понимание на слух растёт быстрее всего.",
  speaking: "Делай шэдоуинг 10 минут в день — это ставит произношение и беглость.",
  writing: "Пиши по короткому тексту в день — AI укажет на ошибки, и они уйдут в проработку.",
  grammar: "Проходи по одному грамматическому квизу в день — точечно закрывай слабые правила.",
};

export type WeeklyInsight = {
  headline: string;
  wins: string[];
  focusTitle: string;
  focusWhy: string;
  focusAction: string;
  focusHref: string;
  activeDays: number;
};

export async function getWeeklyInsight(): Promise<WeeklyInsight> {
  const [series, summary, stats, dueCount, journey] = await Promise.all([
    getDailySeries(7),
    getPracticeSummary(),
    getDailyStats(),
    getDueCount(),
    getJourney().catch(() => null),
  ]);

  const activeDays = series.filter(
    (d) => d.reviews + d.lookups + d.practice > 0
  ).length;
  const weekReviews = series.reduce((s, d) => s + d.reviews, 0);
  const weekCorrect = series.reduce((s, d) => s + d.correct, 0);
  const weekAccuracy = weekReviews > 0 ? Math.round((weekCorrect / weekReviews) * 100) : 0;

  // Самый запущенный навык: меньше всего занятий, при равенстве — ниже точность.
  const order: SkillKey[] = ["listening", "speaking", "writing", "grammar"];
  const byKey = new Map(summary.map((s) => [s.skill, s]));
  let weakest: SkillKey = order[0];
  let weakRank = Infinity;
  for (const k of order) {
    const s = byKey.get(k);
    const rank = (s?.sessions ?? 0) * 1000 + (s?.avgScore ?? 0);
    if (rank < weakRank) {
      weakRank = rank;
      weakest = k;
    }
  }

  // ─── Достижения недели ───
  const wins: string[] = [];
  if (stats.streak >= 3) wins.push(`Серия ${stats.streak} ${plural(stats.streak)} 🔥`);
  if (weekReviews >= 20 && weekAccuracy >= 85) wins.push(`Точность повторений ${weekAccuracy}% — отлично`);
  if (activeDays >= 6) wins.push(`Занимался ${activeDays}/7 дней — стабильность решает`);
  if (journey?.status === "ahead") wins.push("Идёшь с опережением графика 🚀");
  if (wins.length === 0 && activeDays > 0) wins.push(`За неделю активных дней: ${activeDays}/7`);

  // ─── Единственный фокус (по приоритету влияния) ───
  let focusTitle: string, focusWhy: string, focusAction: string, focusHref: string;

  if (activeDays < 4) {
    focusTitle = "Вернуть регулярность";
    focusWhy = `Активных дней за неделю: ${activeDays}/7. Регулярность важнее объёма — короткие ежедневные занятия дают больше, чем редкие длинные.`;
    focusAction = "Закрывай хотя бы «Цель на сегодня» каждый день — даже 15–20 минут держат прогресс.";
    focusHref = "/";
  } else if (journey?.status === "behind") {
    focusTitle = "Прибавить темп";
    focusWhy = `По текущему темпу ты немного отстаёшь от графика к C1 (нужно ~${journey.neededPerDay} XP/день).`;
    focusAction = "Закрывай «План на сегодня» полностью — он рассчитан как раз под нужный темп.";
    focusHref = "/path";
  } else if (dueCount > 40) {
    focusTitle = "Разобрать повторения";
    focusWhy = `Накопилось ${dueCount} карточек к повторению — это растёт как снежный ком и бьёт по запоминанию.`;
    focusAction = "Сегодня сделай большой заход в повторение, чтобы расчистить очередь.";
    focusHref = "/review/due";
  } else {
    focusTitle = `Подтянуть ${SKILL_RU[weakest]}`;
    const s = byKey.get(weakest);
    focusWhy = `Из четырёх навыков ${SKILL_RU[weakest]} у тебя самый запущенный (${s?.sessions ?? 0} занятий за 30 дней). Баланс навыков — ключ к C1.`;
    focusAction = SKILL_ACTION[weakest];
    focusHref = SKILL_HREF[weakest];
  }

  const headline =
    activeDays < 4
      ? "Вернись в ритм 💪"
      : journey?.status === "ahead"
        ? "Отличная неделя — так держать! 🌟"
        : journey?.status === "behind"
          ? "Хорошо, но можно прибавить"
          : "Хороший ритм недели 👍";

  return { headline, wins, focusTitle, focusWhy, focusAction, focusHref, activeDays };
}

function plural(n: number): string {
  const d = n % 10,
    dd = n % 100;
  if (d === 1 && dd !== 11) return "день";
  if (d >= 2 && d <= 4 && (dd < 10 || dd >= 20)) return "дня";
  return "дней";
}
