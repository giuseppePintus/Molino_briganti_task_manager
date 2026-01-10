#!/usr/bin/env pwsh
<#
.SYNOPSIS
Script diagnostico per il sistema di backup
Identifica dove sono salvati i backup e cosa è sincronizzato

.DESCRIPTION
Analizza:
1. Container Docker in esecuzione
2. Cartelle locali (/backups, ./backups, etc.)
3. NAS
4. Volume mounts
5. Variabili di ambiente
#>

Write-Host "`n====== DIAGNOSTICA SISTEMA BACKUP ======`n" -ForegroundColor Cyan

# Check Docker containers
Write-Host "📦 CONTAINER DOCKER IN ESECUZIONE:" -ForegroundColor Yellow
$containers = docker ps --format "{{.Names}} ({{.Image}})" 2>$null
if ($containers) {
    $containers | ForEach-Object { Write-Host "  ✅ $_" }
} else {
    Write-Host "  ❌ Nessun container in esecuzione" -ForegroundColor Red
}

# Controlla container specifico
Write-Host "`n🔍 CONTAINER 'molino-briganti-task-manager':" -ForegroundColor Yellow
$containerExists = docker ps -a --filter "name=molino-briganti-task-manager" --format "{{.Names}}" 2>$null
if ($containerExists) {
    Write-Host "  ✅ Container esiste"
    $isRunning = docker ps --filter "name=molino-briganti-task-manager" --format "{{.Names}}" 2>$null
    if ($isRunning) {
        Write-Host "  ✅ Container in ESECUZIONE"
        
        # Verifica cartelle dentro il container
        Write-Host "`n  Cartelle nel container:" -ForegroundColor Cyan
        
        # Check /share mount
        docker exec molino-briganti-task-manager test -d /share/Container/data/molino/backups/database && `
            Write-Host "    ✅ /share/Container/data/molino/backups/database esiste" || `
            Write-Host "    ❌ /share/Container/data/molino/backups/database NON esiste" -ForegroundColor Red
        
        # Check ./backups fallback
        docker exec molino-briganti-task-manager test -d ./backups && `
            Write-Host "    ✅ ./backups esiste (fallback locale)" || `
            Write-Host "    ❌ ./backups NON esiste"
        
        # Conta file in /share
        $shareCount = docker exec molino-briganti-task-manager ls -1 /share/Container/data/molino/backups/database/db-backup-*.sql 2>/dev/null | Measure-Object -Line | Select-Object -ExpandProperty Lines
        Write-Host "    📊 File in /share: $shareCount backup"
        
        # Conta file in ./backups
        $localCount = docker exec molino-briganti-task-manager ls -1 ./backups/db-backup-*.sql 2>/dev/null | Measure-Object -Line | Select-Object -ExpandProperty Lines
        Write-Host "    📊 File in ./backups: $localCount backup"
        
    } else {
        Write-Host "  ⚠️  Container FERMATO" -ForegroundColor Yellow
        $status = docker ps -a --filter "name=molino-briganti-task-manager" --format "{{.State}}" 2>$null
        Write-Host "    Stato: $status"
    }
} else {
    Write-Host "  ❌ Container NON ESISTE" -ForegroundColor Red
}

# Check NAS
Write-Host "`n🌐 NAS (\\nas71f89c\Container\data\molino\backups\database):" -ForegroundColor Yellow
$nasPath = "\\nas71f89c\Container\data\molino\backups\database"
if (Test-Path $nasPath) {
    Write-Host "  ✅ NAS ACCESSIBILE"
    
    $nasBackups = @(Get-ChildItem $nasPath -Filter "db-backup-*.sql" -ErrorAction SilentlyContinue)
    $nasUploads = @(Get-ChildItem $nasPath -Filter "uploads-backup-*.tar.gz" -ErrorAction SilentlyContinue)
    
    Write-Host "    📊 Database backups: $($nasBackups.Count)"
    Write-Host "    📊 Uploads backups: $($nasUploads.Count)"
    
    if ($nasBackups.Count -gt 0) {
        Write-Host "`n    Ultimi 3 backup nel NAS:" -ForegroundColor Cyan
        $nasBackups | Sort-Object -Property LastWriteTime -Descending | Select-Object -First 3 | ForEach-Object {
            $date = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
            $size = "{0:F0} KB" -f ($_.Length / 1KB)
            Write-Host "      📦 $($_.Name)"
            Write-Host "         Data: $date | Size: $size"
        }
    }
} else {
    Write-Host "  ❌ NAS NON ACCESSIBILE" -ForegroundColor Red
}

# Check cartelle locali
Write-Host "`n💾 CARTELLE LOCALI:" -ForegroundColor Yellow
$localDirs = @(
    "./backups",
    "$PSScriptRoot/backups",
    "$PSScriptRoot/task-manager-app/backups",
    "C:\backups",
    "$env:TEMP\backups"
)

foreach ($dir in $localDirs) {
    if (Test-Path $dir -ErrorAction SilentlyContinue) {
        $count = @(Get-ChildItem $dir -Filter "db-backup-*.sql" -ErrorAction SilentlyContinue).Count
        Write-Host "  ✅ $dir ($count backup)" 
    }
}

# Docker compose info
Write-Host "`n📋 DOCKER COMPOSE:" -ForegroundColor Yellow
$composeFile = "task-manager-app/docker-compose.yml"
if (Test-Path $composeFile) {
    Write-Host "  ✅ docker-compose.yml trovato"
    
    # Estrai variabili BACKUP_DIR
    $backupDirLine = Select-String "BACKUP_DIR=" $composeFile | Select-Object -First 1
    if ($backupDirLine) {
        Write-Host "    Configurato: $($backupDirLine.Line.Trim())"
    }
    
    # Estrai volume mounts
    Write-Host "`n    Volume mounts:" -ForegroundColor Cyan
    Select-String "^\s+-\s+/.*:" $composeFile | Select-Object -First 5 | ForEach-Object {
        Write-Host "      $($_.Line.Trim())"
    }
} else {
    Write-Host "  ❌ docker-compose.yml NON trovato" -ForegroundColor Red
}

# Riassunto
Write-Host "`n====== PROBLEMA RIASSUNTO ======" -ForegroundColor Cyan
Write-Host @"
Il tuo problema:
- L'interfaccia mostra backup del 25/12
- Ma nel NAS vedi solo backup del 24/12

Possibili cause:
1. Il container sta usando ./backups (fallback locale) invece di /share mount
2. I backup del 25/12 sono in ./backups del container
3. Non sono sincronizzati al NAS

Soluzione:
1. Verificare che il mount /share/Container/data/molino sia disponibile
2. Se container sta usando ./backups, copiare i backup al NAS
3. Riavviare il container per forzare l'uso di /share mount
"@
