/*
  Warnings:

  - You are about to drop the column `originalScheduledAt` on the `Task` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Article" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleId" INTEGER NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "shelfPosition" TEXT,
    "batch" TEXT,
    "expiry" TEXT,
    "lastUpdated" DATETIME NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Inventory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inventoryId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "orderId" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,
    CONSTRAINT "StockMovement_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockAlert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    "alertType" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL,
    "minimumStock" INTEGER NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockAlert_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockAlert_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "articleId" INTEGER NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityDelivered" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" DATETIME,
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
INSERT INTO "new_Task" ("acceptedAt", "acceptedById", "actualMinutes", "assignedOperatorId", "color", "completed", "completedAt", "completedById", "createdAt", "createdById", "description", "estimatedMinutes", "id", "parentTaskId", "paused", "pausedAt", "priority", "recurrenceEnd", "recurrenceType", "recurring", "scheduledAt", "title") SELECT "acceptedAt", "acceptedById", "actualMinutes", "assignedOperatorId", "color", "completed", "completedAt", "completedById", "createdAt", "createdById", "description", "estimatedMinutes", "id", "parentTaskId", "paused", "pausedAt", "priority", "recurrenceEnd", "recurrenceType", "recurring", "scheduledAt", "title" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Article_code_key" ON "Article"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_articleId_key" ON "Inventory"("articleId");

-- CreateIndex
CREATE INDEX "StockAlert_isResolved_idx" ON "StockAlert"("isResolved");

-- CreateIndex
CREATE INDEX "StockAlert_createdAt_idx" ON "StockAlert"("createdAt");
