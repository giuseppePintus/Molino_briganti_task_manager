param()

$serverPort = 5000
$serverPath = "C:\Users\manue\Molino_briganti_task_manager\task-manager-app"
$logFile = "$serverPath\server-monitor.log"

function Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line -ForegroundColor Cyan
    Add-Content -Path $logFile -Value $line
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
    Log "START: Server on localhost:$serverPort"
    Push-Location $serverPath
    
    $env:DATABASE_URL = "file:./server/prisma/data/tasks.db"
    Start-Process -FilePath node -ArgumentList "server/dist/index.js" -NoNewWindow -PassThru | Out-Null
    
    Start-Sleep -Seconds 3
    Pop-Location
    
    if (IsServerAlive) {
        Log "OK: Server started successfully"
        return $true
    } else {
        Log "ERROR: Server failed to start"
        return $false
    }
}

function RestartServer {
    Log "RESTART: Server"
    
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Log "INFO: Node processes stopped"
    
    Start-Sleep -Seconds 2
    
    if (StartServer) {
        return $true
    }
    return $false
}

Log "START: Monitor started"
$interval = 10

while ($true) {
    $alive = IsServerAlive
    
    if ($alive) {
        $status = "OK"
    } else {
        $status = "DOWN - Restarting"
        RestartServer
    }
    
    Log "STATUS: Server $status"
    Start-Sleep -Seconds $interval
}
