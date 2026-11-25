/**
 * AV3 Tarefa 2 - GPS UART -> ThingSpeak (Axios) + pagina remote.html
 * Uso: config-pin P9_11/P9_13 uart && node track_remote.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const axios = require('axios');

const PORT = 3001;
const SERIAL_DEV = '/dev/ttyO4';
const BAUD = 9600;
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'thingspeak.config.json'), 'utf8'));

if (!cfg.writeApiKey || String(cfg.writeApiKey).indexOf('COLE_') === 0) {
  console.error('Edite thingspeak.config.json (writeApiKey/channelId)');
  process.exit(1);
}

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

function parseRmc(line) {
  if (!line || line.charAt(0) !== '$') return null;
  if (line.indexOf('RMC') === -1) return null;
  const parts = line.split(',');
  if (parts.length < 7 || parts[2] !== 'A') return null;
  const lat = nmeaToDecimal(parts[3], parts[4]);
  const lon = nmeaToDecimal(parts[5], parts[6]);
  if (lat == null || lon == null) return null;
  return { lat: lat, lon: lon };
}

let lastFix = null;
let sending = false;

async function sendToThingSpeak(lat, lon) {
  if (sending) return;
  sending = true;
  try {
    const params = { api_key: cfg.writeApiKey };
    params['field' + (cfg.fieldLat || 1)] = lat;
    params['field' + (cfg.fieldLon || 2)] = lon;
    const res = await axios.get(cfg.updateUrl || 'https://api.thingspeak.com/update.json', {
      params: params,
      timeout: 10000
    });
    console.log('ThingSpeak OK', res.data);
  } catch (e) {
    console.error('ThingSpeak ERRO:', e.message);
  } finally {
    sending = false;
  }
}

setInterval(function () {
  if (!lastFix) {
    console.log('Aguardando fix GPS (RMC A) para ThingSpeak...');
    return;
  }
  sendToThingSpeak(lastFix.lat, lastFix.lon);
}, cfg.intervalMs || 15000);

const app = express();

app.get('/api/thingspeak-info', function (req, res) {
  res.json({
    channelId: cfg.channelId,
    readApiKey: cfg.readApiKey && String(cfg.readApiKey).indexOf('COLE_') !== 0 ? cfg.readApiKey : '',
    fieldLat: cfg.fieldLat || 1,
    fieldLon: cfg.fieldLon || 2
  });
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'remote.html'));
});
app.get('/remote', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'remote.html'));
});
app.get('/local', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

const server = https.createServer({
  key: fs.readFileSync(path.join(__dirname, 'certs', 'ca.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'ca.crt'))
}, app);

server.listen(PORT, '0.0.0.0', function () {
  console.log('MAPA (Tarefa 2): https://192.168.7.2:' + PORT + '/');
  console.log('(Nao abra so o site thingspeak.com — la so tem graficos)');
  console.log('ThingSpeak canal', cfg.channelId, 'a cada', (cfg.intervalMs || 15000) / 1000, 's');

  const port = new SerialPort(SERIAL_DEV, { baudRate: BAUD, autoOpen: false });
  const parser = port.pipe(new Readline({ delimiter: '\n' }));

  port.open(function (err) {
    if (err) {
      console.error('Erro serial', SERIAL_DEV, err.message);
      return;
    }
    console.log('Serial', SERIAL_DEV, '@', BAUD);
  });

  parser.on('data', function (line) {
    const pos = parseRmc(String(line).trim());
    if (pos) {
      lastFix = pos;
      console.log('FIX', pos.lat.toFixed(6), pos.lon.toFixed(6));
    }
  });

  port.on('error', function (err) {
    console.error('Serial error:', err.message);
  });
});
