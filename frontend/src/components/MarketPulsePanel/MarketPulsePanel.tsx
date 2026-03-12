import { motion } from 'framer-motion'
import type { RRGDataPoint } from '../../types/rrg.types'

interface MarketPulsePanelProps {
  data: RRGDataPoint[]
}

interface SparklineProps {
  points: number[]
  colorClass: string
}

function pct(part: number, total: number) {
  if (!total) return '0%'
  return `${((part / total) * 100).toFixed(0)}%`
}

function score(asset: RRGDataPoint) {
  return (asset.current.rs_ratio - 100) + (asset.current.rs_momentum - 100)
}

function momentumDelta(asset: RRGDataPoint) {
  const tail = asset.tail || []
  if (tail.length < 2) return 0
  return tail[tail.length - 1].rs_momentum - tail[tail.length - 2].rs_momentum
}

function Sparkline({ points, colorClass }: SparklineProps) {
  if (points.length < 2) {
    return <span className="text-[10px] text-gray-600">-</span>
  }

  const width = 72
  const height = 20
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const stepX = width / (points.length - 1)

  const d = points
    .map((value, index) => {
      const x = index * stepX
      const y = height - ((value - min) / span) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  const lastY = height - ((points[points.length - 1] - min) / span) * height

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={d} fill="none" className={colorClass} strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={width} cy={lastY} r={2.2} className={colorClass.replace('stroke-', 'fill-')} />
    </svg>
  )
}

export function MarketPulsePanel({ data }: MarketPulsePanelProps) {
  const total = data.length
  const leading = data.filter((a) => a.quadrant.toLowerCase() === 'leading')
  const lagging = data.filter((a) => a.quadrant.toLowerCase() === 'lagging')
  const improving = data.filter((a) => a.quadrant.toLowerCase() === 'improving')
  const weakening = data.filter((a) => a.quadrant.toLowerCase() === 'weakening')

  const topGainers = [...data]
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3)

  const topLosers = [...data]
    .sort((a, b) => score(a) - score(b))
    .slice(0, 3)

  return (
    <motion.section
      className="bg-card rounded-lg p-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.08 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Market Pulse</h3>
        <span className="text-xs text-gray-500">{total} settori monitorati</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="bg-background rounded px-3 py-2">
          <p className="text-[11px] text-gray-500">Leading</p>
          <p className="text-green-400 font-semibold">{leading.length} ({pct(leading.length, total)})</p>
        </div>
        <div className="bg-background rounded px-3 py-2">
          <p className="text-[11px] text-gray-500">Lagging</p>
          <p className="text-red-400 font-semibold">{lagging.length} ({pct(lagging.length, total)})</p>
        </div>
        <div className="bg-background rounded px-3 py-2">
          <p className="text-[11px] text-gray-500">Improving</p>
          <p className="text-blue-400 font-semibold">{improving.length} ({pct(improving.length, total)})</p>
        </div>
        <div className="bg-background rounded px-3 py-2">
          <p className="text-[11px] text-gray-500">Weakening</p>
          <p className="text-yellow-400 font-semibold">{weakening.length} ({pct(weakening.length, total)})</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-background rounded p-3">
          <p className="text-xs text-gray-400 mb-2">Top Gainers (forza relativa)</p>
          <div className="space-y-1.5">
            {topGainers.map((asset) => {
              const d = momentumDelta(asset)
              const trend = (asset.tail || []).slice(-10).map((p) => p.rs_momentum)
              return (
                <div key={`g-${asset.symbol}`} className="flex items-center justify-between text-sm">
                  <span className="text-white font-medium">{asset.symbol}</span>
                  <div className="flex items-center gap-2">
                    <Sparkline points={trend} colorClass="stroke-green-400" />
                    <span className="text-green-400">+{score(asset).toFixed(2)} | ΔM {d >= 0 ? '+' : ''}{d.toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-background rounded p-3">
          <p className="text-xs text-gray-400 mb-2">Top Losers (forza relativa)</p>
          <div className="space-y-1.5">
            {topLosers.map((asset) => {
              const d = momentumDelta(asset)
              const trend = (asset.tail || []).slice(-10).map((p) => p.rs_momentum)
              return (
                <div key={`l-${asset.symbol}`} className="flex items-center justify-between text-sm">
                  <span className="text-white font-medium">{asset.symbol}</span>
                  <div className="flex items-center gap-2">
                    <Sparkline points={trend} colorClass="stroke-red-400" />
                    <span className="text-red-400">{score(asset).toFixed(2)} | ΔM {d >= 0 ? '+' : ''}{d.toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.section>
  )
}
