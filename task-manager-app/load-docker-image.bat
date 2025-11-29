@echo off
REM Script batch per caricare l'immagine Docker nel NAS via PuTTY/plink

setlocal enabledelayedexpansion

set NAS_IP=192.168.1.248
set NAS_USER=admin
set NAS_PASSWORD=visualstudiocode123
set IMAGE_PATH=/Container/molino-image.tar

echo.
echo ============================================
echo Caricamento Immagine Docker nel NAS
echo ============================================
echo IP: %NAS_IP%
echo Utente: %NAS_USER%
echo Percorso: %IMAGE_PATH%
echo.

REM Verifica se plink.exe è nel PATH
where plink.exe >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRORE: plink.exe non trovato nel PATH
    echo.
    echo Soluzione:
    echo 1. Scarica PuTTY da: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html
    echo 2. Installa PuTTY (plink.exe sarà aggiunto al PATH)
    echo 3. Riavvia questo script
    echo.
    pause
    exit /b 1
)

echo Esecuzione: docker load -i %IMAGE_PATH%
echo.

REM Crea file temporaneo con i comandi
set "CMD_FILE=%TEMP%\docker_commands.txt"
(
    echo docker load -i %IMAGE_PATH%
    echo docker images
    echo exit
) > "%CMD_FILE%"

REM Esegui via plink con -batch (non interattivo) e -pw (password)
plink.exe -batch -pw %NAS_PASSWORD% %NAS_USER%@%NAS_IP% < "%CMD_FILE%"

echo.
if errorlevel 1 (
    echo ERRORE: Impossibile connettersi al NAS
    echo Verifica:
    echo - IP NAS: %NAS_IP%
    echo - Utente: %NAS_USER%
    echo - Password corretta
    echo - SSH abilitato nel NAS
) else (
    echo Comando completato con successo!
)

del /f /q "%CMD_FILE%" >nul 2>&1
pause
