param(
    [string]$NasIP = "192.168.1.248",
    [string]$NasUser = "vsc",
    [string]$NasPass = "vsc12345",
    [string]$BuildFile = "build-nas-20251130-2312.zip"
)

# Configurazione
$NasHome = "/home/vsc"
$DeployPath = "$NasHome/molino-app"
$BuildFolderName = "build-nas-20251130-2312"

# Colori
function Write-OK { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-ERROR { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-INFO { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-STEP { Write-Host "`n$args" -ForegroundColor Yellow }

# Helper per SSH
function Invoke-SshCommand {
    param([string]$Command)
    try {
        $result = ssh -o StrictHostKeyChecking=no -o BatchMode=no "${NasUser}@${NasIP}" $Command 2>&1
        return $result
    }
    catch {
        return $null
    }
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploy Automatico Task Manager su NAS" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-INFO "NAS: $NasIP"
Write-INFO "User: $NasUser"
Write-INFO "Build: $BuildFile"
Write-Host ""

# Controlla se il file esiste localmente
if (-not (Test-Path $BuildFile)) {
    Write-ERROR "File build non trovato: $BuildFile"
    Write-Host "Assicurati di essere nella directory: $(Get-Location)"
    exit 1
}

$fileSize = (Get-Item $BuildFile).Length / 1MB
Write-OK "File trovato: $([Math]::Round($fileSize, 2)) MB"

Write-STEP "Step 1: Test connessione SSH..."
$sshTest = ssh -o StrictHostKeyChecking=no -o BatchMode=no "${NasUser}@${NasIP}" "echo 'SSH_OK'" 2>&1
if ($sshTest -like "*SSH_OK*") {
    Write-OK "SSH connesso"
} else {
    Write-ERROR "Impossibile connettersi via SSH"
    Write-Host "Verifica:"
    Write-Host "  - SSH è abilitato sul NAS"
    Write-Host "  - Credenziali corrette"
    Write-Host "  - Firewall non blocca porta 22"
    exit 1
}

Write-STEP "Step 2: Preparazione directory NAS..."
ssh "${NasUser}@${NasIP}" "mkdir -p $DeployPath && rm -rf $DeployPath/* 2>/dev/null || true" 2>&1 | Out-Null
Write-OK "Directory pronta"

Write-STEP "Step 3: Upload file via SCP..."
Write-Host "Caricamento di $BuildFile (questo potrebbe impiegare qualche secondo)..."
scp -r $BuildFile "${NasUser}@${NasIP}:${DeployPath}/"
if ($LASTEXITCODE -eq 0) {
    Write-OK "File caricato"
} else {
    Write-ERROR "Errore durante il caricamento"
    exit 1
}

Write-STEP "Step 4: Decompressione build..."
ssh "${NasUser}@${NasIP}" "cd $DeployPath && unzip -q $BuildFile && ls -la" 2>&1 | Out-Null
Write-OK "Build decompresso"

Write-STEP "Step 5: Installa dipendenze Node.js..."
ssh "${NasUser}@${NasIP}" "cd $DeployPath/$BuildFolderName && npm install --production" 2>&1 | Select-Object -Last 5
Write-OK "Dipendenze installate"

Write-STEP "Step 6: Avvio server..."
ssh "${NasUser}@${NasIP}" "pkill -f 'node server' 2>/dev/null || true" 2>&1 | Out-Null
Start-Sleep -Seconds 2
ssh "${NasUser}@${NasIP}" "cd $DeployPath/$BuildFolderName && nohup npm start > server.log 2>&1 &" 2>&1 | Out-Null
Start-Sleep -Seconds 5
Write-OK "Server avviato"

Write-STEP "Step 7: Verifica status..."
$processCheck = ssh "${NasUser}@${NasIP}" "ps aux | grep 'node server' | grep -v grep | wc -l" 2>&1
if ($processCheck -gt 0) {
    Write-OK "Processo Node.js in esecuzione"
} else {
    Write-Host "[WARN] Processo non trovato, verifica log..."
    ssh "${NasUser}@${NasIP}" "tail -10 $DeployPath/$BuildFolderName/server.log" 2>&1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Deploy Completato!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Web UI:    http://${NasIP}:5000" -ForegroundColor Cyan
Write-Host "Username:  Manuel" -ForegroundColor Cyan
Write-Host "Password:  123" -ForegroundColor Cyan
Write-Host ""
Write-Host "Comandi utili:" -ForegroundColor Yellow
Write-Host "  Verifica log:"
Write-Host "    ssh ${NasUser}@${NasIP}"
Write-Host "    tail -f $DeployPath/$BuildFolderName/server.log"
Write-Host ""
Write-Host "  Stop server:"
Write-Host "    pkill -f 'node server'"
Write-Host ""
Write-Host "  Riavvia server:"
Write-Host "    cd $DeployPath/$BuildFolderName && npm start"
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
