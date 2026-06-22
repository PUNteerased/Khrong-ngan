# Install ESP32QRCodeReader for Arduino IDE (Windows)
# Detects sketchbook libraries folder (OneDrive vs Documents).
#
# Run: powershell -ExecutionPolicy Bypass -File install-qrcode-lib.ps1

$ErrorActionPreference = "Stop"

function Get-ArduinoLibrariesRoot {
    $candidates = @(
        (Join-Path $env:USERPROFILE "OneDrive\Documents\Arduino\libraries"),
        (Join-Path $env:USERPROFILE "Documents\Arduino\libraries")
    )
    foreach ($path in $candidates) {
        $parent = Split-Path $path -Parent
        if ((Test-Path $path) -and (Get-ChildItem $path -Directory -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) {
            return $path
        }
        if (Test-Path $parent) {
            return $path
        }
    }
    return $candidates[1]
}

$zipUrl = "https://github.com/hardwareliberopinerolo/ESP32QRCodeReader/archive/refs/heads/master.zip"
$libName = "ESP32QRCodeReader"
$destRoot = Get-ArduinoLibrariesRoot
$destDir = Join-Path $destRoot $libName
$tempZip = Join-Path $env:TEMP "ESP32QRCodeReader-master.zip"
$tempExtract = Join-Path $env:TEMP "ESP32QRCodeReader-install"

Write-Host "LaneYa - install $libName for Arduino IDE"
Write-Host "Libraries folder: $destRoot"
Write-Host "Target: $destDir"

New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
if (Test-Path $destDir) {
    Write-Host "Removing old $libName ..."
    Remove-Item -Recurse -Force $destDir
}
if (Test-Path $tempExtract) {
    Remove-Item -Recurse -Force $tempExtract
}

Write-Host "Downloading ..."
Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing

Write-Host "Extracting ..."
Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

$srcFolder = Join-Path $tempExtract "ESP32QRCodeReader-master"
if (-not (Test-Path (Join-Path $srcFolder "library.properties"))) {
    Write-Error "library.properties not found - download may be corrupt"
}

Move-Item -Path $srcFolder -Destination $destDir

$includeDir = Join-Path $destDir "include"
$srcDir = Join-Path $destDir "src"
if ((Test-Path $includeDir) -and (Test-Path $srcDir)) {
    Copy-Item (Join-Path $includeDir "*.h") $srcDir -Force
}

$patchScript = Join-Path $PSScriptRoot "patch-qrcode-lib.ps1"
if (Test-Path $patchScript) {
    & $patchScript -LibDir $destDir
}

Remove-Item -Force $tempZip -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $tempExtract -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "OK - installed to:"
Write-Host "  $destDir"
Write-Host ""
Write-Host "Next: restart Arduino IDE, upload esp32-cam-laneya.ino"
Write-Host 'Serial should show: [qr] ESP32QRCodeReader ready'
