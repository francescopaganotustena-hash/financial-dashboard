# RRG Web App - Deploy Guide

Guida completa per il deploy in produzione della RRG Web App.

---

## Indice

1. [Prerequisiti](#prerequisiti)
2. [Deploy Backend su VPS](#deploy-backend-su-vps)
3. [Deploy Frontend su Vercel](#deploy-frontend-su-vercel)
4. [Deploy Completo con Docker Compose](#deploy-completo-con-docker-compose)
5. [Configurazione SSL](#configurazione-ssl)
6. [Monitoraggio e Manutenzione](#monitoraggio-e-manutenzione)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisiti

### Per il Backend (VPS)

- Server Ubuntu 22.04 o superiore
- Docker e Docker Compose installati
- Dominio configurato (es. `api.yourdomain.com`)
- API key per i servizi esterni:
  - NewsAPI (per news finanziarie)
  - Alpha Vantage (per dati di mercato)

### Per il Frontend (Vercel)

- Node.js 18+ installato localmente
- Account Vercel
- Dominio opzionale per il frontend

---

## Deploy Backend su VPS

### Step 1: Installare Docker

```bash
# Aggiornare il sistema
sudo apt update && sudo apt upgrade -y

# Installare Docker
curl -fsSL https://get.docker.com | sudo sh

# Aggiungere utente al gruppo docker
sudo usermod -aG docker $USER

# Installare Docker Compose Plugin
sudo apt install -y docker-compose-plugin

# Verificare installazione
docker --version
docker compose version
```

### Step 2: Clonare il Repository

```bash
# Clonare il repository
git clone https://github.com/yourusername/rrg-webapp.git
cd rrg-webapp

# O copia la directory esistente
# /home/sviluppatore/Documenti/salim
```

### Step 3: Configurare le Variabili d'Ambiente

```bash
# Creare file .env dal template
cp backend/.env.example backend/.env

# Modificare il file .env
nano backend/.env
```

Contenuto consigliato per `backend/.env`:

```env
# Redis
REDIS_URL=redis://redis:6379

# Benchmark
DEFAULT_BENCHMARK=SPY

# API Keys (ottieni da https://newsapi.org e https://www.alphavantage.co)
NEWSAPI_KEY=your_newsapi_key_here
ALPHA_VANTAGE_KEY=your_alpha_vantage_key_here

# Cache TTL (secondi)
CACHE_TTL_WEEKLY=3600
CACHE_TTL_DAILY=300

# CORS Origins
CORS_ORIGINS=["http://localhost:3001","https://yourdomain.com","https://www.yourdomain.com"]

# Environment
ENV=production
```

### Step 4: Avviare con Docker Compose

```bash
# Dalla directory root del progetto
cd /home/sviluppatore/Documenti/salim

# Avviare tutti i servizi
docker compose -f docker-compose.prod.yml up -d

# Verificare lo stato
docker compose -f docker-compose.prod.yml ps

# Visualizzare i log
docker compose -f docker-compose.prod.yml logs -f backend
```

### Step 5: Verificare il Backend

```bash
# Test health endpoint
curl http://localhost:8000/api/health

# Test RRG endpoint
curl "http://localhost:8000/api/rrg?symbols=XLK,XLE,XLV&benchmark=SPY&period=daily"
```

---

## Deploy Frontend su Vercel

### Opzione A: Vercel CLI (Consigliato per sviluppo)

```bash
# Installare Vercel CLI
npm install -g vercel

# Login
vercel login

# Navigare alla directory frontend
cd /home/sviluppatore/Documenti/salim/frontend

# Deploy di staging
vercel

# Deploy di produzione
vercel --prod
```

### Opzione B: Vercel Dashboard (Consigliato per produzione)

1. Vai su [vercel.com](https://vercel.com)
2. Clicca "Add New Project"
3. Importa il repository GitHub
4. Configura le impostazioni di build:

```
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

5. Configura le Variabili d'Ambiente nel dashboard Vercel:

```
VITE_API_URL=https://api.yourdomain.com
```

Se frontend e backend sono serviti dallo stesso dominio tramite Nginx reverse proxy, puoi lasciare `VITE_API_URL` vuota.

6. Clicca "Deploy"

### Opzione C: Build Statica e Deploy su Nginx

Se deployi tutto sulla stessa VPS:

```bash
# Nel frontend, modifica vite.config.ts
export default defineConfig({
  // ...
  base: '/',
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})

# Build
cd frontend
npm run build

# I file statici sono in dist/
# Vengono serviti automaticamente da nginx
```

---

## Deploy Completo con Docker Compose

### Architecture

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  (Port 80)  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
   │   Frontend  │  │  Backend    │  │   Redis     │
   │   (Static)  │  │  (Port 8000)│  │  (Port 6379)│
   └─────────────┘  └─────────────┘  └─────────────┘
```

### Comandi Utili

```bash
# Avviare tutti i servizi
docker compose -f docker-compose.prod.yml up -d

# Fermare tutti i servizi
docker compose -f docker-compose.prod.yml down

# Riavviare un servizio
docker compose -f docker-compose.prod.yml restart backend

# Visualizzare i log in tempo reale
docker compose -f docker-compose.prod.yml logs -f

# Scalare i servizi (se necessario)
docker compose -f docker-compose.prod.yml up -d --scale backend=3

# Aggiornare dopo git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Nota: `docker-compose.prod.yml` monta la configurazione Nginx da `docker/nginx/nginx.conf` e i certificati da `docker/ssl/`.

### Health Checks

```bash
# Nginx
curl http://localhost/

# Backend API
curl http://localhost/api/health

# Redis
docker exec rrg-redis redis-cli ping
```

---

## Configurazione SSL

### Step 1: Installare Certbot

```bash
sudo apt install -y certbot
```

### Step 2: Ottenere Certificato

```bash
# Fermare temporaneamente nginx
docker compose -f docker-compose.prod.yml stop nginx

# Ottenere certificato
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d api.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --non-interactive
```

### Step 3: Copiare Certificati

```bash
# Creare directory ssl
mkdir -p /home/sviluppatore/Documenti/salim/docker/ssl

# Copiare certificati
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem \
  /home/sviluppatore/Documenti/salim/docker/ssl/

sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem \
  /home/sviluppatore/Documenti/salim/docker/ssl/

# Impostare permessi
chmod 644 /home/sviluppatore/Documenti/salim/docker/ssl/fullchain.pem
chmod 600 /home/sviluppatore/Documenti/salim/docker/ssl/privkey.pem
```

### Step 4: Abilitare SSL in Nginx

Modifica `docker/nginx/nginx.conf`:

```nginx
# De-commenta la sezione SSL:
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

### Step 5: Riavviare

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

### Auto-Rinnovo

```bash
# Creare script di rinnovo
sudo nano /usr/local/bin/certbot-renew-rrg.sh
```

```bash
#!/bin/bash
certbot renew --quiet
docker cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem rrg-nginx:/etc/nginx/ssl/fullchain.pem
docker cp /etc/letsencrypt/live/yourdomain.com/privkey.pem rrg-nginx:/etc/nginx/ssl/privkey.pem
docker exec rrg-nginx nginx -s reload
```

```bash
# Rendere eseguibile
sudo chmod +x /usr/local/bin/certbot-renew-rrg.sh

# Aggiungere a crontab (rinnovo giornaliero alle 3:00)
sudo crontab -e
0 3 * * * /usr/local/bin/certbot-renew-rrg.sh
```

---

## Monitoraggio e Manutenzione

### Log

```bash
# Log di tutti i servizi
docker compose -f docker-compose.prod.yml logs -f

# Log di un servizio specifico
docker compose -f docker-compose.prod.yml logs -f backend

# Log degli ultimi 100 eventi
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Metriche

```bash
# Utilizzo risorse
docker stats

# Spazio disco
docker system df

# Pulizia
docker system prune -a
```

### Backup Redis

```bash
# Backup dati Redis
docker exec rrg-redis redis-cli BGSAVE

# Copia file di backup
docker cp rrg-redis:/data/dump.rdb ./backup-redis-$(date +%Y%m%d).rdb
```

### Update

```bash
# Aggiornare codice
git pull

# Ricostruire e riavviare
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Troubleshooting

### Backend non risponde

```bash
# Verificare lo stato
docker compose -f docker-compose.prod.yml ps

# Controllare i log
docker compose -f docker-compose.prod.yml logs backend

# Riavviare il servizio
docker compose -f docker-compose.prod.yml restart backend
```

### WebSocket non si connette

1. Verificare che nginx abbia l'upgrade header:
```bash
docker exec rrg-nginx cat /etc/nginx/nginx.conf | grep -A5 "Upgrade"
```

2. Controllare i log del backend:
```bash
docker compose -f docker-compose.prod.yml logs backend | grep WebSocket
```

### Errori SSL

```bash
# Verificare certificato
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Controllare scadenza
certbot certificates
```

### Redis Connection Error

```bash
# Verificare Redis
docker exec rrg-redis redis-cli ping

# Riavviare Redis
docker compose -f docker-compose.prod.yml restart redis
```

### CORS Error

Verifica che `CORS_ORIGINS` nel file `.env` includa il dominio del frontend:

```env
CORS_ORIGINS=["https://yourdomain.com","https://www.yourdomain.com"]
```

---

## Quick Reference

| Servizio | Porta | URL |
|----------|-------|-----|
| Nginx (HTTP) | 80 | http://localhost |
| Nginx (HTTPS) | 443 | https://localhost |
| Backend API | 8000 | http://localhost:8000 |
| Redis | 6379 | internal |

### Endpoints API

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/rrg` | GET | RRG data |
| `/api/prices` | GET | Price history |
| `/api/news` | GET | Financial news |
| `/api/insights` | POST | AI insights |
| `/api/ws/rrg` | WS | WebSocket RRG updates |

---

## Contact

Per supporto, apri una issue sul repository GitHub.

---

## Quick Setup: Vercel + Render (Git Sync)

Questa configurazione usa i piani gratuiti iniziali:
- Frontend: Vercel (directory `frontend`)
- Backend: Render (directory `backend`, file `render.yaml`)
- Deploy automatico a ogni push su GitHub

### 1) Deploy backend su Render

1. Vai su Render -> `New +` -> `Blueprint`.
2. Seleziona questo repository GitHub.
3. Render usera automaticamente `render.yaml`.
4. Crea il servizio `financial-dashboard-api`.
5. In Environment aggiorna:
   - `CORS_ORIGINS` con URL frontend reale, es:
     - `["https://financial-dashboard.vercel.app"]`
   - opzionale `CORS_ORIGIN_REGEX` per preview deploy:
     - `^https://.*\\.vercel\\.app$`
   - `NEWSAPI_KEY` (opzionale)
   - `ALPHA_VANTAGE_KEY` (opzionale)
6. Prendi la URL pubblica backend Render.

### 2) Deploy frontend su Vercel

1. Vai su Vercel -> `Add New Project`.
2. Importa lo stesso repository GitHub.
3. Configura:
   - `Root Directory`: `frontend`
   - Framework: Vite (auto)
4. In Environment Variables aggiungi:
   - `VITE_API_URL=https://<tuo-backend-render>.onrender.com`
5. Deploy.

### 3) Verifica

```bash
curl -sS https://<tuo-backend-render>.onrender.com/api/health
```

Controlla poi in UI:
- Ricerca ticker (`AAPL`, `Stellantis`)
- Tabella market watch
- Grafico RRG e pannelli info

### 4) Aggiornamenti futuri

- Ogni `git push` su `main` avvia auto-deploy su Vercel e Render.
