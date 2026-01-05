#!/bin/bash
set -e

echo " Starting Wadatrip backend (dev mode)..."

BASE_PATH="$(pwd)"
LOGS_DIR="$BASE_PATH/logs"

# Configuration: service name, port, and yarn command
declare -A SERVICES=(
  ["itineraries"]="3011 yarn dev:itineraries"
  ["pricing"]="3012 yarn dev:pricing"
  ["alerts"]="3013 yarn dev:alerts"
  ["provider-hub"]="3014 yarn dev:provider-hub"
  ["payments"]="3016 yarn dev:payments"
  ["gateway"]="3015 yarn start:gateway"
  ["web"]="5173 yarn workspace @wadatrip/web dev -- --host 0.0.0.0 --port 5173 --clearScreen false"
)

# Cleanup
echo " Cleaning old processes and logs..."
for name in "${!SERVICES[@]}"; do
  port=$(echo "${SERVICES[$name]}" | awk '{print $1}')
  pid=$(lsof -t -i:$port || true)
  if [ ! -z "$pid" ]; then
    echo "Stopping $name (port $port, PID $pid)..."
    kill -9 $pid || true
  fi
done

[ -d "$LOGS_DIR" ] && rm -rf "$LOGS_DIR"

# Start services
for name in "${!SERVICES[@]}"; do
  port=$(echo "${SERVICES[$name]}" | awk '{print $1}')
  cmd=$(echo "${SERVICES[$name]}" | cut -d' ' -f2-)
  health_path="/health"
  require_ok=1

  if [ "$name" = "web" ]; then
    health_path="/"
    require_ok=0
  fi

  echo "▶ Starting $name on port $port..."
  (cd "$BASE_PATH" && $cmd &) >/dev/null 2>&1

  # Health check
  for i in {1..15}; do
    sleep 2
    if [ "$require_ok" -eq 0 ]; then
      if curl -sf "http://localhost:$port$health_path" >/dev/null; then
        echo "✅ $name service ready at http://localhost:$port"
        break
      fi
    else
      if curl -sf "http://localhost:$port$health_path" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
        echo "✅ $name service ready at http://localhost:$port"
        break
      fi
    fi
    if [ $i -eq 15 ]; then
      echo "⚠️ $name did not respond after 15 retries."
    fi
  done
done

echo "✅ All Wadatrip backend services started successfully!"
