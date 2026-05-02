# ============================================================
# nas-deploy.ps1 - Deploy unificato NAS QNAP (Molino Briganti)
# ============================================================
# Sostituisce: quickbuild-nas.ps1 + rebuild-nas-safe.ps1
#
# FILOSOFIA:
#   1. Si lavora SEMPRE sullo shadow (porta 5001) per testare.
#   2. La produzione (porta 5000) si tocca solo con -Promote esplicito.
#   3. Due modalita' di build:
#        -Full   = rebuild completo immagine Docker (nuova immagine :mariadb-new)
#        -Quick  = solo docker cp di file statici/dist nel container shadow esistente
#      Se non specifichi nulla, l'auto-detect sceglie:
#        - Quick se lo shadow esiste gia'
#        - Full  se lo shadow non esiste (prima volta)
#
# USI TIPICI:
#
#   # Modifica HTML/JS, primo deploy della sessione
#   .\nas-deploy.ps1 -Full              # crea shadow su :5001 con immagine nuova
#
#   # Iterazione successiva (modifiche minori)
#   .\nas-deploy.ps1                    # auto -> Quick: aggiorna solo i file nello shadow
#   .\nas-deploy.ps1 -OnlyFrontend      # solo HTML/CSS/JS, nessun rebuild server
#
#   # Quando sei soddisfatto -> promuovi a produzione
#   .\nas-deploy.ps1 -Promote           # quick: copia stessi file in prod (+restart se non SkipRestart)
#   .\nas-deploy.ps1 -Full -Promote     # full: build + smoke shadow + swap atomico produzione
#
# SWITCH:
#   -Full           Forza rebuild completo immagine Docker
#   -Quick          Forza solo docker cp (richiede shadow esistente)
#   -Promote        Dopo build/sync sullo shadow, propaga anche al container produzione
#   -SkipApk        Salta build APK Android
#   -SkipServer     Salta `npm run build` (TS) e upload server/dist
#   -SkipPrisma     Salta prisma generate / db push
#   -SkipRestart    In Quick: non riavvia il container dopo i cp
#   -OnlyFrontend   Alias: -SkipApk -SkipServer -SkipPrisma (solo public/)
#   -KeepShadow     In Full+Promote: dopo lo swap, mantieni shadow vivo per A/B test
#   -RemoveShadow   Rimuove shadow + immagine :mariadb-new e termina (cleanup manuale)
# ============================================================

[CmdletBinding()]
param(
    [switch]$Full,
    [switch]$Quick,
    [switch]$Promote,
    [switch]$SkipApk,
    [switch]$SkipServer,
    [switch]$SkipPrisma,
    [switch]$SkipRestart,
    [switch]$OnlyFrontend,
    [switch]$KeepShadow,
    [switch]$RemoveShadow
)

$ErrorActionPreference = 'Stop'

if ($Full -and $Quick) { throw "-Full e -Quick sono mutuamente esclusivi" }

if ($OnlyFrontend) {
    $SkipApk = $true
    $SkipServer = $true
    $SkipPrisma = $true
}

# ---------- Config ----------
$configPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'nas-config.local.ps1'
if (-not (Test-Path $configPath)) {
    throw "Config mancante: $configPath. Copia nas-config.example.ps1 e popolalo."
}
. $configPath

$DOCKER       = '/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker'
$CT_PROD      = 'molino-task-manager-nas'
$CT_SHADOW    = "${CT_PROD}-shadow"
$IMG          = 'molino-task-manager'
$TAG_CUR      = 'mariadb'
$TAG_NEW      = 'mariadb-new'
$TAG_PREV     = 'mariadb-prev'
$SHADOW_PORT  = 5001
$PROD_PORT    = 5000
$BUILD_CTX    = '/share/Container/molino-build-new'
$STATIC_STAGE = '/share/Container/molino-static-stage'  # per Quick: dove scompattiamo l'archivio

