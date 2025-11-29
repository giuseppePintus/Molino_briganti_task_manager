# Deploy su NAS con Build Locale Forzato
# Usage: .\deploy-nas-with-build.ps1 -NasIp 192.168.1.100 -NasUser root

param(
    [Parameter(Mandatory=$true)]
    [string]$NasIp,
    
    [Parameter(Mandatory=$false)]
    [string]$NasUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$NasPort = "22"
)

Write-Host "🚀 Deploy su NAS - Build Locale Forzato" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "NAS IP: $NasIp" -ForegroundColor Gray
Write-Host "NAS User: $NasUser" -ForegroundColor Gray
Write-Host "NAS Port: $NasPort" -ForegroundColor Gray
Write-Host ""

# Step 1: Verifica che docker-compose.nas.yml esista localmente
Write-Host "📋 Step 1: Verificando docker-compose.nas.yml locale..." -ForegroundColor Yellow
if (-not (Test-Path "docker-compose.nas.yml")) {
    Write-Host "❌ Errore: docker-compose.nas.yml non trovato!" -ForegroundColor Red
    exit 1
}

$nasContent = Get-Content "docker-compose.nas.yml" -Raw
if ($nasContent -notmatch "^\s*build:") {
    Write-Host "⚠️  Avviso: docker-compose.nas.yml non ha `build:` configurato!" -ForegroundColor Yellow
    Write-Host "   Questo è necessario per il build locale sul NAS" -ForegroundColor Yellow
}
Write-Host "✅ docker-compose.nas.yml trovato" -ForegroundColor Green

# Step 2: Copia docker-compose.nas.yml al NAS
Write-Host ""
Write-Host "📤 Step 2: Copiando docker-compose.nas.yml al NAS..." -ForegroundColor Yellow

$scpCmd = "scp -P $NasPort docker-compose.nas.yml ${NasUser}@${NasIp}:/nas/molino/app/"
Invoke-Expression $scpCmd 2>&1 | Where-Object { $_ -notmatch "^$" } | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore durante copia del file" -ForegroundColor Red
    exit 1
}
Write-Host "✅ File copiato" -ForegroundColor Green

# Step 3: Ferma i container precedenti
Write-Host ""
Write-Host "🛑 Step 3: Fermando container precedenti..." -ForegroundColor Yellow

$stopCmd = "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml down"
ssh -p $NasPort "${NasUser}@${NasIp}" $stopCmd 2>&1 | Where-Object { $_ -notmatch "^$" } | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
Write-Host "✅ Container fermati" -ForegroundColor Green

# Step 4: Pulisci immagini vecchie
Write-Host ""
Write-Host "🧹 Step 4: Pulendo immagini precedenti..." -ForegroundColor Yellow

$cleanCmd = "docker rmi molino-task-manager:latest 2>/dev/null || true"
ssh -p $NasPort "${NasUser}@${NasIp}" $cleanCmd 2>&1 | Where-Object { $_ -notmatch "^$" } | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
Write-Host "✅ Immagini pulite" -ForegroundColor Green

# Step 5: Build e avvia i container
Write-Host ""
Write-Host "🔨 Step 5: Costruendo immagine sul NAS..." -ForegroundColor Yellow
Write-Host "   ⏳ Questo richiederà 5-15 minuti (dipende dalla connessione)" -ForegroundColor Gray

$buildCmd = "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml up -d --build 2>&1"
$buildOutput = ssh -p $NasPort "${NasUser}@${NasIp}" $buildCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore durante build" -ForegroundColor Red
    Write-Host "Output:" -ForegroundColor Red
    Write-Host $buildOutput -ForegroundColor Red
    exit 1
}

# Mostra solo i messaggi importanti dal build
$buildOutput | ForEach-Object {
    if ($_ -match "Step|Successfully|ERROR|FAILED|pulling|Building|exporting|naming") {
        Write-Host "   $_" -ForegroundColor Gray
    }
}

Write-Host "✅ Build completato" -ForegroundColor Green

# Step 6: Verifica lo stato
Write-Host ""
Write-Host "📊 Step 6: Verificando stato container..." -ForegroundColor Yellow

$statusCmd = "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml ps"
$statusOutput = ssh -p $NasPort "${NasUser}@${NasIp}" $statusCmd
Write-Host $statusOutput -ForegroundColor Gray

# Step 7: Health check
Write-Host ""
Write-Host "🏥 Step 7: Aspettando che l'applicazione si avvii..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$healthUrl = "http://${NasIp}:5000/api/health"
try {
    $health = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
    Write-Host "✅ Health check OK: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Health check non disponibile (container potrebbe ancora avviarsi)" -ForegroundColor Yellow
    Write-Host "   Riprova tra qualche secondo: $healthUrl" -ForegroundColor Gray
}

# Step 8: Mostra log
Write-Host ""
Write-Host "📋 Step 8: Ultimi log dall'app..." -ForegroundColor Yellow
$logsCmd = "cd /nas/molino/app && docker-compose -f docker-compose.nas.yml logs --tail=20"
$logsOutput = ssh -p $NasPort "${NasUser}@${NasIp}" $logsCmd
Write-Host $logsOutput -ForegroundColor Gray

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
Write-Host ""
Write-Host "💡 Nota: Se i container impiegano tempo ad avviarsi," -ForegroundColor Cyan
Write-Host "   monitora i log con:" -ForegroundColor Cyan
Write-Host "   ssh -p $NasPort ${NasUser}@${NasIp} 'cd /nas/molino/app && docker-compose -f docker-compose.nas.yml logs -f'" -ForegroundColor White
