-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" DATETIME,
    "originalScheduledAt" DATETIME,
    "assignedOperatorId" INTEGER,
    "estimatedMinutes" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "color" TEXT NOT NULL DEFAULT '#FCD34D',
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceType" TEXT,
    "recurrenceEnd" DATETIME,
    "parentTaskId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "acceptedById" INTEGER,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" DATETIME,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedById" INTEGER,
    "completedAt" DATETIME,
    "actualMinutes" INTEGER,
    CONSTRAINT "Task_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("acceptedAt", "acceptedById", "actualMinutes", "assignedOperatorId", "color", "completed", "completedAt", "completedById", "createdAt", "createdById", "description", "estimatedMinutes", "id", "originalScheduledAt", "paused", "pausedAt", "priority", "scheduledAt", "title") SELECT "acceptedAt", "acceptedById", "actualMinutes", "assignedOperatorId", "color", "completed", "completedAt", "completedById", "createdAt", "createdById", "description", "estimatedMinutes", "id", "originalScheduledAt", "paused", "pausedAt", "priority", "scheduledAt", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
