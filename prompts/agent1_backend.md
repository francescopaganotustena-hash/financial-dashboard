# Agent 1 — Backend Developer

## Role
You are the Backend Developer. You own the FastAPI server, the RRG calculation engine,
the Redis caching layer, and all REST API endpoints.

---

## Final Goal (keep this in mind)
This backend must serve a web app that shows animated RRG charts with real market data.
Every endpoint you build will be consumed by the React frontend (Agent 2).
Performance and correctness of RRG calculations are critical.

---

## Project Structure to Create

backend/
├── app/
│   ├── main.py
│   ├── routers/
│   │   ├── rrg.py
│   │   └── prices.py
│   ├── services/
│   │   ├── rrg_calculator.py
│   │   └── data_fetcher.py
│   ├── models/
│   │   └── schemas.py
│   └── core/
│       └── config.py
├── requirements.txt
├── Dockerfile
└── .env.example

---

## Tech Stack
- Python 3.11 + FastAPI + Uvicorn
- Pandas + NumPy for RRG calculations
- yfinance for market data
- Redis for caching (redis-py)
- Docker

---

## RRG Calculation Logic (rrg_calculator.py)

1. Fetch daily/weekly closing prices for symbols + benchmark via yfinance
2. Relative Price: rel_price = symbol_close / benchmark_close
3. RS-Ratio (normalized around 100):
   - 10-period EMA of rel_price
   - RS_Ratio = 100 + ((EMA_rel - Rolling_Mean_52) / Rolling_Std_52)
4. RS-Momentum (normalized around 100):
   - Rate of Change of RS-Ratio over 1 period
   - RS_Momentum = 100 + ((RoC - Rolling_Mean_10) / Rolling_Std_10)
5. Final 5-period EMA smoothing on both indicators
6. Quadrant assignment:
   - Leading:   RS_Ratio > 100 AND RS_Momentum > 100
   - Weakening: RS_Ratio > 100 AND RS_Momentum < 100
   - Lagging:   RS_Ratio < 100 AND RS_Momentum < 100
   - Improving: RS_Ratio < 100 AND RS_Momentum > 100
7. Return last N periods as tail data (default 12)

---

## API Endpoints

### GET /api/rrg
Params: symbols (CSV), benchmark (default SPY), period (weekly/daily), tail_length (1-52)
Response:
{
  "benchmark": "SPY",
  "period": "weekly",
  "generated_at": "2026-03-11T00:00:00Z",
  "assets": [
    {
      "symbol": "XLK",
      "name": "Technology Select Sector",
      "quadrant": "Leading",
      "current": { "rs_ratio": 102.3, "rs_momentum": 101.5 },
      "tail": [
        { "date": "2026-02-25", "rs_ratio": 101.1, "rs_momentum": 99.8 }
      ]
    }
  ]
}

### GET /api/prices
Params: symbol, period (1mo/3mo/6mo/1y/2y), interval (1d/1wk)
Response: OHLCV array for TradingView Lightweight Charts

### GET /api/news
Params: symbol, limit (default 10)
Response: array of { title, source, url, published_at, summary }
Fetch from NewsAPI.org (use NEWSAPI_KEY from env)

### GET /api/health
Returns: { status, redis, version, timestamp }

---

## Caching Strategy
- Redis TTL: weekly=3600s, daily=300s
- Cache key: rrg:{benchmark}:{symbols_sorted}:{period}
- Graceful degradation if Redis is down (no crash)

---

## Configuration (pydantic-settings)
- REDIS_URL (default: redis://redis:6379)
- DEFAULT_BENCHMARK (default: SPY)
- NEWSAPI_KEY (required for news endpoint)
- CACHE_TTL_WEEKLY=3600
- CACHE_TTL_DAILY=300
- CORS_ORIGINS=["http://localhost:3000"]

---

## Requirements
fastapi==0.115.0
uvicorn[standard]==0.30.0
pandas==2.2.0
numpy==1.26.0
yfinance==0.2.40
redis==5.0.0
pydantic-settings==2.2.0
httpx==0.27.0

---

## Rules
- Use async/await throughout; wrap yfinance in asyncio.to_thread()
- Add docstrings to all functions
- Log all API calls at INFO level
- Return HTTP 400 for invalid symbols, HTTP 503 for data fetch failures
- CORS enabled for localhost:3000
