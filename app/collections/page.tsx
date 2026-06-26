"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ConfirmButton from "@/components/ConfirmButton";

type Collection = { id: number; name: string; description: string | null; count: number };

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/collections");
    const data = await res.json();
    setCollections(data.collections || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🃏 Коллекции</h1>

      <form onSubmit={create} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название новой коллекции"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
        />
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
          + Создать
        </button>
      </form>

      <Link
        href="/match"
        className="flex items-center justify-between gap-3 rounded-2xl border-2 border-accent/40 bg-accent/5 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      >
        <div>
          <div className="font-display font-bold">🎮 Игра «Пары»</div>
          <div className="text-sm text-muted">
            Соединяй слово с переводом на скорость — азартная тренировка лексики.
          </div>
        </div>
        <span className="btn3d shrink-0 bg-accent px-4 py-2 text-sm text-white" style={{ boxShadow: "0 4px 0 0 color-mix(in srgb, var(--accent) 70%, black)" }}>
          Играть
        </span>
      </Link>

      {loading ? (
        <div className="text-muted">Загрузка…</div>
      ) : collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center text-muted">
          Пока нет коллекций. Создай первую выше или добавляй слова прямо из
          ридера и переводчика.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {collections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-5"
            >
              <Link href={`/collections/${c.id}`} className="min-w-0 flex-1">
                <div className="font-semibold hover:text-primary">{c.name}</div>
                <div className="text-xs text-muted">{c.count} карточек</div>
              </Link>
              <div className="flex items-center gap-2">
                {c.count > 0 && (
                  <Link
                    href={`/collections/${c.id}/study`}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
                  >
                    Учить
                  </Link>
                )}
                <ConfirmButton
                  onConfirm={() => remove(c.id)}
                  label={`Удалить коллекцию «${c.name}»`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
