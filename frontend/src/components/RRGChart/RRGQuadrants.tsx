import { useMemo } from 'react'
import { getQuadrantColor, getQuadrantLabel } from '../../utils/rrg.utils'
import type { Quadrant } from '../../types/rrg.types'

interface RRGQuadrantsProps {
  width: number
  height: number
}

export function RRGQuadrants({ width, height }: RRGQuadrantsProps) {
  const quadrants = useMemo(() => {
    const cx = width / 2
    const cy = height / 2

    return [
      { id: 'leading', x: cx, y: 0, labelX: cx * 0.7, labelY: cy * 0.3 },
      { id: 'weakening', x: cx, y: cy, labelX: cx * 0.7, labelY: height - cy * 0.3 },
      { id: 'lagging', x: 0, y: cy, labelX: cx * 0.3, labelY: height - cy * 0.3 },
      { id: 'improving', x: 0, y: 0, labelX: cx * 0.3, labelY: cy * 0.3 },
    ] as const
  }, [width, height])

  const paths = useMemo(() => {
    const cx = width / 2
    const cy = height / 2

    return [
      {
        id: 'leading' as Quadrant,
        d: `M ${cx} 0 L ${width} 0 L ${width} ${cy} L ${cx} ${cy} Z`,
      },
      {
        id: 'weakening' as Quadrant,
        d: `M ${cx} ${cy} L ${width} ${cy} L ${width} ${height} L ${cx} ${height} Z`,
      },
      {
        id: 'lagging' as Quadrant,
        d: `M 0 ${cy} L ${cx} ${cy} L ${cx} ${height} L 0 ${height} Z`,
      },
      {
        id: 'improving' as Quadrant,
        d: `M 0 0 L ${cx} 0 L ${cx} ${cy} L 0 ${cy} Z`,
      },
    ]
  }, [width, height])

  return (
    <g className="quadrants">
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill={getQuadrantColor(path.id, 0.3)}
          stroke="none"
        />
      ))}
      {quadrants.map((q) => (
        <text
          key={q.id}
          x={q.labelX}
          y={q.labelY}
          fill={getQuadrantColor(q.id as Quadrant, 0.8)}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs font-medium uppercase tracking-wider"
          style={{ fontSize: 11, fillOpacity: 0.7 }}
        >
          {getQuadrantLabel(q.id as Quadrant)}
        </text>
      ))}
    </g>
  )
}