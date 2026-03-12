# Session Memory - 2026-03-11

## 1) Obiettivo della sessione
Riprendere il lavoro dal progetto esistente, riallineare runtime locale su rete `10.0.0.0/24`, risolvere anomalie funzionali UI/API emerse durante i test manuali (connessione backend, stato WebSocket, animazione grafico RRG, overlap layout, pannello prezzi vuoto, news non disponibili), e lasciare il progetto pronto per una ripartenza veloce.

## 2) Contesto iniziale rilevato
- Cartella progetto: `/home/sviluppatore/Documenti/salim`
- Log storici presenti in `logs/`:
  - `worklog_2026-03-11.md`
  - `decisions.md`
  - `qa_phase1.md`, `qa_phase3.md`, `qa_phase4.md`
- Da worklog precedente risultavano completati: hardening, lint/build frontend, compile backend, integrazione Docker/Nginx, ecc.

## 3) Runtime impostato in questa sessione
- Host LAN usato: `10.0.0.103`
- Porte usate in questa sessione:
  - Backend: `8011`
  - Frontend (Vite dev): `3011`
- URL operativi:
  - Frontend: `http://10.0.0.103:3011`
  - Backend API: `http://10.0.0.103:8011`

## 4) Problemi incontrati e fix applicati (ordine causale)

### 4.1 Frontend "Failed to connect to backend"
**Sintomo**
- UI mostrava errore generico di connessione backend.

**Diagnosi**
- API raggiungibile (`/api/rrg` e `/api/health` rispondevano).
- Problema CORS: origine frontend `http://10.0.0.103:3011` non consentita.

**Fix**
- Aggiornato elenco CORS backend in `backend/app/core/config.py` aggiungendo:
  - `http://localhost:3011`
  - `http://127.0.0.1:3011`
  - `http://10.0.0.103:3011`

---

### 4.2 Stato WebSocket incoerente (Play -> Disconnesso)
**Sintomo**
- Premendo Play lo stato passava a "Disconnesso" e non restava connesso.

**Diagnosi**
- Bug nel lifecycle del hook WebSocket (`isManualDisconnectRef`/cleanup/reconnect).
- Effetto secondario: rimbalzi di connessione (close/open ripetuti).

**Fix**
- Refactor del hook in `frontend/src/hooks/useWebSocket.ts`:
  - introdotta gestione `closeSocket(manual)` centralizzata;
  - corretta semantica manual disconnect vs cleanup effect;
  - rimosso pattern di reconnect ridondante che provocava loop.

**Esito**
- Stato passa correttamente `In pausa -> Connesso` quando si preme Play.

---

### 4.3 Animazione RRG quasi impercettibile
**Sintomo**
- Punti quasi fermi anche con Play attivo.

**Diagnosi**
- Scala fissa `0..200` troppo ampia rispetto a oscillazioni reali intorno a `100`.

**Fix**
- `frontend/src/components/RRGChart/RRGChart.tsx`:
  - scala dinamica centrata su `100` con range adattivo dai dati reali (current + tail);
  - griglia calcolata sui tick dinamici.

**Esito**
- Movimento visivamente percepibile.

---

### 4.4 Campo ricerca screener che invade il grafico
**Sintomo**
- Input "Cerca per simbolo o settore..." sovrapposto/parzialmente in area chart.

**Diagnosi**
- Overflow e compressione verticale del blocco chart.

**Fix**
- `frontend/src/components/RRGChart/RRGChart.tsx`:
  - container chart con `overflow-hidden`;
  - svg da `overflow-visible` a `overflow-hidden`.
- `frontend/src/App.tsx`:
  - blocco chart reso non comprimibile (`flex-none`, `min-h` coerente);
  - altezza chart consolidata a `520`.

**Esito**
- Ridotta/eliminata sovrapposizione nel layout testato.

---

