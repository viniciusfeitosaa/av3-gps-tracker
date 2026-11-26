# Documento da atividade — Prática 11 e AV3  
## Rastreador GPS com Node.js na BeagleBone Black

**Disciplina:** T954 — Sistemas Embarcados  
**Professor:** Imbiriba  
**Placa:** BeagleBone Black (Debian 10 Buster — BeagleBoard.org IoT Image 2020-04-06)  
**Módulo GPS:** GY-GPS6MV2 (u-blox NEO-6M)  
**Pasta na BBB:** `/var/lib/cloud9/AV3-GPS`  
**Espelho no PC:** `C:\Users\vinic\BBB\AV3-GPS`  
**Repositório GitHub:** https://github.com/viniciusfeitosaa/av3-gps-tracker  
**Mapa público (Tarefa 2):** https://viniciusfeitosaa.github.io/av3-gps-tracker/  
**Mapa de bordo geral:** `C:\Users\vinic\BBB\mapa de bordo BBB.md`  
**Última atualização deste documento:** 2026-11-26  

> Este arquivo é a base para o relatório final: reúne o que o PDF pediu, o que foi feito, como rodar, resultados, adaptações e problemas. Pode ser copiado/adaptado para o formulário da disciplina.

---

## 1. Objetivo da prática

Montar um rastreador GPS na BeagleBone Black capaz de:

1. Comunicar-se com o módulo GY-GPS6MV2 via **UART**.  
2. Interpretar sentenças **NMEA** (em especial posição e status de fix).  
3. **AV3 Tarefa 1 (local):** servidor **Node.js** com HTTPS + WebSocket e página HTML com mapa em tempo real.  
4. **AV3 Tarefa 2 (remoto):** enviar latitude/longitude ao **ThingSpeak** (HTTP/Axios a cada 15 s) e visualizar o trajeto em um **frontend** que lê o canal na nuvem — inclusive em URL pública (GitHub Pages).

---

## 2. Materiais e ambiente

| Item | Detalhe |
|------|---------|
| BeagleBone Black | Debian 10; usuário `debian` / senha padrão da imagem; SSH |
| Acesso USB do Windows | IP `192.168.7.2` |
| Módulo GPS | GY-GPS6MV2 / NEO-6M, saída NMEA @ 9600 8N1 |
| Protoboard / jumpers | Ligações UART e alimentação |
| Internet na BBB (Tarefa 2) | WiFi USB (RTL8188EUS) e/ou tether USB do celular (RNDIS) |
| Internet no PC/navegador | Tiles de mapa (OSM/Esri) + API ThingSpeak |
| Software | Node.js v10.15.2 na imagem; `express`, `ws`, `serialport`, `axios` |

---

## 3. Conceitos teóricos aplicados (PDF §1)

### 3.1 UART

Comunicação serial assíncrona ponto a ponto (TX/RX), com baud rate acordado, tipicamente 8N1 (8 bits de dados, sem paridade, 1 stop bit). Na BeagleBone, a UART4 é exposta nos pinos **P9_11** (RX) e **P9_13** (TX) e aparece em `/dev` como `ttyO4` (symlink para `ttyS4`).

### 3.2 GPS e NMEA

O receptor GPS emite linhas de texto no formato NMEA 0183 (`$GPxxx` / `$GNxxx`, …). Exemplos comuns: `$GPGGA`, `$GPRMC` / `$GNRMC`, `$GPGSV`.

**Sentença usada no software das Tarefas 1 e 2:** `$GPRMC` / `$GNRMC` (*Recommended Minimum Course*).

- Status **`A`** (*Active*): fix válido → lat/lon são convertidos para graus decimais e usados.  
- Status **`V`** (*Void*): sem fix → posição **não** é enviada ao WebSocket nem ao ThingSpeak.

Conversão NMEA → decimal (resumo): graus = parte inteira de `ddmm.mmmm / 100`; minutos = resto; decimal = graus + minutos/60; hemisférios S/W tornam o valor negativo.

Exemplo de estrutura:

```text
$GPRMC,hhmmss.sss,A,ddmm.mmmm,S,dddmm.mmmm,W,...
```

### 3.3 Observações de ensaio (fix e LED)

- **Indoor:** típico status `V`, campos de lat/lon vazios, poucos satélites — comportamento esperado.  
- **Outdoor / céu aberto:** status `A`, coordenadas preenchidas. Em várias placas GY-NEO6MV2 o LED PPS só pisca **com fix**. LED apagado indoor **não** prova falha de UART se o NMEA ainda flui.

