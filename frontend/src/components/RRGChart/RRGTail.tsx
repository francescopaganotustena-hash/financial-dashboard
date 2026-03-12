import { useMemo, useRef } from 'react'
import * as d3 from 'd3'
import { motion } from 'framer-motion'
import type { RRGHistoricalPoint } from '../../types/rrg.types'
import { useAppStore } from '../../store/useAppStore'

interface RRGTailProps {
  data: RRGHistoricalPoint[]
  xScale: d3.ScaleLinear<number, number>
  yScale: d3.ScaleLinear<number, number>
  isAnimating: boolean
}

export function RRGTail({ data, xScale, yScale, isAnimating }: RRGTailProps) {
  const { selectedAsset } = useAppStore()
  const pathRef = useRef<SVGPathElement>(null)

  const pathData = useMemo(() => {
    if (data.length < 2) return ''

    const points = data.map((d) => ({
      x: xScale(d.rsRatio),
      y: yScale(d.rsMomentum),
    }))

    const lineGenerator = d3
      .line<{ x: number; y: number }>()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(d3.curveCatmullRom.alpha(0.5))

    return lineGenerator(points) || ''
  }, [data, xScale, yScale])

  const gradientId = `tail-gradient-${selectedAsset}`

  const gradientStops = useMemo(() => {
    if (data.length < 2) return []
    return data.map((_, i) => ({
      offset: `${(i / (data.length - 1)) * 100}%`,
      opacity: 0.2 + (i / (data.length - 1)) * 0.8,
    }))
  }, [data])

  if (!pathData || data.length < 2) return null

  return (
    <g className="tail">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {gradientStops.map((stop, i) => (
            <stop
              key={i}
              offset={stop.offset}
              stopColor="#3b82f6"
              stopOpacity={stop.opacity}
            />
          ))}
        </linearGradient>
      </defs>

      <motion.path
        ref={pathRef}
        d={pathData}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: isAnimating ? 1.5 : 0,
          ease: 'easeInOut',
        }}
      />

      {data.map((point, i) => (
        <motion.circle
          key={`${point.timestamp}-${i}`}
          cx={xScale(point.rsRatio)}
          cy={yScale(point.rsMomentum)}
          r={i === data.length - 1 ? 5 : 2}
          fill={i === data.length - 1 ? '#3b82f6' : '#3b82f6'}
          opacity={0.3 + (i / (data.length - 1)) * 0.7}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.3 + (i / (data.length - 1)) * 0.7, scale: 1 }}
          transition={{ delay: isAnimating ? i * 0.05 : 0 }}
        />
      ))}
    </g>
  )
}
