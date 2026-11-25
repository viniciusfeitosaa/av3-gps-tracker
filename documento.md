# Documento da atividade — Prática 11 e AV3  
## Rastreador GPS usando Node.js (BeagleBone Black)

**Disciplina:** T954 — Sistemas Embarcados  
**Professor:** Imbiriba  
**Placa:** BeagleBone Black (Debian 10 Buster)  
**Módulo GPS:** GY-GPS6MV2 (u-blox NEO-6M)  
**Pasta do projeto (BBB):** `/var/lib/cloud9/AV3-GPS`  
**Espelho no PC:** `C:\Users\vinic\BBB\AV3-GPS`  
**Mapa de bordo geral:** `C:\Users\vinic\BBB\mapa de bordo BBB.md`  
**Última atualização deste documento:** 2026-11-19  

---

## 1. Objetivo

Montar um rastreador GPS na BeagleBone Black usando:

1. Comunicação **UART** com o módulo GY-GPS6MV2  
2. Sentenças **NMEA** (posição, status, satélites)  
3. **AV3 Tarefa 1:** servidor **Node.js** (HTTPS + WebSocket) + página HTML com mapa em tempo real  
4. **AV3 Tarefa 2:** envio remoto via **ThingSpeak** (Axios a cada 15 s) + HTML que lê o canal e mostra mapa  

---

## 2. Etapas do PDF × o que foi realizado

### 2.1 Introdução teórica (PDF §1)

| Tópico | Conteúdo do PDF | Realizado? |
|--------|-----------------|------------|
| UART | TX/RX, baud, 8N1, assíncrono | Estudado / aplicado na prática |
| GPS / NMEA | `$GPGGA`, `$GPRMC` / `$GNRMC`, etc. | Observado na prática (`watch`) |
| Módulo GY-GPS6MV2 | Saída NMEA padrão | Utilizado |

**Sentença usada no software (Tarefas 1 e 2):** `$GPRMC` / `$GNRMC`.  
Só aceitamos status **`A`** (fix válido). Status **`V`** é ignorado para pin e para ThingSpeak.

---

### 2.2 Checando `/dev` (PDF §2.1)

**Pedido:** listar terminais `ttyO0`…`ttyO5` em `/dev`.

**Realizado:** sim.

```bash
ls -l /dev/ttyO*
```

**Resultado:** `ttyO4` → `ttyS4` (UART4). É a porta usada com o GPS.

---

### 2.3 Configurar GPIOs como UART (PDF §2.2)

**Pedido:** `config-pin` em **P9.11** e **P9.13**.

**Realizado:** sim.

```bash
config-pin P9_11 uart
config-pin P9_13 uart
config-pin -q P9_11
config-pin -q P9_13
```

**Resultado esperado:** `Current mode ... is: uart`.

---

### 2.4 Aplicação 1 — Teste UART com conversor USB (PDF §2.3 e §2.4)

**Pedido:**

- Ligar conversor UART-USB na UART4  
- Terminal no PC @ **115200** bps  
- `echo "Usando echo!" >> /dev/ttyO4`  
- Programa `uart.c` (termios, B115200) → `./uart "ola mundo"`  

**Realizado:** **não** (etapa pulada de propósito).

**Justificativa registrada:** a UART4 já foi validada recebendo NMEA do GPS real a **9600** bps. O teste do conversor USB a 115200 é didático e **não** é pré-requisito técnico do rastreador GPS (o módulo usa 9600).

**Se o professor exigir print da App 1:** refazer com conversor USB, Minicom/PuTTY @ 115200, depois desligar o conversor e religar o GPS @ 9600.

---

### 2.5 Aplicação 2 — GPS na UART4 (PDF §2.5)

**Pedido:** ligar GY-GPS6MV2 na UART4; visualizar NMEA com:

```bash
sudo minicom -b 9600 -o -D /dev/ttyO4
```

**Realizado:** sim (com equivalente e com minicom).

**Ligações utilizadas:**

| Módulo GPS | BeagleBone Black |
|------------|------------------|
| VCC | 5 V (P9_07) ou 3,3 V (P9_03) |
| GND | GND (P9_01) |
| TX | **P9_11** (RX da BBB) |
| RX | **P9_13** (TX da BBB) |

**Comandos usados no projeto:**

```bash
cd /var/lib/cloud9/AV3-GPS
sudo systemctl stop gpsd.socket gpsd   # se gpsd estiver segurando a porta
./run_tracker.sh watch
# ou:
# sudo minicom -b 9600 -o -D /dev/ttyO4
```

**Observações de ensaio:**

