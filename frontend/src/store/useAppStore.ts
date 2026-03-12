import { create } from 'zustand'
import type { Period } from '../types/rrg.types'
import { SP500_SECTORS, BENCHMARKS } from '../utils/rrg.utils'

export type PriceChartPeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y'

export interface ScreenerFiltersState {
  quadrants: string[]
  rsRatioMin?: number
  rsRatioMax?: number
  rsMomentumMin?: number
  rsMomentumMax?: number
  searchQuery: string
}

interface AppState {
  selectedSymbols: string[]
  benchmark: string
  period: Period
  tailLength: number
  selectedAsset: string | null
  isPlaying: boolean
  currentFrame: number
  priceChartPeriod: PriceChartPeriod
  screenerFilters: ScreenerFiltersState

  setSelectedSymbols: (symbols: string[]) => void
  toggleSymbol: (symbol: string) => void
  setBenchmark: (benchmark: string) => void
  setPeriod: (period: Period) => void
  setTailLength: (length: number) => void
  setSelectedAsset: (symbol: string | null) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentFrame: (frame: number) => void
  setPriceChartPeriod: (period: PriceChartPeriod) => void
  setScreenerFilters: (filters: Partial<ScreenerFiltersState>) => void
  resetScreenerFilters: () => void
  reset: () => void
}

const initialScreenerFilters: ScreenerFiltersState = {
  quadrants: [],
  rsRatioMin: undefined,
  rsRatioMax: undefined,
  rsMomentumMin: undefined,
  rsMomentumMax: undefined,
  searchQuery: '',
}

const initialState = {
  selectedSymbols: SP500_SECTORS,
  benchmark: BENCHMARKS[0],
  period: 'weekly' as Period,
  tailLength: 12,
  selectedAsset: null,
  isPlaying: false,
  currentFrame: 0,
  priceChartPeriod: '1M' as PriceChartPeriod,
  screenerFilters: initialScreenerFilters,
}

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setSelectedSymbols: (symbols) => set({ selectedSymbols: symbols }),

  toggleSymbol: (symbol) => set((state) => {
    const isSelected = state.selectedSymbols.includes(symbol)
    const newSymbols = isSelected
      ? state.selectedSymbols.filter((s) => s !== symbol)
      : [...state.selectedSymbols, symbol]
    return { selectedSymbols: newSymbols.length > 0 ? newSymbols : state.selectedSymbols }
  }),

  setBenchmark: (benchmark) => set({ benchmark }),

  setPeriod: (period) => set({ period }),

  setTailLength: (tailLength) => set({ tailLength: Math.max(4, Math.min(26, tailLength)) }),

  setSelectedAsset: (symbol) => set({ selectedAsset: symbol }),

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  setCurrentFrame: (currentFrame) => set({ currentFrame }),

  setPriceChartPeriod: (period) => set({ priceChartPeriod: period }),

  setScreenerFilters: (filters) => set((state) => ({
    screenerFilters: { ...state.screenerFilters, ...filters }
  })),

  resetScreenerFilters: () => set({ screenerFilters: initialScreenerFilters }),

  reset: () => set(initialState),
}))