-- CreateTable
CREATE TABLE "Warehouse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "posizione" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codice" TEXT,
    "lotto" TEXT,
    "scadenza" DATETIME,
    "quantita" INTEGER NOT NULL DEFAULT 0,
    "annotazioni" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_posizione_key" ON "Warehouse"("posizione");
