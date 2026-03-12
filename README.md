# RRG Web App - Technical Summary

## Panoramica

RRG (Relative Rotation Graph) Web App è un'applicazione full-stack per l'analisi tecnica della rotazione settoriale.

## Stack Tecnologico

### Backend
- **Framework:** FastAPI (Python 3.11)
- **Data Processing:** Pandas, NumPy
- **Data Source:** yfinance
- **Cache:** Redis
- **WebSocket:** FastAPI WebSocket

### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Charts:** D3.js (custom RRGChart)
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)

## Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ RRGChart    │  │ PriceChart  │  │ AIInsightPanel      │ │
│  │ (D3.js)     │  │ (Recharts)  │  │ (AI Insights)       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ AssetTable  │  │ SectorScreen│  │ WebSocketStatus     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/WebSocket
                            │
┌─────────────────────────────────────────────────────────────┐
│                         SERVER                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FastAPI App (main.py)                               │  │
│  │   - /api/rrg      - RRG calculation                  │  │
│  │   - /api/prices   - Historical prices                │  │
│  │   - /api/news     - Financial news                   │  │
│  │   - /api/insights - AI commentary                    │  │
│  │   - /api/ws/rrg   - WebSocket updates                │  │
│  │   - /api/health   - Health check                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ Redis       │  │ yfinance    │                          │
│  │ (Cache)     │  │ (Data API)  │                          │
│  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Struttura del Progetto

```
salim/
├── backend/
│   ├── app/
│   │   ├── core/           # Configurazione
│   │   ├── models/         # Pydantic schemas
│   │   ├── routers/        # API endpoints
│   │   │   ├── rrg.py      # RRG calculation endpoint
│   │   │   ├── prices.py   # Price history endpoint
│   │   │   ├── health.py   # Health check endpoint
│   │   │   ├── websocket.py# WebSocket endpoint (NEW)
│   │   │   └── insights.py # AI insights endpoint (NEW)
│   │   ├── services/       # Business logic
│   │   │   ├── data_fetcher.py
│   │   │   ├── rrg_calculator.py
│   │   │   └── websocket_manager.py (NEW)
│   │   ├── ai_insight/     # AI commentary (NEW)
│   │   │   └── insight_generator.py
│   │   ├── main.py         # FastAPI app entry point
│   │   └── __init__.py
│   ├── Dockerfile
│   ├── Dockerfile.prod
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── RRGChart/
│   │   │   ├── PriceChart/
│   │   │   ├── NewsPanel/
│   │   │   ├── AssetTable/
│   │   │   ├── SectorScreener/
│   │   │   ├── Layout/
│   │   │   ├── AIInsightPanel/ (NEW)
│   │   │   │   ├── AIInsightPanel.tsx
│   │   │   │   ├── AIInsightPanel.css
│   │   │   │   └── index.ts
│   │   │   └── WebSocketStatus/ (NEW)
│   │   │       ├── WebSocketStatus.tsx
│   │   │       ├── WebSocketStatus.css
│   │   │       └── index.ts
│   │   ├── hooks/
│   │   │   ├── useRRGData.ts
│   │   │   └── useWebSocket.ts (NEW)
│   │   ├── store/
│   │   │   └── useAppStore.ts
│   │   ├── types/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── Dockerfile.prod
│   └── README.md
│
├── docker/
│   ├── nginx/
│   │   └── nginx.conf      # Nginx reverse proxy config
│   └── ssl/
│       └── README.md       # SSL setup instructions
│
├── docker-compose.yml      # Development
├── docker-compose.prod.yml # Production
├── DEPLOY.md               # Deploy instructions
└── README.md
```

## API Endpoints

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/rrg` | GET | Calcola RRG per simboli specificati |
| `/api/prices` | GET | Ottieni storico prezzi (OHLCV) |
| `/api/news` | GET | Ottieni news finanziarie |
| `/api/insights` | POST | Genera AI insights su RRG data |
| `/api/personal-analysis/catalog` | GET | Catalogo parametri/strumenti del modulo analisi interna |
| `/api/personal-analysis` | POST | Modulo interno: scoring, rischio e allocazione teorica |
| `/api/health` | GET | Health check del server |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/api/ws/rrg` | WebSocket per aggiornamenti RRG real-time |

**Parametri WebSocket:**
- `symbols`: Comma-separated symbols (e.g., "XLK,XLE,XLV")
- `benchmark`: Benchmark ticker (default: "SPY")
- `period`: "daily" o "weekly"

**Formato messaggio:**
```json
{
  "type": "rrg_update",
  "data": { ... RRG data ... },
  "timestamp": "2026-03-11T10:00:00Z"
}
```

## Funzionalità Implementate

### Fase 1 ✅ - Backend FastAPI
- RRG calculation engine
- Price history fetcher
- News aggregator
- Health check endpoint
- Redis caching

### Fase 2 ✅ - Frontend React
- RRGChart con D3.js (quadranti, code, etichette)
- PriceChart con Recharts
- NewsPanel
- AssetTable
- Layout responsive con sidebar

### Fase 3 ✅ - Feature Avanzate
- SectorScreener per screening settori
- Integrazione completa backend-frontend
- Fallback polling se WebSocket non disponibile

### Fase 4 ✅ - Polish + Deploy
- **WebSocket** per aggiornamenti real-time
- **AI Insight Panel** per commentary automatico
- **Docker Compose** production-ready
- **Nginx** reverse proxy con SSL support
- **Deploy guide** completa per VPS/self-hosted

## RRG Quadrants

```
                    RS Momentum
                        ↑
         Weakening      │      Leading
         (Giallo)       │      (Verde)
                        │
    ────────────────────┼───────────────────→ RS Ratio
                        │
         Lagging        │      Improving
         (Rosso)        │      (Blu)
                        │
```

- **Leading:** Outperforming con momentum positivo
- **Weakening:** Outperforming ma momentum in calo
- **Lagging:** Underperforming con momentum negativo
- **Improving:** Underperforming ma momentum in crescita

## Comandi Utili

### Sviluppo Locale

```bash
# Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

### Docker

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.prod.yml up -d

# Logs
docker compose logs -f backend

# Restart
docker compose restart backend
```

## Variabili d'Ambiente

### Backend (.env)

```env
REDIS_URL=redis://localhost:6379
DEFAULT_BENCHMARK=SPY
NEWSAPI_KEY=your_key
ALPHA_VANTAGE_KEY=your_key
CACHE_TTL_WEEKLY=3600
CACHE_TTL_DAILY=300
CORS_ORIGINS=["http://localhost:3001"]
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
VITE_ENABLE_PERSONAL_ANALYSIS=true
```

## Rollback Feature "Analisi Interna"

Per disattivare rapidamente la nuova pagina senza revert di codice:

```env
VITE_ENABLE_PERSONAL_ANALYSIS=false
```

Effetto operativo:
- nasconde la voce menu "Analisi Interna"
- blocca la route hash `#/personal-analysis` riportando alla dashboard
- lascia invariata la dashboard principale

`VITE_API_URL` puo` anche essere lasciata vuota in produzione dietro reverse proxy (`/api` e `/api/ws` sullo stesso host del frontend).

## License

MIT License
