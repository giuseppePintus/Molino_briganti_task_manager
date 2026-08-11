[CmdletBinding()]
param(
    [string]$ApkPath = (Join-Path $PSScriptRoot 'android-inventory-app\operatorlite\build\outputs\apk\debug\OperatorLite-v1.0.0-debug.apk'),
    [string[]]$TabletIps,
    [ValidateSet('shadow', 'prod')]
    [string]$Environment = 'shadow',
    [int]$AdbPort = 5555,
    [switch]$PrepareUsb,
    [switch]$ConnectOnly,
    [string]$TabletIp,
    [string]$TabletIpFile = (Join-Path $PSScriptRoot 'tablet-ips.txt'),
    [string]$RegistryPath = (Join-Path $PSScriptRoot 'tablet-registry.json')
)

$ErrorActionPreference = 'Stop'

function Get-ResolvedTabletTargets {
    param(
        [Parameter(Mandatory)] [string]$TargetEnvironment
    )

    if ($TabletIps -and $TabletIps.Count -gt 0) {
        return $TabletIps | ForEach-Object {
            [PSCustomObject]@{
                Name       = $_
                Ip         = $_
                Environment = $TargetEnvironment
            }
        }
    }

    if ($TabletIp) {
        return @([PSCustomObject]@{
            Name        = $TabletIp
            Ip          = $TabletIp
            Environment = $TargetEnvironment
        })
    }

    if (Test-Path $RegistryPath) {
        $registry = Get-Content -Path $RegistryPath -Raw | ConvertFrom-Json
        $entries = @($registry.tablets)
        $selected = $entries | Where-Object { $_.enabled -ne $false }

        if ($selected.Count -gt 0) {
            $resolved = foreach ($entry in $selected) {
                $ip = $null
                if ($TargetEnvironment -eq 'shadow' -and $entry.shadowIp) {
                    $ip = $entry.shadowIp
                } elseif ($TargetEnvironment -eq 'prod' -and $entry.prodIp) {
                    $ip = $entry.prodIp
                }

                if (-not $ip) { continue }

                [PSCustomObject]@{
                    Name        = $entry.name
                    Mac         = $entry.mac
                    Ip          = $ip
                    Environment = $TargetEnvironment
                }
            }

            if ($resolved.Count -gt 0) {
                return $resolved
            }
        }
    }

    if (Test-Path $TabletIpFile) {
        return Get-Content -Path $TabletIpFile | ForEach-Object { $_.Trim() } | Where-Object { $_ } | ForEach-Object {
            [PSCustomObject]@{
                Name        = $_
                Ip          = $_
                Environment = $TargetEnvironment
            }
        }
    }

    throw 'Specifica -TabletIp, -TabletIps oppure crea tablet-registry.json / tablet-ips.txt nella root del workspace.'
}

function Test-AdbAvailable {
    if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
        throw 'adb non trovato nel PATH. Installa Android Platform Tools o aggiungi adb al PATH.'
    }
}

function Invoke-AdbCommand {
    param(
        [Parameter(Mandatory)] [string[]]$Arguments,
        [switch]$IgnoreExitCode
    )

    & adb @Arguments
    if (-not $IgnoreExitCode -and $LASTEXITCODE -ne 0) {
        throw "adb $($Arguments -join ' ') fallito con exit code $LASTEXITCODE"
    }
}

Test-AdbAvailable

if (-not (Test-Path $ApkPath)) {
    throw "APK non trovato: $ApkPath"
}

$resolvedTargets = Get-ResolvedTabletTargets -TargetEnvironment $Environment

Write-Host '=== Operator Lite Wi-Fi deploy ===' -ForegroundColor Cyan
Write-Host "APK: $ApkPath" -ForegroundColor Cyan
Write-Host "Ambiente: $Environment" -ForegroundColor Cyan
$targetNames = $resolvedTargets | ForEach-Object { $_.Name } | Select-Object -Unique
Write-Host "Tablet: $($targetNames -join ', ')" -ForegroundColor Cyan
Write-Host "Porta ADB: $AdbPort" -ForegroundColor Cyan

if ($PrepareUsb) {
    Write-Host ''
    Write-Host '[PREP] Esegui questa modalità con un tablet collegato via USB e debugging abilitato.' -ForegroundColor Yellow
    Invoke-AdbCommand -Arguments @('tcpip', "$AdbPort")
    Write-Host "[OK] Tablet messo in ascolto su TCP/IP porta $AdbPort" -ForegroundColor Green
    return
}

foreach ($target in $resolvedTargets) {
    $endpoint = "$($target.Ip)`:$AdbPort"

    Write-Host ''
    if ($target.Name -and $target.Name -ne $target.Ip) {
        Write-Host "[CONNECT] $($target.Name) -> $endpoint" -ForegroundColor Yellow
    } else {
        Write-Host "[CONNECT] $endpoint" -ForegroundColor Yellow
    }
    Invoke-AdbCommand -Arguments @('connect', $endpoint) -IgnoreExitCode

    if (-not $ConnectOnly) {
        Write-Host "[INSTALL] $endpoint" -ForegroundColor Yellow
        Invoke-AdbCommand -Arguments @('-s', $endpoint, 'install', '-r', $ApkPath)
        Write-Host "[OK] Installato su $endpoint" -ForegroundColor Green
    } else {
        Write-Host "[OK] Connessione OK su $endpoint (modalità connect-only)" -ForegroundColor Green
    }
}

Write-Host ''
Write-Host '[DONE] Operazione completata.' -ForegroundColor Cyan