$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Invoke-PlatformIO {
    param([string[]]$Args)

    if (Get-Command pio -ErrorAction SilentlyContinue) { & pio @Args; return $LASTEXITCODE }
    if (Get-Command platformio -ErrorAction SilentlyContinue) { & platformio @Args; return $LASTEXITCODE }
    if (Get-Command python -ErrorAction SilentlyContinue) { & python -m platformio @Args; return $LASTEXITCODE }
    if (Get-Command py -ErrorAction SilentlyContinue) { & py -m platformio @Args; return $LASTEXITCODE }
    return 1
}

Invoke-PlatformIO @("device", "monitor")
