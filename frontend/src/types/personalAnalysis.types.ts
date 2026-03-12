export type RiskProfile = 'prudente' | 'bilanciato' | 'dinamico'
export type InvestorStyle = 'value' | 'quality' | 'income' | 'macro_defensive' | 'multi_asset_prudent'
export type AssetClassKey = 'equity' | 'bond' | 'commodity' | 'real_estate' | 'cash'

export interface PersonalAnalysisRequest {
  risk_profile: RiskProfile
  time_horizon_months: number
  capital: number
  asset_class_preferences: Record<AssetClassKey, number>
  max_concentration_pct: number
  min_defensive_pct: number
  custom_instruments: PersonalCustomInstrument[]
  investor_style: InvestorStyle
}

export interface PersonalCustomInstrument {
  symbol: string
  asset_class: AssetClassKey
}

export interface PersonalAnalysisScores {
  quality_score: number
  risk_score: number
  stability_score: number
  liquidity_score: number
  profile_coherence_score: number
  investor_style_coherence_score: number
  total_score: number
}

export interface PersonalAnalysisInstrument {
  symbol: string
  name: string
  asset_class: string
  instrument_type: string
  defensive: boolean
  risk_level: string
  scores: PersonalAnalysisScores
  metrics: Record<string, number>
  data_source: 'market_data' | 'fallback_mock'
  explanation: string
}

export interface PersonalAnalysisAllocation {
  symbol: string
  name: string
  asset_class: string
  weight_pct: number
  amount: number
  risk_level: string
  explanation: string
}

export interface PersonalAnalysisSummary {
  average_score: number
  analyzed_instruments: number
  top_symbol: string
  defensive_allocation_pct: number
  contains_mock_data: boolean
}

export interface PersonalAnalysisResponse {
  generated_at: string
  disclaimer: string
  summary: PersonalAnalysisSummary
  ranking: PersonalAnalysisInstrument[]
  allocation: PersonalAnalysisAllocation[]
  narrative: string
  scoring_formula: Record<string, string>
}

export interface PersonalAnalysisCatalogInstrument {
  symbol: string
  name: string
  asset_class: AssetClassKey
  defensive: boolean
  style_tags: InvestorStyle[]
}

export interface PersonalAnalysisCatalogResponse {
  risk_profiles: RiskProfile[]
  investor_styles: InvestorStyle[]
  asset_classes: AssetClassKey[]
  default_risk_profile: RiskProfile
  default_investor_style: InvestorStyle
  default_time_horizon_months: number
  default_capital: number
  default_max_concentration_pct: number
  default_min_defensive_pct: number
  default_asset_class_preferences: Record<AssetClassKey, number>
  instruments: PersonalAnalysisCatalogInstrument[]
}
