# Estrae i blocchi <style>...</style> inline da una pagina HTML e li appende al file CSS dedicato.
# Uso: .\extract-inline-css.ps1 -Page orders-planner.html
param(
    [Parameter(Mandatory=$true)][string]$Page
)
$ErrorActionPreference = 'Stop'

$htmlPath = Join-Path $PSScriptRoot "public\$Page"
if (-not (Test-Path $htmlPath)) { throw "HTML non trovato: $htmlPath" }

$cssName = ($Page -replace '\.html$','-custom.css')
$cssPath = Join-Path $PSScriptRoot "public\css\$cssName"

$content = Get-Content $htmlPath -Raw
$styleMatches = [regex]::Matches($content, '(?s)<style[^>]*>([\s\S]*?)</style>')
if ($styleMatches.Count -eq 0) {
    Write-Host "[SKIP] $Page : nessun blocco <style> trovato" -ForegroundColor DarkYellow
    return
}

# Verifica link CSS presente
if ($content -notmatch [regex]::Escape("css/$cssName")) {
    throw "ERRORE: $Page non ha <link rel=stylesheet href=css/$cssName>. Aggiungilo prima."
}

# Concatena tutti i blocchi
$cssBlocks = @()
for ($i = 0; $i -lt $styleMatches.Count; $i++) {
    $blk = $styleMatches[$i].Groups[1].Value.Trim()
    if ($styleMatches.Count -gt 1) {
        $cssBlocks += "/* --- blocco $($i+1)/$($styleMatches.Count) --- */`n$blk"
    } else {
        $cssBlocks += $blk
    }
}
$newCssChunk = ($cssBlocks -join "`n`n")

# Crea file CSS se manca
if (-not (Test-Path $cssPath)) {
    Set-Content -Path $cssPath -Value "/* $cssName - creato 28-04-2026 */`n" -Encoding UTF8 -NoNewline
}

$existing = Get-Content $cssPath -Raw
$header = "`n`n/* === Spostato da <style> inline di $Page (28-04-2026) === */`n"
$final = $existing.TrimEnd() + $header + $newCssChunk + "`n"
Set-Content -Path $cssPath -Value $final -NoNewline -Encoding UTF8

# Rimuove i blocchi style dall'HTML
$cleanedHtml = [regex]::Replace($content, '(?s)\s*<style[^>]*>[\s\S]*?</style>\s*', "`n")
Set-Content -Path $htmlPath -Value $cleanedHtml -NoNewline -Encoding UTF8

$htmlKb = [math]::Round((Get-Item $htmlPath).Length/1KB, 2)
$cssKb  = [math]::Round((Get-Item $cssPath).Length/1KB, 2)
$remaining = (Select-String -Path $htmlPath -Pattern '</?style' -AllMatches).Matches.Count
Write-Host "[OK] $Page -> $cssName  | HTML $htmlKb KB | CSS $cssKb KB | style residui: $remaining" -ForegroundColor Green
