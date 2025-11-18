# deploy-nas.ps1 - Script di deployment per Windows
# Utilizzo: .\deploy-nas.ps1 -Action start|stop|restart|status|backup|restore|logs

param(
    [Parameter(Position=0)]
    [ValidateSet('start', 'stop', 'restart', 'status', 'logs', 'backup', 'list', 'restore', 'restore-latest', 'help')]
    [string]$Action = 'help',
    
    [Parameter(Position=1)]
    [string]$BackupFile
)

$DOCKER_COMPOSE_FILE = "docker-compose.yml"
$CONTAINER_NAME = "molino-briganti-task-manager"
$NAS_URL = "http://localhost:5000"

# Funzioni di output
function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Warning { Write-Host "⚠️  $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "❌ $args" -ForegroundColor Red }

# Verifica Docker Compose
function Test-Docker {
    try {
        $version = docker-compose --version 2>$null
        Write-Info "Docker Compose trovato: $version"
        return $true
    } catch {
        Write-Error "docker-compose non trovato. Installa Docker Desktop."
        return $false
    }
}

# Avvia applicazione
function Start-App {
    Write-Info "Avvio dell'applicazione in Docker..."
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    Write-Info "In attesa che l'applicazione si avvii..."
    Start-Sleep -Seconds 10
    
    # Verifica health
    try {
        $response = Invoke-WebRequest -Uri "$NAS_URL/api/health" -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "Applicazione avviata correttamente"
            Write-Host ""
            Write-Info "🌐 Web UI: http://localhost:5000"
            Write-Info "📊 API: http://localhost:5000/api"
            Write-Info "🗄️  Backup API: http://localhost:5000/api/backup"
            Write-Info "🖥️  NAS Server: http://localhost:5001"
        }
    } catch {
        Write-Warning "L'applicazione sta avviandosi... controlla i log con: .\deploy-nas.ps1 logs"
    }
}

# Ferma applicazione
function Stop-App {
    Write-Info "Arresto dell'applicazione..."
    docker-compose -f $DOCKER_COMPOSE_FILE down
    Write-Success "Applicazione fermata"
}

# Riavvia applicazione
function Restart-App {
    Stop-App
    Start-Sleep -Seconds 2
    Start-App
}

# Mostra stato
function Get-Status {
    Write-Info "Stato dei container:"
    docker-compose -f $DOCKER_COMPOSE_FILE ps
    
    Write-Host ""
    Write-Info "Health check:"
    try {
        $response = Invoke-WebRequest -Uri "$NAS_URL/api/health" -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Success "API Health: OK"
        }
    } catch {
        Write-Warning "API Health: Non disponibile"
    }
    
    # Mostra backup info
    try {
        $backup_status = Invoke-WebRequest -Uri "$NAS_URL/api/backup/status" -ErrorAction SilentlyContinue
        if ($backup_status.StatusCode -eq 200) {
            Write-Info "Backup System Status:"
            $backup_status.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
        }
    } catch {
        # Ignora errori
    }
}

# Mostra log
function Get-Logs {
    docker-compose -f $DOCKER_COMPOSE_FILE logs -f $CONTAINER_NAME
}

# Crea backup manuale
function New-Backup {
    Write-Info "Creazione backup manuale..."
    try {
        $response = Invoke-WebRequest -Uri "$NAS_URL/api/backup/manual" -Method POST -ErrorAction Stop
        $json = $response.Content | ConvertFrom-Json
        if ($json.success) {
            Write-Success "Backup creato:"
            $json | ConvertTo-Json | Write-Host
        } else {
            Write-Error "Errore nel backup: $($json.error)"
        }
    } catch {
        Write-Error "Errore: $_"
    }
}

# Elenca backup
function Get-Backups {
    Write-Info "Backup disponibili:"
    try {
        $response = Invoke-WebRequest -Uri "$NAS_URL/api/backup/list" -ErrorAction Stop
        $json = $response.Content | ConvertFrom-Json
        $json.files | ForEach-Object { Write-Host "  - $_" }
        Write-Host "Totale: $($json.count) backup"
    } catch {
        Write-Error "Errore nel recupero della lista: $_"
    }
}

# Ripristina backup
function Restore-Backup {
    param([string]$FileName)
    
    if ([string]::IsNullOrEmpty($FileName)) {
        Write-Error "Specifica il filename del backup"
        Get-Backups
        return
    }
    
    Write-Warning "Ripristino da backup: $FileName"
    $response = Read-Host "Confermi? (s/n)"
    
    if ($response -eq 's') {
        try {
            $response = Invoke-WebRequest -Uri "$NAS_URL/api/backup/restore/$FileName" -Method POST -ErrorAction Stop
            $json = $response.Content | ConvertFrom-Json
            if ($json.success) {
                Write-Success "Database ripristinato da: $FileName"
            } else {
                Write-Error "Errore nel ripristino: $($json.error)"
            }
        } catch {
            Write-Error "Errore: $_"
        }
    } else {
        Write-Info "Ripristino annullato"
    }
}

# Ripristina l'ultimo backup dal NAS
function Restore-LatestBackup {
    Write-Warning "Ripristino dell'ultimo backup dal NAS..."
    $response = Read-Host "Confermi? (s/n)"
    
    if ($response -eq 's') {
        try {
            $response = Invoke-WebRequest -Uri "$NAS_URL/api/backup/restore-latest" -Method POST -ErrorAction Stop
            $json = $response.Content | ConvertFrom-Json
            if ($json.success) {
                Write-Success "Database ripristinato dall'ultimo backup NAS"
            } else {
                Write-Error "Errore nel ripristino: $($json.error)"
            }
        } catch {
            Write-Error "Errore: $_"
        }
    } else {
        Write-Info "Ripristino annullato"
    }
}

# Mostra help
function Show-Help {
    Write-Host @"
Deployment Script - Molino Briganti Task Manager
================================================

Utilizzo: .\deploy-nas.ps1 [Azione] [Opzioni]

Azioni:
  start                - Avvia l'applicazione in Docker
  stop                 - Ferma l'applicazione
  restart              - Riavvia l'applicazione
  status               - Mostra lo stato dell'applicazione
  logs                 - Mostra i log in tempo reale
  backup               - Crea un backup manuale
  list                 - Elenca i backup disponibili
  restore <file>       - Ripristina un backup specifico
  restore-latest       - Ripristina l'ultimo backup dal NAS
  help                 - Mostra questo messaggio

Esempi:
  .\deploy-nas.ps1 start
  .\deploy-nas.ps1 backup
  .\deploy-nas.ps1 restore db-backup-2024-01-15-120000.sql
  .\deploy-nas.ps1 logs
"@
}

# Main
if (-not (Test-Docker)) {
    exit 1
}

switch ($Action) {
    'start' { Start-App }
    'stop' { Stop-App }
    'restart' { Restart-App }
    'status' { Get-Status }
    'logs' { Get-Logs }
    'backup' { New-Backup }
    'list' { Get-Backups }
    'restore' { Restore-Backup -FileName $BackupFile }
    'restore-latest' { Restore-LatestBackup }
    'help' { Show-Help }
    default { Show-Help }
}
