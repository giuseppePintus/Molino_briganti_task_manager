# Script per build e deploy completo con aggiornamento versione automatico
# Uso: .\build-and-deploy.ps1 -Version "1.0.16"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,
    
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BUILD & DEPLOY v$Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Aggiorna versione
Write-Host "📝 STEP 1: Aggiornamento versione..." -ForegroundColor Yellow
& "$PSScriptRoot\update-version.ps1" -Version $Version

# 2. Build Docker
Write-Host ""
Write-Host "🔨 STEP 2: Build Docker image..." -ForegroundColor Yellow
docker build -t "task-manager-nas:$Version" -f Dockerfile .

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build fallita!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completata" -ForegroundColor Green

if ($SkipDeploy) {
    Write-Host ""
    Write-Host "⏭️ Deploy saltato (flag -SkipDeploy)" -ForegroundColor Yellow
    exit 0
}

# 3. Salva immagine
Write-Host ""
Write-Host "💾 STEP 3: Salvataggio immagine..." -ForegroundColor Yellow
$tarFile = "task-manager-nas-$Version.tar"
docker save "task-manager-nas:$Version" -o $tarFile
Write-Host "✅ Immagine salvata: $tarFile" -ForegroundColor Green

# 4. Trasferisci al NAS
Write-Host ""
Write-Host "📤 STEP 4: Trasferimento al NAS..." -ForegroundColor Yellow
Write-Host "  (Inserisci password vsc12345 quando richiesto)"
scp $tarFile vsc@192.168.1.248:/share/homes/vsc/

# 5. Deploy sul NAS
Write-Host ""
Write-Host "🚀 STEP 5: Deploy sul NAS..." -ForegroundColor Yellow
$dockerPath = "/share/CACHEDEV1_DATA/.qpkg/container-station/usr/bin/docker"

Write-Host "  Fermando container esistente..."
ssh vsc@192.168.1.248 "$dockerPath stop molino-app 2>/dev/null; $dockerPath rm molino-app 2>/dev/null"

Write-Host "  Caricando nuova immagine..."
ssh vsc@192.168.1.248 "$dockerPath load -i /share/homes/vsc/$tarFile"

Write-Host "  Avviando nuovo container..."
ssh vsc@192.168.1.248 "$dockerPath run -d --name molino-app --restart unless-stopped -p 5000:5000 -v /share/Container/data/molino:/data/molino task-manager-nas:$Version"

# 6. Verifica
Write-Host ""
Write-Host "🔍 STEP 6: Verifica deployment..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
ssh vsc@192.168.1.248 "$dockerPath logs molino-app --tail 15"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ DEPLOY COMPLETATO v$Version" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Accedi a: http://192.168.1.248:5000" -ForegroundColor Cyan
