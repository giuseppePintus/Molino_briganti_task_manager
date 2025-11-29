# Script PowerShell per esportare e caricare l'immagine nel NAS

param(
    [string]$ImageTag = "arm64-v3",
    [string]$NasIP = "192.168.1.248",
    [string]$NasUser = "visualstudiocode123",
    [string]$NasPassword = "visualstudiocode123",
    [string]$ContainerPath = "/share/CACHEDEV1_DATA/Container"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Export e Deploy su NAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Immagine: molino-task-manager:$ImageTag"
Write-Host "NAS: $NasIP"
Write-Host "Percorso: $ContainerPath"
Write-Host ""

$ImageName = "molino-task-manager"
$TarFile = "molino-image-$ImageTag.tar"

# Step 1: Esporta l'immagine
Write-Host "Step 1: Esportazione immagine..." -ForegroundColor Yellow
docker save "$ImageName:$ImageTag" -o $TarFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore durante l'esportazione" -ForegroundColor Red
    exit 1
}
$FileSize = (Get-Item $TarFile).Length / 1MB
Write-Host "✓ Esportazione completata ($([Math]::Round($FileSize, 2)) MB)" -ForegroundColor Green
Write-Host ""

# Step 2: Carica nel NAS via SSH
Write-Host "Step 2: Caricamento nel NAS via SSH..." -ForegroundColor Yellow
$env:SSHPASS = $NasPassword
ssh -o StrictHostKeyChecking=no "$NasUser@$NasIP" "mkdir -p $ContainerPath"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Cartella creata/verificata nel NAS" -ForegroundColor Green
} else {
    Write-Host "⚠ Impossibile creare cartella nel NAS" -ForegroundColor Yellow
}

# Nota: scp potrebbe richiedere input manuale
Write-Host ""
Write-Host "⚠ Carica il file $TarFile nel NAS:" -ForegroundColor Yellow
Write-Host "  Percorso locale: $(Get-Item $TarFile | Select-Object -ExpandProperty FullName)" -ForegroundColor White
Write-Host "  Percorso NAS: $ContainerPath/$TarFile" -ForegroundColor White
Write-Host ""
Write-Host "Puoi usare:" -ForegroundColor Cyan
Write-Host "  1. QNAP File Station (Web UI)" -ForegroundColor White
Write-Host "  2. Oppure via SCP (se installato)" -ForegroundColor White
Write-Host ""

# Step 3: Comandi da eseguire nel NAS
Write-Host "Step 3: Comandi da eseguire nel NAS (via SSH):" -ForegroundColor Yellow
Write-Host ""
Write-Host "ssh $NasUser@$NasIP" -ForegroundColor Cyan
Write-Host "docker stop molino-task-manager 2>/dev/null" -ForegroundColor Cyan
Write-Host "docker rm molino-task-manager 2>/dev/null" -ForegroundColor Cyan
Write-Host "docker load -i $ContainerPath/$TarFile" -ForegroundColor Cyan
Write-Host "docker run -d --name molino-task-manager -p 5000:5000 -p 5001:5001 -v /share/CACHEDEV1_DATA/molino:/data/molino -e DATABASE_URL=file:/data/molino/prisma.db -e JWT_SECRET=your-secret -e DEFAULT_MASTER_USER=Manuel -e DEFAULT_MASTER_PASSWORD=123 molino-task-manager:$ImageTag" -ForegroundColor Cyan
Write-Host "docker ps" -ForegroundColor Cyan
Write-Host ""

$env:SSHPASS = ""
Write-Host "✓ Script completato" -ForegroundColor Green
