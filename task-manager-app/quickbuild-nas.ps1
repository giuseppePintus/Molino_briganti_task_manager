# Quick Deploy Script
# Uso: .\quickbuild-nas.ps1
# Fatto per: Molino Briganti Task Manager

$ErrorActionPreference = 'Stop'

# Carica credenziali dal config locale (gitignored). Vedi nas-config.example.ps1
$configPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'nas-config.local.ps1'
if (-not (Test-Path $configPath)) {
    throw "Config mancante: $configPath. Copia nas-config.example.ps1 e popolalo."
}
. $configPath

Write-Host "[QUICKBUILD] Quick Build + Deploy NAS (senza dati)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

# 0. Rigenera Prisma client locale
Write-Host "[0/5] Rigenerazione Prisma client locale..." -ForegroundColor Yellow
npx prisma generate --schema=server/prisma/schema.prisma
Write-Host "[OK] Prisma client rigenerato" -ForegroundColor Green
Write-Host ""

# 0.5 Build APK Android (best-effort: non blocca il deploy se fallisce)
Write-Host "[0b/5] Build APK Android (debug)..." -ForegroundColor Yellow
$androidDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'android-inventory-app'
if (Test-Path (Join-Path $androidDir 'gradlew.bat')) {
    try {
        Push-Location $androidDir
        & .\gradlew.bat --quiet assembleDebug 2>&1 | Select-Object -Last 5
        $apkSrc = Join-Path $androidDir 'app\build\outputs\apk\debug\MolinoInventory-v1.2.0-debug.apk'
        if (-not (Test-Path $apkSrc)) {
            # fallback: cerca un qualsiasi APK debug
            $apkSrc = Get-ChildItem -Path (Join-Path $androidDir 'app\build\outputs\apk\debug') -Filter '*.apk' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        }
        if ($apkSrc -and (Test-Path $apkSrc)) {
            Copy-Item $apkSrc -Destination (Join-Path $PSScriptRoot 'public\MolinoInventory.apk') -Force
            $apkSize = [Math]::Round((Get-Item (Join-Path $PSScriptRoot 'public\MolinoInventory.apk')).Length / 1MB, 2)
            Write-Host "[OK] APK copiato in public/MolinoInventory.apk ($apkSize MB)" -ForegroundColor Green
        } else {
            Write-Host "[WARN] APK non trovato, salto la copia" -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host "[WARN] Build APK fallita: $($_.Exception.Message)" -ForegroundColor DarkYellow
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[WARN] gradlew non trovato, salto build APK" -ForegroundColor DarkYellow
}
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
Write-Host "[4/5] Upload al NAS (utente: $NAS_USER)..." -ForegroundColor Yellow
scp task-manager-update.tar.gz "$($NAS_USER)@$($NAS_IP):/share/Container/"
Write-Host "[OK] File caricato" -ForegroundColor Green
Write-Host ""

# 5. Extract sul NAS (il restart avviene a fine sincronizzazione, evita race condition)
Write-Host "[5/5] Estrazione archivio sul NAS..." -ForegroundColor Yellow
ssh "$($NAS_USER)@$($NAS_IP)" 'cd /share/Container && tar -xzf task-manager-update.tar.gz'
Write-Host "[OK] Archivio estratto" -ForegroundColor Green
Write-Host ""

# 6. Sincronizza file critici DENTRO il container (singola sessione SSH per evitare stalli)
Write-Host "[6/7] Sincronizzazione file critici nel container (single SSH)..." -ForegroundColor Yellow
$remoteScript = @'
set -e
DOCKER=/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker
SRC=/share/Container
CT=molino-task-manager-nas

echo "  -> index.html";                    $DOCKER cp $SRC/public/index.html                    $CT:/app/public/index.html
echo "  -> orders-planner.html";           $DOCKER cp $SRC/public/orders-planner.html           $CT:/app/public/orders-planner.html
echo "  -> admin-dashboard.html";          $DOCKER cp $SRC/public/admin-dashboard.html          $CT:/app/public/admin-dashboard.html
echo "  -> customers-management.html";     $DOCKER cp $SRC/public/customers-management.html     $CT:/app/public/customers-management.html
echo "  -> warehouse-management.html";     $DOCKER cp $SRC/public/warehouse-management.html     $CT:/app/public/warehouse-management.html
echo "  -> warehouse-management-lite.html"; $DOCKER cp $SRC/public/warehouse-management-lite.html $CT:/app/public/warehouse-management-lite.html
echo "  -> trips-management.html";         $DOCKER cp $SRC/public/trips-management.html         $CT:/app/public/trips-management.html
echo "  -> operators.html";                $DOCKER cp $SRC/public/operators.html                $CT:/app/public/operators.html
echo "  -> backup-management.html";        $DOCKER cp $SRC/public/backup-management.html        $CT:/app/public/backup-management.html
echo "  -> company-settings.html";         $DOCKER cp $SRC/public/company-settings.html         $CT:/app/public/company-settings.html
echo "  -> operator-dashboard.html";       $DOCKER cp $SRC/public/operator-dashboard.html       $CT:/app/public/operator-dashboard.html
echo "  -> operator-lite.html";            $DOCKER cp $SRC/public/operator-lite.html            $CT:/app/public/operator-lite.html
if [ -f $SRC/public/favicon.svg ]; then echo "  -> favicon.svg"; $DOCKER cp $SRC/public/favicon.svg $CT:/app/public/favicon.svg; fi
if [ -f $SRC/public/MolinoInventory.apk ]; then echo "  -> MolinoInventory.apk"; $DOCKER cp $SRC/public/MolinoInventory.apk $CT:/app/public/MolinoInventory.apk; fi
echo "  -> js/";                            $DOCKER cp $SRC/public/js/.                          $CT:/app/public/js/
if [ -d $SRC/public/css ]; then echo "  -> css/"; $DOCKER cp $SRC/public/css/. $CT:/app/public/css/; fi
if [ -d $SRC/public/images ]; then echo "  -> images/"; $DOCKER cp $SRC/public/images/. $CT:/app/public/images/; fi
echo "  -> package.json";                  $DOCKER cp $SRC/package.json                         $CT:/app/package.json
echo "  -> server/dist";                   $DOCKER cp $SRC/server/dist/.                        $CT:/app/server/dist/
echo "  -> schema.prisma";                 $DOCKER cp $SRC/server/prisma/schema.prisma          $CT:/app/server/prisma/schema.prisma

echo "  -> prisma generate";               $DOCKER exec $CT npx prisma@6.19.0 generate --schema /app/server/prisma/schema.prisma
echo "  -> prisma db push";                $DOCKER exec $CT npx prisma@6.19.0 db push --accept-data-loss --schema /app/server/prisma/schema.prisma
echo "  -> restart (with retry)"
if $DOCKER restart $CT; then echo "     restart OK"; elif sleep 3 && $DOCKER restart $CT; then echo "     restart OK (retry 1)"; elif sleep 3 && $DOCKER restart $CT; then echo "     restart OK (retry 2)"; else echo "     restart FAILED"; fi
'@
# ConnectTimeout + ServerAliveInterval per evitare stalli su rete
# Convertire CRLF -> LF altrimenti bash interpreta \r come parte dei comandi
# Aggiunge newline finale per evitare che bash veda EOF prima dell'ultimo comando
$remoteScriptLF = ($remoteScript -replace "`r`n", "`n") + "`n"
$remoteScriptLF | ssh -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 "$($NAS_USER)@$($NAS_IP)" "bash -s"
Write-Host "[OK] File sincronizzati" -ForegroundColor Green
Write-Host ""

# Attesa che il container sia pronto
Write-Host "[WAIT] Attesa 5 secondi per startup..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "[DONE] DEPLOY COMPLETATO!" -ForegroundColor Green
Write-Host "       URL: http://$($NAS_IP):5000" -ForegroundColor Cyan
Write-Host "       (credenziali NAS in nas-config.local.ps1)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "✅ Passaggi completati:" -ForegroundColor Green
Write-Host "   1. TypeScript compilato" -ForegroundColor Green
Write-Host "   2. Archivio tar.gz creato (senza dati)" -ForegroundColor Green
Write-Host "   3. Archivio verificato" -ForegroundColor Green
Write-Host "   4. File caricato via SCP" -ForegroundColor Green
Write-Host "   5. Estratto e container riavviato" -ForegroundColor Green
Write-Host "   6. File critici sincronizzati (HTML + package.json)" -ForegroundColor Green
Write-Host "   7. Container pronto per il servizio" -ForegroundColor Green
