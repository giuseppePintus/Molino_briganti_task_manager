---
applyTo: "**/backups/**,**/*backup*.ps1,**/*backup*.sh,**/BACKUP_SYSTEM_STATUS.md"
description: "Sistema di backup MariaDB: dump, rotazione, sync verso NAS. Modifiche ad alto rischio."
---

# Sistema di Backup

> **Attenzione**: il sistema di backup è critico. Nessuna modifica "a freddo": leggi sempre prima `task-manager-app/BACKUP_SYSTEM_STATUS.md`.

## Componenti
- **Dump**: `task-manager-app/auto-backup-mariadb.ps1` (Windows) e `task-manager-app/mariadb-backup.sh` (Linux/NAS).
- **Restore**: `task-manager-app/mariadb-restore.sh`.
- **Schedulazione Windows**: `task-manager-app/setup-backup-schedule.ps1`.
- **Sync verso NAS**: `sync-backups-nas.ps1` (root).
- **Rotazione**: `cleanup-backups.ps1` (root). **Verifica la retention prima di modificarlo.**
- **Diagnostica**: `diagnose-backup-system.ps1` — deve restare **read-only**, niente effetti collaterali.
- **UI**: `task-manager-app/public/backup-management.html` (rigenerata da `update-backup-page.ps1`).

## Cartelle dump
- `task-manager-app/backups/db-backup-*.sql`
- `molino-data/backups/db-backup-*.sql`
- `backups/backup-config.json` (config root)
- `task-manager-app/backups/backup-config.json` (config app)

Naming: `db-backup-<ISO timestamp con `-` invece di `:`>.sql`. **Non rinominare i file esistenti.**

## Regole non negoziabili
1. **Mai cancellare** dump senza esplicita richiesta dell'utente.
2. **Mai disabilitare** la schedulazione esistente; al massimo aggiungere nuove task.
3. Prima di modificare la rotazione: stampa quanti file verrebbero cancellati con la nuova policy (dry-run).
4. Ogni cambio al formato del nome file richiede aggiornare anche `backup-management.html` e `cleanup-backups.ps1`.
5. Restore in produzione: solo dopo backup dello stato attuale.

## Monitoraggio
- Lo stato corrente è tracciato in `BACKUP_SYSTEM_STATUS.md`. Aggiornalo se cambi cadenza, retention o destinazione.
