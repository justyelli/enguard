"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export default function ReminderToggle() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!VAPID;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      setError("Нужно разрешить уведомления в браузере.");
      return;
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID) as unknown as BufferSource,
    });
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!res.ok) throw new Error("save failed");
    setEnabled(true);
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    setEnabled(false);
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (enabled) await disable();
      else await enable();
    } catch {
      setError("Пуш недоступен здесь (нужен HTTPS или совместимый браузер). На телефоне работает после установки PWA.");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
        🔔 Пуш-уведомления недоступны в этом браузере. Открой приложение по HTTPS
        (после деплоя) и установи как PWA — тогда напоминания будут приходить на телефон.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <button onClick={toggle} disabled={busy} className="flex w-full items-center justify-between text-left disabled:opacity-60">
        <div>
          <div className="font-display font-bold">🔔 Пуш-напоминания</div>
          <div className="text-sm text-muted">
            {enabled ? "Включены — напомним вечером, если не позанимался" : "Напоминать заниматься каждый день"}
          </div>
        </div>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-border"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </button>
      {error && <div className="mt-2 text-xs text-danger">{error}</div>}
    </div>
  );
}
