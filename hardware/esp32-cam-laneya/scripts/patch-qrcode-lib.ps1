# Patch ESP32QRCodeReader for ESP32 Arduino core 3.x
param(
    [Parameter(Mandatory = $true)]
    [string]$LibDir
)

$collections = Join-Path $LibDir "src\openmv\collections.c"
$decode = Join-Path $LibDir "src\quirc\decode.c"

if (-not (Test-Path $collections)) {
    Write-Error "collections.c not found under $LibDir"
}

function Set-IncludesAfterCollectionsHeader {
    param([string]$Path)
    $c = Get-Content $Path -Raw
    $block = @'
#include "collections.h"
#include <stdlib.h>
#include <string.h>
#include <Arduino.h>

'@
    if ($c -match '#include <esp32-hal-psram\.h>') {
        $c = $c -replace '#include <esp32-hal-psram\.h>\r?\n', "#include <Arduino.h>`n"
        Set-Content -Path $Path -Value $c -NoNewline
        Write-Host "Updated $Path (esp32-hal-psram.h -> Arduino.h)"
        return
    }
    if ($c -notmatch '#include <Arduino\.h>') {
        $c = $c -replace '#include "collections.h"\r?\n', $block
        Set-Content -Path $Path -Value $c -NoNewline
        Write-Host "Patched $Path"
    }
}

function Set-IncludesAfterQuircInternal {
    param([string]$Path)
    $d = Get-Content $Path -Raw
    if ($d -match '#include <esp32-hal-psram\.h>') {
        $d = $d -replace '#include <esp32-hal-psram\.h>\r?\n', "#include <Arduino.h>`n"
        Set-Content -Path $Path -Value $d -NoNewline
        Write-Host "Updated $Path (esp32-hal-psram.h -> Arduino.h)"
        return
    }
    if ($d -notmatch '#include <Arduino\.h>') {
        $d = $d -replace '#include <stdlib.h>\r?\n', "#include <stdlib.h>`n#include <Arduino.h>`n"
        Set-Content -Path $Path -Value $d -NoNewline
        Write-Host "Patched $Path"
    }
}

Set-IncludesAfterCollectionsHeader -Path $collections
Set-IncludesAfterQuircInternal -Path $decode

Write-Host "OK - $LibDir"
