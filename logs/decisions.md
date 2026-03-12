# Architectural Decisions Log

_Aggiornato dal Team Leader ad ogni decisione rilevante._

| Data | Decisione | Motivazione | Agente |
|---|---|---|---|
| 2026-03-11 | yfinance come source primaria | Gratuito, nessuna API key, affidabile per EOD | Agent 3 |
| 2026-03-11 | Redis per caching | Evita rate limit yfinance, riduce latenza | Agent 1 |
| 2026-03-11 | D3.js per RRG chart | Massima flessibilità per scatter plot custom animato | Agent 2 |
| 2026-03-11 | Zustand per state | Leggero, ideale per stato real-time complesso | Agent 2 |
| 2026-03-11 | Docker Compose monorepo | Allineato con stack esistente dell'utente | Agent 4 |
| 2026-03-11 | FastAPI backend con 4 endpoint | RRG, Prices, News, Health con caching Redis | Agent 1 |
| 2026-03-11 | React + Vite + D3.js frontend | Grafico RRG interattivo, tema scuro, componenti | Agent 2 |
| 2026-03-11 | Tailwind CSS + Zustand | Styling e state management | Agent 2 |
| 2026-03-11 | TradingView Lightweight Charts | OHLCV performante con volume bars | Agent 3 |
| 2026-03-11 | Sector Screener con filtri multipli | Quadranti, RS-Ratio, RS-Momentum slider | Agent 3 |
| 2026-03-11 | WebSocket per real-time updates | Aggiornamenti RRG senza reload pagina | Agent 4 |
| 2026-03-11 | AI Insight Panel template-based | Commentary automatico su dati RRG | Agent 4 |
| 2026-03-11 | Nginx reverse proxy + SSL | Production deploy con Let's Encrypt | Agent 4 |
