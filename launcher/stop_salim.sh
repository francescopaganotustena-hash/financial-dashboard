#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8011}"
FRONTEND_PORT="${FRONTEND_PORT:-3011}"

find_pids_by_port() {
  local port="$1"
  ss -ltnp 2>/dev/null \
    | awk -v port=":${port}" '$4 ~ port"$" {print $NF}' \
    | grep -oE 'pid=[0-9]+' \
    | cut -d= -f2 \
    | sort -u
}

wait_pids_exit() {
  local pids="$1"
  local retries="${2:-20}"
  local delay="${3:-0.25}"
  local pid
  local i

  for ((i = 1; i <= retries; i++)); do
    local all_stopped=1
    for pid in $pids; do
      if kill -0 "$pid" 2>/dev/null; then
        all_stopped=0
        break
      fi
    done
    if [[ "$all_stopped" -eq 1 ]]; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

stop_port() {
  local port="$1"
  local name="$2"
  local pids

  pids="$(find_pids_by_port "$port" || true)"
  if [[ -z "${pids// }" ]]; then
    echo "$name non risulta attivo su :$port"
    return
  fi

  echo "Arresto $name su :$port (PID: $(echo "$pids" | tr '\n' ' ' | sed 's/[[:space:]]*$//'))"
  kill $pids 2>/dev/null || true

  if wait_pids_exit "$pids"; then
    echo "$name arrestato correttamente."
    return
  fi

  echo "Forzo arresto $name (SIGKILL)..."
  kill -9 $pids 2>/dev/null || true
  if wait_pids_exit "$pids" 8 0.2; then
    echo "$name arrestato (forzato)."
  else
    echo "Attenzione: impossibile arrestare completamente $name su :$port"
  fi
}

echo "Launcher stop: $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
stop_port "$FRONTEND_PORT" "Frontend"
stop_port "$BACKEND_PORT" "Backend"
echo "Operazione completata."
