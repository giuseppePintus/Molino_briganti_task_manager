# Deploy Script for Molino Task Manager - PowerShell Version
# Usage: .\deploy-to-nas.ps1 -NasIP 192.168.1.248 -NasUser root -NasPassword "QNAP1234!@"

param(
    [Parameter(Mandatory=$false)]
    [string]$NasIP = "192.168.1.248",
    
    [Parameter(Mandatory=$false)]
    [string]$NasUser = "root",
    
    [Parameter(Mandatory=$false)]
    [string]$NasPassword = "",
    
    [Parameter(Mandatory=$false)]
    [string]$NasPath = "/nas/molino/app",
    
    [Parameter(Mandatory=$false)]
    [string]$LocalPath = (Get-Location).Path
)

Write-Host "🚀 Molino Task Manager - NAS Deployment (PowerShell)" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📍 Configuration:" -ForegroundColor Yellow
Write-Host "   NAS IP: $NasIP"
Write-Host "   NAS User: $NasUser"
Write-Host "   Local: $LocalPath"
Write-Host "   Remote: $NasPath"
Write-Host ""

# Check if public.zip exists
$zipFile = Join-Path $LocalPath "public.zip"
if (-not (Test-Path $zipFile)) {
    Write-Host "❌ Error: public.zip not found in $LocalPath" -ForegroundColor Red
    Write-Host "   Please run first:" -ForegroundColor Yellow
    Write-Host "   Compress-Archive -Path public -DestinationPath public.zip -Force"
    exit 1
}

$fileSize = (Get-Item $zipFile).Length / 1MB
Write-Host "📦 Archive: public.zip ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
Write-Host ""

# Method 1: Try SFTP
Write-Host "🔄 Attempting deployment via SFTP..." -ForegroundColor Cyan

# Create SFTP commands file
$sftpCommands = @(
    "put `"$zipFile`" $NasPath/public.zip",
    "bye"
) -join "`n"

$sftpFile = "$env:TEMP\sftp_commands_$([DateTime]::Now.Ticks).txt"
Set-Content -Path $sftpFile -Value $sftpCommands -Encoding ASCII

try {
    Write-Host "   Connecting to $NasUser@$NasIP..."
    
    if ([string]::IsNullOrEmpty($NasPassword)) {
        Write-Host "   Using SSH keys..." -ForegroundColor Yellow
        $output = & sftp -b $sftpFile "${NasUser}@${NasIP}" 2>&1
    } else {
        Write-Host "   Using provided credentials..." -ForegroundColor Yellow
        # For SFTP with password, we need to use sshpass or similar
        # PowerShell doesn't have built-in password input for SFTP
        Write-Host "   ⚠️  Warning: SFTP password auth requires additional tools (sshpass, etc.)" -ForegroundColor Yellow
        $output = & sftp -b $sftpFile "${NasUser}@${NasIP}" 2>&1
    }
    
    if ($output -match "Bye|bye|Successfully|100%") {
        Write-Host "✅ File uploaded successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔧 Extracting on NAS..." -ForegroundColor Cyan
        
        $extractCmd = "cd $NasPath && unzip -o public.zip && chmod -R 755 public/ && echo 'Extraction complete'"
        $output = & ssh "${NasUser}@${NasIP}" $extractCmd 2>&1
        
        Write-Host "✅ Deployment complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔄 Restarting Docker container..." -ForegroundColor Cyan
        & ssh "${NasUser}@${NasIP}" "cd $NasPath && docker-compose restart web" 2>&1 | Select-Object -Last 5
        
        exit 0
    }
} catch {
    Write-Host "⚠️  SFTP deployment failed: $_" -ForegroundColor Yellow
} finally {
    Remove-Item -Path $sftpFile -Force -ErrorAction SilentlyContinue
}

# Manual deployment instructions
Write-Host ""
Write-Host "⚠️  Automatic deployment failed. Please deploy manually:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1️⃣  Copy public.zip to NAS:" -ForegroundColor Cyan
Write-Host "   sftp $NasUser@$NasIP"
Write-Host "   put public.zip $NasPath/"
Write-Host "   bye"
Write-Host ""
Write-Host "2️⃣  Extract on NAS:" -ForegroundColor Cyan
Write-Host "   ssh $NasUser@$NasIP"
Write-Host "   cd $NasPath"
Write-Host "   unzip -o public.zip"
Write-Host "   chmod -R 755 public/"
Write-Host "   exit"
Write-Host ""
Write-Host "3️⃣  Restart Docker:" -ForegroundColor Cyan
Write-Host "   ssh $NasUser@$NasIP 'cd $NasPath && docker-compose restart web'"
Write-Host ""
