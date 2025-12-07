# Script per aggiornare automaticamente la versione in tutti i file HTML
# Uso: .\update-version.ps1 -Version "1.0.16"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$date = Get-Date -Format "dd/MM/yyyy"

Write-Host "🔄 Aggiornamento versione a v$Version ($date)..." -ForegroundColor Cyan

# File da aggiornare
$files = @(
    @{
        Path = "public\index.html"
        Pattern = 'v\d+\.\d+\.\d+ • \d{2}/\d{2}/\d{4}'
        Replace = "v$Version • $date"
    },
    @{
        Path = "public\admin-dashboard.html"
        Pattern = '<div class="version-badge">v\d+\.\d+\.\d+</div>'
        Replace = "<div class=`"version-badge`">v$Version</div>"
    },
    @{
        Path = "public\operator-dashboard.html"
        Pattern = '<div class="version-badge">v\d+\.\d+\.\d+</div>'
        Replace = "<div class=`"version-badge`">v$Version</div>"
    }
)

foreach ($file in $files) {
    $fullPath = Join-Path $PSScriptRoot $file.Path
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        if ($content -match $file.Pattern) {
            $content = $content -replace $file.Pattern, $file.Replace
            Set-Content $fullPath $content -NoNewline
            Write-Host "  ✅ $($file.Path) aggiornato" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️ $($file.Path) - pattern non trovato" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ $($file.Path) non trovato" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Versione aggiornata a v$Version" -ForegroundColor Green
Write-Host ""
Write-Host "Ora puoi eseguire:" -ForegroundColor Cyan
Write-Host "  docker build -t task-manager-nas:$Version -f Dockerfile ." -ForegroundColor White
