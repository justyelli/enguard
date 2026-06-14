import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <div className="text-5xl">🔍</div>
      <h1 className="text-xl font-bold">Страница не найдена</h1>
      <p className="text-sm text-muted">
        Похоже, такой страницы нет или она была удалена.
      </p>
      <Link
        href="/"
        className="inline-block rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-hover"
      >
        На главную
      </Link>
    </div>
  );
}
