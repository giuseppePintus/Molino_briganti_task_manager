# Quick Deploy Script
# Uso: .\quickbuild-nas.ps1
# Fatto per: Molino Briganti Task Manager

$ErrorActionPreference = 'Stop'

Write-Host "🚀 Quick Build + Deploy NAS (senza dati)" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# 1. Compila TypeScript
Write-Host "📦 Step 1/5: Compilazione TypeScript..." -ForegroundColor Yellow
npm run build | Out-Null
Write-Host "✅ TypeScript compilato`n" -ForegroundColor Green

# 2. Crea archivio ESCLUDENDO dati
Write-Host "📦 Step 2/5: Creazione archivio (esclude dati)..." -ForegroundColor Yellow
tar -czf task-manager-update.tar.gz `
  --exclude='*.db' `
  --exclude='*.db-journal' `
  --exclude='server/prisma/dev.db' `
  --exclude='server/prisma/prod.db' `
  --exclude='molino-data/*' `
  public server/dist server/prisma package.json 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore creazione archivio" -ForegroundColor Red
    exit 1
}

$archiveSize = (Get-Item task-manager-update.tar.gz).Length / 1KB
Write-Host "✅ Archivio creato ($($archiveSize)KB)`n" -ForegroundColor Green

# 3. Verifica archivio
Write-Host "🔍 Step 3/5: Verifica archivio..." -ForegroundColor Yellow
$hasBadFiles = tar -tzf task-manager-update.tar.gz 2>&1 | Select-String -Pattern '\.db|molino-data' | Measure-Object | Select-Object -ExpandProperty Count

if ($hasBadFiles -gt 0) {
    Write-Host "❌ ERRORE: Archivio contiene file di dati!" -ForegroundColor Red
    Write-Host "   Cancellazione archivio..." -ForegroundColor Red
    Remove-Item task-manager-update.tar.gz -Force
    exit 1
}
Write-Host "✅ Archivio verificato (nessun dato incluso)`n" -ForegroundColor Green

# 4. Upload al NAS
Write-Host "📤 Step 4/5: Upload al NAS..." -ForegroundColor Yellow
scp task-manager-update.tar.gz vsc@192.168.1.248:/share/Container/ 2>&1
Write-Host "✅ File caricato`n" -ForegroundColor Green

# 5. Extract e restart
Write-Host "🔧 Step 5/5: Extract e restart container..." -ForegroundColor Yellow
ssh vsc@192.168.1.248 "cd /share/Container && tar -xzf task-manager-update.tar.gz && /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app" 2>&1
Write-Host "✅ Container riavviato`n" -ForegroundColor Green

Write-Host "✅ DEPLOY COMPLETATO!" -ForegroundColor Green
Write-Host "   URL: http://192.168.1.248:5000" -ForegroundColor Cyan
