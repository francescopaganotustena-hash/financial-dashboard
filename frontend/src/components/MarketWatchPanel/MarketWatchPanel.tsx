import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'
import { API_BASE_URL } from '../../config/api'

type TabKey = 'prezzo' | 'prestazione' | 'tecnica' | 'fondamentale' | 'grafici'

interface MarketCatalogIndex {
  key: string
  label: string
}

interface MarketCatalogItem {
  key: string
  label: string
  flag: string
  indices: MarketCatalogIndex[]
}

interface MarketCatalogResponse {
  markets: MarketCatalogItem[]
}

interface MarketRow {
  symbol: string
  name: string
  flag: string
  last: number
  prev_close: number
  high: number
  low: number
  var_abs: number
  var_pct: number
  volume: number
  avg_volume_20d: number
  sparkline: number[]
  time: string
}

interface MarketWatchResponse {
  market: string
  market_label: string
  flag: string
  index: string
  index_label: string
  rows: MarketRow[]
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'prezzo', label: 'Prezzo' },
  { key: 'prestazione', label: 'Prestazione' },
  { key: 'tecnica', label: 'Sezione tecnica' },
  { key: 'fondamentale', label: 'Fondamentale' },
  { key: 'grafici', label: 'Grafici' },
]

function formatPrice(value: number) {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

function formatVolume(value: number) {
  return new Intl.NumberFormat('it-IT', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatVar(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatPrice(value)}`
}

function formatVarPct(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`
}

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  if (!points || points.length < 2) return <span className="text-xs text-gray-600">n/d</span>

  const width = 92
  const height = 24
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = width / (points.length - 1)

  const path = points
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / span) * height
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  const lastX = width
  const lastY = height - ((points[points.length - 1] - min) / span) * height
  const stroke = positive ? '#4ade80' : '#f87171'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.4} fill={stroke} />
    </svg>
  )
}

