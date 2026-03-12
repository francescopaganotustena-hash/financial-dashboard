import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { API_BASE_URL } from '../../config/api'
import { useAppStore } from '../../store/useAppStore'

interface StockInfo {
  symbol: string
  name: string
  exchange?: string
  type?: string
  currency?: string
  sector?: string
  industry?: string
  country?: string
  website?: string
  summary?: string
  market_cap?: number | null
  price?: number | null
  change_percent?: number | null
  trailing_pe?: number | null
  forward_pe?: number | null
  dividend_yield?: number | null
  beta?: number | null
  fifty_two_week_high?: number | null
  fifty_two_week_low?: number | null
  volume?: number | null
  average_volume?: number | null
}

const formatCompactNumber = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/d'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

const formatPrice = (value?: number | null, currency = 'USD') => {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/d'
  return `${value.toFixed(2)} ${currency}`
}

const formatPercent = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return 'n/d'
  const pct = value * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

export function StockInfoPanel() {
  const { selectedAsset } = useAppStore()
  const [info, setInfo] = useState<StockInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedAsset) {
      setInfo(null)
      setError(null)
      return
    }

    const fetchInfo = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await axios.get(`${API_BASE_URL}/api/stock-info`, {
          params: { symbol: selectedAsset },
        })
        setInfo(response.data as StockInfo)
      } catch (err) {
        setInfo(null)
        setError('Dati titolo non disponibili')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchInfo()
  }, [selectedAsset])

  if (!selectedAsset) {
    return (
      <div className="bg-card rounded-lg p-4 h-[290px] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Seleziona un titolo per vedere le informazioni</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg p-4 h-[290px] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Caricamento informazioni titolo...</p>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="bg-card rounded-lg p-4 h-[290px] flex items-center justify-center">
        <p className="text-red-400 text-sm">{error || 'Dati titolo non disponibili'}</p>
      </div>
    )
  }

  const isPositive = (info.change_percent ?? 0) >= 0

  return (
    <motion.div
      className="bg-card rounded-lg p-4 h-[290px] overflow-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.06 }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-white font-semibold">{info.symbol} Snapshot</h3>
          <p className="text-xs text-gray-400">{info.name}</p>
          <p className="text-[11px] text-gray-500">
            {[info.exchange, info.type].filter(Boolean).join(' • ') || 'Market data'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white text-sm font-semibold">{formatPrice(info.price, info.currency || 'USD')}</p>
          <p className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(info.change_percent)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-background rounded px-2 py-1.5">
          <p className="text-gray-500">Settore</p>
          <p className="text-white">{info.sector || 'n/d'}</p>
        </div>
        <div className="bg-background rounded px-2 py-1.5">
          <p className="text-gray-500">Industry</p>
          <p className="text-white">{info.industry || 'n/d'}</p>
        </div>
        <div className="bg-background rounded px-2 py-1.5">
          <p className="text-gray-500">Market Cap</p>
          <p className="text-white">{formatCompactNumber(info.market_cap)}</p>
        </div>
        <div className="bg-background rounded px-2 py-1.5">
          <p className="text-gray-500">P/E</p>
          <p className="text-white">
            {(info.trailing_pe ?? info.forward_pe) ? `${(info.trailing_pe ?? info.forward_pe)?.toFixed(2)}` : 'n/d'}
          </p>
        </div>
        <div className="bg-background rounded px-2 py-1.5">
          <p className="text-gray-500">52W Range</p>
          <p className="text-white">
            {info.fifty_two_week_low !== undefined && info.fifty_two_week_low !== null
              && info.fifty_two_week_high !== undefined && info.fifty_two_week_high !== null
              ? `${info.fifty_two_week_low.toFixed(2)} - ${info.fifty_two_week_high.toFixed(2)}`
              : 'n/d'}
          </p>
        </div>
        <div className="bg-background rounded px-2 py-1.5">
          <p className="text-gray-500">Avg Volume</p>
          <p className="text-white">{formatCompactNumber(info.average_volume ?? info.volume)}</p>
        </div>
      </div>

      {info.summary && (
        <p className="text-xs text-gray-400 leading-relaxed">
          {info.summary.length > 260 ? `${info.summary.slice(0, 260)}...` : info.summary}
        </p>
      )}
    </motion.div>
  )
}
