# ==========================================================
#  BARBERFIE - start the whole website
#  Usage (from PowerShell):   .\start.ps1
#  Opens one window each for the API and the web server,
#  then opens the homepage in your browser.
# ==========================================================

$root = $PSScriptRoot
$apiDir = Join-Path $root "backend\api-node"
$djangoDir = Join-Path $root "backend\django"

function Stop-Port($port) {
    # Close anything already listening on the port so a fresh copy can start
    $lines = netstat -ano | Select-String ":$port\s+.*LISTENING"
    foreach ($l in $lines) {
        $procId = ($l -split "\s+")[-1]
        if ($procId -match "^\d+$") { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
    }
}

Write-Host ""
Write-Host "  BARBERFIE" -ForegroundColor Yellow
Write-Host "  ---------------------------------------------"

# 1. MySQL (Windows service)
$svc = Get-Service MySQL84 -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Host "  [!] MySQL service not found. Install MySQL and register the MySQL84 service first." -ForegroundColor Red
    exit 1
}
if ($svc.Status -ne "Running") {
    Write-Host "  Starting MySQL..."
    try { Start-Service MySQL84 -ErrorAction Stop } catch {
        Write-Host "  [!] Could not start MySQL. Run this script as administrator once, or start the MySQL84 service from Services." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  [ok] MySQL running on port 3306" -ForegroundColor Green

# 2. Node API on port 4000
Stop-Port 4000
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='BARBERFIE API (port 4000)'; Set-Location '$apiDir'; npm start"
Write-Host "  [ok] API starting on http://localhost:4000" -ForegroundColor Green

# 3. Website on port 5500
Stop-Port 5500
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='BARBERFIE Website (port 5500)'; Set-Location '$root'; npx --yes serve -l 5500 ."
Write-Host "  [ok] Website starting on http://localhost:5500" -ForegroundColor Green

# 4. Django reports (optional, only if Django is installed)
$hasDjango = $false
try { python -c "import django" 2>$null; $hasDjango = ($LASTEXITCODE -eq 0) } catch {}
if ($hasDjango) {
    Stop-Port 8000
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='BARBERFIE Reports (port 8000)'; Set-Location '$djangoDir'; python manage.py runserver 8000"
    Write-Host "  [ok] Django reports starting on http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "  [--] Django reports skipped (not installed; admin reports will be empty)" -ForegroundColor DarkGray
}

# 5. Wait for the API, then open the browser
Write-Host ""
Write-Host "  Waiting for the API..."
$ready = $false
for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
    Start-Sleep -Seconds 1
    try { $r = Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -TimeoutSec 2; $ready = ($r.StatusCode -eq 200) } catch {}
}
if ($ready) { Write-Host "  [ok] API is up" -ForegroundColor Green } else { Write-Host "  [!] API did not answer yet. Check the API window for errors." -ForegroundColor Yellow }

Start-Sleep -Seconds 2
Start-Process "http://localhost:5500"

Write-Host ""
Write-Host "  Website:   http://localhost:5500"
Write-Host "  API:       http://localhost:4000/api/health"
Write-Host "  Admin:     admin@barberfie.com / Password123"
Write-Host ""
Write-Host "  To stop everything run:  .\stop.ps1"
Write-Host ""
