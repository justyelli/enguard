import { prisma } from "@/lib/prisma";
import { getProfile, levelInfo } from "@/lib/gamify";
import { getPracticeSummary } from "@/lib/analytics";
import { getOpenMistakeCount } from "@/lib/mistakes";

// ─────────────────────────────────────────────────────────────────────────────
// «План на сегодня» — методический распорядок дня.
//
// Идея: за 2-3 часа в день за ~3 месяца пройти путь A2→C1 можно только при
// СБАЛАНСИРОВАННОЙ загрузке всех каналов. Самостоятельные ученики обычно
// перекашивают день в пассивное чтение и недодают продуктивные навыки и слух.
// План раскладывает время по доказательным пропорциям и в правильном порядке:
//
//  1. Интервальные повторения (spaced repetition) — наивысший ROI для удержания
//     лексики; делаем В НАЧАЛЕ, пока внимание свежее, и каждый день.
//  2. Понятный ввод — чтение на уровне i+1 (Krashen): главный источник новой
//     лексики и грамматики в контексте.
//  3. Аудирование — второй канал ввода, который без отдельной практики отстаёт.
//  4. Говорение — активное извлечение (retrieval) и беглость.
//  5. Письмо — медленная продукция с вниманием к точности.
//  6. Грамматика — точечная отработка формы (focus on form).
//
// «Фокус дня» — самый запущенный из четырёх навыков практики получает +время
// и метку, чтобы интерливинг подтягивал слабое звено (deliberate practice).
// ─────────────────────────────────────────────────────────────────────────────

export type PlanBlock = {
  key: string;
  icon: string;
  title: string;
  tech: string; // короткое имя техники
  why: string; // зачем это работает (1 строка)
  minutes: number;
  href: string;
  cta: string;
  done: boolean;
  progress: string | null; // напр. "12/20" или "8 слов"
  focus: boolean; // фокус дня (слабый навык)
};

export type TodayPlan = {
  cefr: string;
  next: string | null;
  blocks: PlanBlock[];
  totalMinutes: number;
  doneMinutes: number;
  doneCount: number;
  allDone: boolean;
};

type PracticeSkill = "listening" | "speaking" | "writing" | "grammar";

// Выбираем «фокус дня»: самый редко практикуемый навык за 30 дней,
// при равенстве — с самой низкой средней точностью.
function pickFocus(
  summary: { skill: string; sessions: number; avgScore: number }[]
): PracticeSkill {
  const order: PracticeSkill[] = ["listening", "speaking", "writing", "grammar"];
  const byKey = new Map(summary.map((s) => [s.skill, s]));
  let best: PracticeSkill = order[0];
  let bestRank = Infinity;
  for (const skill of order) {
    const s = byKey.get(skill);
    const sessions = s?.sessions ?? 0;
    const avg = s?.avgScore ?? 0;
    // меньше занятий → важнее; при равенстве ниже точность → важнее
    const rank = sessions * 1000 + avg;
    if (rank < bestRank) {
      bestRank = rank;
      best = skill;
    }
  }
  return best;
}

