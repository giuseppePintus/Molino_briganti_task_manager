---
applyTo: "**/*.ps1"
description: "Convenzioni per gli script PowerShell di deploy, backup e sync verso il NAS QNAP."
---

# Script PowerShell

## Stile
- Usa **nomi cmdlet completi** (`Get-ChildItem`, non `ls`/`dir`; `Where-Object`, non `?`).
- Quote sempre i path con spazi: `"C:\Path With Spaces"`.
- Preferisci `Join-Path` a concatenazioni di stringhe per i percorsi.
- Verbi standard PowerShell per le funzioni (`Get-`, `Set-`, `New-`, `Remove-`, `Invoke-`).
- Usa `Test-Path` prima di leggere/scrivere file critici.
- Per l'output strutturato usa oggetti (`[PSCustomObject]@{...}`) + `Format-Table`, non stringhe interpolate.

## Sicurezza
- **Mai** mettere password in chiaro: leggile da variabili d'ambiente o da `Get-Credential`.
- **Mai** usare `-Force` su `Remove-Item` ricorsivi senza un `Test-Path` + log preventivo.
- Per operazioni distruttive aggiungi `[CmdletBinding(SupportsShouldProcess)]` e usa `if ($PSCmdlet.ShouldProcess(...))`.

## Script chiave del repo (non rompere il loro contratto)
- `quickbuild-nas.ps1` → build + deploy rapido al NAS.
- `deploy-mariadb.ps1` → deploy del container MariaDB.
- `auto-backup-mariadb.ps1` → backup schedulato del DB.
- `setup-backup-schedule.ps1` → registra le scheduled task di Windows.
- `sync-backups-nas.ps1` (root) → sincronizza i dump verso il NAS.
- `cleanup-backups.ps1` (root) → rotazione dump vecchi (controlla la retention prima di modificarlo).
- `diagnose-backup-system.ps1` (root) → diagnostica, deve restare read-only.

## Esecuzione locale
- L'ambiente attivo è `pwsh` con `.venv` Python attivato (vedi terminali aperti). Non assumere alias di Bash.
- Quando suggerisci comandi, usa `;` per concatenare e `|` per pipeline.
