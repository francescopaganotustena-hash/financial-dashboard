import { motion } from 'framer-motion'
import { useRRGData } from '../../hooks/useRRGData'
import { useAppStore } from '../../store/useAppStore'
import { getQuadrantFromString, SECTOR_NAMES } from '../../utils/rrg.utils'

const quadrantColors = {
  leading: 'bg-green-500',
  weakening: 'bg-yellow-500',
  lagging: 'bg-red-500',
  improving: 'bg-blue-500',
}

export function Sidebar() {
  const { data, isLoading, error, refetch } = useRRGData()
  const { selectedAsset, setSelectedAsset } = useAppStore()

  const sortedByRSRatio = [...(data || [])].sort(
    (a, b) => b.current.rs_ratio - a.current.rs_ratio
  )

  return (
    <motion.aside
      className="bg-card border-r border-border w-64 flex flex-col"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-4 border-b border-border">
        <h2 className="text-white font-semibold">Assets</h2>
        <p className="text-gray-500 text-xs mt-1">
          {data?.length || 0} sectors loaded
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-background rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-red-400 text-sm mb-2">Failed to load</p>
            <button
              className="text-blue-400 text-xs hover:underline"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedByRSRatio.map((asset, index) => {
              const quadrant = getQuadrantFromString(asset.quadrant)
              const isSelected = selectedAsset === asset.symbol

              return (
                <motion.button
                  key={asset.symbol}
                  className={`w-full p-2 rounded flex items-center gap-2 transition-colors text-left ${
                    isSelected
                      ? 'bg-blue-900/40 border border-blue-600'
                      : 'hover:bg-background border border-transparent'
                  }`}
                  onClick={() =>
                    setSelectedAsset(isSelected ? null : asset.symbol)
                  }
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      quadrantColors[quadrant]
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-sm">
                        {asset.symbol}
                      </span>
                      <span
                        className={`text-xs font-mono ${
                          asset.current.rs_ratio >= 100 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {asset.current.rs_ratio.toFixed(0)}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs truncate">
                      {SECTOR_NAMES[asset.symbol] || asset.name}
                    </p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Leading</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Weakening</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Lagging</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Improving</span>
          </div>
        </div>
      </div>
    </motion.aside>
  )
}