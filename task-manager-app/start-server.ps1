#!/usr/bin/env pwsh

# Script per avviare e mantenere il server Node.js attivo

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Imposta variabili d'ambiente
$env:DATABASE_URL = 'file:./server/prisma/data/tasks.db'
$env:JWT_SECRET = '***REDACTED_JWT_SECRET***'
$env:PORT = '5000'

Write-Host "🚀 Avviando server Task Manager..." -ForegroundColor Green
Write-Host "📂 Directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "🔧 DATABASE_URL: $env:DATABASE_URL" -ForegroundColor Yellow

npm start
