#!/usr/bin/env pwsh
<#
.SYNOPSIS
Sincronizza e verifica i backup tra NAS e sistema locale
Risolve il problema dei backup del 25/12 non visibili nel NAS

.DESCRIPTION
1. Elenca tutti i backup disponibili (NAS e locali)
2. Copia i backup mancanti dal sistema locale al NAS
3. Verificaintegritàche i backup siano sincronizzati
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$BackupSourceDir = "./backups",
    
    [Parameter(Mandatory = $false)]
    [string]$NasBackupDir = "\\nas71f89c\Container\data\molino\backups\database",
    
    [Parameter(Mandatory = $false)]
    [switch]$DryRun = $false,
    
    [Parameter(Mandatory = $false)]
    [switch]$Force = $false
)

function Write-Log {
    param([string]$Message, [string]$Type = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Type) {
        "ERROR" { "Red" }
        "SUCCESS" { "Green" }
        "WARNING" { "Yellow" }
        default { "White" }
    }
    Write-Host "[$timestamp] $Type: $Message" -ForegroundColor $color
}

Write-Host "`n====== BACKUP SYNC STATUS ======`n" -ForegroundColor Cyan

# Verifica NAS
Write-Log "Verificando accesso al NAS..."
if (-not (Test-Path $NasBackupDir)) {
    Write-Log "❌ NAS NON ACCESSIBILE: $NasBackupDir" "ERROR"
    exit 1
}
Write-Log "✅ NAS accessibile: $NasBackupDir" "SUCCESS"

# Lista backup nel NAS
Write-Host "`n📍 BACKUP NEL NAS:" -ForegroundColor Cyan
$nasBackups = @()
if (Test-Path $NasBackupDir) {
    $nasBackups = Get-ChildItem $NasBackupDir -Filter "db-backup-*.sql" -ErrorAction SilentlyContinue | 
        Sort-Object -Property LastWriteTime -Descending
    
    Write-Host "Totale: $($nasBackups.Count) backup`n"
    $nasBackups | ForEach-Object {
        $date = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        $size = "{0:F2} KB" -f ($_.Length / 1KB)
        Write-Host "  📦 $($_.Name) | $size | $date"
    }
}

# Verifica backup locali (se directory esiste)
Write-Host "`n📍 BACKUP LOCALI:" -ForegroundColor Cyan
$localBackups = @()
if (Test-Path $BackupSourceDir) {
    $localBackups = Get-ChildItem $BackupSourceDir -Filter "db-backup-*.sql" -ErrorAction SilentlyContinue | 
        Sort-Object -Property LastWriteTime -Descending
    
    Write-Host "Totale: $($localBackups.Count) backup`n"
    $localBackups | ForEach-Object {
        $date = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        $size = "{0:F2} KB" -f ($_.Length / 1KB)
        $inNas = $nasBackups.Name -contains $_.Name
        $status = if ($inNas) { "✅ SINCRONIZZATO" } else { "⚠️ NON nel NAS" }
        Write-Host "  📦 $($_.Name) | $size | $date | $status"
    }
} else {
    Write-Log "Directory locale non trovata: $BackupSourceDir" "WARNING"
}

# Analisi differenza
Write-Host "`n📊 ANALISI:" -ForegroundColor Cyan
$missingInNas = $localBackups | Where-Object { $nasBackups.Name -notcontains $_.Name }
$missingLocally = $nasBackups | Where-Object { $localBackups.Name -notcontains $_.Name }

if ($missingInNas.Count -gt 0) {
    Write-Host "`n🔴 Backup LOCALI ma NON nel NAS ($($missingInNas.Count)):" -ForegroundColor Yellow
    $missingInNas | ForEach-Object {
        $date = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
        $size = "{0:F2} KB" -f ($_.Length / 1KB)
        Write-Host "  ➜ $($_.Name) ($size) [$date]"
    }
    
    # Chiedi conferma per copia
    if ($missingInNas.Count -gt 0 -and -not $DryRun) {
        Write-Host "`n" 
        $response = Read-Host "Desideri sincronizzare questi backup al NAS? (S/N)"
        
        if ($response -eq "S" -or $response -eq "s" -or $Force) {
            Write-Host "`n📥 Copiando backup al NAS..." -ForegroundColor Cyan
            
            foreach ($backup in $missingInNas) {
                try {
                    $sourceFile = Join-Path $BackupSourceDir $backup.Name
                    $destFile = Join-Path $NasBackupDir $backup.Name
                    
                    Write-Host "  Copia: $($backup.Name)..." -NoNewline
                    Copy-Item -Path $sourceFile -Destination $destFile -Force
                    Write-Host " ✅" -ForegroundColor Green
                } catch {
                    Write-Log "Errore copia di $($backup.Name): $_" "ERROR"
                }
            }
            
            Write-Log "Sincronizzazione completata!" "SUCCESS"
        } else {
            Write-Log "Sincronizzazione annullata" "WARNING"
        }
    } elseif ($DryRun) {
        Write-Log "[DRY-RUN] Verrebbero copiati $($missingInNas.Count) file" "INFO"
    }
}

if ($missingLocally.Count -gt 0) {
    Write-Host "`n🟡 Backup nel NAS ma NON LOCALI ($($missingLocally.Count)):" -ForegroundColor Yellow
    $missingLocally | ForEach-Object {
        $date = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
        $size = "{0:F2} KB" -f ($_.Length / 1KB)
        Write-Host "  ➜ $($_.Name) ($size) [$date]"
    }
}

if ($missingInNas.Count -eq 0 -and $missingLocally.Count -eq 0) {
    Write-Log "✅ Tutti i backup sono sincronizzati!" "SUCCESS"
}

# Sommario finale
Write-Host "`n====== RIEPILOGO FINALE ======" -ForegroundColor Cyan
Write-Host "NAS: $($nasBackups.Count) backup"
Write-Host "Locali: $($localBackups.Count) backup"
Write-Host "Non sincronizzati: $($missingInNas.Count + $missingLocally.Count)`n"
