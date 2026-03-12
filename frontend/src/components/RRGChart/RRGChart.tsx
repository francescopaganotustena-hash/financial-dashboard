import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import * as d3 from 'd3'
import type { RRGDataPoint } from '../../types/rrg.types'
import { RRGQuadrants } from './RRGQuadrants'
import { RRGTail } from './RRGTail'
import { RRGTooltip } from './RRGTooltip'
import { useAppStore } from '../../store/useAppStore'
import { getQuadrantFromString } from '../../utils/rrg.utils'
import { useRRGHistory } from '../../hooks/useRRGData'

const MARGIN = { top: 40, right: 40, bottom: 40, left: 40 }
const ZOOM_MIN = 0.6
const ZOOM_MAX = 2.2
const ZOOM_STEP = 0.05

interface RRGChartProps {
  data: RRGDataPoint[]
  width?: number
  height?: number
}

export function RRGChart({ data, width = 600, height = 600 }: RRGChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltipData, setTooltipData] = useState<RRGDataPoint | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [showTooltip, setShowTooltip] = useState(false)
  const [scaleZoom, setScaleZoom] = useState(1)

  const {
    selectedAsset,
    setSelectedAsset,
    tailLength,
    isPlaying,
    currentFrame,
    setCurrentFrame,
  } = useAppStore()

  const { data: historyData } = useRRGHistory(selectedAsset)

  const innerWidth = width - MARGIN.left - MARGIN.right
  const innerHeight = height - MARGIN.top - MARGIN.bottom

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGCircleElement>, point: RRGDataPoint) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        setTooltipPos({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        })
        setTooltipData(point)
        setShowTooltip(true)
      }
    },
    []
  )

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false)
    setTooltipData(null)
  }, [])

  const handlePointClick = useCallback(
    (point: RRGDataPoint) => {
      setSelectedAsset(point.symbol === selectedAsset ? null : point.symbol)
    },
    [selectedAsset, setSelectedAsset]
  )

  // Evita crash se i dati non sono validi
  const safeData = useMemo(() => {
    if (!data || !Array.isArray(data)) return []
    return data.filter(point => point && point.current && typeof point.current.rs_ratio === 'number')
  }, [data])

  const maxFrameCount = useMemo(() => {
    const maxTail = safeData.reduce((max, point) => {
      const len = Array.isArray(point.tail) ? point.tail.length : 0
      return Math.max(max, len)
    }, 0)

    return Math.max(maxTail, 1)
  }, [safeData])

  useEffect(() => {
    if (!isPlaying || maxFrameCount <= 1) return

    const interval = setInterval(() => {
      const state = useAppStore.getState()
      state.setCurrentFrame((state.currentFrame + 1) % maxFrameCount)
    }, 700)

    return () => clearInterval(interval)
  }, [isPlaying, maxFrameCount])

  useEffect(() => {
    if (isPlaying) return
    if (maxFrameCount <= 1) {
      if (currentFrame !== 0) setCurrentFrame(0)
      return
    }

    const lastFrame = maxFrameCount - 1
    if (currentFrame !== lastFrame) {
      setCurrentFrame(lastFrame)
    }
  }, [isPlaying, maxFrameCount, currentFrame, setCurrentFrame])

  const tailData = useMemo(() => {
    if (!historyData || !selectedAsset || historyData.length === 0) return []

    if (isPlaying) {
      const visible = Math.min(currentFrame + 1, historyData.length)
      return historyData.slice(Math.max(0, visible - tailLength), visible)
    }

    return historyData.slice(-tailLength)
  }, [historyData, selectedAsset, tailLength, isPlaying, currentFrame])

  const chartDomain = useMemo(() => {
    const ratios: number[] = [100]
    const momentums: number[] = [100]

    safeData.forEach((point) => {
      if (point?.current) {
        ratios.push(point.current.rs_ratio)
        momentums.push(point.current.rs_momentum)
      }
      if (Array.isArray(point?.tail)) {
        point.tail.forEach((p) => {
          ratios.push(p.rs_ratio)
          momentums.push(p.rs_momentum)
        })
      }
    })

    const ratioHalfRange = Math.max(...ratios.map((v) => Math.abs(v - 100)))
    const momentumHalfRange = Math.max(...momentums.map((v) => Math.abs(v - 100)))
    const adaptiveHalfRange = Math.max(Math.max(ratioHalfRange, momentumHalfRange) + 1.5, 4)
    const halfRange = Math.min(Math.max(adaptiveHalfRange * scaleZoom, 3), 60)

    return {
      min: 100 - halfRange,
      max: 100 + halfRange,
    }
  }, [safeData, scaleZoom])

  const xScale = useMemo(
    () => d3.scaleLinear().domain([chartDomain.min, chartDomain.max]).range([0, innerWidth]),
    [chartDomain.min, chartDomain.max, innerWidth]
  )

  const yScale = useMemo(
    () => d3.scaleLinear().domain([chartDomain.min, chartDomain.max]).range([innerHeight, 0]),
    [chartDomain.min, chartDomain.max, innerHeight]
  )

  const gridLines = useMemo(
    () => xScale.ticks(8).filter((v) => v > chartDomain.min && v < chartDomain.max),
    [xScale, chartDomain.min, chartDomain.max]
  )

  const clampZoom = useCallback((next: number) => {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
  }, [])

  const zoomPercent = Math.round(scaleZoom * 100)

  return (
    <div className="relative bg-card rounded-lg p-4 overflow-hidden">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="overflow-hidden"
      >
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          <RRGQuadrants width={innerWidth} height={innerHeight} />

          <g className="grid-lines">
            {gridLines.map((val) => (
              <line
                key={`h-${val}`}
                x1={0}
                x2={innerWidth}
                y1={yScale(val)}
                y2={yScale(val)}
                stroke="#2a2a2a"
                strokeDasharray="4,4"
              />
            ))}
            {gridLines.map((val) => (
              <line
                key={`v-${val}`}
                x1={xScale(val)}
                x2={xScale(val)}
                y1={0}
                y2={innerHeight}
                stroke="#2a2a2a"
                strokeDasharray="4,4"
              />
            ))}
          </g>

          <line
            x1={xScale(100)}
            x2={xScale(100)}
            y1={0}
            y2={innerHeight}
            stroke="#4a4a4a"
            strokeWidth={1}
          />
          <line
            x1={0}
            x2={innerWidth}
            y1={yScale(100)}
            y2={yScale(100)}
            stroke="#4a4a4a"
            strokeWidth={1}
          />

          {selectedAsset && tailData.length >= 2 && (
            <RRGTail
              data={tailData}
              xScale={xScale}
              yScale={yScale}
              isAnimating={isPlaying}
            />
          )}

          <g className="data-points">
            {safeData.map((point) => {
              const tail = Array.isArray(point.tail) ? point.tail : []
              const frameIndex = isPlaying
                ? Math.min(currentFrame, Math.max(0, tail.length - 1))
                : Math.max(0, tail.length - 1)
              const framePoint = tail.length > 0 ? tail[frameIndex] : null

              const rsRatio = framePoint ? framePoint.rs_ratio : point.current.rs_ratio
              const rsMomentum = framePoint ? framePoint.rs_momentum : point.current.rs_momentum
              const cx = xScale(rsRatio)
              const cy = yScale(rsMomentum)
              const isSelected = selectedAsset === point.symbol
              const quadrant = getQuadrantFromString(point.quadrant)

              const colors: Record<string, string> = {
                leading: '#10b981',
                weakening: '#f59e0b',
                lagging: '#ef4444',
                improving: '#3b82f6',
              }

              return (
                <g key={point.symbol}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 14 : 10}
                    fill={colors[quadrant]}
                    fillOpacity={isSelected ? 0.8 : 0.5}
                    stroke={isSelected ? '#ffffff' : 'transparent'}
                    strokeWidth={2}
                    className="cursor-pointer transition-all duration-200 hover:r-16"
                    onMouseMove={(e) => handleMouseMove(e, point)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handlePointClick(point)}
                  />
                  <text
                    x={cx}
                    y={cy + 4}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={isSelected ? 11 : 9}
                    fontWeight={isSelected ? 700 : 500}
                    className="pointer-events-none select-none"
                  >
                    {point.symbol}
                  </text>
                </g>
              )
            })}
          </g>

          <text
            x={innerWidth / 2}
            y={-15}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize={12}
          >
            RS-Ratio (Relative Strength)
          </text>
          <text
            x={-15}
            y={innerHeight / 2}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize={12}
            transform={`rotate(-90, -15, ${innerHeight / 2})`}
          >
            RS-Momentum
          </text>
        </g>

        <RRGTooltip
          data={tooltipData}
          x={tooltipPos.x}
          y={tooltipPos.y}
          visible={showTooltip}
        />
      </svg>

      <div className="absolute bottom-4 left-4 text-xs text-gray-500">
        Center: 100 × 100
      </div>

      <div
        className="absolute top-1/2 -translate-y-1/2 z-10"
        style={{ left: `${width + 12}px` }}
      >
        <div className="w-14 flex flex-col items-center gap-2 bg-background/90 border border-border rounded-lg px-2 py-3 shadow-sm">
          <span className="text-[10px] text-gray-300 font-medium">Zoom</span>
          <button
            onClick={() => setScaleZoom((prev) => clampZoom(prev - ZOOM_STEP))}
            className="w-7 h-6 rounded bg-border text-gray-200 hover:bg-border/70 transition-colors"
            aria-label="Riduci zoom scala"
          >
            -
          </button>

          <div className="h-44 flex items-center justify-center">
            <input
              type="range"
              min={Math.round(ZOOM_MIN * 100)}
              max={Math.round(ZOOM_MAX * 100)}
              step={Math.round(ZOOM_STEP * 100)}
              value={zoomPercent}
              onChange={(e) => setScaleZoom(clampZoom(Number(e.target.value) / 100))}
              className="w-40 h-4 -rotate-90 accent-blue-500 cursor-pointer"
              aria-label="Zoom scala grafico RRG"
            />
          </div>

          <button
            onClick={() => setScaleZoom((prev) => clampZoom(prev + ZOOM_STEP))}
            className="w-7 h-6 rounded bg-border text-gray-200 hover:bg-border/70 transition-colors"
            aria-label="Aumenta zoom scala"
          >
            +
          </button>

          <button
            onClick={() => setScaleZoom(1)}
            className="w-full h-6 rounded bg-blue-600/80 text-white text-[10px] hover:bg-blue-600 transition-colors"
            aria-label="Reset zoom scala"
          >
            Auto
          </button>

          <span className="text-[10px] text-gray-400">{zoomPercent}%</span>
        </div>
      </div>
    </div>
  )
}
