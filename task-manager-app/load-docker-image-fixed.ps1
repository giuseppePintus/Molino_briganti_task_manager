# Script PowerShell per caricare l'immagine Docker nel NAS
# Gestisce correttamente caratteri speciali come @ nella password

$NasIP = "192.168.1.248"
$NasUser = "manuel"
$NasPassword = "Giuseppe@358"
$ImagePath = "/Container/molino-image.tar"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Caricamento Immagine Docker nel NAS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IP NAS: $NasIP"
Write-Host "Utente: $NasUser"
Write-Host "Percorso: $ImagePath"
Write-Host ""

# Metodo: Usare sshpass con password corretta (escapa @ correttamente)
Write-Host "Tentativo con sshpass (gestisce caratteri speciali)..." -ForegroundColor Yellow

# Verificare se sshpass è disponibile
$sshPassPath = (Get-Command sshpass -ErrorAction SilentlyContinue).Source

if (-not $sshPassPath) {
    Write-Host "sshpass non trovato. Tentativo di installazione via WSL2..." -ForegroundColor Yellow
    
    # Tentare di installare sshpass via WSL2
    try {
        wsl sudo apt-get update -qq
        wsl sudo apt-get install -y sshpass
        Write-Host "✓ sshpass installato via WSL2" -ForegroundColor Green
    } catch {
        Write-Host "Impossibile installare sshpass automaticamente." -ForegroundColor Red
    }
}

# Ora tentare con sshpass
try {
    # Creare una variabile di ambiente per la password
    # In PowerShell, dobbiamo passarla direttamente
    $env:SSHPASS = $NasPassword
    
    Write-Host ""
    Write-Host "Esecuzione comando: docker load -i $ImagePath" -ForegroundColor Cyan
    Write-Host ""
    
    # Eseguire il comando via SSH con sshpass
    wsl sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no "${NasUser}@${NasIP}" "docker load -i $ImagePath; echo ''; echo '=== Immagini Docker disponibili ==='; docker images | grep molino"
    
    $exitCode = $LASTEXITCODE
    
    # Pulire la variabile
    $env:SSHPASS = ""
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "✓ Immagine caricata con successo nel NAS!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prossimo passo: Creare il container dal NAS" -ForegroundColor Cyan
        exit 0
    } else {
        Write-Host ""
        Write-Host "✗ Errore durante il caricamento (codice: $exitCode)" -ForegroundColor Red
    }
} 
catch {
    Write-Host "Errore: $_" -ForegroundColor Red
}

# Se arrivi qui, mostra istruzioni manuali
Write-Host ""
Write-Host "⚠ Esecuzione manuale richiesta:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Apri un terminale PowerShell" -ForegroundColor White
Write-Host "2. Esegui:" -ForegroundColor White
Write-Host "   wsl ssh manuel@192.168.1.248" -ForegroundColor Cyan
Write-Host "3. Inserisci password: Giuseppe@358" -ForegroundColor Cyan
Write-Host "4. Nel terminale NAS, esegui:" -ForegroundColor White
Write-Host "   docker load -i /Container/molino-image.tar" -ForegroundColor Cyan
Write-Host "   docker images" -ForegroundColor Cyan
Write-Host ""
