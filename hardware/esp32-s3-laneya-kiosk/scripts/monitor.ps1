# Serial monitor — 115200 baud
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (Get-Command pio -ErrorAction SilentlyContinue) {
    pio device monitor
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python -m platformio device monitor
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    py -m platformio device monitor
} else {
    Write-Host "ติดตั้ง PlatformIO: pip install platformio" -ForegroundColor Red
    exit 1
}
