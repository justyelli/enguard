import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Singleton, чтобы в dev-режиме hot-reload не плодил подключения.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Локально — файл dev.db; на проде (Vercel) — Turso через TURSO_* переменные.
// libSQL-адаптер понимает и file:, и libsql:// URL.
function createClient() {
  const url =
    process.env.TURSO_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "file:./dev.db";
  const adapter = new PrismaLibSql({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
