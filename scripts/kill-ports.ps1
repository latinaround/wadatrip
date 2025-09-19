param(
  [Parameter(Mandatory=$true)] [int[]]$Ports,
  [switch]$Force
)

function Show-PortOwners($port) {
  $conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if (!$conns) { Write-Host "Port $port: free"; return }
  $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pid in $pids) {
    try { $p = Get-Process -Id $pid -ErrorAction Stop; Write-Host ("Port {0}: PID {1} ({2})" -f $port, $pid, $p.ProcessName) }
    catch { Write-Host ("Port {0}: PID {1}" -f $port, $pid) }
  }
}

foreach ($port in $Ports) { Show-PortOwners $port }

if ($Force) {
  foreach ($port in $Ports) {
    $conns = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($conns) {
      $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
      foreach ($pid in $pids) {
        try { Write-Warning "Killing PID $pid on port $port"; Stop-Process -Id $pid -Force -ErrorAction Stop }
        catch { Write-Warning "Failed to kill PID $pid: $_" }
      }
    }
  }
}

