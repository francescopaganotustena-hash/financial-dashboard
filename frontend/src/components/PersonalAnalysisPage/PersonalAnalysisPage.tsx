import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import axios from 'axios'
import { usePersonalAnalysis, usePersonalAnalysisCatalog } from '../../hooks/usePersonalAnalysis'
import { API_BASE_URL } from '../../config/api'
import type {
  AssetClassKey,
  InvestorStyle,
  PersonalCustomInstrument,
  PersonalAnalysisRequest,
  PersonalAnalysisResponse,
  RiskProfile,
} from '../../types/personalAnalysis.types'

const RISK_PROFILES: { value: RiskProfile; label: string }[] = [
  { value: 'prudente', label: 'Prudente' },
  { value: 'bilanciato', label: 'Bilanciato' },
  { value: 'dinamico', label: 'Dinamico' },
]

const INVESTOR_STYLE_LABELS: Record<InvestorStyle, string> = {
  value: 'Value',
  quality: 'Quality',
  income: 'Income',
  macro_defensive: 'Macro Defensive',
  multi_asset_prudent: 'Multi Asset Prudent',
}

const INVESTOR_STYLES: { value: InvestorStyle; label: string }[] = [
  { value: 'value', label: INVESTOR_STYLE_LABELS.value },
  { value: 'quality', label: INVESTOR_STYLE_LABELS.quality },
  { value: 'income', label: INVESTOR_STYLE_LABELS.income },
  { value: 'macro_defensive', label: INVESTOR_STYLE_LABELS.macro_defensive },
  { value: 'multi_asset_prudent', label: INVESTOR_STYLE_LABELS.multi_asset_prudent },
]

const ASSET_CLASS_LABELS: Record<AssetClassKey, string> = {
  equity: 'Equity',
  bond: 'Bond',
  commodity: 'Commodity',
  real_estate: 'Real Estate',
  cash: 'Liquidita/Difensivi',
}

const INITIAL_FORM: PersonalAnalysisRequest = {
  risk_profile: 'bilanciato',
  time_horizon_months: 60,
  capital: 50000,
  asset_class_preferences: {
    equity: 45,
    bond: 30,
    commodity: 10,
    real_estate: 10,
    cash: 5,
  },
  max_concentration_pct: 25,
  min_defensive_pct: 20,
  custom_instruments: [],
  investor_style: 'multi_asset_prudent',
}

interface SymbolSuggestion {
  symbol: string
  name: string
  exchange?: string
  type?: string
}

function inferAssetClassFromSuggestion(suggestion: SymbolSuggestion): AssetClassKey {
  const text = `${suggestion.name || ''} ${suggestion.symbol || ''} ${suggestion.type || ''}`.toLowerCase()
  if (
    text.includes('bond') ||
    text.includes('treasury') ||
    text.includes('fixed income') ||
    text.includes('corporate bond') ||
    text.includes('t-bill')
  ) {
    return 'bond'
  }
  return 'equity'
}

function fmtPct(value: number) {
  return `${value.toFixed(2)}%`
}

function fmtNum(value: number) {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(value)
}

function fmtCurrency(value: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value)
}

function scoreBadge(score: number) {
  if (score >= 75) return 'bg-green-900/40 text-green-300 border-green-700'
  if (score >= 55) return 'bg-blue-900/40 text-blue-300 border-blue-700'
  if (score >= 40) return 'bg-yellow-900/40 text-yellow-300 border-yellow-700'
  return 'bg-red-900/40 text-red-300 border-red-700'
}

function RiskBadge({ risk }: { risk: string }) {
  const cls =
    risk === 'basso' || risk === 'medio-basso'
      ? 'bg-green-900/30 text-green-300 border-green-800'
      : risk === 'medio'
        ? 'bg-yellow-900/30 text-yellow-300 border-yellow-800'
        : 'bg-red-900/30 text-red-300 border-red-800'

  return <span className={`text-xs px-2 py-1 rounded border ${cls}`}>{risk}</span>
}

function FormulaPanel({ data }: { data: PersonalAnalysisResponse }) {
  return (
    <div className="bg-background rounded border border-border p-3">
      <p className="text-xs text-gray-400 mb-2">Formula scoring esplicita (0-100)</p>
      <div className="space-y-1">
        {Object.entries(data.scoring_formula).map(([key, value]) => (
          <p key={key} className="text-xs text-gray-300 font-mono break-words">
            <span className="text-blue-300">{key}</span>: {value}
          </p>
        ))}
      </div>
    </div>
  )
}

