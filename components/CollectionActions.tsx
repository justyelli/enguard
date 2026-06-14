"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CollectionActions({
  collectionId,
}: {
  collectionId: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function importFile(file: File) {
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/collections/${collectionId}/import`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setMsg(`Добавлено: ${data.added}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Ошибка импорта");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/collections/${collectionId}/export`}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface"
      >
        ⬇ Экспорт CSV
      </a>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50"
      >
        {busy ? "Импорт…" : "⬆ Импорт"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importFile(f);
          e.target.value = "";
        }}
      />
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
