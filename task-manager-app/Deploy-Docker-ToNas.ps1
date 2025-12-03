param(
    [string]$NasIP = "192.168.1.248",
    [string]$NasUser = "vsc",
    [string]$NasPass = "vsc12345"
)

function Write-OK { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-ERROR { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-INFO { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-STEP { Write-Host "`n$args" -ForegroundColor Yellow -BackgroundColor DarkGray }

Write-Host ""
Write-STEP "Deploy Docker Task Manager su NAS"
Write-INFO "NAS: $NasIP ($NasUser)"
Write-Host ""

# Step 1: Verifica Docker
Write-STEP "Step 1: Verifica Docker..."
$dockerTest = docker ps 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ERROR "Docker non è in esecuzione"
    exit 1
}
Write-OK "Docker OK"

# Step 2: Build immagine Docker
Write-STEP "Step 2: Build immagine Docker..."
Write-INFO "Questo potrebbe impiegare 2-5 minuti..."
docker build -t molino-task-manager:latest -f Dockerfile .
if ($LASTEXITCODE -ne 0) {
    Write-ERROR "Build fallito"
    exit 1
}
Write-OK "Build completato"

# Step 3: Salva immagine in TAR
Write-STEP "Step 3: Export immagine Docker..."
$tarFile = "molino-task-manager-latest.tar"
docker save molino-task-manager:latest -o $tarFile
$tarSize = (Get-Item $tarFile).Length / 1MB
Write-OK "Immagine salvata: $tarFile ($([Math]::Round($tarSize, 2)) MB)"

# Step 4: Transfer via SCP
Write-STEP "Step 4: Caricamento immagine su NAS..."
Write-INFO "Transfer via SCP (questo potrebbe impiegare 1-2 minuti)..."
scp -r $tarFile "${NasUser}@${NasIP}:/tmp/"
if ($LASTEXITCODE -ne 0) {
    Write-ERROR "Transfer fallito"
    exit 1
}
Write-OK "Immagine caricata"

# Step 5: Copia docker-compose
Write-STEP "Step 5: Caricamento docker-compose.yml..."
scp docker-compose.yml "${NasUser}@${NasIP}:/home/vsc/molino-app/"
if ($LASTEXITCODE -ne 0) {
    Write-ERROR "Transfer docker-compose fallito"
    exit 1
}
Write-OK "docker-compose.yml caricato"

# Step 6: Carica immagine in Docker e avvia
Write-STEP "Step 6: Carica immagine e avvia containers..."
$deployCmd = @"
cd /home/vsc/molino-app
docker load -i /tmp/$tarFile
docker-compose down 2>/dev/null || true
docker-compose up -d
docker ps
"@

ssh "${NasUser}@${NasIP}" $deployCmd 2>&1 | Select-Object -Last 20
Write-OK "Container avviati"

# Step 7: Verifica
Write-STEP "Step 7: Verifica status..."
$status = ssh "${NasUser}@${NasIP}" "docker ps --filter 'name=molino' --format 'table {{.Names}}\t{{.Status}}'" 2>&1
Write-Host $status
Write-OK "Deploy completato!"

# Pulizia locale
Write-STEP "Step 8: Pulizia file temporanei..."
Remove-Item $tarFile -Force -ErrorAction SilentlyContinue
Write-OK "Pulizia completata"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploy Docker Completato!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Web UI:    http://${NasIP}:5000" -ForegroundColor Cyan
Write-Host "Username:  Manuel" -ForegroundColor Cyan
Write-Host "Password:  123" -ForegroundColor Cyan
Write-Host ""
Write-Host "Comandi utili:" -ForegroundColor Yellow
Write-Host "  Verifica log container:"
Write-Host "    ssh ${NasUser}@${NasIP}"
Write-Host "    docker logs molino-briganti-task-manager -f"
Write-Host ""
Write-Host "  Stop container:"
Write-Host "    docker-compose down"
Write-Host ""
Write-Host "  Riavvia container:"
Write-Host "    docker-compose up -d"
Write-Host ""
Write-Host "  Verifica storage database:"
Write-Host "    docker exec molino-briganti-task-manager du -sh /data/molino/"
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
