# Script PowerShell per caricare l'immagine Docker nel NAS

$NasIP = "192.168.1.248"
$NasUser = "manuel"
$NasPassword = "Giuseppe@358"
$ImagePath = "/Container/molino-image.tar"

Write-Host "Caricamento Immagine Docker nel NAS" -ForegroundColor Cyan
Write-Host "IP: $NasIP, Utente: $NasUser" -ForegroundColor White
Write-Host ""

# Impostare la variabile di ambiente per sshpass
$env:SSHPASS = $NasPassword

# Eseguire il comando
wsl sshpass -e ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PubkeyAuthentication=no "$NasUser@$NasIP" "docker load -i $ImagePath; docker images | grep molino"

$exitCode = $LASTEXITCODE
$env:SSHPASS = ""

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "Successo! Immagine caricata nel NAS" -ForegroundColor Green
} else {
    Write-Host "Errore durante il caricamento (codice: $exitCode)" -ForegroundColor Red
}
