"""Health check API router."""

import logging
from datetime import datetime

from fastapi import APIRouter
import redis.asyncio as redis

from app.core.config import settings
from app.models.schemas import HealthResponse
from app.services.data_fetcher import fetch_news_with_source

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["health"])

# Redis client (lazy init)
_redis_client: redis.Redis | None = None


async def get_redis() -> redis.Redis | None:
    """Get Redis client instance."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await _redis_client.ping()
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            _redis_client = None
    return _redis_client


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    redis_status = "disconnected"
    redis_client = await get_redis()

    if redis_client:
        try:
            await redis_client.ping()
            redis_status = "connected"
        except Exception as e:
            logger.warning(f"Redis ping failed: {e}")
            redis_status = "error"

    return HealthResponse(
        status="healthy" if redis_status != "error" else "degraded",
        redis=redis_status,
        version="1.0.0",
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


@router.get("/news")
async def get_news(
    symbol: str,
    limit: int = 10,
):
    """
    Get financial news for a symbol.

    - **symbol**: Ticker symbol
    - **limit**: Number of news items (default: 10)
    """
    symbol = symbol.upper()

    if limit < 1 or limit > 50:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="limit must be between 1 and 50")

    news, feed_source = await fetch_news_with_source(symbol, limit)

    return {
        "symbol": symbol,
        "feed_source": feed_source,
        "news": news,
    }
