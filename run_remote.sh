#!/bin/bash
# AV3 Tarefa 2 - GPS -> ThingSpeak + pagina remote.html
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "[1/4] UART..."
config-pin P9_11 uart 2>/dev/null || true
config-pin P9_13 uart 2>/dev/null || true
sudo systemctl stop gpsd.socket gpsd 2>/dev/null || true
sudo systemctl stop av3-gps-tracker 2>/dev/null || true
killall gpsmon cat minicom 2>/dev/null || true
sleep 0.5

if [ ! -d node_modules/axios ]; then
  echo "[2/4] Instalando axios (precisa de internet na BBB)..."
  npm install axios --save
else
  echo "[2/4] axios OK"
fi

if grep -q 'COLE_' thingspeak.config.json; then
  echo "ERRO: edite thingspeak.config.json com Channel ID e Write API Key"
  echo "Veja THINGSPEAK.md"
  exit 1
fi

echo "[3/4] Net?"
ping -c 1 -W 3 google.com >/dev/null 2>&1 && echo "  internet OK" || echo "  AVISO: sem internet — ThingSpeak vai falhar (plugue WiFi/tether)"

echo ""
echo "=============================================="
echo "  MAPA (nao e o site ThingSpeak):"
echo "  https://192.168.7.2:3001/"
echo "  Aceite o aviso de certificado no navegador."
echo "  thingspeak.com = so graficos; o mapa e na BBB."
echo "=============================================="
echo ""
exec node track_remote.js
