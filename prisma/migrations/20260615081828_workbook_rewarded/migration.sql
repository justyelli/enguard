-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Workbook" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "day" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tasks" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "rewardedXp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Workbook" ("answers", "completed", "createdAt", "day", "id", "tasks", "title") SELECT "answers", "completed", "createdAt", "day", "id", "tasks", "title" FROM "Workbook";
DROP TABLE "Workbook";
ALTER TABLE "new_Workbook" RENAME TO "Workbook";
CREATE UNIQUE INDEX "Workbook_day_key" ON "Workbook"("day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
