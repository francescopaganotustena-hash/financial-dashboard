import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Header, Sidebar } from './components/Layout'
import { RRGChart } from './components/RRGChart'
import { PriceChart } from './components/PriceChart'
import { StockTrendPanel } from './components/StockTrendPanel'
import { StockInfoPanel } from './components/StockInfoPanel'
import { MarketWatchPanel } from './components/MarketWatchPanel'
import { MarketPulsePanel } from './components/MarketPulsePanel'
import { NewsPanel } from './components/NewsPanel'
import { AssetTable } from './components/AssetTable'
import { SectorScreener } from './components/SectorScreener'
import { AIInsightPanel } from './components/AIInsightPanel'
import { useRRGData } from './hooks/useRRGData'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
})

function MainContent() {
  const { data, isLoading, error } = useRRGData()

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        <main className="flex-1 p-4 overflow-auto">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-400 text-lg mb-2">Failed to connect to backend</p>
                <p className="text-gray-500 text-sm">
                  Make sure the API service is reachable and configured via VITE_API_URL
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading RRG data...</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-8 flex flex-col gap-4">
                  <div className="flex-none min-h-[520px]">
                    <RRGChart data={data || []} width={700} height={520} />
                  </div>
                  <SectorScreener />
                  <AssetTable />
                  <MarketPulsePanel data={data || []} />
                </div>

                <div className="col-span-4 flex flex-col gap-4">
                  <PriceChart />
                  <StockTrendPanel />
                  <StockInfoPanel />
                  <AIInsightPanel rrgData={data || []} benchmark="SPY" period="daily" />
                  <NewsPanel />
                </div>
              </div>

              <MarketWatchPanel />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainContent />
    </QueryClientProvider>
  )
}
