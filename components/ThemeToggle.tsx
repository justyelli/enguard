"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* игнор */
    }
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "Светлая тема" : "Тёмная тема"}
      aria-label="Переключить тему"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-background"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
