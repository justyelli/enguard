import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/gamify";

// POST /api/profile/boost  { kind: 2 | 3 } — активировать жетон ускорения
export async function POST(req: NextRequest) {
  let kind = 2;
  try {
    ({ kind } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  kind = Number(kind);
  if (kind !== 2 && kind !== 3) {
    return NextResponse.json({ error: "bad kind" }, { status: 400 });
  }

  await getProfile(); // singleton id=1
  const now = new Date();
  const minutes = kind === 2 ? 15 : 10;
  const expires = new Date(now.getTime() + minutes * 60_000);
  const tokenField = kind === 2 ? "boost2" : "boost3";

  // атомарно: есть жетон И нет активного буста
  const res = await prisma.profile.updateMany({
    where: {
      id: 1,
      [tokenField]: { gt: 0 },
      OR: [{ boostMult: { lte: 1 } }, { boostExpires: { lte: now } }],
    },
    data: {
      [tokenField]: { decrement: 1 },
      boostMult: kind,
      boostExpires: expires,
    },
  });

  if (res.count === 0) {
    const p = await getProfile();
    const active = p.boostMult > 1 && p.boostExpires && p.boostExpires > now;
    if (active) {
      return NextResponse.json({ error: "Буст уже активен" }, { status: 400 });
    }
    return NextResponse.json({ error: "Нет жетонов этого буста" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, mult: kind, minutes });
}