Write-Host "[NAS-DEPLOY] Molino Briganti - Deploy unificato" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# ---------- 0. -RemoveShadow: cleanup ed esci ----------
if ($RemoveShadow) {
    Write-Host "`n[CLEANUP] Rimozione shadow + immagine :mariadb-new..." -ForegroundColor Yellow
    ssh "$($NAS_USER)@$($NAS_IP)" "$DOCKER rm -f $CT_SHADOW 2>/dev/null; $DOCKER rmi -f ${IMG}:${TAG_NEW} 2>/dev/null; rm -rf $BUILD_CTX $STATIC_STAGE; echo CLEANED" 2>&1 | Out-Host
    Write-Host "[OK] Cleanup completato" -ForegroundColor Green
    return
}

# ---------- 1. Auto-detect modalita' ----------
Write-Host "`n[1] Verifica stato shadow sul NAS..." -ForegroundColor Yellow
$shadowExists = & ssh -o ConnectTimeout=10 -o BatchMode=yes "$($NAS_USER)@$($NAS_IP)" "$DOCKER ps -a --filter name=^/${CT_SHADOW}`$ --format '{{.Names}}'" 2>&1
$shadowAlive  = ($shadowExists -match [regex]::Escape($CT_SHADOW))

if (-not $Full -and -not $Quick) {
    if ($shadowAlive) {
        $Quick = $true
        Write-Host "[AUTO] Shadow esistente -> modalita' QUICK (docker cp)" -ForegroundColor Cyan
    } else {
        $Full = $true
        Write-Host "[AUTO] Shadow non trovato -> modalita' FULL (rebuild completo)" -ForegroundColor Cyan
    }
}

if ($Quick -and -not $shadowAlive) {
    throw "Modalita' Quick richiesta ma shadow $CT_SHADOW non esiste. Lancia prima con -Full."
}

# ============================================================
# Funzioni helper
# ============================================================

function Build-LocalSources {
    param([bool]$DoApk, [bool]$DoServer, [bool]$DoPrisma)

    if ($DoPrisma) {
        Write-Host "`n[BUILD] Prisma generate locale..." -ForegroundColor Yellow
        npx prisma generate --schema=server/prisma/schema.prisma | Out-Null
        Write-Host "[OK] Prisma client rigenerato" -ForegroundColor Green
    }

    if ($DoServer) {
        Write-Host "`n[BUILD] Compilazione TypeScript..." -ForegroundColor Yellow
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "tsc fallito" }
        Write-Host "[OK] TypeScript compilato" -ForegroundColor Green
    }

    if ($DoApk) {
        Write-Host "`n[BUILD] APK Android (debug, best-effort)..." -ForegroundColor Yellow
        $androidDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'android-inventory-app'
        if (Test-Path (Join-Path $androidDir 'gradlew.bat')) {
            try {
                Push-Location $androidDir
                & .\gradlew.bat --quiet assembleDebug 2>&1 | Select-Object -Last 5
                $apkSrc = Get-ChildItem -Path (Join-Path $androidDir 'app\build\outputs\apk\debug') -Filter '*.apk' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
                if ($apkSrc -and (Test-Path $apkSrc)) {
                    Copy-Item $apkSrc -Destination (Join-Path $PSScriptRoot 'public\MolinoInventory.apk') -Force
                    Write-Host "[OK] APK aggiornato in public/MolinoInventory.apk" -ForegroundColor Green
                } else {
                    Write-Host "[WARN] APK non trovato, salto" -ForegroundColor DarkYellow
                }
            } catch {
                Write-Host "[WARN] Build APK fallito: $($_.Exception.Message)" -ForegroundColor DarkYellow
            } finally { Pop-Location }
        }
    }
}

