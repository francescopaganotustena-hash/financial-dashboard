import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { useRRGData } from '../../hooks/useRRGData'
import { useAppStore } from '../../store/useAppStore'
import { API_BASE_URL } from '../../config/api'
import { getQuadrantFromString, formatNumber, SECTOR_NAMES } from '../../utils/rrg.utils'
import { X, RotateCcw, Search, Filter } from 'lucide-react'
import type { Quadrant } from '../../types/rrg.types'

const QUADRANTS: { value: Quadrant; label: string; color: string }[] = [
  { value: 'leading', label: 'Leading', color: 'bg-green-600' },
  { value: 'weakening', label: 'Weakening', color: 'bg-yellow-600' },
  { value: 'lagging', label: 'Lagging', color: 'bg-red-600' },
  { value: 'improving', label: 'Improving', color: 'bg-blue-600' },
]

interface SymbolSuggestion {
  symbol: string
  name: string
  exchange?: string
  type?: string
}

export function SectorScreener() {
  const { data } = useRRGData()
  const { screenerFilters, setScreenerFilters, resetScreenerFilters, setSelectedAsset } = useAppStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [stockQuery, setStockQuery] = useState('')
  const [symbolSuggestions, setSymbolSuggestions] = useState<SymbolSuggestion[]>([])
  const [isSearchingSymbols, setIsSearchingSymbols] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)

  const normalizedQuery = stockQuery.trim().toUpperCase()
  const canOpenAsTicker = /^[A-Z][A-Z0-9.-]{0,9}$/.test(normalizedQuery)

  useEffect(() => {
    const query = stockQuery.trim()
    if (query.length < 2) {
      setSymbolSuggestions([])
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
      return
    }

    let isCancelled = false
    const timer = setTimeout(async () => {
      setIsSearchingSymbols(true)
      try {
        const response = await axios.get(`${API_BASE_URL}/api/symbol-search`, {
          params: { q: query, limit: 6 },
        })
        const results = ((response.data as { results?: SymbolSuggestion[] }).results ?? [])
        if (!isCancelled) {
          setSymbolSuggestions(results)
          setShowSuggestions(results.length > 0)
          setActiveSuggestionIndex(-1)
        }
      } catch (err) {
        if (!isCancelled) {
          setSymbolSuggestions([])
          setShowSuggestions(false)
          setActiveSuggestionIndex(-1)
        }
        console.error(err)
      } finally {
        if (!isCancelled) setIsSearchingSymbols(false)
      }
    }, 280)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [stockQuery])

  const handleQuadrantToggle = (quadrant: Quadrant) => {
    const current = screenerFilters.quadrants
    const updated = current.includes(quadrant)
      ? current.filter((q) => q !== quadrant)
      : [...current, quadrant]
    setScreenerFilters({ quadrants: updated })
  }

  const handleSearchChange = (query: string) => {
    setScreenerFilters({ searchQuery: query })
  }

  const applySuggestion = (suggestion: SymbolSuggestion) => {
    setStockQuery(suggestion.symbol)
    setSelectedAsset(suggestion.symbol)
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
  }

  const handleSliderChange = (
    field: 'rsRatioMin' | 'rsRatioMax' | 'rsMomentumMin' | 'rsMomentumMax',
    value: number | undefined
  ) => {
    setScreenerFilters({ [field]: value })
  }

  const filteredData = useMemo(() => {
    if (!data) return []

    return data.filter((asset) => {
      const quadrant = getQuadrantFromString(asset.quadrant)
      const { rs_ratio, rs_momentum } = asset.current

      // Filtro quadranti
      if (
        screenerFilters.quadrants.length > 0 &&
        !screenerFilters.quadrants.includes(quadrant)
      ) {
        return false
      }

      // Filtro RS-Ratio
      if (screenerFilters.rsRatioMin !== undefined && rs_ratio < screenerFilters.rsRatioMin) {
        return false
      }
      if (screenerFilters.rsRatioMax !== undefined && rs_ratio > screenerFilters.rsRatioMax) {
        return false
      }

      // Filtro RS-Momentum
      if (screenerFilters.rsMomentumMin !== undefined && rs_momentum < screenerFilters.rsMomentumMin) {
        return false
      }
      if (screenerFilters.rsMomentumMax !== undefined && rs_momentum > screenerFilters.rsMomentumMax) {
        return false
      }

      // Filtro ricerca
      if (screenerFilters.searchQuery) {
        const query = screenerFilters.searchQuery.toLowerCase()
        const symbolMatch = asset.symbol.toLowerCase().includes(query)
        const nameMatch = (SECTOR_NAMES[asset.symbol] || '').toLowerCase().includes(query)
        if (!symbolMatch && !nameMatch) {
          return false
        }
      }

      return true
    })
  }, [data, screenerFilters])

  const hasActiveFilters =
    screenerFilters.quadrants.length > 0 ||
    screenerFilters.rsRatioMin !== undefined ||
    screenerFilters.rsRatioMax !== undefined ||
    screenerFilters.rsMomentumMin !== undefined ||
    screenerFilters.rsMomentumMax !== undefined ||
    screenerFilters.searchQuery !== ''

  return (
    <motion.div
      className="bg-card rounded-lg p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-400" />
          <h3 className="text-white font-semibold text-sm">Sector Screener</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">{filteredData.length} risultati</span>
          {hasActiveFilters && (
            <button
              onClick={resetScreenerFilters}
              className="text-gray-400 hover:text-white transition-colors"
              title="Reset filtri"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="relative">
          <label className="block text-xs text-gray-400 mb-1">Filtro settori</label>
          <Search className="absolute left-2 top-[calc(50%+10px)] -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Technology, XLK, Energy..."
            value={screenerFilters.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-background border border-border rounded pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {screenerFilters.searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2 top-[calc(50%+10px)] -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="relative">
          <label className="block text-xs text-gray-400 mb-1">Cerca titolo</label>
          <Search className="absolute left-2 top-[calc(50%+10px)] -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="AAPL, Stellantis, Microsoft..."
            value={stockQuery}
            onChange={(e) => setStockQuery(e.target.value)}
            onFocus={() => {
              if (symbolSuggestions.length > 0) {
                setShowSuggestions(true)
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 140)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && symbolSuggestions.length > 0) {
                e.preventDefault()
                setActiveSuggestionIndex((prev) =>
                  prev < symbolSuggestions.length - 1 ? prev + 1 : 0
                )
                return
              }
              if (e.key === 'ArrowUp' && symbolSuggestions.length > 0) {
                e.preventDefault()
                setActiveSuggestionIndex((prev) =>
                  prev > 0 ? prev - 1 : symbolSuggestions.length - 1
                )
                return
              }
              if (e.key === 'Enter') {
                if (showSuggestions && activeSuggestionIndex >= 0 && symbolSuggestions[activeSuggestionIndex]) {
                  e.preventDefault()
                  applySuggestion(symbolSuggestions[activeSuggestionIndex])
                  return
                }
                if (showSuggestions && symbolSuggestions.length > 0) {
                  e.preventDefault()
                  applySuggestion(symbolSuggestions[0])
                  return
                }
              }
              if (e.key === 'Enter' && canOpenAsTicker) {
                setSelectedAsset(normalizedQuery)
                setStockQuery(normalizedQuery)
                setShowSuggestions(false)
              }
            }}
            className="w-full bg-background border border-border rounded pl-8 pr-20 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          {stockQuery && (
            <button
              onClick={() => {
                setStockQuery('')
                setShowSuggestions(false)
              }}
              className="absolute right-12 top-[calc(50%+10px)] -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => {
              if (symbolSuggestions.length > 0) {
                applySuggestion(symbolSuggestions[0])
                return
              }
              if (canOpenAsTicker) {
                setSelectedAsset(normalizedQuery)
                setStockQuery(normalizedQuery)
              }
            }}
            disabled={!canOpenAsTicker && symbolSuggestions.length === 0}
            className="absolute right-2 top-[calc(50%+10px)] -translate-y-1/2 px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:bg-border disabled:text-gray-500 transition-colors"
          >
            Apri
          </button>

          {showSuggestions && (symbolSuggestions.length > 0 || isSearchingSymbols) && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-background border border-border rounded shadow-lg overflow-hidden">
              {isSearchingSymbols && (
                <div className="px-3 py-2 text-xs text-gray-500">Ricerca ticker in corso...</div>
              )}
              {!isSearchingSymbols && symbolSuggestions.map((item, index) => (
                <button
                  key={`${item.symbol}-${item.exchange || index}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySuggestion(item)}
                  className={`w-full text-left px-3 py-2 border-b border-border last:border-b-0 transition-colors ${
                    index === activeSuggestionIndex ? 'bg-border/70' : 'hover:bg-border/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white text-sm font-medium">{item.symbol}</span>
                    <span className="text-[10px] text-gray-500 uppercase">{item.type || ''}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{item.name}</p>
                  {item.exchange && <p className="text-[10px] text-gray-500">{item.exchange}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        `Filtro settori` agisce sulla tabella. `Cerca titolo` carica grafico, news e trend del titolo.
      </p>

      {/* Filters Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2 px-3 bg-background rounded text-sm text-gray-400 hover:text-white transition-colors mb-3"
      >
        <span>Filtri RRG Tabella</span>
        <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
      </button>

      <p className="text-[11px] text-gray-600 mb-3">
        I filtri avanzati restringono i risultati per quadrante e range RS-Ratio/RS-Momentum.
      </p>

      {/* Expanded Filters */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 mb-4 pb-4 border-b border-border"
        >
          {/* Quadrant Multi-Select */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Quadranti</label>
            <div className="flex flex-wrap gap-2">
              {QUADRANTS.map((q) => {
                const isActive = screenerFilters.quadrants.includes(q.value)
                return (
                  <button
                    key={q.value}
                    onClick={() => handleQuadrantToggle(q.value)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? `${q.color} text-white`
                        : 'bg-border text-gray-400 hover:text-white'
                    }`}
                  >
                    {q.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* RS-Ratio Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400">RS-Ratio</label>
              <span className="text-xs text-gray-500">
                {screenerFilters.rsRatioMin ?? 0} - {screenerFilters.rsRatioMax ?? 200}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="range"
                min="0"
                max="200"
                value={screenerFilters.rsRatioMin ?? 0}
                onChange={(e) =>
                  handleSliderChange('rsRatioMin', e.target.value ? Number(e.target.value) : undefined)
                }
                className="flex-1 accent-blue-500"
              />
              <input
                type="range"
                min="0"
                max="200"
                value={screenerFilters.rsRatioMax ?? 200}
                onChange={(e) =>
                  handleSliderChange('rsRatioMax', e.target.value ? Number(e.target.value) : undefined)
                }
                className="flex-1 accent-blue-500"
              />
            </div>
          </div>

          {/* RS-Momentum Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-400">RS-Momentum</label>
              <span className="text-xs text-gray-500">
                {screenerFilters.rsMomentumMin ?? 0} - {screenerFilters.rsMomentumMax ?? 200}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="range"
                min="0"
                max="200"
                value={screenerFilters.rsMomentumMin ?? 0}
                onChange={(e) =>
                  handleSliderChange('rsMomentumMin', e.target.value ? Number(e.target.value) : undefined)
                }
                className="flex-1 accent-blue-500"
              />
              <input
                type="range"
                min="0"
                max="200"
                value={screenerFilters.rsMomentumMax ?? 200}
                onChange={(e) =>
                  handleSliderChange('rsMomentumMax', e.target.value ? Number(e.target.value) : undefined)
                }
                className="flex-1 accent-blue-500"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Filtered Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-gray-500">
              <th className="text-left py-2 px-2 font-medium">Symbol</th>
              <th className="text-left py-2 px-2 font-medium">Sector</th>
              <th className="text-right py-2 px-2 font-medium">RS-R</th>
              <th className="text-right py-2 px-2 font-medium">RS-M</th>
              <th className="text-center py-2 px-2 font-medium">Quadrant</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">
                  Nessun risultato per i filtri selezionati
                </td>
              </tr>
            ) : (
              filteredData.map((asset) => {
                const quadrant = getQuadrantFromString(asset.quadrant)
                const quadrantStyles: Record<Quadrant, string> = {
                  leading: 'bg-green-900/30 text-green-400 border-green-800',
                  weakening: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
                  lagging: 'bg-red-900/30 text-red-400 border-red-800',
                  improving: 'bg-blue-900/30 text-blue-400 border-blue-800',
                }

                return (
                  <tr
                    key={asset.symbol}
                    className="border-b border-border/50 hover:bg-border/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedAsset(asset.symbol)}
                  >
                    <td className="py-2 px-2">
                      <span className="font-semibold text-white">{asset.symbol}</span>
                    </td>
                    <td className="py-2 px-2 text-gray-400">
                      {SECTOR_NAMES[asset.symbol] || '-'}
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span
                        className={`font-mono ${
                          asset.current.rs_ratio >= 100 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {formatNumber(asset.current.rs_ratio)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <span
                        className={`font-mono ${
                          asset.current.rs_momentum >= 100 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {formatNumber(asset.current.rs_momentum)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${
                          quadrantStyles[quadrant]
                        }`}
                      >
                        {quadrant.charAt(0).toUpperCase() + quadrant.slice(1)}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
