// Перенос локального dev.db → пустую базу Turso. Идемпотентно (можно гонять повторно).
// Воспроизводит схему (CREATE из sqlite_master) и копирует все строки одной транзакцией
// с отложенной проверкой внешних ключей (данные в dev.db уже консистентны).
// Запуск:
//   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx tsx scripts/seed-turso.mjs
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Нужны TURSO_DATABASE_URL и TURSO_AUTH_TOKEN в окружении.");
  process.exit(1);
}

const local = createClient({ url: "file:./dev.db" });
const remote = createClient({ url, authToken });

// Схема из локальной БД: таблицы (в порядке создания) + индексы.
const master = await local.execute(
  "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid;"
);
const tables = master.rows.filter((r) => r.type === "table").map((r) => String(r.name));

// 1. Снести старые таблицы (если остались от прошлого прогона) — в обратном порядке.
for (const table of [...tables].reverse()) {
  await remote.execute(`DROP TABLE IF EXISTS "${table}";`);
}

// 2. Пересоздать схему (таблицы, затем индексы).
const tableDDL = master.rows.filter((r) => r.type === "table");
const indexDDL = master.rows.filter((r) => r.type !== "table");
for (const row of [...tableDDL, ...indexDDL]) {
  await remote.execute(String(row.sql));
}
console.log(`Схема: ${tableDDL.length} таблиц, ${indexDDL.length} индексов.`);

// 3. Все строки одной транзакцией с отложенной проверкой FK.
const stmts = [{ sql: "PRAGMA defer_foreign_keys=ON;", args: [] }];
const counts = {};
for (const table of tables) {
  const data = await local.execute(`SELECT * FROM "${table}";`);
  counts[table] = data.rows.length;
  if (data.rows.length === 0) continue;
  const cols = data.columns;
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map(() => "?").join(", ");
  for (const row of data.rows) {
    stmts.push({
      sql: `INSERT INTO "${table}" (${colList}) VALUES (${placeholders});`,
      args: cols.map((c) => row[c]),
    });
  }
}
await remote.batch(stmts, "write");

let total = 0;
for (const table of tables) {
  console.log(`  ${table}: ${counts[table]}`);
  total += counts[table];
}
console.log(`Готово. Всего строк перенесено: ${total}.`);

local.close();
remote.close();
