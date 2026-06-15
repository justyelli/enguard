import { NextRequest, NextResponse } from "next/server";
import { getProfile, dayKey } from "@/lib/gamify";
import { sendToAll, pushEnabled } from "@/lib/push";

export const runtime = "nodejs";

// GET /api/push/cron  — ежедневная рассылка напоминаний.
// Защита: заголовок Authorization: Bearer <CRON_SECRET> (Vercel Cron шлёт его сам).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // fail-closed: без секрета эндпоинт недоступен (не открываем рассылку публично)
  if (!secret) {
    return NextResponse.json({ error: "cron not configured" }, { status: 500 });
  }
  // только заголовок Authorization (Vercel Cron шлёт его сам); без секрета в URL
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pushEnabled()) {
    return NextResponse.json({ error: "push not configured" }, { status: 503 });
  }

  const p = await getProfile();
  const activeToday = p.lastActiveDay === dayKey();
  if (activeToday) {
    return NextResponse.json({ ok: true, skipped: "already active today" });
  }

  const body =
    p.streak > 0
      ? `Не теряй серию из ${p.streak} дней! 🔥 Зайди позаниматься.`
      : "Пора позаниматься английским 📚 Пара минут — и +XP!";

  const res = await sendToAll({ title: "Enguard", body, url: "/" });
  return NextResponse.json({ ok: true, ...res });
}
