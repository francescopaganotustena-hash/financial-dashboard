import { useState, useEffect } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/useAppStore'
import type { NewsItem } from '../../types/rrg.types'
import { Clock, TrendingUp, ExternalLink } from 'lucide-react'
import { API_BASE_URL } from '../../config/api'

interface NewsAPIResponse {
  symbol: string
  feed_source?: string
  news: NewsItem[]
}

async function fetchNews(symbol: string): Promise<NewsAPIResponse> {
  const response = await axios.get(`${API_BASE_URL}/api/news`, {
    params: { symbol },
  })
  return response.data as NewsAPIResponse
}

function NewsSkeleton() {
  return (
    <div className="p-3 rounded bg-background animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-800 rounded w-full mb-2" />
      <div className="h-3 bg-gray-800 rounded w-2/3" />
      <div className="flex justify-between mt-3">
        <div className="h-3 bg-gray-800 rounded w-16" />
        <div className="h-3 bg-gray-800 rounded w-12" />
      </div>
    </div>
  )
}

export function NewsPanel() {
  const { selectedAsset } = useAppStore()
  const [news, setNews] = useState<NewsItem[]>([])
  const [feedSource, setFeedSource] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedAsset) {
      setNews([])
      setFeedSource(null)
      return
    }

    const fetchNewsData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const payload = await fetchNews(selectedAsset)
        setNews(payload.news || [])
        setFeedSource(payload.feed_source || null)
      } catch (err) {
        setError('Failed to load news')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchNewsData()

    // Refetch ogni 15 minuti
    const interval = setInterval(fetchNewsData, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [selectedAsset])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  if (!selectedAsset) {
    return (
      <div className="bg-card rounded-lg p-4 h-[300px] flex items-center justify-center">
        <p className="text-gray-500 text-sm">Select an asset to view news</p>
      </div>
    )
  }

  return (
    <motion.div
      className="bg-card rounded-lg p-4 h-[300px] flex flex-col"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        <h3 className="text-white font-semibold">{selectedAsset} News</h3>
        {feedSource && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300">
            {feedSource}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isLoading && news.length === 0 ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <NewsSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : news.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">No news available</p>
          </div>
        ) : (
          <AnimatePresence>
            {news.map((item, index) => (
              <motion.a
                key={item.url || index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 rounded bg-background hover:bg-border transition-colors group"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <h4 className="text-white text-sm font-medium line-clamp-2 group-hover:text-blue-400 transition-colors">
                  {item.title}
                </h4>
                <p className="text-gray-500 text-xs mt-1 line-clamp-2">{item.summary}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-600 text-xs">{item.source}</span>
                  <div className="flex items-center gap-2 text-gray-600 text-xs">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(item.published_at)}
                    </div>
                    <ExternalLink className="w-3 h-3 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </motion.a>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  )
}
