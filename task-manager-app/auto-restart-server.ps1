# Auto-restart server se non raggiungibile
$logPath = "C:\Users\manue\Molino_briganti_task_manager\task-manager-app\server-monitor.log"
$maxDaysLogs = 7

# Pulizia vecchi log
if (Test-Path $logPath) {
    $logAge = (Get-Item $logPath).LastWriteTime
    if ((Get-Date) - $logAge | Select-Object -ExpandProperty Days | Where-Object { $_ -gt $maxDaysLogs }) {
        Remove-Item $logPath -Force
    }
}

function Log {
    param([string]$msg)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Add-Content $logPath $line
    Write-Host $line -ForegroundColor Cyan
}

function Start-AppServer {
    Log "⚙️ Avvio server Node..."
    $workDir = "C:\Users\manue\Molino_briganti_task_manager\task-manager-app"
    
    # Carica .env
    $envFile = Get-Content "$workDir\.env"
    $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim('"'), 'Process')
        }
    }
    
    # Avvia server
    Push-Location $workDir
    $serverProc = Start-Process -FilePath "node" -ArgumentList "server/dist/index.js" -PassThru -NoNewWindow
    Pop-Location
    
    Log "✅ Server PID: $($serverProc.Id)"
    return $serverProc
}

function Test-ServerHealth {
    try {
        $response = Test-NetConnection -ComputerName localhost -Port 5000 -InformationLevel Quiet -ErrorAction SilentlyContinue
        return $response
    } catch {
        return $false
    }
}

Log "🚀 Monitor server avviato - Controlla ogni 15 secondi"

$retryCount = 0
$maxRetries = 3

while ($true) {
    try {
        $isHealthy = Test-ServerHealth
        
        if ($isHealthy) {
            Log "✅ Server OK"
            $retryCount = 0
        } else {
            $retryCount++
            Log "⚠️ Server non raggiungibile (tentativo $retryCount/$maxRetries)"
            
            if ($retryCount -ge $maxRetries) {
                Log "❌ Server down - Riavvio..."
                Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
                Start-Sleep -Seconds 2
                Start-AppServer
                $retryCount = 0
                Start-Sleep -Seconds 10  # Attendi startup
            }
        }
    } catch {
        Log "❌ Errore: $_"
    }
    
    Start-Sleep -Seconds 15
}
