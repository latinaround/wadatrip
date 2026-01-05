Write-Host " Starting Wadatrip backend (dev mode)..."

# --- CONFIG ---
$basePath = "C:\Projects\wadatrip\wadatrip\wadatrip-platform"
$services = @(
    @{ name = "itineraries"; port = 3011; cmd = "yarn dev:itineraries" },
    @{ name = "pricing"; port = 3012; cmd = "yarn dev:pricing" },
    @{ name = "alerts"; port = 3013; cmd = "yarn dev:alerts" },
    @{ name = "provider-hub"; port = 3014; cmd = "yarn dev:provider-hub" },
    @{ name = "payments"; port = 3016; cmd = "yarn dev:payments" },
    @{ name = "gateway"; port = 3015; cmd = "yarn start:gateway" },
    @{ name = "web"; port = 5173; cmd = "yarn workspace @wadatrip/web dev -- --host 0.0.0.0 --port 5173 --clearScreen false"; healthPath = "/"; requireOk = $false }
)

# --- CLEANUP ---
Write-Host " Cleaning old processes and logs..."
foreach ($svc in $services) {
    $port = $svc.port
    try {
        $proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($proc) {
            $pid = $proc.OwningProcess
            Write-Host "Stopping process on port $port (PID $pid)..."
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
    } catch { }
}
if (Test-Path "$basePath/logs") { Remove-Item -Recurse -Force "$basePath/logs" }

# --- START SERVICES ---
foreach ($svc in $services) {
    $name = $svc.name
    $port = $svc.port
    $cmd  = $svc.cmd
    $healthPath = if ($svc.ContainsKey("healthPath")) { $svc.healthPath } else { "/health" }
    $requireOk = if ($svc.ContainsKey("requireOk")) { [bool]$svc.requireOk } else { $true }

    Write-Host "`n▶ Starting $name on port $port..."

    Start-Job -ScriptBlock {
        param($cmd, $path)
        Set-Location $path
        Invoke-Expression $cmd
    } -ArgumentList $cmd, $basePath | Out-Null

    # Health check
    $url = "http://localhost:$port$healthPath"
    $maxRetries = 15
    for ($i=0; $i -lt $maxRetries; $i++) {
        Start-Sleep -Seconds 2
        try {
            $response = Invoke-RestMethod -Uri $url -TimeoutSec 2 -ErrorAction Stop
            if (-not $requireOk) {
                Write-Host "✅ $name service ready at $url"
                break
            }

            if ($response -is [System.Collections.IDictionary] -and $response.Contains("ok") -and $response.ok -eq $true) {
                Write-Host "✅ $name service ready at $url"
                break
            }
        } catch { }
        if ($i -eq ($maxRetries - 1)) {
            Write-Host "⚠️  $name did not respond after $maxRetries retries."
        }
    }
}

Write-Host "`n✅ All Wadatrip backend services started successfully!"
