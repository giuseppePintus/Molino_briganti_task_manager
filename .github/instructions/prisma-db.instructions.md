---
applyTo: "**/prisma/**,**/*.prisma,task-manager-app/migrations/**,task-manager-app/setup-mariadb.sql"
description: "Schema Prisma, migrazioni MariaDB e gestione charset utf8mb4."
---

# Database — Prisma + MariaDB

## Setup
- DBMS: **MariaDB** in container Docker (vedi `task-manager-app/docker-compose.yml`).
- Charset/collation: **`utf8mb4` / `utf8mb4_unicode_ci`** ovunque (tabelle, colonne, connessione). Vedi `migrations/utf8mb4-migration.sql` e `migrations/patch-mariadb-utf8mb4.sh`.
- Setup iniziale: `setup-mariadb.sh` + `setup-mariadb.sql`.

## Modelli core (vedi `prisma/schema.prisma`)
- `Article` — anagrafica prodotto.
- `Inventory` — stock per articolo (`currentStock`, `minimumStock`, `reserved`).
- `ShelfPosition` — posizioni fisiche (`code` unico).
- `ShelfEntry` — relazione N:N articolo↔posizione (unique `articleId+positionCode`).
- `StockMovement` — audit trail (`IN`/`OUT`/`ADJUSTMENT`).
- `StockAlert` — allarmi sotto-scorta.

## Regole d'oro
- **Ogni modifica a `currentStock` o `reserved` DEVE generare uno `StockMovement`.** Niente update silenziosi.
- Vincoli unici esistenti vanno preservati (`Inventory.articleId`, `ShelfEntry(articleId, positionCode)`, `ShelfPosition.code`).
- Nuove colonne testuali: tipo `VARCHAR` esplicito + collation `utf8mb4_unicode_ci`.
- Migrazioni: aggiungi un nuovo file SQL in `migrations/` con prefisso data (`YYYYMMDD-`), non modificare quelli passati.
- Prima di una migrazione in produzione: backup manuale (`auto-backup-mariadb.ps1` o `mariadb-backup.sh`).

## Restore
- Procedura: `mariadb-restore.sh <file.sql>`. I dump sono in `task-manager-app/backups/` e `molino-data/backups/`.
- Mai sovrascrivere il DB di produzione senza dump preventivo dello stato corrente.
