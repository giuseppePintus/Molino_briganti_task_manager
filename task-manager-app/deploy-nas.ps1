# Script per il deploy su NAS
# Uso: .\deploy-nas.ps1 -NasIP 192.168.1.100 -NasUser root -NasPassword yourpassword

param(
    [Parameter(Mandatory=$true)]
    [string]$NasIP,
    
    [Parameter(Mandatory=$false)]
    [string]$NasUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$NasPassword,
    
    [Parameter(Mandatory=$false)]
    [string]$LocalPath = "C:\Users\manue\Molino_briganti_task_manager\task-manager-app",
    
    [Parameter(Mandatory=$false)]
    [string]$NasPath = "/nas/molino/app"
)

Write-Host "🚀 Molino Task Manager - Deploy NAS Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Verifica che il path locale esista
if (-not (Test-Path $LocalPath)) {
    Write-Host "❌ Path locale non trovato: $LocalPath" -ForegroundColor Red
    exit 1
}

Write-Host "📍 Configurazione:" -ForegroundColor Yellow
Write-Host "   NAS IP: $NasIP"
Write-Host "   NAS User: $NasUser"
Write-Host "   Local Path: $LocalPath"
Write-Host "   NAS Path: $NasPath"
Write-Host ""

# Step 1: Prepara directory sul NAS
Write-Host "Step 1: Preparazione directory NAS" -ForegroundColor Yellow
Write-Host "▶ Creazione directory..." -ForegroundColor Cyan
ssh $NasUser@$NasIP "mkdir -p $NasPath && mkdir -p /data/molino/backups && chmod -R 755 /data/molino"
Write-Host "✅ Directory pronte" -ForegroundColor Green

# Step 2: Copia i file
Write-Host ""
Write-Host "Step 2: Copia file al NAS" -ForegroundColor Yellow
Write-Host "▶ Copia file con SCP..." -ForegroundColor Cyan
scp -r "$LocalPath\*" "${NasUser}@${NasIP}:${NasPath}/"
Write-Host "✅ File copiati" -ForegroundColor Green

# Step 3: Verifica i file
Write-Host ""
Write-Host "Step 3: Verifica file" -ForegroundColor Yellow
ssh $NasUser@$NasIP "ls -la $NasPath | head -20"

# Step 4: Build e avvia containers
Write-Host ""
Write-Host "Step 4: Build e avvia Docker containers" -ForegroundColor Yellow
Write-Host "▶ Arresto container precedenti..." -ForegroundColor Cyan
ssh $NasUser@$NasIP "cd $NasPath && docker-compose -f docker-compose.nas.yml down 2>/dev/null || true"
Write-Host "✅ Fatto" -ForegroundColor Green

Write-Host "▶ Build e avvio container (questo potrebbe impiegare alcuni minuti)..." -ForegroundColor Cyan
ssh $NasUser@$NasIP "cd $NasPath && docker-compose -f docker-compose.nas.yml up -d --build"
Write-Host "✅ Container in avvio" -ForegroundColor Green

# Step 5: Verifica stato
Write-Host ""
Write-Host "Step 5: Verifica stato container" -ForegroundColor Yellow
ssh $NasUser@$NasIP "cd $NasPath && docker-compose -f docker-compose.nas.yml ps"

# Step 6: Test API
Write-Host ""
Write-Host "Step 6: Test API (attendere 30 secondi per l'avvio completo)" -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "▶ Prova Health Check..." -ForegroundColor Cyan
try {
    $health = Invoke-WebRequest -Uri "http://$NasIP:5000/api/health" -UseBasicParsing -ErrorAction Stop -TimeoutSec 5
    Write-Host "✅ Health Check OK: $($health.Content)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Health Check non disponibile (container ancora in avvio)" -ForegroundColor Yellow
}

# Step 7: Informazioni finali
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ Deploy completato!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Accedi alla web UI:" -ForegroundColor Yellow
Write-Host "   URL: http://$NasIP:5000" -ForegroundColor Cyan
Write-Host "   Username: Manuel" -ForegroundColor Cyan
Write-Host "   Password: 123" -ForegroundColor Cyan
Write-Host ""
Write-Host "📁 Verifica backup:" -ForegroundColor Yellow
Write-Host "   ssh $NasUser@$NasIP 'ls -la /data/molino/backups/'" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Log container:" -ForegroundColor Yellow
Write-Host "   ssh $NasUser@$NasIP 'cd $NasPath && docker-compose -f docker-compose.nas.yml logs -f'" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Usa docker-compose.nas.yml!" -ForegroundColor Yellow
Write-Host "   Il file docker-compose.nas.yml ha 'build:' configurato per il BUILD LOCALE" -ForegroundColor Yellow
Write-Host "   NON farà pull da Docker Hub. Se usi docker-compose.yml tradizionale fallirà!" -ForegroundColor Yellow
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