- Com módulo alimentado e TX→P9_11 corretos, aparecem linhas `$GNGGA`, `$GNRMC`, `$GPGSV`, etc.  
- Indoor típico: status **`V`** (void), lat/lon vazios, poucos satélites — **normal**.  
- Outdoor com fix: status **`A`**, lat/lon preenchidos; LED PPS de muitas placas GY-NEO6MV2 só pisca **com fix**.  
- Em um momento o `watch` ficou sem saída (`0` bytes): causa diagnosticada como **alimentação/fiação** (não software). Conferir VCC/GND e TX→P9_11.  
- Em 2026-11-19 houve fix outdoor válido (ex.: lat ≈ -3.7699, lon ≈ -38.4799) e envio ao ThingSpeak.

---

### 2.6 Cliente `gpsmon` (PDF §2.6)

**Pedido:**

```bash
sudo apt install gpsd-clients
gpsmon /dev/ttyO4
```

**Realizado:** sim — pacote `gpsd-clients` instalado; `gpsmon` disponível em `/usr/bin/gpsmon`.

**Atenção de uso:**

1. Dispositivo correto: **`/dev/ttyO4`** (letra **O**), não `tty04`.  
2. Se a tela ficar vazia: (a) GPS sem dados na UART; (b) `gpsd`/outro processo na porta.  
3. Sequência recomendada:

```bash
sudo systemctl stop gpsd.socket gpsd
config-pin P9_11 uart
config-pin P9_13 uart
# confirmar NMEA:
timeout 3 cat /dev/ttyO4
sudo gpsmon /dev/ttyO4
```

---

## 3. AV3 — Tarefa 1 (5 pts) — Rastreador local Node.js + HTML

### 3.1 O que o PDF pede

- Back-end Node.js: HTTPS + WebSocket + leitura serial UART4 @ 9600  
- Parse de sentença tipo **RMC** (`GNRMC`/`GPRMC`), conversão para graus decimais  
- Envio JSON `{ lat, lon }` aos clientes (evitar repetir a mesma posição)  
- Front-end HTML com mapa e atualização em tempo real  
- PDF cita **Bing Maps**; neste projeto usamos **OpenStreetMap + Leaflet** (opensource, sem chave de API)  
- Certificados SSL locais; porta **3001**  
- Abrir no PC: `https://192.168.7.2:3001`

### 3.2 Estrutura criada

```text
/var/lib/cloud9/AV3-GPS/
├── track.js              # GPS real + HTTPS + WebSocket (Tarefa 1)
├── tracksim.js           # simulação de deslocamento (teste sem fix)
├── track_remote.js       # Tarefa 2: Axios → ThingSpeak + remote.html
├── thingspeak.config.json
├── package.json
├── node_modules/         # express, ws, serialport, axios, …
├── certs/
│   ├── ca.key
│   └── ca.crt            # autoassinado + SAN (192.168.7.2)
├── public/
│   ├── index.html        # mapa local (WebSocket)
│   ├── remote.html       # mapa remoto (ThingSpeak + satélite + painel)
│   └── lib/leaflet/      # Leaflet local (sem CDN)
├── scripts/watch_nmea.sh
├── run_tracker.sh        # sobe Tarefa 1
├── run_remote.sh         # sobe Tarefa 2
├── start_service.sh / av3-gps-tracker.service
├── THINGSPEAK.md
├── README.md
└── documento.md          # este arquivo
```

### 3.3 Dependências Node instaladas

Conforme o espírito do PDF (`express`, `ws`, `serialport`, `bufferutil`, `utf-8-validate`) + **axios** (Tarefa 2):

```bash
cd /var/lib/cloud9/AV3-GPS
npm install
npm install axios --save
```

**Node na BBB:** v10.15.2 (imagem Debian). Funcionou com `serialport@8.0.7`.

### 3.4 Certificados SSL

Gerados com OpenSSL (autoassinados), com **Subject Alternative Name** incluindo `IP:192.168.7.2`.

**Comportamento do navegador:** aviso `ERR_CERT_AUTHORITY_INVALID` / “Sua conexão não é privada” é **esperado**. Aceitar o risco (Avançado → Continuar). Não indica falha do HTTPS.

- URL correta: **`https://192.168.7.2:3001`**  
- `http://` (sem S) **não** atende — só existe servidor HTTPS.

### 3.5 Como subir a Tarefa 1

```bash
cd /var/lib/cloud9/AV3-GPS

./run_tracker.sh          # GPS real (track.js)
./run_tracker.sh sim      # simulação (pin andando sem fix)
./run_tracker.sh watch    # só NMEA no terminal
```

