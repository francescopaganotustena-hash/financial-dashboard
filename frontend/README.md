# Frontend RRG Web App

Frontend React + TypeScript (Vite) per visualizzare Relative Rotation Graph, news e insight.

## Requisiti

- Node.js 20+
- npm 10+

## Configurazione

Crea/aggiorna `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

In produzione dietro reverse proxy sullo stesso dominio puoi lasciare `VITE_API_URL` vuota.

## Comandi

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

## Build produzione (container)

`Dockerfile.prod` costruisce gli asset con Vite e li serve con Nginx usando `frontend/nginx.conf`.
