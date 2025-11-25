-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Inventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleId" INTEGER NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "shelfPosition" TEXT,
    "batch" TEXT,
    "expiry" TEXT,
    "lastUpdated" DATETIME NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Inventory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Inventory" ("articleId", "batch", "currentStock", "expiry", "id", "lastUpdated", "minimumStock", "notes", "shelfPosition") SELECT "articleId", "batch", "currentStock", "expiry", "id", "lastUpdated", "minimumStock", "notes", "shelfPosition" FROM "Inventory";
DROP TABLE "Inventory";
ALTER TABLE "new_Inventory" RENAME TO "Inventory";
CREATE UNIQUE INDEX "Inventory_articleId_key" ON "Inventory"("articleId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