---

## 4. Etapas práticas do PDF × realização

### 4.1 Checando `/dev` (PDF §2.1) — realizado

```bash
ls -l /dev/ttyO*
```

**Resultado:** `ttyO4` → `ttyS4` (UART4), porta usada com o GPS.

### 4.2 Configurar GPIOs como UART (PDF §2.2) — realizado

```bash
config-pin P9_11 uart
config-pin P9_13 uart
config-pin -q P9_11
config-pin -q P9_13
```

Esperado: `Current mode ... is: uart`.

### 4.3 Aplicação 1 — teste UART-USB @ 115200 + `uart.c` (PDF §2.3–2.4) — **não executada**

**Justificativa:** a UART4 já foi validada recebendo NMEA real do GPS a **9600** bps. O teste com conversor USB a 115200 é didático e não é pré-requisito técnico do rastreador (o módulo GPS opera a 9600).

Se o professor exigir print da App 1: ligar conversor UART-USB, Minicom/PuTTY @ 115200, `echo` / `uart.c`, depois religar o GPS @ 9600.

### 4.4 Aplicação 2 — GPS na UART4 (PDF §2.5) — realizado

**Ligações:**

| Módulo GPS | BeagleBone Black |
|------------|------------------|
| VCC | 5 V (P9_07) ou 3,3 V (P9_03) |
| GND | GND (P9_01) |
| TX | **P9_11** (RX da BBB) |
| RX | **P9_13** (TX da BBB) |

**Visualização NMEA:**

```bash
cd /var/lib/cloud9/AV3-GPS
sudo systemctl stop gpsd.socket gpsd
./run_tracker.sh watch
# ou: sudo minicom -b 9600 -o -D /dev/ttyO4
```

Com fiação correta aparecem `$GNGGA`, `$GNRMC`, `$GPGSV`, etc. Em 2026-11-19 houve fix outdoor válido (ex.: lat ≈ -3.7699, lon ≈ -38.4799) com envio ao ThingSpeak.

### 4.5 Cliente `gpsmon` (PDF §2.6) — realizado

```bash
sudo apt install gpsd-clients
sudo systemctl stop gpsd.socket gpsd
config-pin P9_11 uart
config-pin P9_13 uart
timeout 3 cat /dev/ttyO4
sudo gpsmon /dev/ttyO4
```

**Atenção:** dispositivo correto é `/dev/ttyO4` (letra **O**), não `tty04`. Tela vazia → porta ocupada (`gpsd` / `node`) ou GPS sem dados/alimentação.

---

## 5. AV3 — Tarefa 1 (local): Node.js + HTTPS + WebSocket + mapa

### 5.1 Requisitos do PDF

- Back-end Node.js: HTTPS + WebSocket + leitura serial UART4 @ 9600.  
- Parse RMC → JSON `{ lat, lon }` aos clientes.  
- Front-end HTML com mapa em tempo real.  
- PDF cita **Bing Maps**; neste projeto: **OpenStreetMap + Leaflet** (opensource, sem chave de API).  
- Certificados SSL locais; porta **3001**.  
- Abrir no PC: `https://192.168.7.2:3001`.

### 5.2 Arquitetura

```text
GPS (NMEA) --UART4--> track.js --WebSocket--> public/index.html (Leaflet)
                         |
                       HTTPS :3001
```

- `track.js`: servidor HTTPS, WebSocket, SerialPort + parser readline, parse RMC `A`.  
- `tracksim.js`: simulação de deslocamento (demo sem fix outdoor).  
- `public/index.html`: mapa OSM/Leaflet local.  
- `public/lib/leaflet/`: Leaflet **servido localmente** (evita mapa “picotado” se CDN falhar).  
- `certs/`: certificado autoassinado com SAN `IP:192.168.7.2`.  
- Aviso `ERR_CERT_AUTHORITY_INVALID` no navegador é **esperado** — aceitar exceção.  
- Serviço systemd opcional: `av3-gps-tracker` (boot da Tarefa 1).

### 5.3 Como executar (Tarefa 1)

```bash
cd /var/lib/cloud9/AV3-GPS
./run_tracker.sh          # GPS real
./run_tracker.sh sim      # simulação
./run_tracker.sh watch    # só NMEA no terminal
```

