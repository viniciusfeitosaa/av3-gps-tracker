# AV3 GPS — BeagleBone Black + ThingSpeak

Rastreador GPS (UART NMEA RMC) na BeagleBone Black.

- **Tarefa 1 (local):** `track.js` + `https://192.168.7.2:3001/` (WebSocket)
- **Tarefa 2 (remoto):** BBB envia ao ThingSpeak; mapa público no GitHub Pages

## Mapa público (GitHub Pages)

URL (após Pages ativo): ver Settings → Pages deste repositório  
Fonte: pasta [`docs/`](docs/) → `index.html` (frontend Leaflet que lê o canal ThingSpeak).

A BBB **não** precisa estar no cabo USB para o professor ver o mapa. Só precisa estar enviando ao canal (WiFi/tether + `./run_remote.sh`).

## Segredos

- `thingspeak.config.json` **não** vai pro Git (Write API Key).
- Use `thingspeak.config.example.json` como modelo.
- O HTML público leva só Channel ID + **Read** API Key.

## BBB

Projeto na placa: `/var/lib/cloud9/AV3-GPS`  
Detalhes: `documento.md`, `THINGSPEAK.md`