# ------------------------------------------------------------
# Sync file statici (Quick): genera tar + copia DENTRO un container
# Argomenti: $targetCt = nome container destinazione (shadow o prod)
# ------------------------------------------------------------
function Sync-StaticFiles {
    param(
        [string]$TargetContainer,
        [bool]$DoServer,
        [bool]$DoPrisma,
        [bool]$DoRestart
    )

    Write-Host "`n[QUICK] Creazione archivio (esclude dati)..." -ForegroundColor Yellow
    $archiveItems = @('public', 'package.json', 'package-lock.json')
    if ($DoServer) { $archiveItems += 'server/dist' }
    if ($DoPrisma) { $archiveItems += 'server/prisma/schema.prisma' }
    $tarArgs = @(
        '-czf', 'task-manager-update.tar.gz',
        '--exclude=*.db', '--exclude=*.db-journal',
        '--exclude=node_modules', '--exclude=molino-data'
    ) + $archiveItems
    tar @tarArgs
    if ($LASTEXITCODE -ne 0) { throw "tar fallito" }
    Write-Host "[OK] Archivio: $([Math]::Round((Get-Item task-manager-update.tar.gz).Length / 1KB, 2)) KB" -ForegroundColor Green

    Write-Host "`n[QUICK] Upload + estrazione su $STATIC_STAGE ..." -ForegroundColor Yellow
    scp task-manager-update.tar.gz "$($NAS_USER)@$($NAS_IP):/share/Container/task-manager-update.tar.gz" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "scp fallito" }
    ssh "$($NAS_USER)@$($NAS_IP)" "rm -rf $STATIC_STAGE && mkdir -p $STATIC_STAGE && tar -xzf /share/Container/task-manager-update.tar.gz -C $STATIC_STAGE && rm /share/Container/task-manager-update.tar.gz" | Out-Null
    Remove-Item task-manager-update.tar.gz -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Estratto" -ForegroundColor Green

    Write-Host "`n[QUICK] Sync file in container '$TargetContainer'..." -ForegroundColor Yellow
    $remote = @"
set -e
DOCKER=$DOCKER
SRC=$STATIC_STAGE
CT=$TargetContainer

echo "  -> public/ (tutto)"
`$DOCKER cp `$SRC/public/. `$CT:/app/public/
echo "  -> package.json"
`$DOCKER cp `$SRC/package.json `$CT:/app/package.json
"@
    if ($DoServer) {
        $remote += @"

echo "  -> server/dist"
`$DOCKER cp `$SRC/server/dist/. `$CT:/app/server/dist/
"@
    }
    if ($DoPrisma) {
        $remote += @"

echo "  -> schema.prisma + prisma generate + db push"
`$DOCKER cp `$SRC/server/prisma/schema.prisma `$CT:/app/server/prisma/schema.prisma
`$DOCKER exec `$CT npx prisma@6.19.0 generate --schema /app/server/prisma/schema.prisma
`$DOCKER exec `$CT npx prisma@6.19.0 db push --accept-data-loss --schema /app/server/prisma/schema.prisma
"@
    }
    if ($DoRestart) {
        $remote += @"

echo "  -> restart `$CT"
if `$DOCKER restart `$CT; then echo "     restart OK"; elif sleep 3 && `$DOCKER restart `$CT; then echo "     restart OK (retry)"; else echo "     restart FAILED" >&2; exit 1; fi
"@
    } else {
        $remote += @"

echo "  -> restart: SKIP"
"@
    }
    $remoteLF = ($remote -replace "`r`n", "`n") + "`n"
    $remoteLF | ssh -o ConnectTimeout=15 -o ServerAliveInterval=15 "$($NAS_USER)@$($NAS_IP)" "bash -s" 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Sync su $TargetContainer fallito" }
    Write-Host "[OK] Sync completato su $TargetContainer" -ForegroundColor Green
}

