"use client";

import { useState } from "react";
import type { SmartTranslation } from "@/lib/translate";
import TranslationView from "@/components/TranslationView";
import AddToCollection from "@/components/AddToCollection";

export default function TranslatePage() {
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<SmartTranslation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function translate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      setResult(data.translation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🔍 Умный переводчик</h1>
        <p className="mt-1 text-sm text-muted">
          Введи английское слово или фразу — получишь перевод, примеры
          употребления, синонимы и чем оно отличается от похожих слов.
        </p>
      </div>

      <form onSubmit={translate} className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="например: abandon"
          className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 outline-none focus:border-primary"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "…" : "Перевести"}
        </button>
      </form>

      {error && <div className="text-sm text-danger">{error}</div>}

      {result && (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
          <TranslationView t={result} full />
          <div className="border-t border-border pt-4">
            <AddToCollection
              word={result.term}
              translation={result.translation}
              example={result.examples[0]?.en}
            />
          </div>
        </div>
      )}
    </div>
  );
}