No PC (cabo USB): **https://192.168.7.2:3001/**  

- PC precisa de internet para *tiles* do mapa.  
- BBB **não** precisa de WiFi só para a Tarefa 1 via USB.

### 5.4 Status Tarefa 1

| Item | Status |
|------|--------|
| HTTPS + WebSocket | Feito e testado |
| UART + parse RMC | Feito |
| Mapa OSM/Leaflet | Feito |
| Simulação `tracksim` | Feito |
| Fix outdoor `A` + pin real | Feito (ensaio 2026-11-19) |
| systemd no boot | Disponível |

---

## 6. AV3 — Tarefa 2 (remoto): ThingSpeak + frontend

### 6.1 Requisitos do PDF

| Item | Pedido | Status |
|------|--------|--------|
| (a) Envio HTTP a cada 15 s | Axios → ThingSpeak | **Feito** (`track_remote.js`) |
| (b) HTML lendo ThingSpeak + mapa | Visualização remota | **Feito** (`remote.html` + GitHub Pages) |
| (c) WiFi / rede na BBB | Hotspot/campus/tether | **Feito** quando necessário para upload |

### 6.2 Canal ThingSpeak

| Parâmetro | Valor |
|-----------|--------|
| Channel ID | `3588871` |
| Field 1 | latitude |
| Field 2 | longitude |
| Intervalo | 15 s |
| Config na BBB | `thingspeak.config.json` (Write + Read API Keys) |
| Modelo sem segredo | `thingspeak.config.example.json` (no Git) |

A **Write API Key** fica só na BBB / arquivo local e **não** entra no repositório público.

### 6.3 Fluxo de dados

```text
GPS --UART--> track_remote.js --Axios 15s--> ThingSpeak (nuvem)
                                                |
                    docs/index.html (GitHub Pages) / remote.html
                                                |
                                         Leaflet mapa + painel
```

1. BBB lê NMEA; só com RMC `A` guarda `lastFix`.  
2. A cada 15 s, Axios GET em `https://api.thingspeak.com/update.json` com fields lat/lon.  
3. O frontend consulta `feeds.json?results=40` e redesenha trilha, painel e status.  
4. **Não confundir:** `thingspeak.com` mostra **gráficos** do canal. O **mapa da tarefa** é a página Leaflet (BBB ou GitHub Pages).

### 6.4 Back-end `track_remote.js`

- HTTPS porta **3001**, bind `0.0.0.0`.  
- Rotas: `/` e `/remote` → `remote.html`; `/local` → `index.html`.  
- `express.static` com `{ index: false }` (evita servir `index.html` no lugar do remoto).  
- `GET /api/thingspeak-info`: devolve channelId, readApiKey e fields (**sem** write key).  
- Serial aberta **depois** do `listen`.  
- Envio ThingSpeak apenas com fix válido.

### 6.5 Interface `remote.html` (na BBB)

- Mapa tela cheia + painel à **direita**: lat, lon, horário, id da entrada, pontos, canal.  
- Histórico: sparkline SVG + últimas entradas do canal.  
- Basemap padrão: **satélite Esri World Imagery** (OpenStreetMap não oferece imagery oficial).  
- Alternância Leaflet: **Satélite** / **Mapa OSM**.  
- Trilha em amarelo no satélite (contraste).  

### 6.6 Status Ao vivo / Atrasado / Offline

O indicador **não** marca “ao vivo” só porque o canal tem pontos antigos. Usa a idade do último feed:

| Estado | Critério (aprox.) | Significado |
|--------|-------------------|-------------|
| **Ao vivo** | ≤ 45 s | BBB enviando recentemente |
| **Atrasado** | 45 s … 3 min | Sem envio fresco; possível atraso |
| **Offline** | > 3 min ou sem dados | BBB parada / sem net / sem fix |

O status é reavaliado a cada 5 s no frontend.

### 6.7 Frontend público — GitHub Pages (pedido do professor)

Feedback do professor: a demo em `https://192.168.7.2:3001/` **continua local** (IP do cabo USB). Para a Tarefa 2 “remota”, o mapa deve abrir em URL pública **sem** depender da BBB no navegador.

| Item | Valor |
|------|--------|
| Repositório | https://github.com/viniciusfeitosaa/av3-gps-tracker |
| URL pública do mapa | https://viniciusfeitosaa.github.io/av3-gps-tracker/ |
| Fonte | `docs/index.html` (Leaflet via CDN + API ThingSpeak) |
| Segredo excluído do Git | `thingspeak.config.json` (Write Key) via `.gitignore` |

