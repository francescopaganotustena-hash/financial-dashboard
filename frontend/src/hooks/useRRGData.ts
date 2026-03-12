import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import type { RRGDataPoint, RRGHistoricalPoint } from '../types/rrg.types'
import { useAppStore } from '../store/useAppStore'
import { API_BASE_URL } from '../config/api'

interface RRGAPIResponse {
  benchmark: string
  period: string
  generated_at: string
  assets: RRGDataPoint[]
}

async function fetchRRGData(benchmark: string, period: string, symbols: string[]): Promise<RRGDataPoint[]> {
  const response = await axios.get<RRGAPIResponse>(`${API_BASE_URL}/api/rrg`, {
    params: {
      symbols: symbols.join(','),
      benchmark,
      period
    },
  })
  return response.data.assets
}

async function fetchRRGHistory(
  benchmark: string,
  period: string,
  symbol: string
): Promise<RRGHistoricalPoint[]> {
  const response = await axios.get(`${API_BASE_URL}/api/rrg`, {
    params: {
      symbols: symbol,
      benchmark,
      period,
      tail_length: 26
    },
  })

  const data = response.data as RRGAPIResponse
  if (!data.assets || data.assets.length === 0) {
    return []
  }

  const asset = data.assets[0]
  return asset.tail.map((point) => ({
    symbol: asset.symbol,
    rsRatio: point.rs_ratio,
    rsMomentum: point.rs_momentum,
    timestamp: point.date,
  }))
}

export function useRRGData() {
  const { benchmark, period, selectedSymbols } = useAppStore()

  const query = useQuery({
    queryKey: ['rrg', benchmark, period, selectedSymbols.join(',')],
    queryFn: () => fetchRRGData(benchmark, period, selectedSymbols),
    refetchInterval: period === 'weekly' ? 60 * 60 * 1000 : 5 * 60 * 1000,
    staleTime: period === 'weekly' ? 30 * 60 * 1000 : 2 * 60 * 1000,
  })

  return query
}

export function useRRGHistory(symbol: string | null) {
  const { benchmark, period } = useAppStore()

  return useQuery({
    queryKey: ['rrgHistory', benchmark, period, symbol],
    queryFn: () => fetchRRGHistory(benchmark, period, symbol!),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  })
}
