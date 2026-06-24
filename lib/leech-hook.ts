import { getOpenAI, hasOpenAI, OPENAI_MODEL } from "@/lib/openai";

// ─────────────────────────────────────────────────────────────────────────────
// Мнемоники для «трудных слов» (leech-карточек).
//
// Слова, которые раз за разом проваливаются в SRS (lapses>=8), бессмысленно
// гонять тем же способом. Доказательный приём — сменить метод: яркая мнемоника
// (созвучие, образ, разбор на части) создаёт зацепку в памяти и разбивает блок.
// AI генерирует подсказку; без ключа — общий приём-подсказка.
// ─────────────────────────────────────────────────────────────────────────────

const SYS = `Ты — преподаватель английского и эксперт по мнемоникам для русскоязычных. Тебе дают английское слово и его перевод. Придумай ОДНУ яркую мнемоническую подсказку на РУССКОМ, чтобы намертво запомнить это слово.
Используй один из приёмов: созвучие с русским словом, живой нелепый образ, или разбор слова на части. Подсказка должна связать звучание/написание английского слова с его значением.
Верни СТРОГО JSON без markdown: { "hook": "подсказка на русском, 1-2 предложения, конкретно и образно" }`;

export async function generateHook(
  word: string,
  translation: string
): Promise<{ hook: string; usedAI: boolean }> {
  const fallback = {
    hook: `Разбей «${word}» на части или найди созвучие с русским словом, свяжи это с «${translation}» через яркий нелепый образ — чем абсурднее картинка, тем крепче запомнится.`,
    usedAI: false,
  };
  if (!hasOpenAI()) return fallback;
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.9,
      max_tokens: 220,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS },
        { role: "user", content: `Слово: "${word}". Перевод: "${translation}".` },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { hook?: unknown };
    if (typeof parsed.hook === "string" && parsed.hook.trim().length > 0) {
      return { hook: parsed.hook.trim(), usedAI: true };
    }
    return fallback;
  } catch (e) {
    console.error("generateHook error", e);
    return fallback;
  }
}
