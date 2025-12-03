# Script deploy Docker su QNAP NAS (PowerShell)
# Uso: .\deploy-to-nas.ps1 -ImageTag "c1ppo/molino-task-manager:latest"

param(
    [Parameter(Mandatory=$false)]
    [string]$ImageTag = "c1ppo/molino-task-manager:latest"
)

# Configurazione NAS
$NAS_IP = "192.168.1.248"
$NAS_USER = "vsc"
$NAS_DOCKER_BIN = "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker"
$CONTAINER_NAME = "molino-task-manager"
$PORT = "5000"
$DATABASE_PATH = "/share/CACHEDEV1_DATA/molino/tasks.db"
$BACKUP_PATH = "/share/CACHEDEV1_DATA/molino/backups"

Write-Host "🚀 Deploy Docker su QNAP NAS" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "NAS IP: $NAS_IP" -ForegroundColor Yellow
Write-Host "Immagine: $ImageTag" -ForegroundColor Yellow
Write-Host "Container: $CONTAINER_NAME" -ForegroundColor Yellow
Write-Host "Porta: $PORT" -ForegroundColor Yellow
Write-Host ""

# Step 1: Stop vecchio container
Write-Host "Step 1: Arresto container precedente..." -ForegroundColor Cyan
ssh -t "$NAS_USER@$NAS_IP" "source /etc/profile; $NAS_DOCKER_BIN stop $CONTAINER_NAME 2>/dev/null || true" | Out-Null
ssh -t "$NAS_USER@$NAS_IP" "source /etc/profile; $NAS_DOCKER_BIN rm $CONTAINER_NAME 2>/dev/null || true" | Out-Null
Write-Host "✅ Done" -ForegroundColor Green
Write-Host ""

# Step 2: Pull immagine
Write-Host "Step 2: Pull immagine Docker..." -ForegroundColor Cyan
ssh -t "$NAS_USER@$NAS_IP" "source /etc/profile; $NAS_DOCKER_BIN pull $ImageTag"
Write-Host "✅ Done" -ForegroundColor Green
Write-Host ""

# Step 3: Crea directory backup
Write-Host "Step 3: Setup directory backup..." -ForegroundColor Cyan
ssh -t "$NAS_USER@$NAS_IP" "mkdir -p $BACKUP_PATH && chmod 755 $BACKUP_PATH" | Out-Null
Write-Host "✅ Done" -ForegroundColor Green
Write-Host ""

# Step 4: Avvia container
Write-Host "Step 4: Avvio container..." -ForegroundColor Cyan
$dockerRun = @"
source /etc/profile
$NAS_DOCKER_BIN run -d `
  --name $CONTAINER_NAME `
  -p $PORT`:5000 `
  -v /share/CACHEDEV1_DATA:/share/CACHEDEV1_DATA `
  -e DATABASE_URL='file:$DATABASE_PATH' `
  -e BACKUP_DIR='$BACKUP_PATH' `
  $ImageTag
"@
ssh -t "$NAS_USER@$NAS_IP" $dockerRun | Out-Null
Write-Host "✅ Done" -ForegroundColor Green
Write-Host ""

# Step 5: Wait per avvio
Write-Host "Step 5: Attesa avvio container (30 sec)..." -ForegroundColor Cyan
Start-Sleep -Seconds 30
Write-Host "✅ Done" -ForegroundColor Green
Write-Host ""

# Step 6: Verifica stato
Write-Host "Step 6: Verifica stato..." -ForegroundColor Cyan
ssh -t "$NAS_USER@$NAS_IP" "source /etc/profile; $NAS_DOCKER_BIN ps | grep $CONTAINER_NAME"
Write-Host ""

# Step 7: Health check
Write-Host "Step 7: Health check API..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://$NAS_IP:$PORT/api/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ API responsive!" -ForegroundColor Green
    Write-Host "Risposta: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "⚠️ API non ancora disponibile o irraggiungibile" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "==============================" -ForegroundColor Cyan
Write-Host "✅ Deploy completato!" -ForegroundColor Green
Write-Host "🌐 Accedi a: http://$NAS_IP:$PORT" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
