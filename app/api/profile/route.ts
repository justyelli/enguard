import { NextResponse } from "next/server";
import { getProfile, levelInfo, dayKey } from "@/lib/gamify";

// GET /api/profile → текущее состояние игрока
export async function GET() {
  const p = await getProfile();
  const now = new Date();
  const boostActive = p.boostMult > 1 && p.boostExpires && p.boostExpires > now;
  const today = dayKey(now);

  return NextResponse.json({
    profile: {
      totalXp: p.totalXp,
      todayXp: p.todayDay === today ? p.todayXp : 0,
      dailyGoalXp: p.dailyGoalXp,
      streak: p.streak,
      longestStreak: p.longestStreak,
      activeToday: p.lastActiveDay === today,
      gems: p.gems,
      freezes: p.freezes,
      boost2: p.boost2,
      boost3: p.boost3,
      boostMult: boostActive ? p.boostMult : 1,
      boostSecondsLeft: boostActive
        ? Math.max(0, Math.round((p.boostExpires!.getTime() - now.getTime()) / 1000))
        : 0,
    },
    level: levelInfo(p.totalXp),
  });
}
