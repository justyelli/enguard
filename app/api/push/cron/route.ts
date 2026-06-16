import { NextRequest, NextResponse } from "next/server";
import { getProfile, dayKey } from "@/lib/gamify";
import { sendToAll, pushEnabled } from "@/lib/push";

export const runtime = "nodejs";

// GET /api/push/cron — напоминания (запускается кроном каждые 3 часа).
// Защита: заголовок Authorization: Bearer <CRON_SECRET>.
// ?test=1 — отправить тестовый пуш сейчас, минуя проверки (для диагностики).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pushEnabled()) {
    return NextResponse.json({ error: "push not configured" }, { status: 503 });
  }

  const test = req.nextUrl.searchParams.get("test");
  const p = await getProfile();

  if (!test) {
    // уже занимался сегодня — не напоминаем
    if (p.lastActiveDay === dayKey()) {
      return NextResponse.json({ ok: true, skipped: "already active today" });
    }
    // тихие часы: шлём только днём в локальном поясе пользователя
    const offset = Number(process.env.APP_TZ_OFFSET || 0);
    const localHour = new Date(Date.now() + offset * 3_600_000).getUTCHours();
    if (localHour < 9 || localHour >= 22) {
      return NextResponse.json({ ok: true, skipped: "quiet hours" });
    }
  }

  const body = test
    ? "Тестовое уведомление ✅ Пуши работают!"
    : p.streak > 0
      ? `Не теряй серию из ${p.streak} дней! 🔥 Пора пройти урок.`
      : "Пора пройти урок английского 📚 Пара минут — и +XP!";

  const res = await sendToAll({ title: "Enguard", body, url: "/" });
  return NextResponse.json({ ok: true, test: !!test, ...res });
}
