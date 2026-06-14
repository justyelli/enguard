"use client";

import type { SmartTranslation } from "@/lib/translate";

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* нет поддержки — игнор */
  }
}

export default function TranslationView({
  t,
  full = false,
}: {
  t: SmartTranslation;
  full?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{t.term}</span>
          <button
            onClick={() => speak(t.term)}
            title="Произнести"
            aria-label={`Произнести «${t.term}»`}
            className="flex h-8 w-8 items-center justify-center text-muted hover:text-primary"
          >
            🔊
          </button>
          {t.transcription && (
            <span className="text-sm text-muted">{t.transcription}</span>
          )}
          {t.partOfSpeech && (
            <span className="rounded bg-background px-1.5 py-0.5 text-xs text-muted">
              {t.partOfSpeech}
            </span>
          )}
        </div>
        <div className="mt-1 text-base font-medium text-primary">
          {t.translation}
        </div>
      </div>

      {t.meaning && <p className="text-sm text-muted">{t.meaning}</p>}

      {full && t.examples.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase text-muted">
            Примеры
          </div>
          <ul className="space-y-1.5">
            {t.examples.map((ex, i) => (
              <li key={i} className="text-sm">
                <span className="text-foreground">{ex.en}</span>
                <br />
                <span className="text-muted">{ex.ru}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!full && t.examples[0] && (
        <div className="text-sm">
          <span className="text-foreground">{t.examples[0].en}</span>
          <br />
          <span className="text-muted">{t.examples[0].ru}</span>
        </div>
      )}

      {full && t.synonyms.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase text-muted">
            Синонимы
          </div>
          <ul className="space-y-1">
            {t.synonyms.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{s.word}</span>
                <span className="text-muted"> — {s.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {full && t.differences.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase text-muted">
            Чем отличается от похожих
          </div>
          <ul className="space-y-1">
            {t.differences.map((d, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{d.word}</span>
                <span className="text-muted"> — {d.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {t.fallback && (
        <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
          ⚠️ Ключ OpenAI не задан — показан только заглушечный результат.
        </div>
      )}
    </div>
  );
}
