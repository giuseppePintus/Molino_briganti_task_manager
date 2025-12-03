# Script helper per SSH al NAS
# Uso: . .\ssh-nas-helper.ps1
# Poi: Invoke-NasCommand "docker ps"

$NAS_IP = "192.168.1.248"
$NAS_USER = "vsc"
$NAS_PASSWORD = "vsc12345"
$NAS_DOCKER_PATH = "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker"

function Invoke-NasCommand {
    param(
        [string]$Command,
        [bool]$UseDocker = $false
    )
    
    if ($UseDocker) {
        $fullCommand = "source /etc/profile; $NAS_DOCKER_PATH $Command"
    } else {
        $fullCommand = "source /etc/profile; $Command"
    }
    
    Write-Host "🔗 Connessione a NAS ($NAS_IP)..." -ForegroundColor Cyan
    Write-Host "📝 Comando: $Command" -ForegroundColor Yellow
    Write-Host ""
    
    ssh -t "$NAS_USER@$NAS_IP" "$fullCommand"
}

function Get-NasDockerStatus {
    Write-Host "📊 Stato Docker sul NAS..." -ForegroundColor Cyan
    Invoke-NasCommand "docker ps" -UseDocker $true
}

function Test-NasConnection {
    Write-Host "🧪 Test connessione NAS..." -ForegroundColor Cyan
    try {
        ssh $NAS_USER@$NAS_IP "echo 'Connessione OK! ✅'" -ErrorAction Stop
    } catch {
        Write-Host "❌ Errore connessione: $_" -ForegroundColor Red
    }
}

Write-Host "✅ SSH NAS Helper Loaded" -ForegroundColor Green
Write-Host ""
Write-Host "Comandi disponibili:" -ForegroundColor Yellow
Write-Host "  Test-NasConnection                    - Testa la connessione"
Write-Host "  Get-NasDockerStatus                   - Vedi stato Docker"
Write-Host "  Invoke-NasCommand 'comando'           - Esegui comando"
Write-Host "  Invoke-NasCommand 'comando' -UseDocker - Esegui con Docker"
Write-Host ""
Write-Host "Variabili disponibili:" -ForegroundColor Yellow
Write-Host "  `$NAS_IP, `$NAS_USER, `$NAS_DOCKER_PATH" -ForegroundColor Cyan
