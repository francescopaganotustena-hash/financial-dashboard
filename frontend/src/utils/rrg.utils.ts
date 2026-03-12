import type { Quadrant } from '../types/rrg.types'

export function getQuadrantFromString(quadrant: string): Quadrant {
  const q = quadrant.toLowerCase() as Quadrant
  if (q === 'leading') return 'leading'
  if (q === 'weakening') return 'weakening'
  if (q === 'lagging') return 'lagging'
  return 'improving'
}

export function getQuadrant(rsRatio: number, rsMomentum: number): Quadrant {
  if (rsRatio >= 100 && rsMomentum >= 100) return 'leading'
  if (rsRatio >= 100 && rsMomentum < 100) return 'weakening'
  if (rsRatio < 100 && rsMomentum < 100) return 'lagging'
  return 'improving'
}

export function getQuadrantColor(quadrant: Quadrant, opacity = 0.3): string {
  const colors: Record<Quadrant, string> = {
    leading: `rgba(6, 78, 59, ${opacity})`,
    weakening: `rgba(113, 63, 18, ${opacity})`,
    lagging: `rgba(127, 29, 29, ${opacity})`,
    improving: `rgba(30, 58, 95, ${opacity})`,
  }
  return colors[quadrant]
}

export function getQuadrantLabel(quadrant: Quadrant): string {
  const labels: Record<Quadrant, string> = {
    leading: 'LEADING',
    weakening: 'WEAKENING',
    lagging: 'LAGGING',
    improving: 'IMPROVING',
  }
  return labels[quadrant]
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals)
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export const SP500_SECTORS = [
  'XLK', 'XLF', 'XLE', 'XLV', 'XLI',
  'XLP', 'XLRE', 'XLY', 'XLC', 'XLB', 'XLU'
]

export const BENCHMARKS = ['SPY', 'QQQ', 'IWM']

export const SECTOR_NAMES: Record<string, string> = {
  XLK: 'Technology',
  XLF: 'Financials',
  XLE: 'Energy',
  XLV: 'Health Care',
  XLI: 'Industrials',
  XLP: 'Consumer Staples',
  XLRE: 'Real Estate',
  XLY: 'Consumer Discretionary',
  XLC: 'Communication',
  XLB: 'Materials',
  XLU: 'Utilities',
}