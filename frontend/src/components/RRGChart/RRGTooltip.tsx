import { motion, AnimatePresence } from 'framer-motion'
import type { RRGDataPoint } from '../../types/rrg.types'
import { getQuadrantFromString, getQuadrantLabel, formatNumber } from '../../utils/rrg.utils'

interface RRGTooltipProps {
  data: RRGDataPoint | null
  x: number
  y: number
  visible: boolean
}

export function RRGTooltip({ data, x, y, visible }: RRGTooltipProps) {
  if (!data) return null

  const quadrant = getQuadrantFromString(data.quadrant)
  const rsRatio = data.current.rs_ratio
  const rsMomentum = data.current.rs_momentum

  return (
    <AnimatePresence>
      {visible && data && (
        <motion.g
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.1 }}
        >
          <rect
            x={x + 10}
            y={y - 60}
            width={160}
            height={80}
            fill="#1a1a1a"
            stroke="#3a3a3a"
            rx={6}
            className="shadow-lg"
          />
          <text
            x={x + 20}
            y={y - 40}
            fill="#ffffff"
            fontSize={14}
            fontWeight={600}
          >
            {data.symbol}
          </text>
          <text
            x={x + 20}
            y={y - 20}
            fill="#9ca3af"
            fontSize={11}
          >
            {getQuadrantLabel(quadrant)}
          </text>
          <text
            x={x + 20}
            y={y}
            fill="#d1d5db"
            fontSize={11}
          >
            RS-Ratio: {formatNumber(rsRatio)}
          </text>
          <text
            x={x + 20}
            y={y + 16}
            fill="#d1d5db"
            fontSize={11}
          >
            RS-Momentum: {formatNumber(rsMomentum)}
          </text>
        </motion.g>
      )}
    </AnimatePresence>
  )
}