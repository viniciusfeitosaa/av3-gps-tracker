/**
 * AV3 - Rastreador GPS local (UART4 + HTTPS + WebSocket)
 * BeagleBone Black - T954 - Prof. Imbiriba
 *
 * GPS: /dev/ttyO4 @ 9600, sentencas GNRMC/GPRMC
 * Porta HTTPS/WS: 3001
 *
 * Uso: node track.js
 * Cliente: https://192.168.7.2:3001
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const express = require('express');
const WebSocket = require('ws');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');

const PORT = 3001;
const SERIAL_DEV = '/dev/ttyO4';
const BAUD = 9600;
const certDir = path.join(__dirname, 'certs');

function executeCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout, stderr });
    });
  });
}

async function configurePins() {
  try {
    await executeCommand('config-pin P9_11 uart');
    await executeCommand('config-pin P9_13 uart');
    console.log('Pinos P9_11/P9_13 em modo uart');
  } catch (e) {
    console.warn('config-pin falhou (pode ja estar uart):', e.message);
  }
}

/** NMEA ddmm.mmmm -> graus decimais */
function nmeaToDecimal(raw, hemi) {
  if (!raw || raw.length < 3) return null;
  const v = parseFloat(raw);
  if (isNaN(v)) return null;
  const deg = Math.floor(v / 100);
  const min = v - deg * 100;
  let dec = deg + min / 60;
  if (hemi === 'S' || hemi === 'W') dec = -dec;
  return dec;
}

/**
 * Parse GNRMC / GPRMC
 * $GNRMC,hhmmss.sss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,,,A*hh
 */
function parseRmc(line) {
  if (!line || line.charAt(0) !== '$') return null;
  if (line.indexOf('RMC') === -1) return null;
  const parts = line.split(',');
  if (parts.length < 7) return null;
  const status = parts[2];
  if (status !== 'A') return null; // V = void, sem fix
  const lat = nmeaToDecimal(parts[3], parts[4]);
  const lon = nmeaToDecimal(parts[5], parts[6]);
  if (lat == null || lon == null) return null;
  return { lat, lon, status };
}

async function main() {
  await configurePins();

  const keyPath = path.join(certDir, 'ca.key');
  const crtPath = path.join(certDir, 'ca.crt');
  if (!fs.existsSync(keyPath) || !fs.existsSync(crtPath)) {
    console.error('Faltam certs/ca.key e certs/ca.crt');
    process.exit(1);
  }

  const app = express();
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  const server = https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(crtPath),
  }, app);

  const wss = new WebSocket.Server({ server });
  let lastSent = '';
  let serialStarted = false;

  function broadcast(obj) {
    const payload = JSON.stringify(obj);
    if (payload === lastSent) return;
    lastSent = payload;
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
    console.log('WS env', payload);
  }

  function startSerial() {
    if (serialStarted) return;
    serialStarted = true;

    const port = new SerialPort(SERIAL_DEV, { baudRate: BAUD, autoOpen: false });
    port.open((err) => {
      if (err) {
        console.error('Erro abrindo', SERIAL_DEV, err.message);
        serialStarted = false;
        return;
      }
      console.log('Serial', SERIAL_DEV, '@', BAUD);
    });

    const parser = port.pipe(new Readline({ delimiter: '\n' }));
    parser.on('data', (line) => {
      const clean = String(line).trim();
      const pos = parseRmc(clean);
      if (pos) broadcast(pos);
    });

    port.on('error', (err) => {
      console.error('Serial error:', err.message);
    });
  }

  wss.on('connection', (ws) => {
    console.log('Cliente WebSocket conectado');
    startSerial();
    ws.on('close', () => console.log('Cliente WebSocket saiu'));
  });

  server.listen(PORT, () => {
    console.log('HTTPS+WS em https://192.168.7.2:' + PORT);
    console.log('Aguardando WebSocket; GPS em', SERIAL_DEV);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
