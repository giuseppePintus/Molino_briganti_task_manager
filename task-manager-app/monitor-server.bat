@echo off
REM Script per mantenere il server Node attivo su Windows
REM Controlla ogni 30 secondi se il server è vivo, altrimenti lo riavvia

setlocal enabledelayedexpansion
set "APP_DIR=C:\Users\manue\Molino_briganti_task_manager\task-manager-app"
set "LOG_FILE=%APP_DIR%\server-monitor.log"

echo [%date% %time%] Monitor avviato >> "%LOG_FILE%"

:monitor_loop
REM Verifica se il server è in ascolto sulla porta 5000
netstat -ano | findstr ":5000" > nul
if errorlevel 1 (
    echo [%date% %time%] Server non trovato - Riavvio... >> "%LOG_FILE%"
    taskkill /IM node.exe /F 2>nul
    timeout /t 2 /nobreak
    cd /d "%APP_DIR%"
    start /b node server/dist/index.js
    timeout /t 10 /nobreak
) else (
    echo [%date% %time%] Server OK >> "%LOG_FILE%"
)

timeout /t 30 /nobreak
goto monitor_loop
