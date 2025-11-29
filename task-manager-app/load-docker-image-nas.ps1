#!/usr/bin/env pwsh
# Script per caricare l'immagine Docker nel NAS con credenziali SSH

$NasIP = "192.168.1.248"
$NasUser = "admin"
$NasPassword = "visualstudiocode123"
$ImagePath = "/Container/molino-image.tar"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Caricamento Immagine Docker nel NAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IP NAS: $NasIP"
Write-Host "Utente: $NasUser"
Write-Host "Percorso: $ImagePath"
Write-Host ""

# Esportare la password come variabile di ambiente
$env:SSHPASS = $NasPassword

Write-Host "Esecuzione: docker load -i $ImagePath" -ForegroundColor Yellow
Write-Host ""

# Installare sshpass se non disponibile (via Chocolatey)
$sshPass = Get-Command sshpass -ErrorAction SilentlyContinue
if (-not $sshPass) {
    Write-Host "sshpass non trovato. Tentativo di installazione via Chocolatey..." -ForegroundColor Yellow
    try {
        choco install sshpass -y
    } catch {
        Write-Host "Impossibile installare sshpass. Prova manualmente." -ForegroundColor Red
    }
}

# Eseguire docker load
sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "${NasUser}@${NasIP}" "docker load -i $ImagePath; echo ''; echo '=== Immagini caricate ==='; docker images | grep molino"

$exitCode = $LASTEXITCODE

# Pulire la variabile
$env:SSHPASS = ""

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "✓ Immagine caricata con successo nel NAS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prossimo passo: Creare il container" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "✗ Errore (codice: $exitCode)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Prova manualmente:" -ForegroundColor Yellow
    Write-Host "  ssh admin@192.168.1.248" -ForegroundColor White
    Write-Host "  docker load -i /Container/molino-image.tar" -ForegroundColor White
    exit 1
}
