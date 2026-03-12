#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_START="$ROOT_DIR/start"
BACKEND_PORT="${BACKEND_PORT:-8011}"
FRONTEND_PORT="${FRONTEND_PORT:-3011}"

if [[ ! -x "$TARGET_START" ]]; then
  echo "Errore: script non trovato o non eseguibile: $TARGET_START"
  exit 1
fi

is_listening() {
  local port="$1"
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":${port}$"
}

echo "Launcher: $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
echo "Eseguo: $TARGET_START"
"$TARGET_START" "$@"

echo ""
echo "Verifica servizi..."
if is_listening "$BACKEND_PORT" && is_listening "$FRONTEND_PORT"; then
  echo "OK: backend :$BACKEND_PORT e frontend :$FRONTEND_PORT attivi."
else
  echo "Attenzione: uno o piu servizi non risultano attivi."
  echo "Log backend:  $ROOT_DIR/logs/backend_${BACKEND_PORT}.log"
  echo "Log frontend: $ROOT_DIR/logs/frontend_${FRONTEND_PORT}.log"
  exit 1
fi

echo ""
echo "Premi INVIO per chiudere il launcher (i servizi restano avviati)."
read -r
