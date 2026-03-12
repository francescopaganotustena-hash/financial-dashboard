"""Prices API router."""

import logging
from datetime import datetime

from fastapi import APIRouter, Query, HTTPException

from app.models.schemas import PricesResponse, OHLCVPoint
from app.services.data_fetcher import fetch_prices, DataFetchError, SymbolNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["prices"])

# Map period to yfinance parameters
PERIOD_MAP = {
    "1mo": ("1mo", "1d"),
    "3mo": ("3mo", "1d"),
    "6mo": ("6mo", "1d"),
    "1y": ("1y", "1d"),
    "2y": ("2y", "1d"),
}

# Map interval to yfinance
INTERVAL_MAP = {
    "1d": "1d",
    "1wk": "1wk",
}


@router.get("/prices", response_model=PricesResponse)
async def get_prices(
    symbol: str = Query(..., description="Ticker symbol (e.g., XLK, SPY)"),
    period: str = Query(default="1y", description="Period: 1mo, 3mo, 6mo, 1y, 2y"),
    interval: str = Query(default="1d", description="Interval: 1d or 1wk"),
):
    """
    Get OHLCV candlestick data for a symbol.

    - **symbol**: Ticker symbol (e.g., "XLK", "SPY", "AAPL")
    - **period**: Data period (1mo, 3mo, 6mo, 1y, 2y)
    - **interval**: Data interval (1d or 1wk)
    """
    symbol = symbol.upper()

    # Validate period
    if period not in PERIOD_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid period. Must be one of: {', '.join(PERIOD_MAP.keys())}"
        )

    # Validate interval
    if interval not in INTERVAL_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid interval. Must be one of: {', '.join(INTERVAL_MAP.keys())}"
        )

    # Map to yfinance params
    yf_period, yf_interval = PERIOD_MAP[period]

    # Adjust interval for weekly data
    if interval == "1wk":
        yf_interval = "1wk"

    # Fetch data
    try:
        df = await fetch_prices(symbol, yf_period, yf_interval)
    except SymbolNotFoundError:
        raise HTTPException(status_code=400, detail=f"Symbol {symbol} not found")
    except DataFetchError as e:
        raise HTTPException(status_code=503, detail=f"Data fetch failed: {e}")
    except Exception as e:
        logger.error(f"Error fetching prices for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data available for {symbol}")

    # Convert to OHLCV format
    data = []
    for idx, row in df.iterrows():
        data.append(OHLCVPoint(
            date=idx.strftime("%Y-%m-%d"),
            open=float(row.get('Open', row['Close'])),
            high=float(row.get('High', row['Close'])),
            low=float(row.get('Low', row['Close'])),
            close=float(row['Close']),
            volume=int(row.get('Volume', 0)),
        ))

    return PricesResponse(
        symbol=symbol,
        period=period,
        interval=interval,
        data=data,
    )