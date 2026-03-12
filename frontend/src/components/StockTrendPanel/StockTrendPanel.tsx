import { useEffect, useMemo, useRef } from 'react'
import { createChart, type IChartApi, type ISeriesApi, type LineData, type Time } from 'lightweight-charts'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { usePriceData } from '../../hooks/usePriceData'

export function StockTrendPanel() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const { selectedAsset, period } = useAppStore()
  const { data, isLoading, error } = usePriceData(selectedAsset, '3M', period)

  const summary = useMemo(() => {
    if (!data || data.length < 2) return null
    const last = data[data.length - 1]
    const prev = data[data.length - 2]
    const delta = last.close - prev.close
    const deltaPct = prev.close !== 0 ? (delta / prev.close) * 100 : 0
    return {
      lastClose: last.close,
      delta,
      deltaPct,
    }
  }, [data])

  useEffect(() => {
    if (!selectedAsset || isLoading || !!error || !chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1a1a1a' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#2a2a2a' },
        horzLines: { color: '#2a2a2a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 220,
      timeScale: {
        borderColor: '#3a3a3a',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#3a3a3a',
      },
    })

    const lineSeries = chart.addLineSeries({
      color: '#60a5fa',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: true,
      priceLineVisible: true,
    })

    chartRef.current = chart
    lineSeriesRef.current = lineSeries

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      lineSeriesRef.current = null
    }
  }, [selectedAsset, isLoading, error])

  useEffect(() => {
    if (!lineSeriesRef.current || !data || data.length === 0) return

    const lineData: LineData<Time>[] = data.map((point) => ({
      time: point.time as Time,
      value: point.close,
    }))

    lineSeriesRef.current.setData(lineData)
    chartRef.current?.timeScale().fitContent()
  }, [data, selectedAsset])

  if (!selectedAsset) {
    return (
      <div className="bg-card rounded-lg p-4 h-[320px] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Cerca un ticker nel pannello centrale per vedere il trend</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg p-4 h-[320px] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-4 bg-gray-600 rounded-full animate-spin mb-2" />
          <p className="text-gray-500 text-sm">Loading stock trend...</p>
        </div>
      </div>
    )
  }

  if (error || !data || data.length === 0) {
    return (
      <div className="bg-card rounded-lg p-4 h-[320px] flex items-center justify-center">
        <p className="text-red-400 text-sm">
          Impossibile caricare il trend per {selectedAsset}. Verifica il ticker.
        </p>
      </div>
    )
  }

  const isPositive = (summary?.delta || 0) >= 0

  return (
    <motion.div
      className="bg-card rounded-lg p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold">{selectedAsset} Trend</h3>
          <p className="text-gray-500 text-xs">Ultimi 3 mesi</p>
        </div>
        {summary && (
          <div className="text-right">
            <p className="text-white text-sm font-semibold">${summary.lastClose.toFixed(2)}</p>
            <p className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}
              {summary.delta.toFixed(2)} ({isPositive ? '+' : ''}
              {summary.deltaPct.toFixed(2)}%)
            </p>
          </div>
        )}
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </motion.div>
  )
}
