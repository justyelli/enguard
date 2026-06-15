import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/gamify";

const PRICES = { freeze: 50, boost2: 40, boost3: 100 } as const;
type Item = keyof typeof PRICES;

// POST /api/profile/shop  { item: "freeze" | "boost2" | "boost3" }
export async function POST(req: NextRequest) {
  let item: Item;
  try {
    ({ item } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (!(item in PRICES)) {
    return NextResponse.json({ error: "bad item" }, { status: 400 });
  }

  await getProfile(); // гарантируем singleton id=1
  const price = PRICES[item];

  // атомарная покупка: условие в where + decrement/increment
  const where =
    item === "freeze"
      ? { id: 1, gems: { gte: price }, freezes: { lt: 2 } }
      : { id: 1, gems: { gte: price } };
  const data =
    item === "freeze"
      ? { gems: { decrement: price }, freezes: { increment: 1 } }
      : item === "boost2"
        ? { gems: { decrement: price }, boost2: { increment: 1 } }
        : { gems: { decrement: price }, boost3: { increment: 1 } };

  const res = await prisma.profile.updateMany({ where, data });
  if (res.count === 0) {
    const p = await getProfile();
    if (item === "freeze" && p.freezes >= 2) {
      return NextResponse.json({ error: "Максимум 2 заморозки" }, { status: 400 });
    }
    return NextResponse.json({ error: "Недостаточно гемов" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
