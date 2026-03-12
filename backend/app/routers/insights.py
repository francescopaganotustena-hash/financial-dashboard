"""Router for AI insights endpoints."""

import logging
from typing import Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ai_insight.insight_generator import insight_generator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["insights"])


class InsightRequest(BaseModel):
    """Request body for insights endpoint."""
    benchmark: str = Field(default="SPY", description="Benchmark ticker")
    period: str = Field(default="daily", description="Period: daily or weekly")
    assets: list = Field(..., description="List of assets with RRG data")


class InsightResponse(BaseModel):
    """Response body for insights endpoint."""
    summary: str
    bullet_points: list
    generated_at: str
    benchmark: str
    period: str


@router.post("/insights", response_model=InsightResponse)
async def generate_insights(request: InsightRequest):
    """
    Generate AI insights from RRG data.

    Analyzes:
    - Assets in Leading quadrant (outperformers)
    - Assets in Lagging quadrant (underperformers)
    - Rotazioni di settore (cambiamenti quadrant)
    - Trend RS-Momentum (accelerazione/decelerazione)

    Returns a summary and bullet points with insights.
    """
    try:
        rrg_data = {
            "benchmark": request.benchmark,
            "period": request.period,
            "assets": request.assets,
        }

        insights = insight_generator.generate_insights(rrg_data)

        return InsightResponse(**insights)

    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate insights: {str(e)}")


@router.get("/insights/example")
async def get_example_insight():
    """Get example insight response for testing."""
    example_data = {
        "benchmark": "SPY",
        "period": "daily",
        "assets": [
            {
                "symbol": "XLK",
                "name": "Technology Select Sector SPDR Fund",
                "quadrant": "Leading",
                "current": {"rs_ratio": 115.5, "rs_momentum": 102.3},
                "tail": [
                    {"date": "2026-03-04", "rs_ratio": 113.2, "rs_momentum": 100.1},
                    {"date": "2026-03-11", "rs_ratio": 115.5, "rs_momentum": 102.3},
                ],
            },
            {
                "symbol": "XLE",
                "name": "Energy Select Sector SPDR Fund",
                "quadrant": "Lagging",
                "current": {"rs_ratio": 85.2, "rs_momentum": 95.8},
                "tail": [
                    {"date": "2026-03-04", "rs_ratio": 87.1, "rs_momentum": 97.2},
                    {"date": "2026-03-11", "rs_ratio": 85.2, "rs_momentum": 95.8},
                ],
            },
        ],
    }

    return insight_generator.generate_insights(example_data)
