# ==========================================================
#  BARBERFIE - share the running site with a public link
#  Usage (from PowerShell):   .\share.ps1
#  Needs the site running first (.\start.ps1). Prints a
#  https://....trycloudflare.com link that works anywhere
#  for as long as this window stays open.
# ==========================================================

$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
    foreach ($p in "C:\Program Files (x86)\cloudflared\cloudflared.exe", "C:\Program Files\cloudflared\cloudflared.exe") {
        if (Test-Path $p) { $cf = $p; break }
    }
} else { $cf = $cf.Source }
if (-not $cf) {
    Write-Host "  [!] cloudflared is not installed. Run:  winget install Cloudflare.cloudflared" -ForegroundColor Red
    exit 1
}

# Make sure the API (which also serves the pages) is up
try { Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -TimeoutSec 3 | Out-Null }
catch { Write-Host "  [!] The site is not running. Run .\start.ps1 first." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  Creating a public link for http://localhost:4000 ..." -ForegroundColor Yellow
Write-Host "  Keep this window open while sharing. Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

# cloudflared prints the URL on stderr; watch for it and show it clearly
& $cf tunnel --url http://localhost:4000 2>&1 | ForEach-Object {
    $line = "$_"
    if ($line -match "https://[a-z0-9-]+\.trycloudflare\.com") {
        $url = $Matches[0]
        Write-Host ""
        Write-Host "  =============================================" -ForegroundColor Green
        Write-Host "   Share this link:  $url" -ForegroundColor Green
        Write-Host "  =============================================" -ForegroundColor Green
        Write-Host ""
        Set-Clipboard -Value $url -ErrorAction SilentlyContinue
        Write-Host "  (copied to your clipboard)" -ForegroundColor DarkGray
        Write-Host ""
    }
}