### 4.5 Pannello Price vuoto (titolo presente ma nessun grafico)
**Sintomo**
- Header del pannello prezzi visibile (es. `XLI Price`) ma area grafico vuota.

**Diagnosi (doppia causa)**
1. Mapping dati errato: backend restituisce `date`, frontend usava `time` senza conversione.
2. Lifecycle chart: `createChart()` partiva quando il container non esisteva (stato loading), poi non si riattivava.

**Fix**
- `frontend/src/hooks/usePriceData.ts`:
  - conversione payload `date -> time`;
  - uso reale del timeframe selezionato (`1D/1W/1M/...`) nella query;
  - `interval=1wk` per `1W`, altrimenti `1d`;
  - query key aggiornata con `chartPeriod`.
- `frontend/src/components/PriceChart/PriceChart.tsx`:
  - hook chiamato con `selectedTimeframe`;
  - init chart dipendente da `selectedAsset`, `isLoading`, `error`;
  - cleanup refs robusto.

**Esito**
- Canvas del chart creati e popolati dopo selezione asset.

---

### 4.6 Sezione News con `No news available`
**Sintomo**
- Endpoint `/api/news` rispondeva `news: []` (soprattutto senza chiave NewsAPI).

**Diagnosi**
- Comportamento backend precedente: se `NEWSAPI_KEY` assente, ritorno immediato lista vuota.

**Fix**
- `backend/app/services/data_fetcher.py`:
  - introdotto `fetch_news_with_source()`:
    - usa NewsAPI se disponibile;
    - fallback automatico a `yfinance` in assenza chiave o errore;
    - normalizzazione formato yfinance (in questa versione i dati sono annidati in `content`).
  - wrapper compatibile `fetch_news()` mantenuto.
- `backend/app/routers/health.py` (`/api/news`):
  - ora ritorna anche `feed_source`.
- `backend/app/models/schemas.py`:
  - `NewsResponse` esteso con `feed_source` opzionale.
- `frontend/src/components/NewsPanel/NewsPanel.tsx`:
  - lettura `feed_source` dalla risposta;
  - aggiunta badge visuale fonte feed (es. `Yahoo Finance (fallback)`).

**Esito**
- `/api/news?symbol=XLRE` restituisce articoli con contenuti valorizzati + `feed_source`.
- Badge visibile in UI.

## 5) Stato corrente verificato a fine sessione
- Porte in ascolto:
  - `8011` backend
  - `3011` frontend
- Processi osservati:
  - `node ... vite --host 0.0.0.0 --port 3011`
  - `python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8011`
- API testate con esito positivo:
  - `/api/rrg`
  - `/api/prices`
  - `/api/news` (con `feed_source`)
  - `/api/health`

## 6) File modificati in questa sessione (ordine temporale indicativo)
1. `backend/app/core/config.py`
2. `frontend/src/components/RRGChart/RRGChart.tsx`
3. `frontend/src/components/WebSocketStatus/WebSocketStatus.tsx`
4. `frontend/src/components/WebSocketStatus/WebSocketStatus.css`
5. `frontend/src/components/Layout/Header.tsx`
6. `frontend/src/hooks/useWebSocket.ts`
7. `frontend/src/App.tsx`
8. `frontend/src/hooks/usePriceData.ts`
9. `frontend/src/components/PriceChart/PriceChart.tsx`
10. `backend/app/services/data_fetcher.py`
11. `backend/app/routers/health.py`
12. `backend/app/models/schemas.py`
13. `frontend/src/components/NewsPanel/NewsPanel.tsx`

## 7) Verifiche eseguite durante la sessione
- Frontend:
  - `npm run lint` (più volte)
  - `npx tsc --noEmit -p tsconfig.app.json` (più volte)
  - `npm run build` (eseguita durante fase di fix animazione/layout)
- Backend:
  - test endpoint via `curl`
  - test WebSocket via script `python websockets` e controllo eventi browser
- Test E2E mirati:
  - script Playwright headless per verificare stato WS, variazione coordinate punti, presenza canvas chart, presenza badge feed source.

