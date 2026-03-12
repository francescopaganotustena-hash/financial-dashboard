import { motion } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import { BENCHMARKS, SP500_SECTORS, SECTOR_NAMES } from '../../utils/rrg.utils'
import {
  LayoutDashboard,
  Play,
  Pause,
  ChevronDown,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { WebSocketStatus } from '../WebSocketStatus'
import { useWebSocket } from '../../hooks/useWebSocket'

export function Header() {
  const {
    benchmark,
    setBenchmark,
    period,
    setPeriod,
    tailLength,
    setTailLength,
    selectedSymbols,
    toggleSymbol,
    isPlaying,
    setIsPlaying,
  } = useAppStore()

  const [showBenchmarkMenu, setShowBenchmarkMenu] = useState(false)
  const [showSectorMenu, setShowSectorMenu] = useState(false)
  const benchmarkMenuRef = useRef<HTMLDivElement>(null)
  const sectorMenuRef = useRef<HTMLDivElement>(null)

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (benchmarkMenuRef.current && !benchmarkMenuRef.current.contains(event.target as Node)) {
        setShowBenchmarkMenu(false)
      }
      if (sectorMenuRef.current && !sectorMenuRef.current.contains(event.target as Node)) {
        setShowSectorMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // WebSocket connection for real-time RRG updates
  const { isConnected, isConnecting, error, reconnect } = useWebSocket({
    symbols: selectedSymbols.length > 0 ? selectedSymbols : ['XLK'],
    benchmark,
    period: period as 'daily' | 'weekly',
    enabled: isPlaying,
  })

  return (
    <motion.header
      className="bg-card border-b border-border px-4 py-3"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-6 h-6 text-blue-500" />
          <h1 className="text-white text-xl font-bold">RRG Charts</h1>
        </div>

        <div className="flex items-center gap-4">
          <WebSocketStatus
            isConnected={isConnected}
            isConnecting={isConnecting}
            isPaused={!isPlaying}
            error={error}
            onReconnect={reconnect}
          />

          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm">Benchmark:</label>
            <div className="relative" ref={benchmarkMenuRef}>
              <button
                className="bg-background border border-border rounded px-3 py-1.5 text-white text-sm flex items-center gap-2 hover:border-gray-500 transition-colors"
                onClick={() => setShowBenchmarkMenu(!showBenchmarkMenu)}
              >
                {benchmark}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showBenchmarkMenu && (
                <div className="absolute top-full mt-1 right-0 bg-card border border-border rounded shadow-lg z-50">
                  {BENCHMARKS.map((b) => (
                    <button
                      key={b}
                      className="block w-full px-4 py-2 text-left text-white text-sm hover:bg-border transition-colors"
                      onClick={() => {
                        setBenchmark(b)
                        setShowBenchmarkMenu(false)
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm">Period:</label>
            <div className="flex bg-background border border-border rounded overflow-hidden">
              {(['weekly', 'daily'] as const).map((p) => (
                <button
                  key={p}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    period === p
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setPeriod(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm">Tail:</label>
            <input
              type="range"
              min={4}
              max={26}
              value={tailLength}
              onChange={(e) => setTailLength(parseInt(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <span className="text-white text-sm w-6">{tailLength}</span>
          </div>

          <button
            className={`p-2 rounded transition-colors ${
              isPlaying ? 'bg-blue-600 text-white' : 'bg-background text-gray-400 hover:text-white'
            }`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <span className="text-gray-400 text-sm">Sectors:</span>
        <div className="relative" ref={sectorMenuRef}>
          <button
            className="bg-background border border-border rounded px-3 py-1 text-white text-sm flex items-center gap-2 hover:border-gray-500 transition-colors"
            onClick={() => setShowSectorMenu(!showSectorMenu)}
          >
            {selectedSymbols.length} selected
            <ChevronDown className="w-3 h-3" />
          </button>
          {showSectorMenu && (
            <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded shadow-lg z-50 p-2 grid grid-cols-4 gap-1 min-w-[400px]">
              {SP500_SECTORS.map((sector) => (
                <button
                  key={sector}
                  className={`px-2 py-1 text-xs rounded text-left transition-colors ${
                    selectedSymbols.includes(sector)
                      ? 'bg-blue-600 text-white'
                      : 'bg-background text-gray-400 hover:text-white'
                  }`}
                  onClick={() => toggleSymbol(sector)}
                >
                  {sector} - {SECTOR_NAMES[sector]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.header>
  )
}
