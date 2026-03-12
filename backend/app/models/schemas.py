"""Pydantic schemas for API responses."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Literal


class RRGPoint(BaseModel):
    """Single point in the RRG tail."""
    date: str
    rs_ratio: float
    rs_momentum: float


class RRGCurrent(BaseModel):
    """Current RRG values for an asset."""
    rs_ratio: float
    rs_momentum: float


class RRGAsset(BaseModel):
    """Asset with RRG data."""
    symbol: str
    name: str
    quadrant: str
    current: RRGCurrent
    tail: List[RRGPoint] = Field(default_factory=list)


class RRGResponse(BaseModel):
    """Response for /api/rrg endpoint."""
    benchmark: str
    period: str
    generated_at: str
    assets: List[RRGAsset]


class OHLCVPoint(BaseModel):
    """OHLCV candlestick data point."""
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class PricesResponse(BaseModel):
    """Response for /api/prices endpoint."""
    symbol: str
    period: str
    interval: str
    data: List[OHLCVPoint]


class NewsItem(BaseModel):
    """Single news item."""
    title: str
    source: str
    url: str
    published_at: str
    summary: Optional[str] = None


class NewsResponse(BaseModel):
    """Response for /api/news endpoint."""
    symbol: str
    feed_source: Optional[str] = None
    news: List[NewsItem]


class HealthResponse(BaseModel):
    """Response for /api/health endpoint."""
    status: str
    redis: str
    version: str
    timestamp: str


class PersonalCustomInstrument(BaseModel):
    symbol: str
    asset_class: Literal["equity", "bond", "commodity", "real_estate", "cash"]


class PersonalAnalysisRequest(BaseModel):
    """Request for personal analysis module."""

    risk_profile: Literal["prudente", "bilanciato", "dinamico"]
    time_horizon_months: int = Field(ge=6, le=240)
    capital: float = Field(gt=0)
    asset_class_preferences: Dict[str, float] = Field(default_factory=dict)
    max_concentration_pct: float = Field(gt=1, le=100)
    min_defensive_pct: float = Field(ge=0, le=100)
    custom_instruments: List[PersonalCustomInstrument] = Field(default_factory=list)
    investor_style: Literal[
        "value",
        "quality",
        "income",
        "macro_defensive",
        "multi_asset_prudent",
    ]


class PersonalAnalysisScores(BaseModel):
    quality_score: float
    risk_score: float
    stability_score: float
    liquidity_score: float
    profile_coherence_score: float
    investor_style_coherence_score: float
    total_score: float


class PersonalAnalysisInstrument(BaseModel):
    symbol: str
    name: str
    asset_class: str
    instrument_type: str
    defensive: bool
    risk_level: str
    scores: PersonalAnalysisScores
    metrics: Dict[str, float]
    data_source: str
    explanation: str


class PersonalAnalysisAllocation(BaseModel):
    symbol: str
    name: str
    asset_class: str
    weight_pct: float
    amount: float
    risk_level: str
    explanation: str


class PersonalAnalysisSummary(BaseModel):
    average_score: float
    analyzed_instruments: int
    top_symbol: str
    defensive_allocation_pct: float
    contains_mock_data: bool


class PersonalAnalysisResponse(BaseModel):
    generated_at: str
    disclaimer: str
    summary: PersonalAnalysisSummary
    ranking: List[PersonalAnalysisInstrument]
    allocation: List[PersonalAnalysisAllocation]
    narrative: str
    scoring_formula: Dict[str, str]


class PersonalAnalysisCatalogInstrument(BaseModel):
    symbol: str
    name: str
    asset_class: str
    defensive: bool
    style_tags: List[str]


class PersonalAnalysisCatalogResponse(BaseModel):
    risk_profiles: List[str]
    investor_styles: List[str]
    asset_classes: List[str]
    default_risk_profile: str
    default_investor_style: str
    default_time_horizon_months: int
    default_capital: float
    default_max_concentration_pct: float
    default_min_defensive_pct: float
    default_asset_class_preferences: Dict[str, float]
    instruments: List[PersonalAnalysisCatalogInstrument]
