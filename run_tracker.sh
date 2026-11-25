#!/bin/bash
# AV3-GPS - sobe rastreador (UART4 + Node HTTPS/WS)
# Uso:
#   ./run_tracker.sh          -> GPS real (track.js)
#   ./run_tracker.sh sim      -> simulacao (tracksim.js)
#   ./run_tracker.sh watch    -> so NMEA no terminal

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

MODE="${1:-gps}"

echo "[1/4] UART4 P9_11 / P9_13..."
config-pin P9_11 uart 2>/dev/null || echo "(P9_11 ja ok ou falhou)"
config-pin P9_13 uart 2>/dev/null || echo "(P9_13 ja ok ou falhou)"

echo "[2/4] Liberando /dev/ttyO4 se ocupada..."
for p in /proc/[0-9]*; do
  if ls -l "$p/fd" 2>/dev/null | grep -qE "ttyO4|ttyS4"; then
    pid=$(basename "$p")
    echo "  matando PID $pid ($(cat "$p/comm" 2>/dev/null))"
    kill "$pid" 2>/dev/null || true
  fi
done
sleep 0.5

if [ ! -d "$DIR/node_modules" ]; then
  echo "ERRO: node_modules ausente. Rode: npm install"
  exit 1
fi

if [ ! -f "$DIR/certs/ca.key" ] || [ ! -f "$DIR/certs/ca.crt" ]; then
  echo "ERRO: faltam certs/ca.key e certs/ca.crt"
  exit 1
fi

case "$MODE" in
  watch|nmea)
    echo "[3/4] So leitura NMEA (Ctrl+C para parar)"
    stty -F /dev/ttyS4 9600 raw -echo -echoe -echok 2>/dev/null || true
    echo "[4/4] cat /dev/ttyO4 @ 9600"
    exec cat /dev/ttyO4
    ;;
  sim|tracksim)
    APP="tracksim.js"
    ;;
  gps|track|"")
    APP="track.js"
    ;;
  *)
    echo "Uso: $0 [gps|sim|watch]"
    exit 1
    ;;
esac

echo "[3/4] App: $APP"
echo "[4/4] HTTPS/WS em https://192.168.7.2:3001"
echo "     Ctrl+C para parar"
echo ""
exec node "$APP"
