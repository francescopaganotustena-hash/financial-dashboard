"""Personal analysis API router."""

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    PersonalAnalysisCatalogResponse,
    PersonalAnalysisRequest,
    PersonalAnalysisResponse,
)
from app.services.personal_analysis import get_personal_analysis_catalog, run_personal_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["personal-analysis"])


@router.get("/personal-analysis/catalog", response_model=PersonalAnalysisCatalogResponse)
async def personal_analysis_catalog():
    """Return catalog and allowed values for the personal analysis module."""
    return get_personal_analysis_catalog()


@router.post("/personal-analysis", response_model=PersonalAnalysisResponse)
async def personal_analysis(request: PersonalAnalysisRequest):
    """Run explicit scoring/risk/allocation analysis for internal simulation usage."""
    try:
        return await run_personal_analysis(request)
    except Exception as e:
        logger.error(f"Personal analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to run personal analysis")