# ------------------------------------------------------------
# Full rebuild: build immagine :mariadb-new + smoke test su shadow
# ------------------------------------------------------------
function Invoke-FullRebuild {
    Write-Host "`n[FULL] Creazione build context..." -ForegroundColor Yellow
    if (Test-Path build-ctx.tar.gz) { Remove-Item build-ctx.tar.gz -Force }
    tar -czf build-ctx.tar.gz `
        --exclude='*.db' --exclude='*.db-journal' `
        --exclude='node_modules' --exclude='molino-data' `
        --exclude='backups/*.sql' --exclude='backups/*.tar.gz' `
        Dockerfile package.json package-lock.json public server/dist server/prisma server/.env
    if ($LASTEXITCODE -ne 0) { throw "tar build-ctx fallito" }
    $size = [math]::Round((Get-Item build-ctx.tar.gz).Length / 1MB, 2)
    Write-Host "[OK] build-ctx.tar.gz creato ($size MB)" -ForegroundColor Green

    Write-Host "`n[FULL] Upload context al NAS..." -ForegroundColor Yellow
    scp build-ctx.tar.gz "$($NAS_USER)@$($NAS_IP):/share/Container/build-ctx.tar.gz" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "scp build-ctx fallito" }
    ssh "$($NAS_USER)@$($NAS_IP)" "rm -rf $BUILD_CTX && mkdir -p $BUILD_CTX && tar -xzf /share/Container/build-ctx.tar.gz -C $BUILD_CTX && rm /share/Container/build-ctx.tar.gz" | Out-Null
    Write-Host "[OK] Context estratto in $BUILD_CTX" -ForegroundColor Green

    Write-Host "`n[FULL] Backup tag immagine corrente come ${IMG}:${TAG_PREV}..." -ForegroundColor Yellow
    ssh "$($NAS_USER)@$($NAS_IP)" "$DOCKER tag ${IMG}:${TAG_CUR} ${IMG}:${TAG_PREV} 2>/dev/null || true; $DOCKER images $IMG" 2>&1 | Out-Host
    Write-Host "[OK]" -ForegroundColor Green

    Write-Host "`n[FULL] Build ${IMG}:${TAG_NEW} sul NAS (puo' richiedere alcuni minuti)..." -ForegroundColor Yellow
    ssh -o ServerAliveInterval=30 "$($NAS_USER)@$($NAS_IP)" "cd $BUILD_CTX && $DOCKER build -t ${IMG}:${TAG_NEW} -f Dockerfile . 2>&1 | tail -30" 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "docker build fallito" }
    Write-Host "[OK] Immagine ${IMG}:${TAG_NEW} costruita" -ForegroundColor Green

    Write-Host "`n[FULL] Smoke test su shadow (porta $SHADOW_PORT)..." -ForegroundColor Yellow
    $smoke = @"
set -e
DOCKER=$DOCKER
CT_OLD=$CT_PROD
SHADOW=$CT_SHADOW
IMG_NEW=${IMG}:${TAG_NEW}

`$DOCKER rm -f `$SHADOW 2>/dev/null || true
ENVS=`$(`$DOCKER inspect `$CT_OLD --format '{{range .Config.Env}}-e {{.}} {{end}}')
`$DOCKER run -d --name `$SHADOW \
  -p ${SHADOW_PORT}:5000 \
  -v /share/Container/data/molino:/data/nas \
  -v /share/Public/molino-data/uploads:/app/uploads \
  -v /share/Public/molino-data/backups:/app/backups \
  -v /share/Public/molino-data/data:/app/data \
  -v /share/Container/wireguard/config:/wireguard:rw \
  `$ENVS \
  `$IMG_NEW

echo "Shadow avviato, attendo 25s..."
sleep 25

HTTP_CODE=`$(curl -sS -o /tmp/health.txt -w '%{http_code}' http://localhost:${SHADOW_PORT}/api/health || echo "000")
echo "HTTP /api/health: `$HTTP_CODE"
cat /tmp/health.txt 2>/dev/null || true
echo ""
`$DOCKER ps --filter name=`$SHADOW --format 'STATUS: {{.Status}}'

if [ "`$HTTP_CODE" != "200" ]; then
  `$DOCKER logs --tail 40 `$SHADOW
  echo "SMOKE_TEST_FAILED"
  exit 2
fi
echo "SMOKE_TEST_OK"
"@
    $smokeLF = ($smoke -replace "`r`n", "`n") + "`n"
    $smokeOut = $smokeLF | ssh "$($NAS_USER)@$($NAS_IP)" "bash -s" 2>&1
    Write-Host $smokeOut
    if (($smokeOut | Out-String) -notmatch 'SMOKE_TEST_OK') {
        throw "Smoke test fallito. Produzione intatta. Per ripulire: .\nas-deploy.ps1 -RemoveShadow"
    }
    Write-Host "[OK] Smoke test passato" -ForegroundColor Green
    Remove-Item build-ctx.tar.gz -Force -ErrorAction SilentlyContinue
}