## 8) Note operative importanti
- **Repository git non disponibile in root** (`fatal: not a git repository`), quindi non è stato possibile usare `git status`/diff per tracciamento formale.
- Il backend news è esposto tramite `health.py` (router `/api/news`), non in un file `news.py` separato.
- Il fallback Yahoo dipende dal formato `yfinance.news`, che può cambiare nel tempo; parser attuale gestisce sia formato flat sia annidato in `content`.

## 9) Comandi rapidi per ripartenza
### Avvio backend
```bash
cd /home/sviluppatore/Documenti/salim/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8011
```

### Avvio frontend
```bash
cd /home/sviluppatore/Documenti/salim/frontend
VITE_API_URL=http://10.0.0.103:8011 npm run dev -- --host 0.0.0.0 --port 3011
```

### Smoke test API
```bash
curl -sS http://10.0.0.103:8011/api/health
curl -sS "http://10.0.0.103:8011/api/rrg?symbols=XLK,XLF,XLRE&benchmark=SPY&period=weekly"
curl -sS "http://10.0.0.103:8011/api/prices?symbol=XLK&period=3mo&interval=1d"
curl -sS "http://10.0.0.103:8011/api/news?symbol=XLRE&limit=3"
```

## 10) Possibili miglioramenti successivi (non bloccanti)
1. Estendere il badge feed con colori differenziati (`NewsAPI` vs `fallback`).
2. Ridurre size bundle frontend (>500kB) con code splitting/manual chunks.
3. Valutare persistenza configurabile di host/porte in script npm dedicati (`dev:lan`).
4. Aggiungere test automatico API contract per `feed_source` e mapping `date -> time` del pannello prezzi.

## 11) Addendum operativo (aggiornamento serale)
### 11.1 Problema segnalato
- Eseguendo `start`, l'utente vedeva output incoerente sulle porte (es. backend su 3011) e percepiva che il programma "si chiudeva da solo".

### 11.2 Diagnosi
- Possibile contaminazione variabili ambiente (`BACKEND_PORT`/`FRONTEND_PORT`) nella shell utente.
- Comportamento del launcher iniziale: avvio servizi in background e uscita immediata del processo wrapper (comportamento tecnicamente corretto ma ambiguo lato UX).

### 11.3 Fix applicati
- `start` (root progetto):
  - aggiunti default espliciti `DEFAULT_BACKEND_PORT=8011` e `DEFAULT_FRONTEND_PORT=3011`;
  - aggiunta funzione `sanitize_ports()`:
    - valida che le porte siano numeriche;
    - se backend/frontend collidono, ripristina automaticamente `8011/3011`;
  - aggiunta stampa diagnostica iniziale:
    - percorso script eseguito (`Script: .../start`);
    - porte effettive (`Porte: backend=... frontend=...`);
  - migliorato bootstrap:
    - `nohup ... < /dev/null`;
    - attesa porte con retry (`wait_for_port`) invece di sleep fisso;
    - messaggi diagnostici più utili in caso di fail.
- Nuovo launcher dedicato:
  - creato `launcher/start_salim.sh`;
  - il launcher richiama solo `/home/sviluppatore/Documenti/salim/start` (evita ambiguità su altri `start`);
  - dopo l'avvio verifica che entrambe le porte siano attive;
  - resta aperto fino a INVIO con messaggio:
    - `Premi INVIO per chiudere il launcher (i servizi restano avviati).`

### 11.4 Esito verificato
- `./start` e `./launcher/start_salim.sh` mostrano configurazione corretta e avviano:
  - backend `:8011`
  - frontend `:3011`
- test di conflitto forzato (`BACKEND_PORT=3011`) gestito automaticamente con ripristino default.

### 11.5 Comando raccomandato per l'utente
```bash
cd /home/sviluppatore/Documenti/salim/launcher
./start_salim.sh
```
