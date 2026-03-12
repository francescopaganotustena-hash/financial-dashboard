"""Pydantic schemas for API responses."""

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


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
