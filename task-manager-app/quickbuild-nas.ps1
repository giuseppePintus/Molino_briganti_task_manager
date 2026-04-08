# Quick Deploy Script
# Uso: .\quickbuild-nas.ps1
# Fatto per: Molino Briganti Task Manager

$ErrorActionPreference = 'Stop'

Write-Host "[QUICKBUILD] Quick Build + Deploy NAS (senza dati)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# 0. Rigenera Prisma client locale
Write-Host "[0/5] Rigenerazione Prisma client locale..." -ForegroundColor Yellow
npx prisma generate --schema=server/prisma/schema.prisma
Write-Host "[OK] Prisma client rigenerato" -ForegroundColor Green
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
ssh admin@192.168.1.248 'cd /share/Container && tar -xzf task-manager-update.tar.gz && /share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-task-manager-nas'
Write-Host "[OK] Container riavviato" -ForegroundColor Green
Write-Host ""

# 6. Sincronizza file critici DENTRO il container
Write-Host "[6/7] Sincronizzazione file critici nel container..." -ForegroundColor Yellow
Write-Host "      Copia index.html aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/public/index.html molino-task-manager-nas:/app/public/index.html'
Write-Host "      Copia HTML aggiornato (orders-planner.html)..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/public/orders-planner.html molino-task-manager-nas:/app/public/orders-planner.html'
Write-Host "      Copia admin-dashboard.html aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/public/admin-dashboard.html molino-task-manager-nas:/app/public/admin-dashboard.html'
Write-Host "      Copia customers-management.html aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/public/customers-management.html molino-task-manager-nas:/app/public/customers-management.html'
Write-Host "      Copia warehouse-management.html aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/public/warehouse-management.html molino-task-manager-nas:/app/public/warehouse-management.html'
Write-Host "      Copia warehouse-management-lite.html aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/public/warehouse-management-lite.html molino-task-manager-nas:/app/public/warehouse-management-lite.html'
Write-Host "      Copia trips-management.html aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/public/trips-management.html molino-task-manager-nas:/app/public/trips-management.html'
Write-Host "      Copia operators.html aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/public/operators.html molino-task-manager-nas:/app/public/operators.html'
Write-Host "      Copia package.json aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/package.json molino-task-manager-nas:/app/package.json'
Write-Host "      Copia server/dist aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/server/dist/. molino-task-manager-nas:/app/server/dist/'
Write-Host "      Copia schema Prisma aggiornato..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Container/server/prisma/schema.prisma molino-task-manager-nas:/app/server/prisma/schema.prisma'
Write-Host "      Rigenera Prisma client nel container..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker exec molino-task-manager-nas npx prisma@6.19.0 generate --schema /app/server/prisma/schema.prisma'
Write-Host "      Sincronizza schema DB (db push)..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker exec molino-task-manager-nas npx prisma@6.19.0 db push --accept-data-loss --schema /app/server/prisma/schema.prisma'
Write-Host "      Riavvia container..." -ForegroundColor Gray
ssh admin@192.168.1.248 '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-task-manager-nas'
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
