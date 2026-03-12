export interface RRGDataPoint {
  symbol: string
  name: string
  quadrant: 'Leading' | 'Weakening' | 'Lagging' | 'Improving'
  current: {
    rs_ratio: number
    rs_momentum: number
  }
  tail: Array<{
    date: string
    rs_ratio: number
    rs_momentum: number
  }>
}

export interface RRGHistoricalPoint {
  symbol: string
  rsRatio: number
  rsMomentum: number
  timestamp: string
}

export interface AssetData {
  symbol: string
  name: string
  sector: string
  rsRatio: number
  rsMomentum: number
  quadrant: 'leading' | 'weakening' | 'lagging' | 'improving'
  price?: number
  change?: number
  changePercent?: number
}

export interface PriceData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface NewsItem {
  title: string
  summary: string
  source: string
  url: string
  published_at: string
  symbols?: string[]
}

export type Quadrant = 'leading' | 'weakening' | 'lagging' | 'improving'
export type Period = 'weekly' | 'daily'
export type PriceChartPeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y'

export interface ScreenerFilters {
  quadrants: Quadrant[]
  rsRatioMin?: number
  rsRatioMax?: number
  rsMomentumMin?: number
  rsMomentumMax?: number
  searchQuery: string
}