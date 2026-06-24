import Link from "next/link";
import { getVocabProgress, type WordStatus } from "@/lib/vocab";
import { getReadingWordCandidates } from "@/lib/reading-words";
import AddVocab from "@/components/AddVocab";
import AddReadingWords from "@/components/AddReadingWords";
import GenerateVocab from "@/components/GenerateVocab";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<WordStatus, { label: string; cls: string }> = {
  known: { label: "знаю", cls: "bg-success/15 text-success" },
  added: { label: "учу", cls: "bg-xp/15 text-xp" },
  new: { label: "новое", cls: "bg-background text-muted" },
};

export default async function VocabPage() {
  const [prog, reading] = await Promise.all([
    getVocabProgress(),
    getReadingWordCandidates(24),
  ]);
  const overallPct = Math.round((prog.totalKnown / Math.max(1, prog.totalWords)) * 100);

  return (
    <div className="space-y-6">
      <section className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            📚 Ядро лексики
          </h1>
          <p className="text-muted">
            Самые полезные слова по уровням. Учим частотное в первую очередь — это
            быстрее всего поднимает понимание речи.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-bold text-primary">{overallPct}%</div>
          <div className="text-xs text-muted">освоено</div>
        </div>
      </section>

      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
        Нажми «+ в карточки» — слова попадут в коллекцию уровня и встанут в очередь
        интервальных повторений. Отметка «знаю» появляется после первого верного
        повторения. Добавляй порциями, чтобы не перегружаться.
      </div>

      {reading.length > 0 && (
        <section className="rounded-3xl border-2 border-primary/40 bg-primary/5 p-5 sm:p-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">📥 Слова из твоего чтения</h2>
              <p className="text-sm text-muted">
                Слова, которые ты смотрел в книгах, но ещё не учишь. Самая полезная
                лексика — из живого текста. Добавим их в карточки <b>вместе с
                предложением</b> (режим «вставь слово в контекст»).
              </p>
            </div>
            <AddReadingWords
              words={reading.map((r) => ({
                word: r.word,
                translation: r.translation,
                context: r.context,
              }))}
            />
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {reading.slice(0, 12).map((r) => (
              <li key={r.word} className="rounded-xl bg-surface p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">{r.word}</span>
                  <span className="text-sm text-muted">— {r.translation}</span>
                  {r.count > 1 && (
                    <span className="rounded bg-background px-1 text-[10px] text-muted">
                      ×{r.count}
                    </span>
                  )}
                </div>
                {r.context && (
                  <div className="truncate text-xs italic text-muted">{r.context}</div>
                )}
              </li>
            ))}
          </ul>
          {reading.length > 12 && (
            <p className="mt-2 text-xs text-muted">…и ещё {reading.length - 12}. Кнопка добавит все.</p>
          )}
        </section>
      )}

      {prog.bands.map((b) => {
        const pct = Math.round((b.known / b.total) * 100);
        const remaining = b.total - b.added;
        return (
          <section key={b.band} className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 font-display text-lg font-bold text-primary">
                  {b.band}
                </div>
                <div>
                  <div className="font-display font-bold">
                    {b.known} / {b.total} освоено
                  </div>
                  <div className="text-xs text-muted">
                    в карточках: {b.added} · осталось добавить: {remaining}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <AddVocab band={b.band} remaining={remaining} />
                <GenerateVocab band={b.band} />
              </div>
            </div>

            <div className="mb-4 h-2 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            <details className="group">
              <summary className="cursor-pointer list-none text-sm font-medium text-primary">
                <span className="group-open:hidden">Показать слова ▾</span>
                <span className="hidden group-open:inline">Скрыть слова ▴</span>
              </summary>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {b.words.map((w) => {
                  const chip = STATUS_CHIP[w.status];
                  return (
                    <li
                      key={w.w}
                      className="flex items-start justify-between gap-2 rounded-xl bg-background p-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{w.w}</span>
                          <span className="text-sm text-muted">— {w.t}</span>
                        </div>
                        <div className="truncate text-xs italic text-muted">{w.ex}</div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${chip.cls}`}
                      >
                        {chip.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          </section>
        );
      })}

      <div className="text-center">
        <Link href="/collections" className="text-sm font-medium text-primary hover:underline">
          Открыть коллекции карточек →
        </Link>
      </div>
    </div>
  );
}
