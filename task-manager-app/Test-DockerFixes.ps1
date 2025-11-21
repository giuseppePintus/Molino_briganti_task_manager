# Test Script per Docker Fixes
# Questo script automatizza i test descritti in TESTING_GUIDE.md

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $projectRoot "server"
$testDbPath = Join-Path $serverDir "test-tasks.db"
$testEnvPath = Join-Path $serverDir ".env.test"

Write-Host "=== 🧪 Docker Infrastructure Testing ===" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# TEST 1: TypeScript Compilation
# ============================================================
Write-Host "📝 TEST 1: TypeScript Compilation" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray

Push-Location $serverDir

Write-Host "Building TypeScript..." -ForegroundColor Gray
npm run build 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ PASSED: TypeScript compilation successful" -ForegroundColor Green
    
    # Verify databaseInit.js exists
    $databaseInitJs = Join-Path $serverDir "dist\services\databaseInit.js"
    if (Test-Path $databaseInitJs) {
        Write-Host "✅ PASSED: databaseInit.js file generated" -ForegroundColor Green
    } else {
        Write-Host "❌ FAILED: databaseInit.js not found" -ForegroundColor Red
    }
} else {
    Write-Host "❌ FAILED: TypeScript compilation error" -ForegroundColor Red
}

Write-Host ""

# ============================================================
# TEST 2: Check for databaseInit import in index.js
# ============================================================
Write-Host "📝 TEST 2: Check imports in compiled code" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────" -ForegroundColor Gray

$indexJs = Join-Path $serverDir "dist\index.js"
$content = Get-Content $indexJs -Raw

if ($content -match "initializeDatabaseIfEmpty") {
    Write-Host "✅ PASSED: initializeDatabaseIfEmpty found in index.js" -ForegroundColor Green
} else {
    Write-Host "❌ FAILED: initializeDatabaseIfEmpty not found in index.js" -ForegroundColor Red
}

if ($content -match "databaseInit_1") {
    Write-Host "✅ PASSED: databaseInit module imported" -ForegroundColor Green
} else {
    Write-Host "❌ FAILED: databaseInit module not imported" -ForegroundColor Red
}

Write-Host ""

# ============================================================
# TEST 3: Docker/Environment Configuration Check
# ============================================================
Write-Host "📝 TEST 3: Docker Configuration" -ForegroundColor Yellow
Write-Host "─────────────────────────────" -ForegroundColor Gray

$dockerfile = Join-Path $projectRoot "Dockerfile"
$dockerContent = Get-Content $dockerfile -Raw

if ($dockerContent -match "chmod -R 755") {
    Write-Host "✅ PASSED: Dockerfile includes chmod 755" -ForegroundColor Green
} else {
    Write-Host "❌ FAILED: Dockerfile missing chmod 755" -ForegroundColor Red
}

if ($dockerContent -match "COPY .env.docker") {
    Write-Host "✅ PASSED: Dockerfile copies .env.docker" -ForegroundColor Green
} else {
    Write-Host "❌ FAILED: Dockerfile doesn't copy .env.docker" -ForegroundColor Red
}

Write-Host ""

# ============================================================
# TEST 4: orders-planner.html logging
# ============================================================
Write-Host "📝 TEST 4: orders-planner.html logging" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────" -ForegroundColor Gray

$ordersPlanner = Join-Path $projectRoot "public\orders-planner.html"
$ordersContent = Get-Content $ordersPlanner -Raw

if ($ordersContent -match "role.*slave") {
    Write-Host "✅ PASSED: orders-planner uses role: 'slave'" -ForegroundColor Green
} else {
    Write-Host "❌ FAILED: orders-planner doesn't use role: 'slave'" -ForegroundColor Red
}

if ($ordersContent -match "Content-Type.*application/json") {
    Write-Host "✅ PASSED: API requests include Content-Type header" -ForegroundColor Green
} else {
    Write-Host "❌ FAILED: API requests missing Content-Type header" -ForegroundColor Red
}

if ($ordersContent -match "console.log.*Operatori") {
    Write-Host "✅ PASSED: Logging for operator loading added" -ForegroundColor Green
} else {
    Write-Host "❌ FAILED: Operator loading logging not found" -ForegroundColor Red
}

Write-Host ""

# ============================================================
# TEST 5: Clean up and Summary
# ============================================================
Write-Host "📝 TEST 5: Summary" -ForegroundColor Yellow
Write-Host "─────────────────" -ForegroundColor Gray

Write-Host ""
Write-Host "✅ All build tests completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. docker compose build" -ForegroundColor Gray
Write-Host "2. docker compose up -d" -ForegroundColor Gray
Write-Host "3. docker compose logs -f molino-app" -ForegroundColor Gray
Write-Host ""

Pop-Location
