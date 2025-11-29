# Script per caricare l'immagine Docker nel NAS via SSH

$nasIP = "192.168.1.248"
$nasUser = "manuel"
$nasPassword = "Giuseppe@358"
$imageFile = "molino-image.tar"
$imagePath = "/share/$imageFile"

# Installare plink se necessario (parte di PuTTY)
# https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html

Write-Host "Caricamento dell'immagine Docker nel NAS..." -ForegroundColor Green
Write-Host "NAS: $nasIP"
Write-Host "File: $imageFile"
Write-Host ""

# Verificare se il file esiste localmente
if (-not (Test-Path $imageFile)) {
    Write-Host "Errore: $imageFile non trovato nella directory corrente!" -ForegroundColor Red
    exit 1
}

# Metodo 1: Tentare con scp (se OpenSSH è installato su Windows 10+)
Write-Host "Tentativo 1: Copia file con scp..." -ForegroundColor Yellow

# Creare un file temporaneo con la password per scp
$sshKeyFile = "$env:USERPROFILE\.ssh\id_rsa"

# Provare direttamente (richiederà password manuale o key)
try {
    # Primo tentativo: copiare il file
    Write-Host "Copiando $imageFile nel NAS..."
    
    # Usare expect.exe se disponibile, altrimenti richiedere input
    $process = Start-Process -FilePath "scp" `
        -ArgumentList "-o StrictHostKeyChecking=no -o BatchMode=no $imageFile ${nasUser}@${nasIP}:/share/" `
        -NoNewWindow -Wait -PassThru
    
    if ($process.ExitCode -eq 0) {
        Write-Host "File copiato con successo!" -ForegroundColor Green
    } else {
        Write-Host "Errore nella copia (codice: $($process.ExitCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "scp non disponibile o errore: $_" -ForegroundColor Yellow
}

# Metodo 2: Usare uno script bash/sh con expect
Write-Host ""
Write-Host "Tentativo 2: Usare script bash con expect (se disponibile nel NAS)..." -ForegroundColor Yellow

# Questo sarebbe il comando ideale se potessimo eseguirlo direttamente
Write-Host "Comando da eseguire manualmente nel NAS:" -ForegroundColor Cyan
Write-Host "  ssh $nasUser@$nasIP" -ForegroundColor White
Write-Host "  docker load -i $imagePath" -ForegroundColor White
Write-Host "  docker images | grep molino" -ForegroundColor White
Write-Host ""

Write-Host "Alternativa (se il file è già nel NAS):" -ForegroundColor Cyan
Write-Host "  Usa QNAP Web UI → File Station per verificare che il file sia in /share/" -ForegroundColor White
Write-Host "  Poi: docker load -i /share/$imageFile" -ForegroundColor White
