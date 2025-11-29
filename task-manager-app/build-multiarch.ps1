# Build Multi-Architecture Docker Image
# Crea immagini per amd64 e arm64 (compatibile con tutti i NAS)

param(
    [Parameter(Mandatory=$false)]
    [string]$Registry = "docker.io",
    
    [Parameter(Mandatory=$false)]
    [string]$ImageName = "molino-task-manager",
    
    [Parameter(Mandatory=$false)]
    [string]$Tag = "latest",
    
    [Parameter(Mandatory=$false)]
    [switch]$Push
)

Write-Host "🐳 Build Multi-Architecture Docker Image" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$fullImage = "${Registry}/${ImageName}:${Tag}"
Write-Host "Target: $fullImage" -ForegroundColor Gray
Write-Host ""

# Verifica che buildx sia disponibile
Write-Host "📋 Step 1: Verificando Docker Buildx..." -ForegroundColor Yellow
$buildxCheck = docker buildx version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore: Docker Buildx non disponibile" -ForegroundColor Red
    Write-Host "Su Windows con Docker Desktop, Buildx dovrebbe essere incluso" -ForegroundColor Red
    Write-Host "Verifica: Settings → Docker Engine" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker Buildx disponibile: $($buildxCheck[0])" -ForegroundColor Green

# Verifica builder
Write-Host ""
Write-Host "📋 Step 2: Verificando builder multi-platform..." -ForegroundColor Yellow
$builderCheck = docker buildx ls 2>&1
if ($builderCheck -notmatch "docker-container") {
    Write-Host "⚠️  Creando builder multi-platform (questo richiede qualche secondo)..." -ForegroundColor Yellow
    docker buildx create --use --name multiplatform --platform linux/amd64,linux/arm64 2>&1 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "✅ Builder multi-platform disponibile" -ForegroundColor Green
}

# Build multi-arch
Write-Host ""
Write-Host "🔨 Step 3: Building per amd64 e arm64..." -ForegroundColor Yellow
Write-Host "   ⏳ Questo richiederà 10-20 minuti (dipende dal sistema)" -ForegroundColor Gray

$buildCmd = "docker buildx build --platform linux/amd64,linux/arm64 -t $fullImage ."

if ($Push) {
    Write-Host "   📤 Push dopo build" -ForegroundColor Gray
    $buildCmd += " --push"
} else {
    Write-Host "   💾 Salvataggio locale" -ForegroundColor Gray
    $buildCmd += " --load"
}

Write-Host ""
Invoke-Expression $buildCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore durante build" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Build completato!" -ForegroundColor Green

# Mostra informazioni
Write-Host ""
Write-Host "📊 Informazioni immagine:" -ForegroundColor Yellow
docker inspect $fullImage 2>/dev/null | Select-Object -ExpandProperty Content | ConvertFrom-Json | Select-Object `
    @{Name="Architecture"; Expression={$_[0].Architecture}},
    @{Name="Os"; Expression={$_[0].Os}},
    @{Name="Size"; Expression={"{0:F2} MB" -f ($_.Size/1024/1024)}}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan

if ($Push) {
    Write-Host "✅ Immagine pushata su Docker Hub!" -ForegroundColor Green
    Write-Host "   URL: https://hub.docker.com/r/library/$ImageName" -ForegroundColor White
} else {
    Write-Host "💡 Per pushare su Docker Hub:" -ForegroundColor Cyan
    Write-Host "   .\build-multiarch.ps1 -Push" -ForegroundColor White
}

Write-Host ""
Write-Host "📝 Sul NAS, usa:" -ForegroundColor Cyan
Write-Host "   docker pull $fullImage" -ForegroundColor White
Write-Host "   Docker supporterà automaticamente amd64 e arm64" -ForegroundColor White
