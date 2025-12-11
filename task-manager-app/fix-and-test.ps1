# Fix Prisma Client e riavvia container
Write-Host "🔄 Rigenerando Prisma Client..." -ForegroundColor Cyan

# Rigenera Prisma senza output verboso
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker exec molino-app npm run prisma:generate --loglevel=warn" 2>$null | Out-Null

Write-Host "✅ Prisma Client rigenerato" -ForegroundColor Green

# Aspetta un momento
Start-Sleep -Seconds 2

Write-Host "🔄 Riavviando container..." -ForegroundColor Cyan
ssh vsc@192.168.1.248 "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker restart molino-app" 2>$null | Out-Null

# Aspetta che il container sia health
Start-Sleep -Seconds 5

Write-Host "✅ Container riavviato" -ForegroundColor Green

# Testa l'API
Write-Host ""
Write-Host "🚀 Testando creazione trip..." -ForegroundColor Cyan

$date = (Get-Date).AddDays(3).ToString("yyyy-MM-ddT17:00:00Z")
$payload = @{
    name="FINAL TEST"
    date=$date
    assignedOperatorId=6
    vehicleName="Furgone"
    notes="Test after Prisma regen"
    sequence=@()
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "http://192.168.1.248:5000/api/trips" `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $payload `
        -UseBasicParsing
    
    if ($response.StatusCode -eq 201) {
        Write-Host "✅ SUCCESS!" -ForegroundColor Green
        $result = $response.Content | ConvertFrom-Json
        Write-Host ""
        Write-Host "📊 Trip Created:"
        Write-Host "   ID: $($result.id)"
        Write-Host "   Name: $($result.name)"
        Write-Host "   Status: $($result.status)"
        Write-Host "   Operator: $($result.assignedOperator.username)"
    }
} catch {
    Write-Host "❌ ERRORE:" -ForegroundColor Red
    $error = $_.Exception.Response.Content | ConvertFrom-Json
    Write-Host $error.error
}