# ------------------------------------------------------------
# Promote: shadow -> produzione
# ------------------------------------------------------------
function Invoke-Promote {
    param([bool]$IsFullMode, [bool]$DoServer, [bool]$DoPrisma, [bool]$DoRestart, [bool]$KeepShadowAlive)

    if ($IsFullMode) {
        Write-Host "`n[PROMOTE-FULL] Swap atomico produzione su :$PROD_PORT..." -ForegroundColor Yellow
        if (-not $KeepShadowAlive) {
            ssh "$($NAS_USER)@$($NAS_IP)" "$DOCKER rm -f $CT_SHADOW 2>/dev/null || true" | Out-Null
        }
        $swap = @"
set -e
DOCKER=$DOCKER
CT=$CT_PROD
IMG_NEW=${IMG}:${TAG_NEW}
IMG_CUR=${IMG}:${TAG_CUR}

ENVS=`$(`$DOCKER inspect `$CT --format '{{range .Config.Env}}-e {{.}} {{end}}')
`$DOCKER stop `$CT
`$DOCKER rm `$CT
`$DOCKER tag `$IMG_NEW `$IMG_CUR
`$DOCKER rmi `$IMG_NEW 2>/dev/null || true

`$DOCKER run -d --name `$CT \
  --restart unless-stopped \
  -p ${PROD_PORT}:5000 \
  -v /share/Container/data/molino:/data/nas \
  -v /share/Public/molino-data/uploads:/app/uploads \
  -v /share/Public/molino-data/backups:/app/backups \
  -v /share/Public/molino-data/data:/app/data \
  -v /share/Container/wireguard/config:/wireguard:rw \
  `$ENVS \
  `$IMG_CUR

echo "Container ricreato, attendo 25s..."
sleep 25
`$DOCKER ps --filter name=`$CT --format '{{.Names}} {{.Status}}'
"@
        $swapLF = ($swap -replace "`r`n", "`n") + "`n"
        $swapOut = $swapLF | ssh "$($NAS_USER)@$($NAS_IP)" "bash -s" 2>&1
        Write-Host $swapOut
        if (($swapOut | Out-String) -notmatch "$CT_PROD\s+Up") {
            Write-Host "[ERR] Swap fallito! Tentativo rollback..." -ForegroundColor Red
            ssh "$($NAS_USER)@$($NAS_IP)" "$DOCKER tag ${IMG}:${TAG_PREV} ${IMG}:${TAG_CUR}; $DOCKER run -d --name $CT_PROD --restart unless-stopped -p ${PROD_PORT}:5000 -v /share/Container/data/molino:/data/nas -v /share/Public/molino-data/uploads:/app/uploads -v /share/Public/molino-data/backups:/app/backups -v /share/Public/molino-data/data:/app/data -v /share/Container/wireguard/config:/wireguard:rw ${IMG}:${TAG_CUR}"
            throw "Swap fallito - rollback eseguito (immagine prev ripristinata)"
        }
        Write-Host "[OK] Swap completato" -ForegroundColor Green

        Write-Host "`n[PROMOTE-FULL] Verifica health produzione..." -ForegroundColor Yellow
        $check = ssh "$($NAS_USER)@$($NAS_IP)" "curl -sS -o /dev/null -w '%{http_code}' http://localhost:${PROD_PORT}/api/health" 2>&1
        Write-Host "Health: $check"
        if (($check | Out-String) -notmatch '200') { throw "Health check post-swap fallito! Verifica manuale necessaria." }

        ssh "$($NAS_USER)@$($NAS_IP)" "rm -rf $BUILD_CTX" | Out-Null
    } else {
        # Quick promote: replica gli stessi docker cp anche su prod
        Write-Host "`n[PROMOTE-QUICK] Replico file da $STATIC_STAGE a container produzione..." -ForegroundColor Yellow
        Sync-StaticFiles -TargetContainer $CT_PROD -DoServer $DoServer -DoPrisma $DoPrisma -DoRestart $DoRestart
    }
}

