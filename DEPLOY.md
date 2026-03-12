# RRG Web App - Deploy Guide

Guida per deploy self-hosted su VPS con Docker Compose e Nginx.

## Prerequisiti

- VPS Linux (Ubuntu 22.04+ consigliato)
- Docker + Docker Compose plugin
- Dominio (opzionale ma consigliato)
- Porte aperte: `80`, `443`

## 1) Setup server

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo apt install -y docker-compose-plugin
```

## 2) Clona progetto

```bash
git clone <URL_REPO>
cd salim
```

## 3) Configura env backend

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Valori base consigliati:

```env
REDIS_URL=redis://redis:6379
DEFAULT_BENCHMARK=SPY
CACHE_TTL_WEEKLY=3600
CACHE_TTL_DAILY=300
YFINANCE_TIMEOUT_SEC=6
CORS_ORIGINS=["https://yourdomain.com","https://www.yourdomain.com"]
CORS_ORIGIN_REGEX=
NEWSAPI_KEY=
ALPHA_VANTAGE_KEY=
```

## 4) Avvio produzione

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Controlli:

```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost/api/health
```

## 5) SSL con Certbot

```bash
sudo apt install -y certbot

docker compose -f docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --non-interactive

mkdir -p docker/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem docker/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem docker/ssl/
chmod 644 docker/ssl/fullchain.pem
chmod 600 docker/ssl/privkey.pem

docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

## 6) Comandi operativi

```bash
# log
docker compose -f docker-compose.prod.yml logs -f backend

# restart backend
docker compose -f docker-compose.prod.yml restart backend

# update codice
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 7) Troubleshooting rapido

- `502/504`: verifica log backend e nginx
- `CORS`: aggiorna `CORS_ORIGINS` in `backend/.env`
- `Redis disconnected`: verifica `REDIS_URL` e stato container redis
- `API lente`: riduci numero simboli richiesta o aumenta risorse VPS

## Endpoints utili

- `GET /api/health`
- `GET /api/rrg`
- `GET /api/prices`
- `GET /api/news`
- `GET /api/insights`
- `WS /api/ws/rrg`
