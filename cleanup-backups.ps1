param([switch]$DryRun = $false)

Write-Host "`n=== PULIZIA BACKUP - MANTIENI SOLO NAS ===" -ForegroundColor Cyan

$nasPath = "\\nas71f89c\Container\data\molino\backups\database"

if (-not (Test-Path $nasPath)) {
    Write-Host "Errore: NAS non accessibile!" -ForegroundColor Red
    exit 1
}

Write-Host "`nLeggo backup nel NAS..." -ForegroundColor Green
$nasBackups = @(Get-ChildItem $nasPath -Filter "db-backup-*.sql" 2>$null)
Write-Host "Trovati $($nasBackups.Count) backup nel NAS`n"

$localPaths = @("./backups", "$PSScriptRoot/backups", "$PSScriptRoot/task-manager-app/backups")
$toDelete = @()

foreach ($localPath in $localPaths) {
    if (-not (Test-Path $localPath)) { continue }
    
    $localBackups = @(Get-ChildItem $localPath -Filter "db-backup-*.sql" 2>$null)
    
    foreach ($backup in $localBackups) {
        if (-not ($nasBackups.Name -contains $backup.Name)) {
            $toDelete += $backup
            Write-Host "DA ELIMINARE: $($backup.Name)" -ForegroundColor Red
        }
    }
}

if ($toDelete.Count -eq 0) {
    Write-Host "Nessun backup da eliminare - sistema già sincronizzato!" -ForegroundColor Green
    exit 0
}

Write-Host "`nBACKUP DA ELIMINARE: $($toDelete.Count)" -ForegroundColor Yellow

if (-not $DryRun) {
    Write-Host "`nEliminazione in corso...`n" -ForegroundColor Yellow
    
    foreach ($file in $toDelete) {
        try {
            Remove-Item -Path $file.FullName -Force -ErrorAction Stop
            Write-Host "OK: $($file.Name)" -ForegroundColor Green
        } catch {
            Write-Host "ERRORE: $($file.Name) - $_" -ForegroundColor Red
        }
    }
    
    Write-Host "`nDone! Sistema sincronizzato con NAS." -ForegroundColor Green
} else {
    Write-Host "[DRY-RUN] Verrebbero eliminati $($toDelete.Count) file" -ForegroundColor Yellow
}
