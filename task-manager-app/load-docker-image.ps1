# Script PowerShell per caricare l'immagine Docker nel NAS
# Richiede OpenSSH (disponibile in Windows 10+) e ssh-agent

$NasIP = "192.168.1.248"
$NasUser = "manuel"
$NasPassword = "Giuseppe@358"
$ImagePath = "/Container/molino-image.tar"
$TimeoutSeconds = 60

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Caricamento Immagine Docker nel NAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IP NAS: $NasIP"
Write-Host "Utente: $NasUser"
Write-Host "Percorso: $ImagePath"
Write-Host ""

# Metodo 1: Tentare con chiave SSH (se disponibile)
$sshKey = "$env:USERPROFILE\.ssh\id_rsa"
if (Test-Path $sshKey) {
    Write-Host "Trovata chiave SSH: $sshKey" -ForegroundColor Green
    Write-Host "Tentativo con chiave SSH..." -ForegroundColor Yellow
    
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "${NasUser}@${NasIP}" "docker load -i $ImagePath; docker images | grep molino"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Immagine caricata con successo!" -ForegroundColor Green
        exit 0
    }
}

# Metodo 2: Usare sshpass se disponibile
$sshPassPath = (Get-Command sshpass -ErrorAction SilentlyContinue).Source
if ($sshPassPath) {
    Write-Host "Trovato sshpass: $sshPassPath" -ForegroundColor Green
    Write-Host "Tentativo con sshpass e password..." -ForegroundColor Yellow
    
    # Esportare la password in una variabile di ambiente
    $env:SSHPASS = $NasPassword
    
    # Eseguire il comando
    & sshpass -e ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o PubkeyAuthentication=no "${NasUser}@${NasIP}" "docker load -i $ImagePath; docker images | grep molino"
    
    # Pulire la variabile
    $env:SSHPASS = ""
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Immagine caricata con successo!" -ForegroundColor Green
        exit 0
    }
}

# Metodo 3: Istruzioni manuali
Write-Host ""
Write-Host "⚠ Non è stato possibile automatizzare il caricamento." -ForegroundColor Yellow
Write-Host ""
Write-Host "OPZIONE A - Esegui manualmente nel terminale:" -ForegroundColor White
Write-Host "  ssh $NasUser@$NasIP" -ForegroundColor Cyan
Write-Host "  (inserisci password: $NasPassword)" -ForegroundColor Gray
Write-Host "  docker load -i $ImagePath" -ForegroundColor Cyan
Write-Host "  docker images | grep molino" -ForegroundColor Cyan
Write-Host ""
Write-Host "OPZIONE B - Se hai PuTTY installato:" -ForegroundColor White
Write-Host "  Esegui: .\load-docker-image.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "OPZIONE C - Installa sshpass:" -ForegroundColor White
Write-Host "  # Su Windows con WSL2:" -ForegroundColor Cyan
Write-Host "  wsl sudo apt-get install sshpass" -ForegroundColor Cyan
Write-Host "  # Poi riavvia questo script" -ForegroundColor Cyan
Write-Host ""