No PC (USB `192.168.7.2`): abrir `https://192.168.7.2:3001`, aceitar o certificado.

**PC precisa de internet** para baixar os *tiles* do mapa. A BBB não precisa de WiFi só para a Tarefa 1 via USB.

### 3.6 Status funcional da Tarefa 1

| Item | Status |
|------|--------|
| Back-end HTTPS + WebSocket | Feito e testado |
| Leitura UART + parse RMC | Feito |
| Front mapa OSM/Leaflet | Feito (Leaflet local) |
| Simulação `tracksim` + pin | Feito |
| Script `run_tracker.sh` | Feito |
| Demo GPS outdoor com fix `A` + pin real | Feito (ensaio 2026-11-19) |
| systemd no boot (`av3-gps-tracker`) | Disponível (`start_service.sh`) |
| WiFi na BBB | **Não obrigatório** para pin/Tarefa 1 |

---

## 4. AV3 — Tarefa 2 (5 pts) — ThingSpeak + WiFi

### 4.1 O que o PDF pede

| Item | PDF | Status |
|------|-----|--------|
| (a) Envio HTTP (Axios) a cada 15 s | Sim | **Feito** (`track_remote.js`) |
| (b) HTML lendo ThingSpeak + mapa | Sim | **Feito** (`public/remote.html`) |
| (c) WiFi BBB (hotspot/campus) | Sim | **Feito** via tether USB / WiFi quando necessário para upload |

### 4.2 Canal ThingSpeak

| Parâmetro | Valor |
|-----------|--------|
| Channel ID | `3588871` |
| Field 1 | latitude |
| Field 2 | longitude |
| Intervalo | 15 s (`intervalMs` em `thingspeak.config.json`) |
| Write / Read API Keys | em `thingspeak.config.json` (não commitar em repositório público) |

Criação do canal: https://thingspeak.com → New Channel → Fields 1 e 2 → API Keys.

### 4.3 Back-end `track_remote.js`

- HTTPS na porta **3001**, escuta em `0.0.0.0`.  
- Rotas: `/` e `/remote` → `remote.html`; `/local` → `index.html`; static com `{ index: false }`.  
- `GET /api/thingspeak-info` devolve `channelId`, `readApiKey`, fields (sem write key no HTML).  
- Abre serial **depois** do `listen` (evita hang).  
- `setInterval` 15 s: se houver `lastFix` (RMC `A`), Axios GET em `https://api.thingspeak.com/update.json`.

### 4.4 Front `remote.html`

- Painel à **direita**: status ao vivo, lat/lon, horário, id da entrada, pontos na trilha, canal.  
- Consulta `feeds.json?results=40` (histórico), não só o último ponto.  
- Sparkline SVG do trajeto + lista das últimas entradas.  
- Mapa Leaflet tela cheia.  
- **Basemap padrão: satélite** (Esri World Imagery). OSM de ruas disponível no seletor de camadas (canto superior esquerdo).  
  Motivo: o OpenStreetMap **não** oferece tiles de satélite oficiais; Esri World Imagery é o basemap usual no Leaflet.  
- Trilha em amarelo para contraste no satélite.

### 4.5 Como subir a Tarefa 2

```bash
cd /var/lib/cloud9/AV3-GPS
sudo systemctl stop av3-gps-tracker   # libera serial/porta se T1 estiver no boot
./run_remote.sh
```

No PC: **https://192.168.7.2:3001/**  

**Importante:** o site `thingspeak.com` mostra apenas os **gráficos** do canal. O **mapa da tarefa** é a página servida pela BBB na URL acima.

**Rede:**

- BBB com internet (WiFi dongle ou tether USB do celular) para **enviar** ao ThingSpeak.  
- PC com internet para **tiles** (satélite/OSM) e para **ler** a API ThingSpeak no navegador.

### 4.6 Status funcional da Tarefa 2

