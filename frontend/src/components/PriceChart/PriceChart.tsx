import { useEffect, useRef, useState } from 'react'
import { createChart, type IChartApi, type ISeriesApi, type CandlestickData, type HistogramData, type Time } from 'lightweight-charts'
import { motion } from 'framer-motion'
import { usePriceData } from '../../hooks/usePriceData'
import { useAppStore } from '../../store/useAppStore'
import type { PriceChartPeriod } from '../../store/useAppStore'

const TIMEFRAME_OPTIONS: { value: PriceChartPeriod; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
]

export function PriceChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  const { selectedAsset, period, priceChartPeriod, setPriceChartPeriod } = useAppStore()

  const [selectedTimeframe, setSelectedTimeframe] = useState<PriceChartPeriod>(priceChartPeriod)
  const { data, isLoading, error } = usePriceData(selectedAsset, selectedTimeframe, period)

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
      height: 350,
      timeScale: {
        borderColor: '#3a3a3a',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#3a3a3a',
      },
      crosshair: {
        mode: 1, // Magnetic mode
      },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    })

    // Imposta i margini della scala dopo la creazione
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [selectedAsset, isLoading, error])

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !data || data.length === 0) return

    const candleData: CandlestickData<Time>[] = data.map((d) => ({
      time: d.time as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }))

    const volumeData: HistogramData<Time>[] = data.map((d) => ({
      time: d.time as Time,
      value: d.volume,
      color: d.close >= d.open ? '#26a69a80' : '#ef535080',
    }))

    candleSeriesRef.current.setData(candleData)
    volumeSeriesRef.current.setData(volumeData)

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }, [data, selectedAsset])

  useEffect(() => {
    setPriceChartPeriod(selectedTimeframe)
  }, [selectedTimeframe, setPriceChartPeriod])

  if (!selectedAsset) {
    return (
      <div className="bg-card rounded-lg p-4 h-[398px] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Select an asset to view price chart</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg p-4 h-[398px] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-4 bg-gray-600 rounded-full animate-spin mb-2" />
          <p className="text-gray-500 text-sm">Loading price data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-card rounded-lg p-4 h-[398px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">Error loading price data</p>
          <button
            className="text-blue-400 text-xs hover:underline"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="bg-card rounded-lg p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold">{selectedAsset} Price</h3>
          <span className="text-gray-500 text-xs uppercase">({period})</span>
        </div>
        <div className="flex gap-1">
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedTimeframe(option.value)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selectedTimeframe === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-border text-gray-400 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full" />
    </motion.div>
  )
}
