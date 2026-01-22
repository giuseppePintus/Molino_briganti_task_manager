# Script per aggiornare backup-management.html sul container Docker NAS

$sourceFile = "C:\Users\manue\Molino_briganti_task_manager\task-manager-app\public\backup-management.html"
$nasHost = "admin@192.168.1.248"
$password = "***REDACTED_NAS_PASSWORD***"
$containerName = "molino-task-manager-nas"

Write-Host "Caricamento file sul container Docker..." -ForegroundColor Cyan

# Leggi il contenuto del file
$content = Get-Content $sourceFile -Raw

# Crea un file temporaneo locale
$tempFile = [System.IO.Path]::GetTempFileName()
$content | Out-File -FilePath $tempFile -Encoding utf8 -NoNewline

# Usa scp per copiare nel container via docker cp
Write-Host "Copiando file nel container..." -ForegroundColor Yellow
& scp $tempFile "${nasHost}:/share/Public/backup-temp.html"

if ($LASTEXITCODE -eq 0) {
    Write-Host "File copiato sul NAS" -ForegroundColor Green
    
    # Copia dal NAS al container Docker
    echo $password | ssh $nasHost "/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker cp /share/Public/backup-temp.html ${containerName}:/app/public/backup-management.html"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "File aggiornato nel container!" -ForegroundColor Green
        
        # Pulizia
        echo $password | ssh $nasHost "rm /share/Public/backup-temp.html"
        Write-Host "File temporaneo rimosso" -ForegroundColor Gray
    } else {
        Write-Host "Errore copia nel container" -ForegroundColor Red
    }
} else {
    Write-Host "Errore caricamento su NAS" -ForegroundColor Red
}

# Rimuovi file temporaneo locale
Remove-Item $tempFile -Force

Write-Host "Aggiornamento completato! Ricarica la pagina con CTRL+F5" -ForegroundColor Cyan
