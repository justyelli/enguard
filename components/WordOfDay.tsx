"use client";

import AddToCollection from "@/components/AddToCollection";

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* игнор */
  }
}

export default function WordOfDay({
  word,
  translation,
  example,
}: {
  word: string;
  translation: string;
  example: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-2 text-xs font-semibold uppercase text-muted">
        ✨ Слово дня
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{word}</span>
        <button
          onClick={() => speak(word)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-background"
          title="Озвучить"
        >
          🔊
        </button>
      </div>
      <div className="text-primary">{translation}</div>
      {example && <p className="mt-1 text-sm text-muted">{example}</p>}
      <div className="mt-3">
        <AddToCollection word={word} translation={translation} example={example ?? undefined} />
      </div>
    </div>
  );
}
