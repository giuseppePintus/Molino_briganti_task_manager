-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Trip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "assignedOperatorId" INTEGER,
    "vehicleId" INTEGER,
    "vehicleName" TEXT,
    "sequence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" DATETIME,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "printedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Trip" ("assignedOperatorId", "completedAt", "createdAt", "date", "id", "name", "notes", "sequence", "startedAt", "status", "updatedAt", "vehicleId", "vehicleName") SELECT "assignedOperatorId", "completedAt", "createdAt", "date", "id", "name", "notes", "sequence", "startedAt", "status", "updatedAt", "vehicleId", "vehicleName" FROM "Trip";
DROP TABLE "Trip";
ALTER TABLE "new_Trip" RENAME TO "Trip";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