# ============================================================
# ESECUZIONE
# ============================================================
Push-Location $PSScriptRoot
try {
    if ($Full) {
        # Build sempre necessario per Full
        Build-LocalSources -DoApk:(-not $SkipApk) -DoServer:(-not $SkipServer) -DoPrisma:(-not $SkipPrisma)
        Invoke-FullRebuild
    } elseif ($Quick) {
        # Quick: ricompila TS solo se non skippato (serve per server/dist)
        Build-LocalSources -DoApk:(-not $SkipApk) -DoServer:(-not $SkipServer) -DoPrisma:(-not $SkipPrisma)
        Sync-StaticFiles -TargetContainer $CT_SHADOW -DoServer:(-not $SkipServer) -DoPrisma:(-not $SkipPrisma) -DoRestart:(-not $SkipRestart)
    }

    Write-Host "`n=================================================" -ForegroundColor Cyan
    Write-Host "[SHADOW PRONTO]  http://$($NAS_IP):$SHADOW_PORT" -ForegroundColor Green
    Write-Host "[PROD INTATTA]   http://$($NAS_IP):$PROD_PORT" -ForegroundColor Green
    Write-Host "=================================================" -ForegroundColor Cyan

    if ($Promote) {
        Invoke-Promote -IsFullMode:$Full -DoServer:(-not $SkipServer) -DoPrisma:(-not $SkipPrisma) -DoRestart:(-not $SkipRestart) -KeepShadowAlive:$KeepShadow
        Write-Host "`n=================================================" -ForegroundColor Green
        Write-Host "[PROMOTED]  http://$($NAS_IP):$PROD_PORT" -ForegroundColor Green
        if ($Full -and -not $KeepShadow) {
            Write-Host "Rollback disponibile: ${IMG}:${TAG_PREV}" -ForegroundColor DarkGray
            Write-Host "Per rimuovere immagine prev: ssh $($NAS_USER)@$($NAS_IP) `"$DOCKER rmi ${IMG}:${TAG_PREV}`"" -ForegroundColor DarkGray
        }
        if ($KeepShadow) {
            Write-Host "Shadow ancora attivo su :$SHADOW_PORT (per A/B test)" -ForegroundColor DarkYellow
            Write-Host "Per rimuoverlo: .\nas-deploy.ps1 -RemoveShadow" -ForegroundColor DarkGray
        }
        Write-Host "=================================================" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Per promuovere a produzione quando hai finito di testare:" -ForegroundColor Yellow
        if ($Full) {
            Write-Host "   .\nas-deploy.ps1 -Full -Promote" -ForegroundColor Cyan
        } else {
            Write-Host "   .\nas-deploy.ps1 -Promote                  (rifa Quick anche su prod)" -ForegroundColor Cyan
        }
        Write-Host "Per scartare lo shadow:" -ForegroundColor Yellow
        Write-Host "   .\nas-deploy.ps1 -RemoveShadow" -ForegroundColor Cyan
    }

} finally {
    Pop-Location
}
