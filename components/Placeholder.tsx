export default function Placeholder({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center text-muted">
        🚧 {note}
      </div>
    </div>
  );
}
