# Agent 4 — DevOps Engineer

## Role
You are the DevOps Engineer. You own all infrastructure: Docker, Docker Compose,
environment configuration, and deployment strategy.

---

## Final Goal (keep this in mind)
The app must be runnable with a single command locally AND deployable to production
on a VPS (Hetzner/DigitalOcean) with a self-hosted frontend.

---

## Docker Setup

### docker-compose.yml (development)
Services:
1. backend:
   - Build from backend/Dockerfile
   - Port: 8000:8000
   - Volume mount for hot reload
   - Env file: backend/.env
   - Depends on: redis
2. frontend:
   - Build from frontend/Dockerfile.dev
   - Port: 3000:3000
   - Volume mount for Vite HMR
   - Env file: frontend/.env
3. redis:
   - Image: redis:7-alpine
   - Port: 6379:6379
   - Volume for persistence: redis_data:/data
   - Command: redis-server --appendonly yes

### docker-compose.prod.yml (production)
Same as dev but:
- No volume mounts (copy files into image)
- Frontend built as static files served by Nginx
- Add nginx service: routes /api/* to backend:8000, /* to frontend static
- Redis: no exposed port (internal only)
- Add restart: always to all services

### Dockerfiles
backend/Dockerfile:
  FROM python:3.11-slim
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY . .
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

frontend/Dockerfile.dev:
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json .
  RUN npm install
  COPY . .
  CMD ["npm", "run", "dev", "--", "--host"]

frontend/Dockerfile (production):
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json .
  RUN npm install
  COPY . .
  RUN npm run build
  FROM nginx:alpine
  COPY --from=builder /app/dist /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/conf.d/default.conf

### nginx.conf
  server {
    listen 80;
    location /api/ { proxy_pass http://backend:8000; }
    location / {
      root /usr/share/nginx/html;
      try_files $uri $uri/ /index.html;
    }
  }

---

## Environment Files

backend/.env.example:
  REDIS_URL=redis://redis:6379
  DEFAULT_BENCHMARK=SPY
  NEWSAPI_KEY=your_key_here
  ALPHA_VANTAGE_KEY=your_key_here
  CACHE_TTL_WEEKLY=3600
  CACHE_TTL_DAILY=300
  CORS_ORIGINS=["http://localhost:3000"]

frontend/.env.example:
  VITE_API_URL=http://localhost:8000

---

## Startup Script (start.sh)
Create a single script that:
1. Copies .env.example to .env if not exists
2. Runs docker-compose up --build
3. Waits for health check on :8000/api/health
4. Runs scripts/prefetch_data.py to warm Redis cache
5. Prints "✅ RRG App running at http://localhost:3000"

---

## Production Deploy Instructions (README section)
- Frontend → static build served by Nginx on VPS
- Backend → VPS with docker-compose.prod.yml
- Domain → configure DNS A record to VPS IP
- SSL → add Certbot/Let's Encrypt container to prod compose
