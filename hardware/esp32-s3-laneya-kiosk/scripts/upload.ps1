# LaneYa ESP32-S3 — build & upload (Windows)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Invoke-PlatformIO {
    param([string[]]$Args)

    if (Get-Command pio -ErrorAction SilentlyContinue) {
        & pio @Args
        return $LASTEXITCODE
    }
    if (Get-Command platformio -ErrorAction SilentlyContinue) {
        & platformio @Args
        return $LASTEXITCODE
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        & python -m platformio @Args
        return $LASTEXITCODE
    }
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -m platformio @Args
        return $LASTEXITCODE
    }

    Write-Host ""
    Write-Host "ไม่พบ PlatformIO CLI" -ForegroundColor Red
    Write-Host "ติดตั้งด้วย: pip install platformio"
    Write-Host "หรือใช้ extension PlatformIO IDE ใน Cursor / VS Code"
    Write-Host "หรือเปิดไฟล์ .ino ใน Arduino IDE (โฟลเดอร์ arduino-ide/)"
    return 1
}

if (-not (Test-Path "include\config.h")) {
    Copy-Item "include\config.example.h" "include\config.h"
    Write-Host "สร้าง include\config.h แล้ว — แก้ WiFi และ KIOSK_HEARTBEAT_SECRET ก่อน upload" -ForegroundColor Yellow
}

Write-Host "Building & uploading ESP32-S3 firmware..." -ForegroundColor Cyan
$code = Invoke-PlatformIO @("run", "-t", "upload")
exit $code