| Item | Status |
|------|--------|
| Axios update 15 s | Feito |
| Fix `A` → canal | Feito (entradas observadas, ex. #40) |
| `remote.html` mapa + painel | Feito |
| Satélite + troca OSM | Feito |
| Confusão thingspeak.com × URL BBB | Documentada / avisos no script e na UI |

---

## 5. Adaptações em relação ao PDF (registrar no relatório)

1. **Mapa:** OpenStreetMap + Leaflet no lugar do Bing Maps (sem chave; opensource).  
2. **Satélite:** Esri World Imagery como camada padrão na Tarefa 2 (OSM não tem imagery).  
3. **App 1 (uart.c @ 115200):** não executada; UART validada via NMEA @ 9600.  
4. **Visualização NMEA:** além de `minicom`/`gpsmon`, uso de `./run_tracker.sh watch`.  
5. **Leaflet servido localmente** em `public/lib/leaflet/` para evitar mapa “picotado” quando a CDN falha.  
6. **UI remota:** painel lateral com histórico do canal (além do pin no mapa).

---

## 6. Problemas encontrados e soluções (para o formulário)

| Problema | Causa | Solução |
|----------|--------|---------|
| `gpsmon /dev/tty04` não acha | Caminho errado (zero) | Usar `/dev/ttyO4` (letra O) |
| `gpsmon` tela vazia | Sem bytes na UART e/ou `gpsd` na porta | Parar `gpsd`; conferir NMEA com `cat`; checar fiação |
| `./run_tracker.sh watch` sem saída | GPS sem TX/alimentação | VCC/GND; TX GPS → P9_11 |
| Mapa picotado | CSS/JS Leaflet da CDN | Leaflet local em `public/lib/` |
| `ERR_CERT_AUTHORITY_INVALID` | Certificado autoassinado | Aceitar exceção no navegador |
| LED GPS apagado indoor | LED PPS em muitas placas só com fix | Normal sem `A`; NMEA ainda pode fluir |
| Pin não aparece no mapa (T1) | Sem fix (`V`) ou sem `track.js`/WS | Outdoor até `A`; ou `./run_tracker.sh sim` |
| “Só vejo gráficos ThingSpeak” | Abrir o site do canal, não a BBB | Abrir `https://192.168.7.2:3001/` |
| `/` servia `index.html` na T2 | `express.static` com index padrão | Rotas `remote.html` antes do static; `index: false` |
| `serialport` npm EACCES | `npm` como root | Instalar como usuário `debian` |
| Net para `apt`/`npm`/ThingSpeak | Sem WiFi estável | Tether USB do celular (RNDIS) |
| Scripts `.sh` falham | CRLF do Windows | `sed -i 's/\r$//' arquivo.sh` |

---

## 7. Checklist rápido para demonstração / formulário

### Tarefa 1 — demonstrar

- [x] Pinos UART configurados  
- [x] NMEA visível (`watch` ou `minicom`/`gpsmon`)  
- [x] `./run_tracker.sh` ou `sim` rodando  
- [x] Navegador em `https://192.168.7.2:3001` (certificado aceito)  
- [x] Mapa OSM visível  
- [x] Pin: com `sim` **ou** com GPS outdoor status `A`  

### Tarefa 2 — demonstrar

- [x] Canal ThingSpeak + Axios  
- [x] HTML remoto lendo fields lat/lon (+ histórico)  
- [x] Mapa satélite / OSM na URL da BBB  
- [x] Internet na BBB para envio (tether/WiFi)  

---

## 8. Comandos úteis (referência)

```bash
# UART
config-pin P9_11 uart
config-pin P9_13 uart

# NMEA
cd /var/lib/cloud9/AV3-GPS
./run_tracker.sh watch
sudo minicom -b 9600 -o -D /dev/ttyO4
sudo systemctl stop gpsd.socket gpsd
sudo gpsmon /dev/ttyO4

# Tarefa 1
./run_tracker.sh
./run_tracker.sh sim

# Tarefa 2
sudo systemctl stop av3-gps-tracker
./run_remote.sh

# No PC
# https://192.168.7.2:3001/     ← mapa (T1 ou T2 conforme o script)
# https://thingspeak.com/channels/3588871   ← só gráficos do canal
```

---

## 9. Conclusão (texto sugerido para o formulário)

Foi implementada a Prática 11 (parte GPS/UART) e as **AV3 Tarefas 1 e 2** na BeagleBone Black. A UART4 (`/dev/ttyO4` @ 9600) lê NMEA do GY-GPS6MV2; o software usa a sentença **RMC** com status **A**. Na Tarefa 1, um servidor Node.js (HTTPS + WebSocket) atualiza um mapa OpenStreetMap/Leaflet em tempo real. Na Tarefa 2, a BBB envia latitude/longitude ao ThingSpeak via Axios a cada 15 s e a página `remote.html` reconstrói a trilha a partir do canal, com painel de telemetria e visão por satélite (Esri) além do mapa OSM. A etapa de teste UART-USB a 115200 (`uart.c`) foi omitida por já haver validação da UART4 com o módulo GPS. O Bing Maps citado no PDF foi substituído por Leaflet/OSM (e satélite Esri na visualização remota).
