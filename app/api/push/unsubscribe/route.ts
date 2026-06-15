import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/push/unsubscribe  { endpoint }
export async function POST(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (typeof endpoint === "string") {
      await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
}
