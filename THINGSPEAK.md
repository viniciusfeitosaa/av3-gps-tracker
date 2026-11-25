# AV3 Tarefa 2 — ThingSpeak

## Criar canal (no PC, site ThingSpeak)

1. Conta em https://thingspeak.com  
2. **Channels → New Channel**  
3. Marque **Field 1** = `latitude`, **Field 2** = `longitude`  
4. Salve e anote:
   - **Channel ID** (neste projeto: `3588871`)
   - **API Keys → Write API Key**
   - **Read API Key** (se o canal não for público)

5. Edite na BBB o arquivo:
   `/var/lib/cloud9/AV3-GPS/thingspeak.config.json`

## Rede na BBB (item c)

A BBB precisa de internet para enviar ao ThingSpeak:

- Hotspot do celular (WiFi dongle), **ou**
- USB tethering do Android na USB host da BBB

Depois:
```bash
# se tether USB (interface usb2 típica):
sudo dhclient usb2
ping -c 2 google.com
```

## Rodar

```bash
cd /var/lib/cloud9/AV3-GPS
sudo systemctl stop av3-gps-tracker   # libera porta/serial da Tarefa 1
npm install axios --save
./run_remote.sh
```

No PC: **https://192.168.7.2:3001/**  

A página `remote.html` lê o canal ThingSpeak a cada 15 s (histórico ~40 feeds), painel à direita, mapa com **satélite Esri** (padrão) e opção **Mapa OSM**.

## Frontend público (GitHub Pages) — o que o professor pediu

A BBB em `192.168.7.2` continua **local**. Para a Tarefa 2 “remota”, o mapa deve abrir em URL pública **sem cabo USB**.

Arquivo pronto: `docs/index.html` (só frontend: Leaflet + API ThingSpeak).  
Mapa/satélite **permanecem**. A BBB só faz o upload Axios.

### Publicar

1. Crie um repo no GitHub (ex.: `av3-gps-tracker`), **só** com a pasta `docs/` (ou o repo inteiro sem `thingspeak.config.json` / write key).  
2. Settings → Pages → Source: Deploy from branch → Branch `main` → folder **`/docs`**.  
3. URL típica: `https://SEU_USER.github.io/av3-gps-tracker/`  
4. Mande essa URL ao professor. Com a BBB enviando ao canal, o pin atualiza sozinho.

**Não** coloque a Write API Key no HTML público. Só Channel ID + Read Key (já no `docs/index.html`).

Teste local sem Pages: abra `docs/index.html` no Chrome (precisa de internet).

## Observações

- Envio só com **fix GPS** (`RMC` status `A`). Indoor/`V` não envia.  
- `thingspeak.com` = gráficos. Mapa remoto público = GitHub Pages (`docs/`).  
- `https://192.168.7.2:3001/` = útil no lab; **não** substitui a URL pública.  
- PDF cita Bing; este projeto usa **Leaflet** + OSM + Esri satélite.  
- Detalhamento: `documento.md` e `mapa de bordo BBB.md` §8.  
