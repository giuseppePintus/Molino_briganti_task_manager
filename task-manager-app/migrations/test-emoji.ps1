$ErrorActionPreference = 'Stop'
# Carica credenziali dal config locale (gitignored)
$configPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')) 'nas-config.local.ps1'
if (-not (Test-Path $configPath)) {
    throw "Config mancante: $configPath. Copia nas-config.example.ps1 e popolalo."
}
. $configPath

$base = "http://$($NAS_IP):5000"
$body = @{ username = $NAS_USER; password = $NAS_PASSWORD } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "$base/api/auth/login" -Method POST -ContentType 'application/json' -Body $body
$token = $resp.token
Write-Host "Token OK: $($token.Substring(0,20))..."

$taskBody = @{
  title = '🛒 Test emoji utf8mb4: FARINA 0 × 10 colli'
  description = 'Test descrizione con emoji 🌾 ✅ × ° è à'
  priority = 'NORMAL'
} | ConvertTo-Json -Compress
$h = @{ Authorization = "Bearer $token" }
$task = Invoke-RestMethod -Uri "$base/api/tasks" -Method POST -Headers $h -ContentType 'application/json' -Body $taskBody
Write-Host "Created task #$($task.id):"
Write-Host "  title=$($task.title)"
Write-Host "  desc=$($task.description)"

# Read it back
$got = Invoke-RestMethod -Uri "$base/api/tasks/$($task.id)" -Headers $h
Write-Host "Read back:"
Write-Host "  title=$($got.title)"
Write-Host "  desc=$($got.description)"

# Cleanup
Invoke-RestMethod -Uri "$base/api/tasks/$($task.id)" -Method DELETE -Headers $h | Out-Null
Write-Host "Cleaned up task #$($task.id)"