**Papéis:**

- BBB + `./run_remote.sh` + internet → **apenas envia** ao canal.  
- Qualquer pessoa com a URL do Pages → **vê o mapa** (mesmo sem cabo USB).

### 6.8 Como executar (Tarefa 2)

```bash
cd /var/lib/cloud9/AV3-GPS
sudo systemctl stop av3-gps-tracker   # libera serial/porta se T1 estiver no boot
# BBB com internet (WiFi ou tether):
./run_remote.sh
```

- Lab / cabo: `https://192.168.7.2:3001/` (aceitar certificado).  
- Demo remota / professor: **https://viniciusfeitosaa.github.io/av3-gps-tracker/**

### 6.9 Status Tarefa 2

| Item | Status |
|------|--------|
| Axios update 15 s | Feito |
| Fix `A` → canal | Feito (entradas observadas) |
| `remote.html` mapa + painel + satélite | Feito |
| Status live/stale/offline | Feito |
| GitHub Pages público | Feito e publicado |
| Internet BBB para upload | Feito (tether/WiFi) |

---

## 7. Estrutura de arquivos do projeto

```text
AV3-GPS/
├── track.js                 # Tarefa 1 — GPS + HTTPS + WebSocket
├── track_remote.js          # Tarefa 2 — GPS + Axios ThingSpeak + remote.html
├── thingspeak.config.json   # Segredos locais (NÃO versionado)
├── thingspeak.config.example.json
├── run_tracker.sh           # Sobe Tarefa 1 / watch / sim
├── run_remote.sh            # Sobe Tarefa 2
├── public/
│   ├── index.html           # Mapa local (WebSocket)
│   ├── remote.html          # Mapa remoto na BBB (ThingSpeak)
│   └── lib/leaflet/         # Leaflet local
├── docs/
│   └── index.html           # Frontend público (GitHub Pages)
├── certs/                   # SSL autoassinado (chave privada fora do Git)
├── documento.md             # Este arquivo (base do relatório)
├── THINGSPEAK.md            # Guia rápido Tarefa 2 / Pages
├── README.md
└── .gitignore
```

Espelho Windows: `C:\Users\vinic\BBB\AV3-GPS\`.  
Cópia operacional na BBB: `/var/lib/cloud9/AV3-GPS/`.

---

## 8. Adaptações em relação ao PDF (registrar no relatório)

1. **Mapa:** OpenStreetMap + Leaflet no lugar do Bing Maps (sem chave de API; opensource).  
2. **Satélite:** Esri World Imagery como camada padrão na visualização remota (OSM não tem imagery oficial).  
3. **App 1 (`uart.c` @ 115200):** omitida; UART validada via NMEA @ 9600 do GPS.  
4. **Visualização NMEA:** além de `minicom`/`gpsmon`, script `./run_tracker.sh watch`.  
5. **Leaflet local** em `public/lib/leaflet/` na BBB (robustez offline de CDN).  
6. **UI remota:** painel com histórico, sparkline e status Ao vivo/Atrasado/Offline.  
7. **URL pública:** GitHub Pages (`docs/index.html`) para cumprir a visualização remota pedida pelo professor, sem expor a BBB na internet.

---

## 9. Problemas encontrados e soluções

| Problema | Causa | Solução |
|----------|--------|---------|
| `gpsmon /dev/tty04` não acha | Zero no nome do device | Usar `/dev/ttyO4` (letra O) |
| `gpsmon` / `watch` vazios | `gpsd` ou `node` na serial; ou GPS sem VCC/TX | Parar gpsd / serviço T1; checar fiação |
| Mapa “picotado” | CDN Leaflet instável | Leaflet em `public/lib/` |
| `ERR_CERT_AUTHORITY_INVALID` | Certificado autoassinado | Aceitar exceção no navegador |
| LED GPS apagado indoor | PPS só com fix em muitas placas | Normal sem `A`; checar NMEA |
| Pin some / não move (T1) | Status `V` ou servidor parado | Outdoor até `A` ou `./run_tracker.sh sim` |
| “Só vejo gráficos ThingSpeak” | Abrir o site do canal | Abrir mapa Leaflet (BBB ou Pages) |
| Professor: “continua local” | Demo só em `192.168.7.2` | Publicar frontend no GitHub Pages |
| `/` servia `index.html` na T2 | `express.static` com index padrão | Rotas `remote.html` antes; `index: false` |
| Status sempre “Ao vivo” | Só checava existência de pontos | Status pela **idade** do último feed |
| `npm` EACCES / net | Root ou sem internet | Instalar como `debian`; tether/WiFi |
| Scripts `.sh` quebrados | CRLF do Windows | `sed -i 's/\r$//' arquivo.sh` |
| Write Key no Git | Risco de vazamento | `.gitignore` + só Read Key no HTML público |

---

## 10. Resultados obtidos (para o relatório)

- UART4 configurada; NMEA visível via `watch` / `minicom` / `gpsmon`.  
- Tarefa 1: mapa local com pin via WebSocket; simulação e fix real testados.  
- Tarefa 2: canal ThingSpeak `3588871` recebendo lat/lon a cada 15 s com fix `A`.  
- Interface remota com satélite, painel, histórico e status live/offline.  
- URL pública funcional: https://viniciusfeitosaa.github.io/av3-gps-tracker/  
- Coordenadas de ensaio outdoor (exemplo): ≈ **-3.7699, -38.4799**.

---

## 11. Checklist de demonstração

### Tarefa 1

- [x] Pinos UART configurados  
- [x] NMEA visível  
- [x] `./run_tracker.sh` (ou `sim`)  
- [x] Navegador em `https://192.168.7.2:3001` (certificado aceito)  
- [x] Mapa e pin (sim ou fix `A`)  

