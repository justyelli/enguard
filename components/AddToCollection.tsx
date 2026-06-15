"use client";

import { useEffect, useState } from "react";

type Collection = { id: number; name: string; count: number };

export default function AddToCollection({
  word,
  translation,
  example,
  context,
  compact = false,
}: {
  word: string;
  translation: string;
  example?: string;
  context?: string;
  compact?: boolean;
}) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<
    "idle" | "saving" | "done" | "error" | "needname"
  >("idle");
  const [loaded, setLoaded] = useState(false);

  async function loadCollections() {
    const res = await fetch("/api/collections");
    const data = await res.json();
    setCollections(data.collections || []);
    if (data.collections?.[0]) setSelected(String(data.collections[0].id));
    setLoaded(true);
  }

  useEffect(() => {
    loadCollections();
  }, []);

  async function add() {
    if (!selected && !newName.trim()) {
      setStatus("needname");
      return;
    }
    setStatus("saving");
    try {
      let collectionId = selected ? Number(selected) : null;

      // Создаём новую коллекцию при необходимости
      if (newName.trim()) {
        const res = await fetch("/api/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim() }),
        });
        const data = await res.json();
        collectionId = data.collection.id;
      }

      if (!collectionId) {
        setStatus("error");
        return;
      }

      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId,
          word,
          translation,
          example,
          context,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
      setNewName("");
      loadCollections();
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="text-sm font-medium text-success">
        ✓ Добавлено в коллекцию
        <button
          className="ml-2 text-xs text-muted underline"
          onClick={() => setStatus("idle")}
        >
          ещё раз
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        {collections.length > 0 && (
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setNewName("");
            }}
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        )}
        <button
          onClick={add}
          disabled={status === "saving"}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {status === "saving" ? "…" : "➕ В коллекцию"}
        </button>
      </div>

      <input
        value={newName}
        onChange={(e) => {
          setNewName(e.target.value);
          if (status === "needname") setStatus("idle");
        }}
        placeholder={
          loaded && collections.length === 0
            ? "Создать коллекцию: введи название"
            : "…или новая коллекция"
        }
        className={`w-full rounded-lg border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary ${
          status === "needname" ? "border-danger" : "border-border"
        }`}
      />
      {status === "needname" && (
        <div className="text-xs text-danger">
          Сначала введи название коллекции (например «Мои слова»).
        </div>
      )}
      {status === "error" && (
        <div className="text-xs text-danger">Не удалось добавить.</div>
      )}
    </div>
  );
}
