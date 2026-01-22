# deploy-mariadb.ps1 - Script per deploy su NAS con MariaDB

Write-Host "[DEPLOY] Starting deployment to NAS with MariaDB..." -ForegroundColor Green

# Configurazione
$NAS_IP = "192.168.1.248"
$NAS_USER = "admin"
$NAS_PASSWORD = "***REDACTED_NAS_PASSWORD***"
$IMAGE_NAME = "molino-task-manager:mariadb"
$CONTAINER_NAME = "molino-briganti-task-manager"

# 1. Build dell'immagine Docker
Write-Host "[BUILD] Building Docker image..." -ForegroundColor Cyan
docker build -t $IMAGE_NAME .

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker build failed!" -ForegroundColor Red
    exit 1
}

# 2. Stop del container esistente sul NAS
Write-Host "[STOP] Stopping existing container on NAS..." -ForegroundColor Cyan
$stopCmd = "docker stop $CONTAINER_NAME 2>/dev/null; docker rm $CONTAINER_NAME 2>/dev/null; exit 0"
echo $NAS_PASSWORD | ssh $NAS_USER@$NAS_IP $stopCmd

# 3. Salva l'immagine e trasferiscila al NAS
Write-Host "[TRANSFER] Transferring image to NAS (this may take a few minutes)..." -ForegroundColor Cyan
docker save $IMAGE_NAME | gzip | ssh $NAS_USER@$NAS_IP "gunzip | docker load"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Image transfer failed!" -ForegroundColor Red
    exit 1
}

# 4. Avvia il nuovo container con MariaDB
Write-Host "[START] Starting new container with MariaDB..." -ForegroundColor Cyan
$runCmd = "docker run -d --name $CONTAINER_NAME --restart unless-stopped -p 5000:5000 " +
  "-e DATABASE_URL=`"mysql://molino_user:***REDACTED_DB_PASSWORD***@192.168.1.248:3306/molino_production`" " +
  "-e JWT_SECRET=`"***REDACTED_JWT_SECRET***`" " +
  "-e PORT=5000 -e NODE_ENV=production -e DEFAULT_MASTER_USER=`"master`" -e DEFAULT_MASTER_PASS=`"masterpass`" " +
  "-v /share/Public/molino-data/uploads:/app/uploads -v /share/Public/molino-data/backups:/app/backups " +
  "$IMAGE_NAME"

echo $NAS_PASSWORD | ssh $NAS_USER@$NAS_IP $runCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SUCCESS] Deployment completed successfully!" -ForegroundColor Green
    Write-Host "[INFO] Application available at: http://$NAS_IP:5000" -ForegroundColor Yellow
    
    # Verifica dello stato del container
    Write-Host "[STATUS] Checking container status..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    echo $NAS_PASSWORD | ssh $NAS_USER@$NAS_IP "docker ps -f name=$CONTAINER_NAME"
    
    Write-Host "[LOGS] Recent logs:" -ForegroundColor Cyan
    echo $NAS_PASSWORD | ssh $NAS_USER@$NAS_IP "docker logs --tail 20 $CONTAINER_NAME"
    
    Write-Host "`n[NEXT STEPS]" -ForegroundColor Yellow
    Write-Host "  1. Test the web interface at http://$NAS_IP:5000"
    Write-Host "  2. Configure automated MariaDB backups with mysqldump"
    Write-Host "  3. Monitor application logs: docker logs -f $CONTAINER_NAME"
} else {
    Write-Host "[ERROR] Deployment failed!" -ForegroundColor Red
    exit 1
}
