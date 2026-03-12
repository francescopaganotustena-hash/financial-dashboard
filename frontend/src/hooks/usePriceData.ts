import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { PriceData } from '../types/rrg.types'
import { API_BASE_URL } from '../config/api'
import type { PriceChartPeriod } from '../store/useAppStore'

// Mappa period dal frontend ai parametri backend
const PERIOD_MAP: Record<string, string> = {
  '1D': '1mo',
  '1W': '1mo',
  '1M': '3mo',
  '3M': '6mo',
  '6M': '1y',
  '1Y': '2y',
  'weekly': '1y',
  'daily': '1mo',
}

interface BackendPriceDataPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface BackendPricesResponse {
  data?: BackendPriceDataPoint[]
}

async function fetchPriceData(
  symbol: string,
  chartPeriod: PriceChartPeriod,
  rrgPeriod: 'weekly' | 'daily'
): Promise<PriceData[]> {
  const backendPeriod = PERIOD_MAP[chartPeriod] || PERIOD_MAP[rrgPeriod] || '1y'
  const interval = chartPeriod === '1W' ? '1wk' : '1d'
  const response = await axios.get(`${API_BASE_URL}/api/prices`, {
    params: { symbol, period: backendPeriod, interval },
  })
  const payload = response.data as BackendPricesResponse
  const rows = payload.data || []
  return rows.map((row) => ({
    time: row.date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
  }))
}

export function usePriceData(
  symbol: string | null,
  chartPeriod: PriceChartPeriod,
  rrgPeriod: 'weekly' | 'daily' = 'weekly'
) {
  return useQuery({
    queryKey: ['prices', symbol, chartPeriod, rrgPeriod],
    queryFn: () => fetchPriceData(symbol!, chartPeriod, rrgPeriod),
    enabled: !!symbol,
    refetchInterval: rrgPeriod === 'weekly' ? 60 * 60 * 1000 : 5 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
  })
}
