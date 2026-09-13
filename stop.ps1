# ==========================================================
#  BARBERFIE - stop the API and web server
#  Usage (from PowerShell):   .\stop.ps1
#  MySQL keeps running as a Windows service.
# ==========================================================

function Stop-Port($port, $name) {
    $lines = netstat -ano | Select-String ":$port\s+.*LISTENING"
    if (-not $lines) { Write-Host "  [--] $name was not running" -ForegroundColor DarkGray; return }
    foreach ($l in $lines) {
        $procId = ($l -split "\s+")[-1]
        if ($procId -match "^\d+$") { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
    }
    Write-Host "  [ok] $name stopped" -ForegroundColor Green
}

Write-Host ""
Stop-Port 4000 "API"
Stop-Port 5500 "Website"
Stop-Port 8000 "Django reports"
Write-Host ""
