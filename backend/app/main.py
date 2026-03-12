"""RRG Web App - Main FastAPI Application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import rrg, prices, health, websocket, insights, search, market

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Starting RRG Web App...")
    yield
    logger.info("Shutting down RRG Web App...")


# Create FastAPI app
app = FastAPI(
    title="RRG Web App API",
    description="Relative Rotation Graph API with real-time market data",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(rrg.router)
app.include_router(prices.router)
app.include_router(health.router)
app.include_router(websocket.router)
app.include_router(insights.router)
app.include_router(search.router)
app.include_router(market.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "RRG Web App API",
        "version": "1.0.0",
        "docs": "/docs",
    }
