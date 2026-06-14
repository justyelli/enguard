"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <div className="text-5xl">😵</div>
      <h1 className="text-xl font-bold">Что-то пошло не так</h1>
      <p className="text-sm text-muted">
        Произошла ошибка. Попробуй обновить или вернуться позже.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-hover"
      >
        Повторить
      </button>
    </div>
  );
}
