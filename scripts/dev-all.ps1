# Starts local dev stack with .env loaded and migration applied
# Usage (desde la raíz del repo):  .\scripts\dev-all.ps1
# Opciones: -Migrate:$false  -ForceKill

param(
  [switch]$Migrate = $true,
  [switch]$ForceKill
)

Write-Host "[dev-all] Setting NODE_OPTIONS to load .env via dotenv" -ForegroundColor Cyan
$env:NODE_OPTIONS = "-r dotenv/config"

# (Opcional) fuerza IPv4 para Docker Desktop/Windows
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/wadatrip?schema=public' }
if (-not $env:REDIS_URL)    { $env:REDIS_URL    = 'redis://127.0.0.1:6379' }

if ($Migrate) {
  Write-Host "[dev-all] Prisma generate + migrate" -ForegroundColor Cyan
  yarn prisma:generate
  if ($LASTEXITCODE -ne 0) { Write-Error "prisma:generate failed"; exit 1 }
  yarn prisma:migrate
  if ($LASTEXITCODE -ne 0) { Write-Error "prisma:migrate failed"; exit 1 }
}

function Test-PortInUse($port) {
  try {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    return $null -ne $conn
  } catch { return $false }
}

function Kill-Port($port) {
  try {
    $procs = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
    if ($procs) {
      foreach ($pid in $procs) {
        try {
          Write-Warning ("[dev-all] Killing PID {0} on port {1}" -f $pid, $port)
          Stop-Process -Id $pid -Force -ErrorAction Stop
        } catch {
          Write-Warning ("[dev-all] Failed to kill PID {0}: {1}" -f $pid, $_)
        }
      }
      Start-Sleep -Milliseconds 500
    }
  } catch {
    Write-Warning ("[dev-all] Kill-Port error on {0}: {1}" -f $port, $_)
  }
}

function Start-ServiceWindow($title, $cmd) {
  $ps = "`$env:NODE_OPTIONS='-r dotenv/config'; $cmd"
  Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit -Command $ps" -WindowStyle Normal
  Write-Host "[dev-all] Started $title" -ForegroundColor Green
}

function Start-ServiceIfFree($title, $cmd, $port) {
  if (Test-PortInUse $port) {
    if ($ForceKill) { Kill-Port $port }
  }
  if (Test-PortInUse $port) {
    Write-Warning ("[dev-all] Port {0} in use; skipping {1}" -f $port, $title)
  } else {
    Start-ServiceWindow $title $cmd
  }
}

function Resolve-FreePort($preferred, $tries = 10) {
  $p = [int]$preferred
  for ($i = 0; $i -lt $tries; $i++) {
    if (-not (Test-PortInUse $p)) { return $p }
    $p++
  }
  return [int]$preferred
}

# Decide Gateway port (3000 or next free). If -ForceKill, try to free 3000 first
$gwPort = 3000
if (Test-PortInUse 3000) {
  if ($ForceKill) { Kill-Port 3000 }
}
if (Test-PortInUse 3000) {
  $gwPort = Resolve-FreePort 3000 10
  Write-Warning ("[dev-all] Using alternate Gateway port {0}" -f $gwPort)
}

Start-ServiceIfFree "pricing"      "`$env:PORT='3012'; yarn dev:pricing"     3012
Start-ServiceIfFree "itineraries"  "`$env:PORT='3011'; yarn dev:itineraries" 3011
Start-ServiceIfFree "alerts"       "`$env:PORT='3013'; `$env:GATEWAY_URL='http://127.0.0.1:$gwPort'; yarn dev:alerts"      3013
Start-ServiceIfFree "provider-hub" "`$env:PORT='3014'; yarn dev:provider-hub" 3014
Start-ServiceIfFree "gateway"      "`$env:PORT='$gwPort'; yarn dev:gateway"     $gwPort

Write-Host "[dev-all] All services started in separate PowerShell windows." -ForegroundColor Cyan
Write-Host ("Gateway:     http://127.0.0.1:{0}/docs" -f $gwPort)
Write-Host "Itineraries: http://127.0.0.1:3011/health"
Write-Host "Pricing:     http://127.0.0.1:3012"
Write-Host "Alerts:      http://127.0.0.1:3013"
