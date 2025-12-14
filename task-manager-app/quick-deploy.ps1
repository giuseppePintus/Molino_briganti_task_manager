# Quick Deploy - Aggiorna solo i file modificati senza rebuild completo
# Usa quando cambi solo HTML/CSS/JS/TS (non package.json)

param(
    [string]$Version = "1.0.19"
)

$NAS_IP = "192.168.1.248"
$NAS_USER = "vsc"
$CONTAINER_NAME = "molino-app"

Write-Host "🚀 Quick Deploy v$Version" -ForegroundColor Cyan

# 1. Compila TypeScript localmente
Write-Host "📦 Compiling TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript compilation failed" -ForegroundColor Red
    exit 1
}

# 2. Crea tar.gz dei file da aggiornare
Write-Host "📦 Creating archive..." -ForegroundColor Yellow
tar -czf task-manager-update.tar.gz public server/dist server/prisma package.json

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tar creation failed" -ForegroundColor Red
    exit 1
}

# 3. Carica su NAS
Write-Host "📤 Uploading to NAS..." -ForegroundColor Yellow
scp task-manager-update.tar.gz "${NAS_USER}@${NAS_IP}:/tmp/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Upload failed" -ForegroundColor Red
    exit 1
}

# 4. Estrai nel container e riavvia (tramite script bash)
Write-Host "🔄 Updating container..." -ForegroundColor Yellow

# Crea uno script bash temporaneo
$updateScript = '#!/bin/bash
set -e
cd /tmp
tar -xzf task-manager-update.tar.gz 2>/dev/null
if command -v docker > /dev/null 2>&1; then
  if docker ps 2>/dev/null | grep -q molino-app; then
    docker cp public/. molino-app:/app/public/
    docker cp server/dist/. molino-app:/app/server/dist/
    docker restart molino-app
    echo "[OK] Container aggiornato"
  else
    echo "[WARN] Container non in esecuzione"
  fi
else
  echo "[INFO] Docker non disponibile direttamente"
fi
'

# Salva lo script in un file temporaneo
$tempScript = "$env:TEMP/quick-update-$((Get-Date).Ticks).sh"
[System.IO.File]::WriteAllText($tempScript, $updateScript)

# Carica e esegui lo script
Write-Host "  (Extracting and restarting container...)" -ForegroundColor Gray
scp $tempScript "${NAS_USER}@${NAS_IP}:/tmp/quick-update.sh" | Out-Null
ssh "${NAS_USER}@${NAS_IP}" "bash /tmp/quick-update.sh ; rm /tmp/quick-update.sh" 

# Cleanup
Remove-Item -Path $tempScript -Force -ErrorAction SilentlyContinue
Remove-Item -Path "task-manager-update.tar.gz" -Force -ErrorAction SilentlyContinue

Write-Host "✅ Quick deploy completed!" -ForegroundColor Green
Write-Host "🌐 Server: http://${NAS_IP}:5000" -ForegroundColor Cyan
