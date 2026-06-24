-- CreateTable
CREATE TABLE "Mistake" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source" TEXT NOT NULL,
    "wrong" TEXT NOT NULL,
    "correct" TEXT NOT NULL,
    "note" TEXT,
    "category" TEXT,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Mistake_resolved_idx" ON "Mistake"("resolved");

-- CreateIndex
CREATE INDEX "Mistake_createdAt_idx" ON "Mistake"("createdAt");
