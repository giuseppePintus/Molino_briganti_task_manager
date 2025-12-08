# Quick Deploy - Aggiorna solo i file modificati senza rebuild completo
# Usa quando cambi solo HTML/CSS/JS/TS (non package.json)

param(
    [string]$Version = "1.0.18"
)

$NAS_IP = "192.168.1.248"
$NAS_USER = "vsc"
$CONTAINER_NAME = "molino-app"
$DOCKER_CMD = "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker"

Write-Host "🚀 Quick Deploy v$Version" -ForegroundColor Cyan

# 1. Compila TypeScript localmente
Write-Host "📦 Compiling TypeScript..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\server"
npx tsc
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript compilation failed" -ForegroundColor Red
    exit 1
}
Set-Location $PSScriptRoot

# 2. Copia file modificati direttamente nel container via docker cp
Write-Host "📤 Copying updated files to container..." -ForegroundColor Yellow

# Crea archivio temporaneo dei file da aggiornare
$tempDir = New-Item -ItemType Directory -Path "$env:TEMP\molino-update-$(Get-Date -Format 'yyyyMMddHHmmss')" -Force

# Copia i file compilati e statici
Copy-Item -Path ".\server\dist" -Destination "$tempDir\server\dist" -Recurse -Force
Copy-Item -Path ".\public" -Destination "$tempDir\public" -Recurse -Force

# Crea archivio tar
$tarFile = "$PSScriptRoot\update-files.tar"
Set-Location $tempDir
tar -cvf $tarFile *
Set-Location $PSScriptRoot

# 3. Carica su NAS
Write-Host "📤 Uploading to NAS..." -ForegroundColor Yellow
scp $tarFile "${NAS_USER}@${NAS_IP}:/share/CACHEDEV1_DATA/Container/"

# 4. Estrai nel container e riavvia
Write-Host "🔄 Updating container..." -ForegroundColor Yellow
$sshCommands = @"
cd /share/CACHEDEV1_DATA/Container
$DOCKER_CMD cp update-files.tar ${CONTAINER_NAME}:/app/
$DOCKER_CMD exec ${CONTAINER_NAME} sh -c 'cd /app && tar -xvf update-files.tar && rm update-files.tar'
$DOCKER_CMD restart ${CONTAINER_NAME}
rm update-files.tar
"@

ssh "${NAS_USER}@${NAS_IP}" $sshCommands

# Cleanup
Remove-Item -Path $tempDir -Recurse -Force
Remove-Item -Path $tarFile -Force

Write-Host "✅ Quick deploy completed!" -ForegroundColor Green
Write-Host "🌐 Server: http://${NAS_IP}:5000" -ForegroundColor Cyan
