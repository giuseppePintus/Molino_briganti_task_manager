# setup-backup-schedule.ps1
# Script per configurare il backup automatico ogni ora tramite Windows Task Scheduler

$taskName = "MariaDB-Backup-Hourly"
$scriptPath = "C:\Users\manue\Molino_briganti_task_manager\task-manager-app\auto-backup-mariadb.ps1"
$taskDescription = "Backup automatico ogni ora del database MariaDB sul NAS"

Write-Host "🔧 Configurazione Task Scheduler per backup automatico..." -ForegroundColor Cyan

# Verifica se il task esiste già
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  Task '$taskName' già esistente. Rimuovo..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Crea l'azione (esegue lo script PowerShell)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

# Crea il trigger (ogni ora)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration ([TimeSpan]::MaxValue)

# Crea le impostazioni del task
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

# Registra il task (esegui come utente corrente)
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description $taskDescription `
    -User $env:USERNAME `
    -RunLevel Highest

Write-Host "✅ Task Scheduler configurato con successo!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Dettagli configurazione:" -ForegroundColor Cyan
Write-Host "   Nome task: $taskName"
Write-Host "   Frequenza: Ogni ora"
Write-Host "   Script: $scriptPath"
Write-Host "   Utente: $env:USERNAME"
Write-Host ""
Write-Host "🔍 Per verificare il task:" -ForegroundColor Yellow
Write-Host "   Get-ScheduledTask -TaskName '$taskName' | Format-List"
Write-Host ""
Write-Host "🗑️  Per rimuovere il task:" -ForegroundColor Yellow
Write-Host "   Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
