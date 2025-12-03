param(
    [string]$NasIP = "192.168.1.248",
    [string]$NasUser = "vsc",
    [string]$NasPass = "vsc12345"
)

function Write-OK { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-ERROR { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-INFO { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-STEP { Write-Host "`n$args" -ForegroundColor Yellow }

# Imposta la working directory
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host ""
Write-STEP "Deploy Docker (Build remoto su NAS)"
Write-INFO "NAS: $NasIP"
Write-INFO "Working Directory: $(Get-Location)"
Write-Host ""

# Step 1: Carica il build zip sul NAS (se non esiste)
Write-STEP "Step 1: Verifica build zip..."
$buildZip = "build-nas-20251130-2312.zip"
if (-not (Test-Path $buildZip)) {
    Write-ERROR "Build zip non trovato: $buildZip"
    exit 1
}
Write-OK "Build trovato"

# Step 2: Carica build zip
Write-STEP "Step 2: Caricamento build su NAS..."
scp $buildZip "${NasUser}@${NasIP}:/tmp/" 2>&1 | Select-Object -Last 3
Write-OK "Build caricato"

# Step 3: Carica docker-compose
Write-STEP "Step 3: Caricamento docker-compose..."
scp docker-compose.yml "${NasUser}@${NasIP}:/home/vsc/molino-app/" 2>&1 | Out-Null
Write-OK "docker-compose.yml caricato"

# Step 4: Carica Dockerfile
Write-STEP "Step 4: Caricamento Dockerfile..."
scp Dockerfile "${NasUser}@${NasIP}:/home/vsc/molino-app/" 2>&1 | Out-Null
Write-OK "Dockerfile caricato"

# Step 5: Carica package.json
Write-STEP "Step 5: Caricamento package.json..."
scp package.json "${NasUser}@${NasIP}:/home/vsc/molino-app/" 2>&1 | Out-Null
Write-OK "package.json caricato"

# Step 6: Carica public directory
Write-STEP "Step 6: Caricamento public files..."
scp -r public/* "${NasUser}@${NasIP}:/home/vsc/molino-app/public/" 2>&1 | Out-Null
Write-OK "Public files caricati"

# Step 7: Carica server/dist
Write-STEP "Step 7: Caricamento server build..."
scp -r server/dist/* "${NasUser}@${NasIP}:/home/vsc/molino-app/server/dist/" 2>&1 | Out-Null
Write-OK "Server build caricato"

# Step 8: Decomprime build zip e prepara il progetto
Write-STEP "Step 8: Preparazione directory sul NAS..."
$prepareCmd = @"
cd /home/vsc/molino-app
unzip -q /tmp/$buildZip -d temp-build 2>/dev/null || true
# Se il file è stato decompresso, copia tutto
if [ -d 'temp-build/build-nas-20251130-2312' ]; then
  cp -r temp-build/build-nas-20251130-2312/* .
  rm -rf temp-build
fi
# Verifica struttura
echo 'Directory struttura:'
ls -la | head -10
"@

ssh "${NasUser}@${NasIP}" $prepareCmd 2>&1 | Select-Object -Last 15
Write-OK "Directory preparata"

# Step 9: Build e avvia Docker
Write-STEP "Step 9: Docker build e avvio container..."
$dockerBuildCmd = @"
cd /home/vsc/molino-app
mkdir -p /data/molino/backups
docker-compose down 2>/dev/null || true
echo 'Inizio build Docker (questo impiegherà 2-5 minuti)...'
docker-compose up -d --build
echo 'Container avviati!'
docker ps
echo ''
echo 'Attesa 15 secondi per l'avvio completo...'
sleep 15
docker logs molino-briganti-task-manager | tail -20
"@

ssh "${NasUser}@${NasIP}" $dockerBuildCmd 2>&1
Write-OK "Docker avviato"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploy Docker Completato!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Web UI:    http://${NasIP}:5000" -ForegroundColor Cyan
Write-Host "Username:  Manuel" -ForegroundColor Cyan
Write-Host "Password:  123" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verifica container:"
Write-Host "  ssh ${NasUser}@${NasIP}"
Write-Host "  docker ps"
Write-Host ""
Write-Host "Verifica log:"
Write-Host "  docker logs molino-briganti-task-manager -f"
Write-Host ""
Write-Host "Stop container:"
Write-Host "  docker-compose down"
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
