# Molino Briganti — Istruzioni globali per Copilot

## Lingua
- **Rispondi sempre in italiano** (codice, identificatori e log restano in inglese).
- Tono diretto e conciso: niente preamboli, niente riassunti finali se non richiesti.

## Panoramica del workspace
Repository multi-progetto che gestisce l'operatività del Molino Briganti.

| Cartella | Stack | Ruolo |
|---|---|---|
| `task-manager-app/server/` | Node.js + TypeScript + Express + Prisma | Backend API REST + Socket.IO |
| `task-manager-app/public/` | HTML + JS vanilla (no framework) | Frontend operativo (warehouse, ordini, backup, ecc.) |
| `task-manager-app/client/` | TypeScript | Codice client compilato |
| `task-manager-app/prisma/` | Prisma + MariaDB (utf8mb4) | Schema DB e migrazioni |
| `android-inventory-app/` | Kotlin + Jetpack Compose + Gradle KTS | App Android di magazzino |
| `*.ps1` (root e `task-manager-app/`) | PowerShell | Deploy, backup, sync verso NAS |
| `molino-data/`, `task-manager-app/backups/` | File `.sql` | Dump MariaDB (NON modificare a mano) |

## Infrastruttura
- **Produzione**: NAS QNAP `NAS71F89C` (IP `192.168.1.248`, host `http://NAS71F89C:5000`).
- Docker su QNAP via Container Station: binario `/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker`.
- Container principale: `molino-task-manager-nas`.
- **Database**: MariaDB su NAS, charset `utf8mb4` (vedi `task-manager-app/migrations/utf8mb4-migration.sql`). Path dati container: `/share/Container/data/molino/`.
- **Auth**: JWT, utente applicativo di servizio `master` / `masterpass`.
- **Realtime**: Socket.IO, evento principale `inventory:updated`.

## Segreti
- **Mai** leggere o scrivere credenziali in chiaro nei file versionati.
- Negli script PowerShell carica le credenziali da `nas-config.local.ps1` (gitignored). Esempio in `nas-config.example.ps1`.
- Negli script `.sh` usa variabili d'ambiente (`$NAS_IP`, `$NAS_USER`, `$NAS_PASSWORD`, `$DB_USER`, `$DB_PASS`).
- I file `.nas_ssh_config`, `nas-config.local.*`, `.env*` sono in `.gitignore`: NON rimuoverli da lì.

## Regole operative trasversali
- **Mai** eseguire comandi distruttivi sui backup (`rm -rf`, `Remove-Item -Recurse` su `*/backups/`, drop di tabelle in produzione) senza chiedere conferma esplicita.
- **Mai** committare/pubblicare credenziali, file `.env`, `local.properties`, dump SQL, file `*.local.*`.
- Prima di toccare uno script di deploy o backup, leggerlo per intero: spesso l'ordine delle operazioni è critico (lock DB, sync NAS, restart container).
- Se devi creare un nuovo file di configurazione Copilot, mettilo in `.github/instructions/` con `applyTo:` mirato (non usare `**`).

## Convenzioni di stile
- Codice e nomi di variabili **in inglese**, commenti **in italiano** dove aiutano la comprensione del dominio.
- Niente refactor "a sorpresa": modifica solo ciò che serve al task richiesto.
- Niente nuove dipendenze senza motivazione; preferire la libreria standard.

## Dove cercare cosa
- Documentazione operativa: `README.md` (root) e `task-manager-app/README.md`.
- Stato del sistema di backup: `task-manager-app/BACKUP_SYSTEM_STATUS.md`.
- Note sul deploy rapido al NAS: `task-manager-app/QUICKBUILD_DEPLOY.md`.
