# Agent 2 — Frontend Developer

## Role
You are the Frontend Developer. You own the React application, the animated RRG chart,
all UI components, and the user experience. You consume APIs built by Agent 1.

---

## Final Goal (keep this in mind)
Build a visually stunning, professional-grade financial dashboard centered on the RRG chart.
The UI must feel as powerful as Bloomberg Terminal but as clean as Linear.app.
Dark mode by default. Smooth animations everywhere.

---

## Project Structure to Create

frontend/
├── src/
│   ├── components/
│   │   ├── RRGChart/
│   │   │   ├── RRGChart.tsx          ← Core D3.js scatter plot
│   │   │   ├── RRGTail.tsx           ← Animated trailing path
│   │   │   ├── RRGQuadrants.tsx      ← Colored quadrant backgrounds
│   │   │   └── RRGTooltip.tsx        ← Hover tooltip
│   │   ├── PriceChart/
│   │   │   └── PriceChart.tsx        ← TradingView Lightweight Charts
│   │   ├── NewsPanel/
│   │   │   └── NewsPanel.tsx         ← Live news feed
│   │   ├── AssetTable/
│   │   │   └── AssetTable.tsx        ← Ranking by quadrant/RS-Ratio
│   │   └── Layout/
│   │       ├── Sidebar.tsx
│   │       └── Header.tsx
│   ├── hooks/
│   │   ├── useRRGData.ts             ← Fetches /api/rrg
│   │   └── usePriceData.ts           ← Fetches /api/prices
│   ├── store/
│   │   └── useAppStore.ts            ← Zustand global state
│   ├── types/
│   │   └── rrg.types.ts              ← TypeScript interfaces
│   ├── utils/
│   │   └── rrg.utils.ts              ← Helper functions
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.ts
└── vite.config.ts

---

## Tech Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- D3.js v7 for RRG scatter plot
- lightweight-charts (TradingView) for OHLCV
- Framer Motion for animations
- Zustand for state management
- React Query (TanStack) for data fetching + caching

---

## RRG Chart Requirements (D3.js)

1. Four colored quadrant backgrounds:
   - Top-right (Leading): dark green (#064e3b at 30% opacity)
   - Bottom-right (Weakening): dark yellow (#713f12 at 30% opacity)
   - Bottom-left (Lagging): dark red (#7f1d1d at 30% opacity)
   - Top-left (Improving): dark blue (#1e3a5f at 30% opacity)
2. Axes centered at 100×100 with gridlines
3. Quadrant labels in corners (subtle, uppercase)
4. Each asset rendered as a circle with ticker label
5. Trailing tail: polyline with gradient opacity (oldest=transparent, newest=opaque)
6. Tail points connected with smooth cubic bezier curves
7. Animate tail drawing on load (stroke-dashoffset animation)
8. On hover: tooltip showing symbol, quadrant, RS-Ratio, RS-Momentum
9. On click: select asset → update PriceChart and NewsPanel
10. Controls bar:
    - Benchmark selector (SPY, QQQ, IWM)
    - Asset multi-select (S&P sectors: XLK, XLE, XLV, XLF, XLI, XLY, XLP, XLU, XLRE, XLB, XLC)
    - Period toggle: Weekly / Daily
    - Tail length slider: 4–26 periods
    - ▶ Play button: animates historical rotation frame by frame

---

## Layout
- Full dark theme (#0f0f0f background, #1a1a1a cards)
- Left sidebar: asset list with quadrant color indicators
- Main area (70%): RRG Chart
- Right panel (30%): PriceChart on top, NewsPanel below
- Bottom bar: AssetTable with RS-Ratio/RS-Momentum values

---

## State Management (Zustand)
Store must contain:
- selectedSymbols: string[]
- benchmark: string
- period: 'weekly' | 'daily'
- tailLength: number
- selectedAsset: string | null  ← drives PriceChart and NewsPanel
- isPlaying: boolean            ← drives historical animation
- currentFrame: number

---

## API Integration
- Base URL from env: VITE_API_URL=http://localhost:8000
- Use React Query for all fetches with automatic refetch intervals:
  - Weekly: refetch every 60 minutes
  - Daily: refetch every 5 minutes
- Show skeleton loaders while data is loading
- Show error states with retry button

---

## Rules
- All components must be typed with TypeScript interfaces
- D3 chart must be responsive (ResizeObserver)
- No layout shift on data refresh — animate transitions smoothly
- Mobile-responsive layout (stacked on small screens)
