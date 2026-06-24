import Link from "next/link";
import { getLeechCards } from "@/lib/analytics";
import LeechHook from "@/components/LeechHook";

export const dynamic = "force-dynamic";

export default async function LeechesPage() {
  const leeches = await getLeechCards(40);

  if (leeches.length === 0) {
    return (
      <div className="mx-auto max-w-md space-y-6 text-center">
        <div className="text-6xl">✨</div>
        <h1 className="font-display text-2xl font-bold">Трудных слов нет</h1>
        <p className="text-muted">
          Сюда попадают слова, которые ты много раз провалил в повторении. Пока таких
          нет — отлично! Если слово начнёт упорно ускользать, оно появится здесь, и я
          помогу запомнить его мнемоникой.
        </p>
        <Link href="/" className="btn3d inline-block bg-primary px-6 py-3 text-white">
          На главную
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          🐛 Трудные слова
        </h1>
        <p className="text-muted">
          Эти слова раз за разом ускользают — обычное повторение им не помогает. Смени
          подход: яркая <b>мнемоника</b> (созвучие, нелепый образ, разбор на части)
          создаёт зацепку в памяти и разбивает блок.
        </p>
      </section>

      <ul className="space-y-3">
        {leeches.map((c) => (
          <li key={c.id} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <span className="font-display text-lg font-bold">{c.word}</span>
                <span className="ml-2 text-muted">— {c.translation}</span>
              </div>
              <span className="shrink-0 rounded-md bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">
                трудное
              </span>
            </div>
            {(c.example || c.context) && (
              <p className="mt-1 text-sm italic text-muted">{c.example || c.context}</p>
            )}
            <LeechHook word={c.word} translation={c.translation} />
          </li>
        ))}
      </ul>

      <div className="text-center">
        <Link href="/review/mistakes" className="text-sm font-medium text-primary hover:underline">
          К повторению ошибок →
        </Link>
      </div>
    </div>
  );
}
