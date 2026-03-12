"""RRG API router."""

import logging
from typing import Optional
import json

from fastapi import APIRouter, Query, HTTPException, Depends
import redis.asyncio as redis

from app.core.config import settings
from app.models.schemas import RRGResponse
from app.services.rrg_calculator import calculate_rrg_for_symbols
from app.services.data_fetcher import DataFetchError, SymbolNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["rrg"])

# Redis client (lazy init)
_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """Get Redis client instance."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            _redis_client = None
    return _redis_client


def _get_cache_key(benchmark: str, symbols: str, period: str) -> str:
    """Generate cache key for RRG request."""
    sorted_symbols = ",".join(sorted(symbols.split(",")))
    return f"rrg:{benchmark}:{sorted_symbols}:{period}"


def _get_cache_ttl(period: str) -> int:
    """Get cache TTL based on period."""
    if period == "weekly":
        return settings.cache_ttl_weekly
    return settings.cache_ttl_daily


@router.get("/rrg", response_model=RRGResponse)
async def get_rrg(
    symbols: str = Query(..., description="Comma-separated list of symbols (e.g., XLK,XLE,XLV)"),
    benchmark: str = Query(default=settings.default_benchmark, description="Benchmark ticker (default: SPY)"),
    period: str = Query(default="weekly", description="Period: weekly or daily"),
    tail_length: int = Query(default=12, ge=1, le=52, description="Number of periods in tail"),
):
    """
    Calculate RRG (Relative Rotation Graph) for specified symbols.

    - **symbols**: Comma-separated ticker symbols (e.g., "XLK,XLE,XLV,XLF")
    - **benchmark**: Benchmark ticker (default: "SPY")
    - **period**: "weekly" or "daily"
    - **tail_length**: Number of historical periods to include (1-52)
    """
    # Validate period
    if period not in ("weekly", "daily"):
        raise HTTPException(status_code=400, detail="period must be 'weekly' or 'daily'")

    # Parse symbols
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail="At least one symbol is required")

    if len(symbol_list) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 symbols allowed")

    # Try cache first
    redis_client = await get_redis()
    cache_key = _get_cache_key(benchmark, symbols, period)

    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                logger.info(f"Cache hit for {cache_key}")
                data = json.loads(cached)
                # Override tail_length if different
                if data.get("assets"):
                    for asset in data["assets"]:
                        asset["tail"] = asset["tail"][-tail_length:]
                return data
        except Exception as e:
            logger.warning(f"Redis get failed: {e}")

    # Calculate RRG
    try:
        data = await calculate_rrg_for_symbols(
            symbols=symbol_list,
            benchmark=benchmark,
            period=period,
            tail_length=tail_length,
        )
    except SymbolNotFoundError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DataFetchError as e:
        raise HTTPException(status_code=503, detail=f"Data fetch failed: {e}")
    except Exception as e:
        logger.error(f"RRG calculation error: {e}")
        raise HTTPException(status_code=500, detail="Internal calculation error")

    # Validate: at least one asset must be returned
    if not data.get("assets"):
        raise HTTPException(
            status_code=400,
            detail=f"No valid data found for symbols: {', '.join(symbol_list)}. Check that symbols exist."
        )

    # Cache result
    if redis_client:
        try:
            ttl = _get_cache_ttl(period)
            await redis_client.setex(cache_key, ttl, json.dumps(data))
            logger.info(f"Cached {cache_key} for {ttl}s")
        except Exception as e:
            logger.warning(f"Redis set failed: {e}")

    return data