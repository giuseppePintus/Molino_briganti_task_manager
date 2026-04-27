# auto-backup-mariadb.ps1
# Script per eseguire backup automatico MariaDB sul NAS
# Eseguire questo script periodicamente (es. ogni ora via Task Scheduler Windows)

# Carica credenziali dal config locale (gitignored). Vedi nas-config.example.ps1
$configPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'nas-config.local.ps1'
if (-not (Test-Path $configPath)) {
    throw "Config mancante: $configPath. Copia nas-config.example.ps1 e popolalo."
}
. $configPath

$BACKUP_SCRIPT = "/share/Public/molino-data/mariadb-backup.sh"
$LOG_FILE      = Join-Path $PSScriptRoot 'backup-logs.txt'

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

try {
    Write-Host "[$timestamp] Starting MariaDB backup on NAS..."
    
    # Esegui il backup via SSH
    $result = echo $NAS_PASSWORD | ssh "$NAS_USER@$NAS_IP" $BACKUP_SCRIPT 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $message = "[$timestamp] ✅ Backup completed successfully"
        Write-Host $message -ForegroundColor Green
        Add-Content -Path $LOG_FILE -Value $message
        Add-Content -Path $LOG_FILE -Value $result
    } else {
        $message = "[$timestamp] ❌ Backup failed with exit code $LASTEXITCODE"
        Write-Host $message -ForegroundColor Red
        Add-Content -Path $LOG_FILE -Value $message
        Add-Content -Path $LOG_FILE -Value $result
        exit 1
    }
    
} catch {
    $message = "[$timestamp] ❌ Error: $_"
    Write-Host $message -ForegroundColor Red
    Add-Content -Path $LOG_FILE -Value $message
    exit 1
}