export async function getTodayPlan(): Promise<TodayPlan> {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const now = new Date();

  const [
    profile,
    reviewsToday,
    lookupsToday,
    dueCount,
    practiceGroups,
    summary,
    openMistakes,
    mistakesReviewedToday,
  ] = await Promise.all([
    getProfile(),
    prisma.reviewLog.count({ where: { createdAt: { gte: startToday } } }),
    prisma.wordLookup.count({ where: { createdAt: { gte: startToday } } }),
    prisma.card.count({ where: { dueDate: { lte: now } } }),
    prisma.practiceLog.groupBy({
      by: ["skill"],
      where: { createdAt: { gte: startToday } },
      _count: { _all: true },
    }),
    getPracticeSummary(),
    getOpenMistakeCount(),
    prisma.mistake.count({ where: { lastSeen: { gte: startToday } } }),
  ]);

  const lvl = levelInfo(profile.totalXp);
  const practiceToday: Record<string, number> = {};
  for (const g of practiceGroups) practiceToday[g.skill] = g._count._all;
  const focus = pickFocus(summary);

  // Цель по SRS: примерно равна числу просроченных, но в разумных рамках.
  const srsTarget = Math.min(40, Math.max(15, dueCount || 15));
  const srsDone = reviewsToday >= srsTarget || (dueCount === 0 && reviewsToday > 0);

  const focusBonus = (s: PracticeSkill) => (s === focus ? 5 : 0);

  // Дневная ротация под-режимов: разнообразие за 90 дней (против монотонности)
  // и покрытие обоих под-навыков канала. Оба варианта логируются под тем же
  // skill (listening/speaking), поэтому отметка «готово» работает без изменений.
  const dayNum = Math.floor(now.getTime() / 86_400_000);
  const listenVariant =
    dayNum % 2 === 0
      ? {
          icon: "🎧",
          title: "Аудирование",
          tech: "Тренировка слуха",
          href: "/practice/listening",
          cta: "Диктант",
          why: "Диктант обостряет восприятие на слух и точность — нужно расслышать каждое слово.",
        }
      : {
          icon: "📻",
          title: "Аудио-история",
          tech: "Понятный ввод на слух",
          href: "/practice/audio-story",
          cta: "Слушать",
          why: "Слушание связной истории ради смысла — главный двигатель к C1; незнакомые слова тапаешь прямо в транскрипте.",
        };
  const speakVariant =
    dayNum % 2 === 0
      ? {
          icon: "💬",
          title: "Говорение",
          tech: "Активное извлечение",
          href: "/practice/speaking",
          cta: "Говорить",
          why: "Проговаривание вслух запускает извлечение из памяти и развивает беглость.",
        }
      : {
          icon: "🎙️",
          title: "Шэдоуинг",
          tech: "Постановка произношения",
          href: "/practice/shadowing",
          cta: "Повторять",
          why: "Слушай и тут же повторяй за диктором — лучший способ поставить произношение, ритм и беглость.",
        };

  const blocks: PlanBlock[] = [
    {
      key: "srs",
      icon: "🔁",
      title: "Повторение слов",
      tech: "Интервальные повторения",
      why: "Самый эффективный способ удержать слова в долгой памяти — повторять их точно перед забыванием.",
      minutes: dueCount > 40 ? 30 : 20,
      href: dueCount > 0 ? "/review/due" : "/collections",
      cta: dueCount > 0 ? `Повторить (${Math.min(dueCount, 99)})` : "К карточкам",
      done: srsDone,
      progress: `${reviewsToday}/${srsTarget}`,
      focus: false,
    },
    {
      key: "reading",
      icon: "📖",
      title: "Чтение книги",
      tech: "Понятный ввод (i+1)",
      why: "Чтение чуть выше твоего уровня даёт новую лексику и грамматику в живом контексте.",
      minutes: 35,
      href: "/books",
      cta: "Читать",
      done: lookupsToday >= 8,
      progress: `${lookupsToday} слов`,
      focus: false,
    },
    {
      key: "listening",
      icon: listenVariant.icon,
      title: listenVariant.title,
      tech: listenVariant.tech,
      why: listenVariant.why,
      minutes: 25 + focusBonus("listening"),
      href: listenVariant.href,
      cta: listenVariant.cta,
      done: (practiceToday.listening ?? 0) > 0,
      progress: null,
      focus: focus === "listening",
    },
    {
      key: "speaking",
      icon: speakVariant.icon,
      title: speakVariant.title,
      tech: speakVariant.tech,
      why: speakVariant.why,
      minutes: 20 + focusBonus("speaking"),
      href: speakVariant.href,
      cta: speakVariant.cta,
      done: (practiceToday.speaking ?? 0) > 0,
      progress: null,
      focus: focus === "speaking",
    },
    {
      key: "writing",
      icon: "✍️",
      title: "Письмо",
      tech: "Продукция с разбором",
      why: "Письмо — медленная продукция: есть время осознанно применить новые слова и правила, а AI укажет ошибки.",
      minutes: 20 + focusBonus("writing"),
      href: "/practice/writing",
      cta: "Писать",
      done: (practiceToday.writing ?? 0) > 0,
      progress: null,
      focus: focus === "writing",
    },
    {
      key: "grammar",
      icon: "📐",
      title: "Грамматика",
      tech: "Отработка формы",
      why: "Короткий точечный квиз закрепляет конкретное правило — без перегруза теорией.",
      minutes: 15 + focusBonus("grammar"),
      href: "/practice/grammar",
      cta: "Квиз",
      done: (practiceToday.grammar ?? 0) > 0,
      progress: null,
      focus: focus === "grammar",
    },
  ];

  // Адаптивный блок: если в журнале есть неотработанные ошибки — точечная
  // практика по ним получает слот сразу после повторения (deliberate practice).
  if (openMistakes > 0) {
    blocks.splice(1, 0, {
      key: "mistakes",
      icon: "🛠️",
      title: "Работа над ошибками",
      tech: "Точечная практика",
      why: "Разбор собственных ошибок закрывает слабые места быстрее всего — это самая адресная практика.",
      minutes: 10,
      href: "/mistakes",
      cta: `Разобрать (${Math.min(openMistakes, 99)})`,
      done: mistakesReviewedToday > 0,
      progress: `${openMistakes} в журнале`,
      focus: false,
    });
  }

  const totalMinutes = blocks.reduce((s, b) => s + b.minutes, 0);
  const doneMinutes = blocks.reduce((s, b) => s + (b.done ? b.minutes : 0), 0);
  const doneCount = blocks.filter((b) => b.done).length;

  return {
    cefr: lvl.cefr,
    next: lvl.next,
    blocks,
    totalMinutes,
    doneMinutes,
    doneCount,
    allDone: doneCount === blocks.length,
  };
}
