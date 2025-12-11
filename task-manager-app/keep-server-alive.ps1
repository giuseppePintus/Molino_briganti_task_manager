# Script per mantenere il server localhost:5000 sempre attivo
# Uso: .\keep-server-alive.ps1

$serverPort = 5000
$serverPath = "C:\Users\manue\Molino_briganti_task_manager\task-manager-app"
$logFile = "$serverPath\server-monitor.log"

function Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage -ForegroundColor Cyan
    Add-Content -Path $logFile -Value $logMessage
}

function IsServerAlive {
    try {
        $result = Test-NetConnection -ComputerName localhost -Port $serverPort -ErrorAction SilentlyContinue -WarningAction SilentlyContinue
        return $result.TcpTestSucceeded
    } catch {
        return $false
    }
}

function StartServer {
    Log "🚀 Avvio server localhost:$serverPort..."
    Push-Location $serverPath
    
    $env:DATABASE_URL = "file:./server/prisma/data/tasks.db"
    
    # Avvia il server in background
    Start-Process -FilePath node -ArgumentList "server/dist/index.js" -NoNewWindow -PassThru | Out-Null
    
    # Attendi che il server si avvii
    Start-Sleep -Seconds 3
    Pop-Location
    
    if (IsServerAlive) {
        Log "✅ Server avviato con successo su localhost:$serverPort"
        return $true
    } else {
        Log "❌ Fallito avvio del server. Nessun processo in ascolto su porta $serverPort"
        return $false
    }
}

function RestartServer {
    Log "🔄 Riavvio server..."
    
    # Arresta i processi Node precedenti
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Log "  ✓ Processi Node terminati"
    
    Start-Sleep -Seconds 2
    
    # Avvia il nuovo server
    if (StartServer) {
        return $true
    }
    return $false
}

# Main loop
Log "=== Monitor Server Avviato ==="
$checkInterval = 10  # Controlla ogni 10 secondi

while ($true) {
    $isAlive = IsServerAlive
    
    if ($isAlive) {
        $status = "✅ Server OK"
    } else {
        $status = "❌ Server DOWN - Riavvio..."
        RestartServer
    }
    
    Log "$status (Prossimo check tra ${checkInterval}s)"
    Start-Sleep -Seconds $checkInterval
}
