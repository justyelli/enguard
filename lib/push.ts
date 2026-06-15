import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;

export function pushEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure(): boolean {
  if (configured) return true;
  if (!pushEnabled()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@enguard.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string };

// Рассылает пуш всем подписанным устройствам; чистит «мёртвые» подписки.
export async function sendToAll(payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!configure()) return { sent: 0, removed: 0 };
  const subs = await prisma.pushSubscription.findMany();
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        );
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          removed++;
        }
      }
    })
  );

  return { sent, removed };
}
