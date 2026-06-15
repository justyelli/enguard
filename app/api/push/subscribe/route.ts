import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/push/subscribe  { subscription: PushSubscriptionJSON }
export async function POST(req: NextRequest) {
  try {
    const { subscription } = await req.json();
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "bad subscription" }, { status: 400 });
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth },
      update: { p256dh, auth },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
}