### Tarefa 2

- [x] Canal ThingSpeak + Axios 15 s  
- [x] BBB com internet no envio  
- [x] Mapa remoto (BBB e/ou GitHub Pages)  
- [x] Satélite / OSM + painel + status offline quando BBB parada  

---

## 12. Comandos úteis (referência rápida)

```bash
# UART
config-pin P9_11 uart
config-pin P9_13 uart

# NMEA
cd /var/lib/cloud9/AV3-GPS
sudo systemctl stop gpsd.socket gpsd
./run_tracker.sh watch
sudo gpsmon /dev/ttyO4

# Tarefa 1 (local)
./run_tracker.sh
./run_tracker.sh sim
# PC: https://192.168.7.2:3001/

# Tarefa 2 (remoto)
sudo systemctl stop av3-gps-tracker
./run_remote.sh
# Lab:   https://192.168.7.2:3001/
# Público: https://viniciusfeitosaa.github.io/av3-gps-tracker/
# Gráficos: https://thingspeak.com/channels/3588871
```

---

## 13. Conclusão (texto sugerido para o formulário / relatório)

Foi implementada a Prática 11 (GPS/UART) e as **AV3 Tarefas 1 e 2** na BeagleBone Black. A UART4 (`/dev/ttyO4` @ 9600) lê NMEA do módulo GY-GPS6MV2; o software utiliza a sentença **RMC** com status **A** para obter latitude e longitude em graus decimais. Na Tarefa 1, um servidor Node.js (HTTPS + WebSocket) atualiza um mapa OpenStreetMap/Leaflet em tempo real no endereço USB da placa. Na Tarefa 2, a BeagleBone envia as coordenadas ao ThingSpeak via Axios a cada 15 s; a visualização remota é feita por frontend Leaflet (painel, histórico, satélite Esri e status Ao vivo/Atrasado/Offline), publicado também em URL pública no GitHub Pages, de modo que a demonstração não dependa do IP local `192.168.7.2`. A etapa de teste UART-USB a 115200 (`uart.c`) foi omitida por já haver validação da UART4 com o GPS. O Bing Maps citado no PDF foi substituído por Leaflet/OSM, com camada de satélite Esri na interface remota.

---

## 14. Anexos sugeridos no relatório impresso/PDF

1. Foto das ligações GPS ↔ BBB (P9_11 / P9_13 / VCC / GND).  
2. Print de NMEA (`watch` ou `gpsmon`) com RMC `A` ou `V`.  
3. Print do mapa Tarefa 1 (`192.168.7.2:3001`) com pin.  
4. Print do canal ThingSpeak (gráficos / feeds).  
5. Print do mapa público (GitHub Pages) com status **Ao vivo** (BBB enviando) e **Offline** (BBB parada).  
6. Link do repositório e da URL Pages.  
7. Este `documento.md` (ou trechos) como memorial descritivo.
