# Quick Deploy Script
# Uso: .\quickbuild-nas.ps1
# Fatto per: Molino Briganti Task Manager

$ErrorActionPreference = 'Stop'

Write-Host "[QUICKBUILD] Quick Build + Deploy NAS (senza dati)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Compila TypeScript
Write-Host "[1/5] Compilazione TypeScript..." -ForegroundColor Yellow
npm run build
Write-Host "[OK] TypeScript compilato" -ForegroundColor Green
Write-Host ""

# 2. Crea archivio ESCLUDENDO dati
Write-Host "[2/5] Creazione archivio (esclude dati)..." -ForegroundColor Yellow
tar -czf task-manager-update.tar.gz `
  --exclude='*.db' `
  --exclude='*.db-journal' `
  --exclude='node_modules' `
  --exclude='molino-data' `
  public server/dist server/prisma/schema.prisma package.json package-lock.json

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERR] Errore creazione archivio" -ForegroundColor Red
    exit 1
}

$archiveSize = (Get-Item task-manager-update.tar.gz).Length / 1KB
Write-Host "[OK] Archivio creato ($([Math]::Round($archiveSize, 2))KB)" -ForegroundColor Green
Write-Host ""

# 3. Verifica archivio
Write-Host "[3/5] Verifica archivio..." -ForegroundColor Yellow
$badFiles = tar -tzf task-manager-update.tar.gz | Select-String -Pattern '\.db|molino-data' -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count

if ($badFiles -gt 0) {
    Write-Host "[ERR] ERRORE: Archivio contiene file di dati!" -ForegroundColor Red
    Write-Host "      Cancellazione archivio..." -ForegroundColor Red
    Remove-Item task-manager-update.tar.gz -Force
    exit 1
}
Write-Host "[OK] Archivio verificato (nessun dato incluso)" -ForegroundColor Green
Write-Host ""

# 4. Upload al NAS
Write-Host "[4/5] Upload al NAS (utente: admin)..." -ForegroundColor Yellow
scp task-manager-update.tar.gz admin@192.168.1.248:/share/Container/
Write-Host "[OK] File caricato" -ForegroundColor Green
Write-Host ""

# 5. Extract e restart con utente admin
Write-Host "[5/5] Extract e restart container..." -ForegroundColor Yellow
ssh admin@192.168.1.248 'cd /share/Container && tar -xzf task-manager-update.tar.gz && /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app'
Write-Host "[OK] Container riavviato" -ForegroundColor Green
Write-Host ""

# 6. Sincronizza file critici DENTRO il container
Write-Host "[6/7] Sincronizzazione file critici nel container..." -ForegroundColor Yellow
Write-Host "      Copia HTML aggiornato (orders-planner.html)..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/public/orders-planner.html molino-app:/app/public/orders-planner.html'
Write-Host "      Copia package.json aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/package.json molino-app:/app/package.json'
Write-Host "      Riavvia container..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app'
Write-Host "[OK] File sincronizzati" -ForegroundColor Green
Write-Host ""

# Attesa che il container sia pronto
Write-Host "[WAIT] Attesa 5 secondi per startup..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "[DONE] DEPLOY COMPLETATO!" -ForegroundColor Green
Write-Host "       URL: http://192.168.1.248:5000" -ForegroundColor Cyan
Write-Host "       Credenziali: admin / ***REDACTED_NAS_PASSWORD***" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Passaggi completati:" -ForegroundColor Green
Write-Host "   1. TypeScript compilato" -ForegroundColor Green
Write-Host "   2. Archivio tar.gz creato (senza dati)" -ForegroundColor Green
Write-Host "   3. Archivio verificato" -ForegroundColor Green
Write-Host "   4. File caricato via SCP" -ForegroundColor Green
Write-Host "   5. Estratto e container riavviato" -ForegroundColor Green
Write-Host "   6. File critici sincronizzati (HTML + package.json)" -ForegroundColor Green
Write-Host "   7. Container pronto per il servizio" -ForegroundColor Green
