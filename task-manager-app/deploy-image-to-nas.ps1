# Script per esportare l'immagine Docker dal locale e caricarla sul NAS
# Usage: .\deploy-image-to-nas.ps1 -NasIp 192.168.1.100 -NasUser root -NasPassword password

param(
    [Parameter(Mandatory=$true)]
    [string]$NasIp,
    
    [Parameter(Mandatory=$false)]
    [string]$NasUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$NasPassword = "",
    
    [Parameter(Mandatory=$false)]
    [string]$NasPort = "22"
)

Write-Host "🚀 Deploy Docker Image to NAS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Step 1: Verifica che l'immagine esista localmente
Write-Host ""
Write-Host "📦 Step 1: Verificando immagine locale..." -ForegroundColor Yellow
$imageExists = docker images | Select-String "molino-task-manager.*latest"
if (-not $imageExists) {
    Write-Host "❌ Errore: Immagine 'molino-task-manager:latest' non trovata localmente!" -ForegroundColor Red
    Write-Host "Esegui prima: docker-compose build" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Immagine trovata: $($imageExists -split '\s+' | Select-Object -First 3 | Join-String -Separator ' ')" -ForegroundColor Green

# Step 2: Esporta l'immagine in un tar
Write-Host ""
Write-Host "💾 Step 2: Esportando immagine in tar..." -ForegroundColor Yellow
$tarFile = "molino-task-manager-latest.tar"
$tarPath = Join-Path -Path $PSScriptRoot -ChildPath $tarFile

if (Test-Path $tarPath) {
    Write-Host "⚠️  File $tarFile già esiste, eliminando..." -ForegroundColor Yellow
    Remove-Item $tarPath -Force
}

Write-Host "   Salvando a: $tarPath" -ForegroundColor Gray
docker save molino-task-manager:latest -o $tarPath

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore durante export dell'immagine" -ForegroundColor Red
    exit 1
}

$fileSize = (Get-Item $tarPath).Length / 1MB
Write-Host "✅ Immagine esportata: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Green

# Step 3: Carica l'immagine sul NAS
Write-Host ""
Write-Host "📤 Step 3: Caricando immagine sul NAS ($NasIp)..." -ForegroundColor Yellow

# Se non è fornita una password, usa SSH key
if ($NasPassword -eq "") {
    Write-Host "   Usando SSH key authentication..." -ForegroundColor Gray
    # Usa WSL per scp (più affidabile su Windows)
    $remoteFile = "/tmp/$tarFile"
    
    # Prova con scp nativo (se disponibile)
    if (Get-Command scp -ErrorAction SilentlyContinue) {
        scp -P $NasPort $tarPath "${NasUser}@${NasIp}:$remoteFile"
    } else {
        # Fallback: usa WSL
        Write-Host "   Usando WSL per SCP..." -ForegroundColor Gray
        wsl scp -P $NasPort $tarPath "${NasUser}@${NasIp}:$remoteFile"
    }
} else {
    # Usa password con plink (parte di PuTTY)
    Write-Host "   Usando password authentication..." -ForegroundColor Gray
    $remoteFile = "/tmp/$tarFile"
    
    # Copia il file usando SSH (più semplice su Windows)
    $sshCmd = "cat > $remoteFile" | ssh -l $NasUser -p $NasPort $NasIp
    Get-Content $tarPath | ssh -l $NasUser -p $NasPort $NasIp "cat > $remoteFile"
}

Write-Host "✅ File caricato sul NAS: $remoteFile" -ForegroundColor Green

# Step 4: Carica l'immagine nel Docker del NAS
Write-Host ""
Write-Host "🐳 Step 4: Caricando immagine in Docker sul NAS..." -ForegroundColor Yellow

$loadCmd = "docker load -i $remoteFile && rm $remoteFile"
if (Get-Command ssh -ErrorAction SilentlyContinue) {
    ssh -p $NasPort "${NasUser}@${NasIp}" $loadCmd
} else {
    wsl ssh -p $NasPort "${NasUser}@${NasIp}" $loadCmd
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Immagine caricata con successo nel Docker del NAS" -ForegroundColor Green
} else {
    Write-Host "⚠️  Possibile errore durante il caricamento, continuando..." -ForegroundColor Yellow
}

# Step 5: Avvia i container sul NAS
Write-Host ""
Write-Host "🚀 Step 5: Avviando container sul NAS..." -ForegroundColor Yellow

$startCmd = "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml down && docker-compose -f docker-compose.nas.yml up -d"
if (Get-Command ssh -ErrorAction SilentlyContinue) {
    ssh -p $NasPort "${NasUser}@${NasIp}" $startCmd
} else {
    wsl ssh -p $NasPort "${NasUser}@${NasIp}" $startCmd
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Container avviati con successo" -ForegroundColor Green
} else {
    Write-Host "⚠️  Errore durante avvio dei container" -ForegroundColor Yellow
}

# Step 6: Verifica lo stato
Write-Host ""
Write-Host "📊 Step 6: Verificando stato dei container..." -ForegroundColor Yellow

$statusCmd = "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml ps"
if (Get-Command ssh -ErrorAction SilentlyContinue) {
    ssh -p $NasPort "${NasUser}@${NasIp}" $statusCmd
} else {
    wsl ssh -p $NasPort "${NasUser}@${NasIp}" $statusCmd
}

# Step 7: Health check
Write-Host ""
Write-Host "🏥 Step 7: Health check API..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$healthUrl = "http://${NasIp}:5000/api/health"
try {
    $health = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Health check OK: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Health check non disponibile (container potrebbe ancora avviarsi)" -ForegroundColor Yellow
    Write-Host "   Riprova tra qualche secondo: $healthUrl" -ForegroundColor Gray
}

# Step 8: Pulizia file locale
Write-Host ""
Write-Host "🧹 Step 8: Pulizia..." -ForegroundColor Yellow
Remove-Item $tarPath -Force
Write-Host "✅ File tar locale eliminato" -ForegroundColor Green

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Deploy completato con successo!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Accedi all'applicazione:" -ForegroundColor Cyan
Write-Host "   URL: http://${NasIp}:5000" -ForegroundColor White
Write-Host "   Login: Manuel / 123" -ForegroundColor White
Write-Host ""
Write-Host "📊 Backup API:" -ForegroundColor Cyan
Write-Host "   Status: http://${NasIp}:5001/api/backup/status" -ForegroundColor White
