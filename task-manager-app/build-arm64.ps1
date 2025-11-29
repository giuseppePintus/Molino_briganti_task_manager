# Script PowerShell per buildare l'immagine Docker per ARM64

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Build Docker Image per ARM64" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$imageName = "molino-task-manager"
$imageTag = "latest"
$platform = "linux/arm64/v8"

Write-Host "Parametri build:" -ForegroundColor Yellow
Write-Host "  Immagine: $imageName:$imageTag"
Write-Host "  Platform: $platform"
Write-Host "  Dockerfile: ./Dockerfile"
Write-Host ""

# Verificare che Docker supporti buildx per multi-arch
Write-Host "Verifico supporto per build multi-architettura..." -ForegroundColor Yellow

docker buildx version >$null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creando builder per multi-arch support..." -ForegroundColor Cyan
    docker buildx create --name multiarch-builder --use
}

Write-Host ""
Write-Host "Avvio build per $platform..." -ForegroundColor Cyan
Write-Host ""

# Build per ARM64 - carica direttamente senza esportare
docker buildx build `
  --platform $platform `
  --tag "${imageName}:${imageTag}-arm64" `
  --load `
  .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Build completato con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Immagine creata: ${imageName}:${imageTag}-arm64" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Prossimi passi:" -ForegroundColor Yellow
    Write-Host "  1. Esportare in TAR: docker save ${imageName}:${imageTag}-arm64 -o molino-image-arm64.tar" -ForegroundColor White
    Write-Host "  2. Caricare nel NAS" -ForegroundColor White
    Write-Host "  3. Caricare l'immagine: docker load -i /share/CACHEDEV1_DATA/Container/molino-image-arm64.tar" -ForegroundColor White
} else {
    Write-Host "✗ Build fallito!" -ForegroundColor Red
    exit 1
}
