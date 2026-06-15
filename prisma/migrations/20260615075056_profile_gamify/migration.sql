-- CreateTable
CREATE TABLE "Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "todayXp" INTEGER NOT NULL DEFAULT 0,
    "todayDay" TEXT,
    "dailyGoalXp" INTEGER NOT NULL DEFAULT 50,
    "goalRewardedDay" TEXT,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDay" TEXT,
    "gems" INTEGER NOT NULL DEFAULT 0,
    "freezes" INTEGER NOT NULL DEFAULT 0,
    "boost2" INTEGER NOT NULL DEFAULT 0,
    "boost3" INTEGER NOT NULL DEFAULT 0,
    "boostMult" INTEGER NOT NULL DEFAULT 1,
    "boostExpires" DATETIME,
    "updatedAt" DATETIME NOT NULL
);
