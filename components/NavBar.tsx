"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const links = [
  { href: "/", label: "Главная", exact: true },
  { href: "/books", label: "Книги" },
  { href: "/translate", label: "Переводчик" },
  { href: "/collections", label: "Коллекции" },
  { href: "/practice", label: "Практика" },
  { href: "/workbook", label: "Воркбук" },
  { href: "/stats", label: "Статистика" },
];

export default function NavBar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="no-print border-b border-border bg-surface/85 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-bold text-lg"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white text-sm">
            E
          </span>
          <span className="hidden sm:inline">Enguard</span>
        </Link>
        <div className="flex flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {links.slice(1).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(l.href, l.exact)
                  ? "bg-primary text-white"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <ThemeToggle />
      </nav>
    </header>
  );
}