export function MarketWatchPanel() {
  const [catalog, setCatalog] = useState<MarketCatalogItem[]>([])
  const [selectedMarket, setSelectedMarket] = useState<string>('')
  const [selectedIndex, setSelectedIndex] = useState<string>('')
  const [rows, setRows] = useState<MarketRow[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('prezzo')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const { data } = await axios.get<MarketCatalogResponse>(`${API_BASE_URL}/api/markets/catalog`)
        setCatalog(data.markets || [])

        if ((data.markets || []).length > 0) {
          const firstMarket = data.markets[0]
          setSelectedMarket(firstMarket.key)
          if (firstMarket.indices.length > 0) {
            setSelectedIndex(firstMarket.indices[0].key)
          }
        }
      } catch (err) {
        setError('Impossibile caricare il catalogo mercati')
        console.error(err)
      }
    }

    loadCatalog()
  }, [])

  const selectedMarketData = useMemo(
    () => catalog.find((m) => m.key === selectedMarket) || null,
    [catalog, selectedMarket]
  )

  useEffect(() => {
    if (!selectedMarketData) return
    const hasIndex = selectedMarketData.indices.some((idx) => idx.key === selectedIndex)
    if (!hasIndex) {
      setSelectedIndex(selectedMarketData.indices[0]?.key || '')
    }
  }, [selectedMarketData, selectedIndex])

  useEffect(() => {
    if (!selectedMarket || !selectedIndex) return

    let cancelled = false

    const fetchTable = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await axios.get<MarketWatchResponse>(`${API_BASE_URL}/api/markets/watch`, {
          params: { market: selectedMarket, index: selectedIndex },
        })
        if (!cancelled) {
          setRows(data.rows || [])
        }
      } catch (err) {
        if (!cancelled) {
          setRows([])
          setError('Dati mercato non disponibili')
        }
        console.error(err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchTable()
    const timer = setInterval(fetchTable, 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [selectedMarket, selectedIndex])

  const selectedFlag = selectedMarketData?.flag || '🌍'
  const sortedRows = useMemo(() => {
    if (activeTab === 'prestazione') return [...rows].sort((a, b) => b.var_pct - a.var_pct)
    if (activeTab === 'tecnica') {
      return [...rows].sort((a, b) => {
        const aRange = a.high - a.low || 1
        const bRange = b.high - b.low || 1
        const aPos = (a.last - a.low) / aRange
        const bPos = (b.last - b.low) / bRange
        return bPos - aPos
      })
    }
    return rows
  }, [rows, activeTab])

  const getRangePos = (row: MarketRow) => {
    const range = row.high - row.low
    if (range <= 0) return 0
    return ((row.last - row.low) / range) * 100
  }

  const getVolatility = (row: MarketRow) => {
    if (!row.last) return 0
    return ((row.high - row.low) / row.last) * 100
  }

  const getMomentum5d = (row: MarketRow) => {
    if (!row.sparkline || row.sparkline.length < 2) return 0
    const first = row.sparkline[Math.max(0, row.sparkline.length - 6)] || row.sparkline[0]
    const last = row.sparkline[row.sparkline.length - 1]
    if (!first) return 0
    return ((last - first) / first) * 100
  }

  return (
    <motion.section
      className="bg-card rounded-lg p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.1 }}
    >
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={selectedMarket}
          onChange={(e) => setSelectedMarket(e.target.value)}
          className="min-w-[220px] bg-background border border-border rounded px-3 py-2 text-sm text-white"
        >
          {catalog.map((market) => (
            <option key={market.key} value={market.key}>
              {market.flag} {market.label}
            </option>
          ))}
        </select>

        <select
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(e.target.value)}
          className="min-w-[280px] bg-background border border-border rounded px-3 py-2 text-sm text-white"
        >
          {(selectedMarketData?.indices || []).map((idx) => (
            <option key={idx.key} value={idx.key}>
              {idx.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-background text-gray-300 border-border hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        {isLoading && rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">Caricamento mercato...</p>
        ) : error ? (
          <p className="text-sm text-red-400 py-4">{error}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              {activeTab === 'prezzo' && (
                <tr className="border-b border-border text-gray-400">
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-right py-2 px-2 font-medium">Ultimo</th>
                  <th className="text-right py-2 px-2 font-medium">Massimo</th>
                  <th className="text-right py-2 px-2 font-medium">Minimo</th>
                  <th className="text-right py-2 px-2 font-medium">Var.</th>
                  <th className="text-right py-2 px-2 font-medium">Var. %</th>
                  <th className="text-right py-2 px-2 font-medium">Vol.</th>
                  <th className="text-right py-2 px-2 font-medium">Ora</th>
                </tr>
              )}
              {activeTab === 'prestazione' && (
                <tr className="border-b border-border text-gray-400">
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-right py-2 px-2 font-medium">Ultimo</th>
                  <th className="text-right py-2 px-2 font-medium">Var.</th>
                  <th className="text-right py-2 px-2 font-medium">Var. %</th>
                  <th className="text-right py-2 px-2 font-medium">Vol.</th>
                  <th className="text-right py-2 px-2 font-medium">Classifica</th>
                </tr>
              )}
              {activeTab === 'tecnica' && (
                <tr className="border-b border-border text-gray-400">
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-right py-2 px-2 font-medium">Pos. Range</th>
                  <th className="text-right py-2 px-2 font-medium">Volatilita</th>
                  <th className="text-right py-2 px-2 font-medium">Mom. 5g</th>
                  <th className="text-right py-2 px-2 font-medium">Bias</th>
                </tr>
              )}
              {activeTab === 'fondamentale' && (
                <tr className="border-b border-border text-gray-400">
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-right py-2 px-2 font-medium">Prezzo</th>
                  <th className="text-right py-2 px-2 font-medium">Vol. Oggi</th>
                  <th className="text-right py-2 px-2 font-medium">Media 20g</th>
                  <th className="text-right py-2 px-2 font-medium">Turnover</th>
                </tr>
              )}
              {activeTab === 'grafici' && (
                <tr className="border-b border-border text-gray-400">
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-left py-2 px-2 font-medium">Trend (1 mese)</th>
                  <th className="text-right py-2 px-2 font-medium">Ultimo</th>
                  <th className="text-right py-2 px-2 font-medium">Var. %</th>
                </tr>
              )}
            </thead>
            <tbody>
              {sortedRows.map((row, index) => {
                const positive = row.var_abs >= 0
                const rangePos = getRangePos(row)
                const volatility = getVolatility(row)
                const momentum5d = getMomentum5d(row)
                const turnover = row.last * row.volume
                const strongBias = rangePos > 65 && momentum5d > 0
                const weakBias = rangePos < 35 && momentum5d < 0
                const biasLabel = strongBias ? 'Bullish' : weakBias ? 'Bearish' : 'Neutrale'

                if (activeTab === 'prezzo') {
                  return (
                    <tr key={row.symbol} className="border-b border-border/60 hover:bg-background/50 transition-colors">
                      <td className="py-2 px-2 text-white font-medium whitespace-nowrap">
                        <span className="mr-2">{row.flag || selectedFlag}</span>
                        {row.name}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-100">{formatPrice(row.last)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{formatPrice(row.high)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{formatPrice(row.low)}</td>
                      <td className={`py-2 px-2 text-right font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>
                        {formatVar(row.var_abs)}
                      </td>
                      <td className={`py-2 px-2 text-right font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>
                        {formatVarPct(row.var_pct)}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-300">{formatVolume(row.volume)}</td>
                      <td className="py-2 px-2 text-right text-gray-400">{row.time}</td>
                    </tr>
                  )
                }

                if (activeTab === 'prestazione') {
                  return (
                    <tr key={row.symbol} className="border-b border-border/60 hover:bg-background/50 transition-colors">
                      <td className="py-2 px-2 text-white font-medium whitespace-nowrap">
                        <span className="mr-2">{row.flag || selectedFlag}</span>
                        {row.name}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-100">{formatPrice(row.last)}</td>
                      <td className={`py-2 px-2 text-right font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>{formatVar(row.var_abs)}</td>
                      <td className={`py-2 px-2 text-right font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>{formatVarPct(row.var_pct)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{formatVolume(row.volume)}</td>
                      <td className="py-2 px-2 text-right text-gray-400">#{index + 1}</td>
                    </tr>
                  )
                }

                if (activeTab === 'tecnica') {
                  return (
                    <tr key={row.symbol} className="border-b border-border/60 hover:bg-background/50 transition-colors">
                      <td className="py-2 px-2 text-white font-medium whitespace-nowrap">
                        <span className="mr-2">{row.flag || selectedFlag}</span>
                        {row.name}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-100">{rangePos.toFixed(0)}%</td>
                      <td className="py-2 px-2 text-right text-gray-300">{volatility.toFixed(2)}%</td>
                      <td className={`py-2 px-2 text-right font-semibold ${momentum5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {momentum5d >= 0 ? '+' : ''}{momentum5d.toFixed(2)}%
                      </td>
                      <td className={`py-2 px-2 text-right ${
                        strongBias ? 'text-green-400' : weakBias ? 'text-red-400' : 'text-gray-300'
                      }`}>
                        {biasLabel}
                      </td>
                    </tr>
                  )
                }

                if (activeTab === 'fondamentale') {
                  return (
                    <tr key={row.symbol} className="border-b border-border/60 hover:bg-background/50 transition-colors">
                      <td className="py-2 px-2 text-white font-medium whitespace-nowrap">
                        <span className="mr-2">{row.flag || selectedFlag}</span>
                        {row.name}
                      </td>
                      <td className="py-2 px-2 text-right text-gray-100">{formatPrice(row.last)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{formatVolume(row.volume)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{formatVolume(row.avg_volume_20d || 0)}</td>
                      <td className="py-2 px-2 text-right text-gray-300">{formatVolume(turnover)}</td>
                    </tr>
                  )
                }

                return (
                  <tr key={row.symbol} className="border-b border-border/60 hover:bg-background/50 transition-colors">
                    <td className="py-2 px-2 text-white font-medium whitespace-nowrap">
                      <span className="mr-2">{row.flag || selectedFlag}</span>
                      {row.name}
                    </td>
                    <td className="py-2 px-2">
                      <Sparkline points={row.sparkline || []} positive={positive} />
                    </td>
                    <td className="py-2 px-2 text-right text-gray-100">{formatPrice(row.last)}</td>
                    <td className={`py-2 px-2 text-right font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>
                      {formatVarPct(row.var_pct)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </motion.section>
  )
}