export function PersonalAnalysisPage() {
  const [form, setForm] = useState<PersonalAnalysisRequest>(INITIAL_FORM)
  const [catalogHydrated, setCatalogHydrated] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedAssetClassForSearch, setSelectedAssetClassForSearch] = useState<AssetClassKey>('equity')
  const analysis = usePersonalAnalysis()
  const catalogQuery = usePersonalAnalysisCatalog()

  const output = analysis.data
  const catalog = catalogQuery.data

  const riskOptions = useMemo(() => {
    if (!catalog) return RISK_PROFILES
    return catalog.risk_profiles.map((item) => ({
      value: item,
      label: item.charAt(0).toUpperCase() + item.slice(1),
    }))
  }, [catalog])

  const styleOptions = useMemo(() => {
    if (!catalog) return INVESTOR_STYLES
    return catalog.investor_styles.map((item) => ({
      value: item,
      label: INVESTOR_STYLE_LABELS[item],
    }))
  }, [catalog])

  const assetClassOptions = useMemo(() => {
    if (!catalog) return Object.keys(ASSET_CLASS_LABELS) as AssetClassKey[]
    return catalog.asset_classes
  }, [catalog])

  useEffect(() => {
    if (!catalog || catalogHydrated) return

    setForm((prev) => {
      const nextPreferences = { ...prev.asset_class_preferences }
      assetClassOptions.forEach((assetClass) => {
        if (nextPreferences[assetClass] === undefined) {
          nextPreferences[assetClass] = catalog.default_asset_class_preferences[assetClass] ?? 0
        }
      })

      return {
        ...prev,
        risk_profile: catalog.risk_profiles.includes(prev.risk_profile) ? prev.risk_profile : catalog.default_risk_profile,
        investor_style: catalog.investor_styles.includes(prev.investor_style) ? prev.investor_style : catalog.default_investor_style,
        time_horizon_months: prev.time_horizon_months || catalog.default_time_horizon_months,
        capital: prev.capital || catalog.default_capital,
        max_concentration_pct: prev.max_concentration_pct || catalog.default_max_concentration_pct,
        min_defensive_pct: prev.min_defensive_pct || catalog.default_min_defensive_pct,
        asset_class_preferences: nextPreferences,
      }
    })

    setCatalogHydrated(true)
  }, [catalog, catalogHydrated, assetClassOptions])

  const totalPreference = useMemo(
    () => Object.values(form.asset_class_preferences).reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0),
    [form.asset_class_preferences]
  )

  const topEquityStocks = useMemo(
    () => (output?.ranking || []).filter((item) => item.asset_class === 'equity' && item.instrument_type === 'EQUITY').slice(0, 5),
    [output]
  )

  const topEquityEtf = useMemo(
    () => (output?.ranking || []).filter((item) => item.asset_class === 'equity' && item.instrument_type === 'ETF').slice(0, 5),
    [output]
  )

  const topBond = useMemo(
    () => (output?.ranking || []).filter((item) => item.asset_class === 'bond').slice(0, 5),
    [output]
  )

  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    let canceled = false
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const response = await axios.get<{ results?: SymbolSuggestion[] }>(`${API_BASE_URL}/api/symbol-search`, {
          params: { q: query, limit: 8 },
        })
        if (!canceled) {
          setSuggestions(response.data.results || [])
        }
      } catch {
        if (!canceled) setSuggestions([])
      } finally {
        if (!canceled) setIsSearching(false)
      }
    }, 280)

    return () => {
      canceled = true
      clearTimeout(timer)
    }
  }, [searchQuery])

  const setPreference = (key: AssetClassKey, value: number) => {
    setForm((prev) => ({
      ...prev,
      asset_class_preferences: {
        ...prev.asset_class_preferences,
        [key]: Math.max(0, Math.min(100, value)),
      },
    }))
  }

  const addCustomInstrument = (row: PersonalCustomInstrument) => {
    const symbol = row.symbol.trim().toUpperCase()
    if (!symbol) return

    setForm((prev) => {
      const exists = prev.custom_instruments.some((item) => item.symbol === symbol)
      if (exists) return prev
      return {
        ...prev,
        custom_instruments: [...prev.custom_instruments, { symbol, asset_class: row.asset_class }],
      }
    })
  }

  const removeCustomInstrument = (symbol: string) => {
    setForm((prev) => ({
      ...prev,
      custom_instruments: prev.custom_instruments.filter((item) => item.symbol !== symbol),
    }))
  }

  const runAnalysis = async () => {
    await analysis.mutateAsync(form)
  }

  return (
    <motion.section
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="bg-card rounded-lg p-4 border border-border">
        <div className="mb-4">
          <h2 className="text-white font-semibold text-lg">Modulo Interno Analisi Finanziaria Personale</h2>
          <p className="text-sm text-gray-400 mt-1">
            Strumento interno per simulazione, scoring comparativo e allocazione teorica su dati pubblici.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Profilo di rischio</label>
            <p className="text-[11px] text-gray-500 mb-1">Indica la tolleranza generale alla volatilita del portafoglio.</p>
            <select
              value={form.risk_profile}
              onChange={(e) => setForm((prev) => ({ ...prev, risk_profile: e.target.value as RiskProfile }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white"
            >
              {riskOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Orizzonte temporale (mesi)</label>
            <p className="text-[11px] text-gray-500 mb-1">Durata stimata della simulazione prima di eventuale revisione.</p>
            <input
              type="number"
              min={6}
              max={240}
              value={form.time_horizon_months}
              onChange={(e) => setForm((prev) => ({ ...prev, time_horizon_months: Math.max(6, Number(e.target.value || 6)) }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Capitale disponibile</label>
            <p className="text-[11px] text-gray-500 mb-1">Importo usato solo per calcolare quote teoriche in valore assoluto.</p>
            <input
              type="number"
              min={1000}
              value={form.capital}
              onChange={(e) => setForm((prev) => ({ ...prev, capital: Math.max(1000, Number(e.target.value || 1000)) }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Stile osservato</label>
            <p className="text-[11px] text-gray-500 mb-1">Approccio prevalente usato per valutare la coerenza dello scoring.</p>
            <select
              value={form.investor_style}
              onChange={(e) => setForm((prev) => ({ ...prev, investor_style: e.target.value as InvestorStyle }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white"
            >
              {styleOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Limite max concentrazione (%)</label>
            <p className="text-[11px] text-gray-500 mb-1">Percentuale massima teorica assegnabile a un singolo strumento.</p>
            <input
              type="number"
              min={5}
              max={100}
              value={form.max_concentration_pct}
              onChange={(e) => setForm((prev) => ({ ...prev, max_concentration_pct: Math.max(5, Math.min(100, Number(e.target.value || 5))) }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Quota min liquidita/difensivi (%)</label>
            <p className="text-[11px] text-gray-500 mb-1">Soglia minima teorica riservata a componenti meno aggressive.</p>
            <input
              type="number"
              min={0}
              max={100}
              value={form.min_defensive_pct}
              onChange={(e) => setForm((prev) => ({ ...prev, min_defensive_pct: Math.max(0, Math.min(100, Number(e.target.value || 0))) }))}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">Preferenze esposizione asset class (non serve che sommino 100)</p>
          <p className="text-[11px] text-gray-500 mb-2">
            Pesi relativi desiderati tra classi di attivo: il motore li normalizza automaticamente.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {assetClassOptions.map((assetClass) => (
              <div key={assetClass} className="bg-background border border-border rounded p-2">
                <label className="text-xs text-gray-400">{ASSET_CLASS_LABELS[assetClass]}</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.asset_class_preferences[assetClass] ?? 0}
                  onChange={(e) => setPreference(assetClass, Number(e.target.value || 0))}
                  className="mt-1 w-full bg-card border border-border rounded px-2 py-1 text-sm text-white"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Totale preferenze inserite: {fmtNum(totalPreference)}</p>
          {catalog && (
            <p className="text-xs text-gray-500 mt-1">
              Universo strumenti disponibili: {catalog.instruments.length}
            </p>
          )}
        </div>

        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">Ricerca azioni e obbligazioni specifiche</p>
          <p className="text-[11px] text-gray-500 mb-2">
            Aggiungi strumenti personalizzati al ranking: lo score viene calcolato con lo stesso profilo selezionato.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="md:col-span-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca ticker o nome (es. AAPL, TLT, IEF...)"
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white placeholder-gray-500"
              />
              {isSearching && <p className="text-[11px] text-gray-500 mt-1">Ricerca in corso...</p>}
            </div>
            <div>
              <select
                value={selectedAssetClassForSearch}
                onChange={(e) => setSelectedAssetClassForSearch(e.target.value as AssetClassKey)}
                className="w-full bg-background border border-border rounded px-3 py-2 text-sm text-white"
              >
                <option value="equity">Azione/ETF Azionario</option>
                <option value="bond">Obbligazionario</option>
                <option value="commodity">Commodity</option>
                <option value="real_estate">Real Estate</option>
                <option value="cash">Liquidita/Difensivi</option>
              </select>
            </div>
            <div>
              <button
                onClick={() => {
                  const ticker = searchQuery.trim().toUpperCase()
                  if (!ticker) return
                  addCustomInstrument({ symbol: ticker, asset_class: selectedAssetClassForSearch })
                  setSearchQuery('')
                  setSuggestions([])
                }}
                className="w-full px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors"
              >
                Aggiungi ticker
              </button>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-2 bg-background border border-border rounded divide-y divide-border">
              {suggestions.map((item) => {
                const inferred = inferAssetClassFromSuggestion(item)
                return (
                  <button
                    key={item.symbol}
                    onClick={() => {
                      addCustomInstrument({ symbol: item.symbol, asset_class: inferred })
                      setSearchQuery('')
                      setSuggestions([])
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-card transition-colors"
                  >
                    <p className="text-sm text-white">
                      {item.symbol} <span className="text-gray-400">- {item.name}</span>
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {item.exchange || 'Market'} • classe suggerita: {ASSET_CLASS_LABELS[inferred]}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          {form.custom_instruments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.custom_instruments.map((row) => (
                <span key={row.symbol} className="inline-flex items-center gap-2 text-xs bg-card border border-border rounded px-2 py-1 text-gray-200">
                  {row.symbol} ({ASSET_CLASS_LABELS[row.asset_class]})
                  <button
                    onClick={() => removeCustomInstrument(row.symbol)}
                    className="text-gray-400 hover:text-white"
                    aria-label={`Rimuovi ${row.symbol}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={runAnalysis}
            disabled={analysis.isPending}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:bg-border disabled:text-gray-500 transition-colors"
          >
            {analysis.isPending ? 'Analisi in esecuzione...' : 'Avvia analisi'}
          </button>
          {analysis.isError && (
            <span className="text-sm text-red-400">
              Errore: {(analysis.error as { message?: string })?.message || 'analisi non disponibile'}
            </span>
          )}
        </div>
      </div>

      {output && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-gray-400">Panoramica score medio</p>
              <p className="text-white text-xl font-semibold mt-1">{output.summary.average_score.toFixed(2)}/100</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-gray-400">Strumenti analizzati</p>
              <p className="text-white text-xl font-semibold mt-1">{output.summary.analyzed_instruments}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-gray-400">Top ranking</p>
              <p className="text-white text-xl font-semibold mt-1">{output.summary.top_symbol}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-xs text-gray-400">Quota difensiva teorica</p>
              <p className="text-white text-xl font-semibold mt-1">{fmtPct(output.summary.defensive_allocation_pct)}</p>
            </div>
          </div>

          {output.summary.contains_mock_data && (
            <div className="bg-yellow-900/20 border border-yellow-800 rounded p-3">
              <p className="text-yellow-200 text-sm">
                Alcuni strumenti usano fallback mock realistico per dati temporaneamente non disponibili dal provider pubblico.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-card rounded-lg p-4 border border-border">
              <h3 className="text-white font-semibold mb-3">Azioni singole maggiormente performanti (per score)</h3>
              {topEquityStocks.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Nessuna azione singola nel set corrente.</p>
                  {topEquityEtf.length > 0 && (
                    <p className="text-xs text-gray-400">
                      Nota: sono presenti strumenti azionari di tipo ETF (es. {topEquityEtf.map((x) => x.symbol).join(', ')}).
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {topEquityStocks.map((item) => (
                    <div key={item.symbol} className="bg-background border border-border rounded p-2">
                      <p className="text-sm text-white">
                        {item.symbol} <span className="text-gray-400">- {item.name}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.instrument_type} • score {item.scores.total_score.toFixed(2)} • momentum 6M {item.metrics.momentum_6m_pct?.toFixed(2) ?? 'n/d'}%
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <h3 className="text-white font-semibold mb-3">Obbligazioni maggiormente performanti (per score)</h3>
              {topBond.length === 0 ? (
                <p className="text-sm text-gray-500">Nessun risultato obbligazionario disponibile.</p>
              ) : (
                <div className="space-y-2">
                  {topBond.map((item) => (
                    <div key={item.symbol} className="bg-background border border-border rounded p-2">
                      <p className="text-sm text-white">
                        {item.symbol} <span className="text-gray-400">- {item.name}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.instrument_type} • score {item.scores.total_score.toFixed(2)} • momentum 6M {item.metrics.momentum_6m_pct?.toFixed(2) ?? 'n/d'}%
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Ranking strumenti analizzati</h3>
              <p className="text-xs text-gray-400">Total score e sottopunteggi tracciabili</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead>
                  <tr className="border-b border-border text-gray-400 text-left">
                    <th className="py-2 px-2">Strumento</th>
                    <th className="py-2 px-2">Classe</th>
                    <th className="py-2 px-2">Rischio</th>
                    <th className="py-2 px-2">Total score</th>
                    <th className="py-2 px-2">Quality</th>
                    <th className="py-2 px-2">Risk</th>
                    <th className="py-2 px-2">Stability</th>
                    <th className="py-2 px-2">Liquidity</th>
                    <th className="py-2 px-2">Profile</th>
                    <th className="py-2 px-2">Style</th>
                    <th className="py-2 px-2">Spiegazione</th>
                  </tr>
                </thead>
                <tbody>
                  {output.ranking.map((row) => (
                    <tr key={row.symbol} className="border-b border-border/50 align-top hover:bg-background/40">
                      <td className="py-2 px-2">
                        <p className="text-white font-medium">{row.symbol}</p>
                        <p className="text-xs text-gray-500">{row.name}</p>
                      </td>
                      <td className="py-2 px-2 text-gray-300">{row.asset_class}</td>
                      <td className="py-2 px-2"><RiskBadge risk={row.risk_level} /></td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-2 py-1 rounded border ${scoreBadge(row.scores.total_score)}`}>
                          {row.scores.total_score.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-300">{row.scores.quality_score.toFixed(1)}</td>
                      <td className="py-2 px-2 text-gray-300">{row.scores.risk_score.toFixed(1)}</td>
                      <td className="py-2 px-2 text-gray-300">{row.scores.stability_score.toFixed(1)}</td>
                      <td className="py-2 px-2 text-gray-300">{row.scores.liquidity_score.toFixed(1)}</td>
                      <td className="py-2 px-2 text-gray-300">{row.scores.profile_coherence_score.toFixed(1)}</td>
                      <td className="py-2 px-2 text-gray-300">{row.scores.investor_style_coherence_score.toFixed(1)}</td>
                      <td className="py-2 px-2 text-xs text-gray-400 max-w-[340px]">{row.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-card rounded-lg p-4 border border-border">
              <h3 className="text-white font-semibold mb-3">Allocazione teorica coerente con profilo</h3>
              <div className="space-y-2">
                {output.allocation.map((row) => (
                  <div key={row.symbol} className="bg-background border border-border rounded p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white text-sm font-medium">
                        {row.symbol} <span className="text-gray-400 font-normal">({row.asset_class})</span>
                      </p>
                      <p className="text-blue-300 text-sm font-semibold">{row.weight_pct.toFixed(2)}%</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Importo teorico: {fmtCurrency(row.amount)}</p>
                    <p className="text-xs text-gray-500 mt-1">{row.explanation}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-card rounded-lg p-4 border border-border">
                <h3 className="text-white font-semibold mb-2">Spiegazione sintetica risultato</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{output.narrative}</p>
              </div>
              <FormulaPanel data={output} />
              <div className="bg-card rounded-lg p-4 border border-border">
                <p className="text-xs text-gray-400">Avvertenza d’uso</p>
                <p className="text-sm text-gray-300 mt-1">{output.disclaimer}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.section>
  )
}
