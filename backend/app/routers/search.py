"""Symbol search API router."""

import logging

from fastapi import APIRouter, Query, HTTPException

from app.services.data_fetcher import search_symbols, fetch_stock_overview, SymbolNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/symbol-search")
async def symbol_search(
    q: str = Query(..., min_length=2, description="Ticker or company name"),
    limit: int = Query(default=8, ge=1, le=20, description="Max number of suggestions"),
):
    """Search market symbols by ticker or company name."""
    results = await search_symbols(q, limit)
    return {
        "query": q,
        "results": results,
    }


@router.get("/stock-info")
async def stock_info(
    symbol: str = Query(..., min_length=1, description="Ticker symbol"),
):
    """Get stock/company overview for a symbol."""
    symbol = symbol.strip().upper()

    try:
        info = await fetch_stock_overview(symbol)
        return info
    except SymbolNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching stock overview for {symbol}: {e}")
        raise HTTPException(status_code=503, detail="Failed to fetch stock overview")
