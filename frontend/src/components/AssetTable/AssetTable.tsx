import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useRRGData } from '../../hooks/useRRGData'
import { useAppStore } from '../../store/useAppStore'
import { getQuadrantFromString, formatNumber, SECTOR_NAMES } from '../../utils/rrg.utils'
import { ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown } from 'lucide-react'
import type { RRGDataPoint } from '../../types/rrg.types'

type SortField = 'symbol' | 'sector' | 'rs_ratio' | 'rs_momentum' | 'quadrant'
type SortDirection = 'asc' | 'desc'

interface SortableHeaderProps {
  field: SortField
  currentSort: SortField
  direction: SortDirection
  onSort: (field: SortField) => void
  children: React.ReactNode
  align?: 'left' | 'right' | 'center'
}

function SortableHeader({ field, currentSort, direction, onSort, children, align = 'left' }: SortableHeaderProps) {
  const isActive = currentSort === field

  return (
    <th
      className={`py-2 px-2 font-medium cursor-pointer hover:text-white transition-colors ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        {children}
        <span className={`transition-colors ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
          {isActive ? (
            direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3" />
          )}
        </span>
      </div>
    </th>
  )
}

export function AssetTable() {
  const { data, isLoading, error } = useRRGData()
  const { selectedAsset, setSelectedAsset } = useAppStore()

  const [sortField, setSortField] = useState<SortField>('rs_ratio')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedData = useMemo(() => {
    if (!data) return []

    return [...data].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case 'symbol':
          aValue = a.symbol
          bValue = b.symbol
          break
        case 'sector':
          aValue = SECTOR_NAMES[a.symbol] || a.symbol
          bValue = SECTOR_NAMES[b.symbol] || b.symbol
          break
        case 'rs_ratio':
          aValue = a.current.rs_ratio
          bValue = b.current.rs_ratio
          break
        case 'rs_momentum':
          aValue = a.current.rs_momentum
          bValue = b.current.rs_momentum
          break
        case 'quadrant': {
          const quadrantOrder = { leading: 0, weakening: 1, improving: 2, lagging: 3 }
          aValue = quadrantOrder[getQuadrantFromString(a.quadrant) as keyof typeof quadrantOrder]
          bValue = quadrantOrder[getQuadrantFromString(b.quadrant) as keyof typeof quadrantOrder]
          break
        }
        default:
          aValue = 0
          bValue = 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue)
        return sortDirection === 'asc' ? comparison : -comparison
      }

      const comparison = (aValue as number) - (bValue as number)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data, sortField, sortDirection])

  // Calcola change% simulato basato su RS-Momentum (per demo)
  const calculateChangePercent = (asset: RRGDataPoint): number => {
    const momentum = asset.current.rs_momentum
    return (momentum - 100) / 10
  }

  const quadrantStyles = {
    leading: 'bg-green-900/30 text-green-400 border-green-800',
    weakening: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
    lagging: 'bg-red-900/30 text-red-400 border-red-800',
    improving: 'bg-blue-900/30 text-blue-400 border-blue-800',
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg p-4">
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-border rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg p-4">
        <p className="text-red-400 text-sm">Error loading data</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg p-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Asset Ranking</h3>
        <span className="text-gray-500 text-xs">{sortedData.length} assets</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-gray-400">
            <SortableHeader
              field="symbol"
              currentSort={sortField}
              direction={sortDirection}
              onSort={handleSort}
            >
              Symbol
            </SortableHeader>
            <SortableHeader
              field="sector"
              currentSort={sortField}
              direction={sortDirection}
              onSort={handleSort}
            >
              Sector
            </SortableHeader>
            <SortableHeader
              field="rs_ratio"
              currentSort={sortField}
              direction={sortDirection}
              onSort={handleSort}
              align="right"
            >
              RS-Ratio
            </SortableHeader>
            <th className="text-right py-2 px-2 font-medium">Change%</th>
            <SortableHeader
              field="rs_momentum"
              currentSort={sortField}
              direction={sortDirection}
              onSort={handleSort}
              align="right"
            >
              RS-Momentum
            </SortableHeader>
            <SortableHeader
              field="quadrant"
              currentSort={sortField}
              direction={sortDirection}
              onSort={handleSort}
              align="center"
            >
              Quadrant
            </SortableHeader>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((asset, index) => {
            const quadrant = getQuadrantFromString(asset.quadrant)
            const isSelected = selectedAsset === asset.symbol
            const rsRatio = asset.current.rs_ratio
            const rsMomentum = asset.current.rs_momentum
            const changePercent = calculateChangePercent(asset)
            const isPositive = changePercent >= 0

            return (
              <motion.tr
                key={asset.symbol}
                className={`border-b border-border/50 cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-900/20' : 'hover:bg-border/50'
                }`}
                onClick={() => setSelectedAsset(isSelected ? null : asset.symbol)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <td className="py-2 px-2">
                  <span className="font-semibold text-white">{asset.symbol}</span>
                </td>
                <td className="py-2 px-2 text-gray-400">
                  {SECTOR_NAMES[asset.symbol] || asset.name || '-'}
                </td>
                <td className="py-2 px-2 text-right">
                  <span
                    className={`font-mono ${
                      rsRatio >= 100 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatNumber(rsRatio)}
                  </span>
                </td>
                <td className="py-2 px-2 text-right">
                  <div className={`flex items-center justify-end gap-1 ${
                    isPositive ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span className="font-mono">
                      {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {rsMomentum >= 100 ? (
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span
                      className={`font-mono ${
                        rsMomentum >= 100 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {formatNumber(rsMomentum)}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center">
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      quadrantStyles[quadrant]
                    }`}
                  >
                    {quadrant.charAt(0).toUpperCase() + quadrant.slice(1)}
                  </span>
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
