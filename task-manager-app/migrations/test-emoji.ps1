$ErrorActionPreference = 'Stop'
$base = 'http://192.168.1.248:5000'
$body = @{ username = 'admin'; password = '***REDACTED_NAS_PASSWORD***' } | ConvertTo-Json
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
