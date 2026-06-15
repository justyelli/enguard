-- CreateTable
CREATE TABLE "PracticeLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "skill" TEXT NOT NULL,
    "detail" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WritingSubmission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "prompt" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PracticeLog_createdAt_idx" ON "PracticeLog"("createdAt");

-- CreateIndex
CREATE INDEX "PracticeLog_skill_idx" ON "PracticeLog"("skill");

-- CreateIndex
CREATE INDEX "WritingSubmission_createdAt_idx" ON "WritingSubmission"("createdAt");
