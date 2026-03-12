"""Personal financial analysis service with explicit scoring rules."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import sqrt, ceil
from statistics import median
import numpy as np
import pandas as pd

from app.models.schemas import (
    PersonalAnalysisCatalogResponse,
    PersonalAnalysisCatalogInstrument,
    PersonalAnalysisAllocation,
    PersonalCustomInstrument,
    PersonalAnalysisInstrument,
    PersonalAnalysisRequest,
    PersonalAnalysisResponse,
    PersonalAnalysisScores,
    PersonalAnalysisSummary,
)
from app.services.data_fetcher import fetch_multiple_prices, fetch_stock_overview


@dataclass(frozen=True)
class InstrumentDef:
    symbol: str
    name: str
    asset_class: str
    instrument_type: str
    defensive: bool
    style_tags: tuple[str, ...]


INSTRUMENTS: tuple[InstrumentDef, ...] = (
    InstrumentDef("SPY", "SPDR S&P 500 ETF", "equity", "ETF", False, ("multi_asset_prudent", "quality")),
    InstrumentDef("QQQ", "Invesco QQQ Trust", "equity", "ETF", False, ("quality", "dinamico")),
    InstrumentDef("VLUE", "iShares MSCI USA Value Factor ETF", "equity", "ETF", False, ("value",)),
    InstrumentDef("QUAL", "iShares MSCI USA Quality Factor ETF", "equity", "ETF", False, ("quality",)),
    InstrumentDef("VIG", "Vanguard Dividend Appreciation ETF", "equity", "ETF", False, ("income", "quality")),
    InstrumentDef("IEF", "iShares 7-10 Year Treasury Bond ETF", "bond", "ETF", True, ("macro_defensive", "multi_asset_prudent")),
    InstrumentDef("TLT", "iShares 20+ Year Treasury Bond ETF", "bond", "ETF", True, ("macro_defensive",)),
    InstrumentDef("LQD", "iShares iBoxx $ Investment Grade Corporate Bond ETF", "bond", "ETF", True, ("income", "multi_asset_prudent")),
    InstrumentDef("GLD", "SPDR Gold Shares", "commodity", "ETF", True, ("macro_defensive", "multi_asset_prudent")),
    InstrumentDef("VNQ", "Vanguard Real Estate ETF", "real_estate", "ETF", False, ("income", "multi_asset_prudent")),
    InstrumentDef("XLP", "Consumer Staples Select Sector SPDR Fund", "equity", "ETF", True, ("macro_defensive", "quality")),
    InstrumentDef("BIL", "SPDR Bloomberg 1-3 Month T-Bill ETF", "cash", "ETF", True, ("macro_defensive", "multi_asset_prudent")),
)
INSTRUMENT_BY_SYMBOL: dict[str, InstrumentDef] = {item.symbol: item for item in INSTRUMENTS}

# Explicit and editable weights for total score.
SCORE_WEIGHTS: dict[str, float] = {
    "quality": 0.24,
    "risk": 0.20,
    "stability": 0.18,
    "liquidity": 0.12,
    "profile_coherence": 0.14,
    "investor_style_coherence": 0.12,
}

PROFILE_TARGET_VOL: dict[str, float] = {
    "prudente": 9.0,
    "bilanciato": 14.0,
    "dinamico": 21.0,
}

PROFILE_EQUITY_BAND: dict[str, tuple[float, float]] = {
    "prudente": (0.10, 0.40),
    "bilanciato": (0.30, 0.70),
    "dinamico": (0.55, 0.90),
}

ASSET_CLASS_KEYS = ("equity", "bond", "commodity", "real_estate", "cash")
RISK_PROFILES = ("prudente", "bilanciato", "dinamico")
INVESTOR_STYLES = ("value", "quality", "income", "macro_defensive", "multi_asset_prudent")
DEFAULT_ASSET_CLASS_PREFERENCES: dict[str, float] = {
    "equity": 45.0,
    "bond": 30.0,
    "commodity": 10.0,
    "real_estate": 10.0,
    "cash": 5.0,
}

STYLE_TAGS_BY_CLASS: dict[str, tuple[str, ...]] = {
    "equity": ("quality", "value", "income"),
    "bond": ("macro_defensive", "multi_asset_prudent", "income"),
    "commodity": ("macro_defensive", "multi_asset_prudent"),
    "real_estate": ("income", "multi_asset_prudent"),
    "cash": ("macro_defensive", "multi_asset_prudent"),
}

FALLBACK_METRICS_BY_CLASS: dict[str, dict[str, float]] = {
    "equity": {"mom6m": 4.0, "vol": 18.0, "drawdown": 17.0, "avg_volume": 1_000_000},
    "bond": {"mom6m": 1.8, "vol": 9.0, "drawdown": 8.0, "avg_volume": 900_000},
    "commodity": {"mom6m": 2.5, "vol": 16.0, "drawdown": 14.0, "avg_volume": 800_000},
    "real_estate": {"mom6m": 3.0, "vol": 15.0, "drawdown": 16.0, "avg_volume": 700_000},
    "cash": {"mom6m": 0.4, "vol": 2.0, "drawdown": 1.2, "avg_volume": 600_000},
}


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _risk_bucket_from_vol(volatility_pct: float) -> str:
    if volatility_pct < 7.0:
        return "basso"
    if volatility_pct < 13.0:
        return "medio-basso"
    if volatility_pct < 20.0:
        return "medio"
    if volatility_pct < 28.0:
        return "medio-alto"
    return "alto"


def _safe_preferences(raw: dict[str, float]) -> dict[str, float]:
    cleaned = {k: max(0.0, float(raw.get(k, 0.0))) for k in ASSET_CLASS_KEYS}
    total = sum(cleaned.values())
    if total <= 0:
        return DEFAULT_ASSET_CLASS_PREFERENCES.copy()
    return {k: (v / total) * 100.0 for k, v in cleaned.items()}


async def _build_custom_instruments(custom_rows: list[PersonalCustomInstrument]) -> list[InstrumentDef]:
    deduped: dict[str, PersonalCustomInstrument] = {}
    for row in custom_rows:
        symbol = row.symbol.strip().upper()
        if not symbol or symbol in INSTRUMENT_BY_SYMBOL:
            continue
        deduped[symbol] = PersonalCustomInstrument(symbol=symbol, asset_class=row.asset_class)

    if not deduped:
        return []

    async def _resolve_info(symbol: str) -> tuple[str, str]:
        try:
            info = await fetch_stock_overview(symbol)
            name = str(info.get("name") or symbol)
            instrument_type = str(info.get("type") or "").upper().strip() or "UNKNOWN"
            return name, instrument_type
        except Exception:
            return symbol, "UNKNOWN"

    custom_defs: list[InstrumentDef] = []
    for symbol, row in deduped.items():
        name, instrument_type = await _resolve_info(symbol)
        asset_class = row.asset_class
        custom_defs.append(
            InstrumentDef(
                symbol=symbol,
                name=name,
                asset_class=asset_class,
                instrument_type=instrument_type,
                defensive=asset_class in ("bond", "cash", "commodity"),
                style_tags=STYLE_TAGS_BY_CLASS.get(asset_class, ("multi_asset_prudent",)),
            )
        )

    return custom_defs


def _extract_metrics(df: pd.DataFrame) -> dict[str, float]:
    closes = pd.to_numeric(df.get("Close"), errors="coerce").dropna()
    volumes = pd.to_numeric(df.get("Volume"), errors="coerce").fillna(0.0)

    if closes.empty:
        raise ValueError("Missing close prices")

    last_close = float(closes.iloc[-1])
    lookback_6m = min(126, len(closes) - 1)
    base_6m = float(closes.iloc[-(lookback_6m + 1)]) if lookback_6m >= 1 else float(closes.iloc[0])
    mom6m = ((last_close / base_6m) - 1.0) * 100.0 if base_6m > 0 else 0.0

    returns = closes.pct_change().dropna()
    tail_returns = returns.tail(63)
    vol = float(tail_returns.std(ddof=0) * sqrt(252) * 100.0) if len(tail_returns) >= 5 else 0.0

    rolling_peak = closes.cummax()
    drawdowns = ((closes / rolling_peak) - 1.0) * 100.0
    max_drawdown = abs(float(drawdowns.min())) if not drawdowns.empty else 0.0

    avg_volume = float(volumes.tail(20).mean()) if not volumes.empty else 0.0

    return {
        "last_close": last_close,
        "mom6m": mom6m,
        "vol": vol,
        "drawdown": max_drawdown,
        "avg_volume": avg_volume,
    }


def _profile_coherence(inst: InstrumentDef, profile: str, horizon_months: int) -> float:
    low, high = PROFILE_EQUITY_BAND[profile]
    if inst.asset_class == "equity":
        base = 100.0 if high >= 0.45 else 50.0
    elif inst.asset_class in ("bond", "cash"):
        base = 100.0 if low <= 0.35 else 65.0
    else:
        base = 78.0

    if horizon_months < 24 and inst.asset_class == "equity":
        base -= 12.0
    if horizon_months >= 60 and inst.asset_class in ("equity", "real_estate"):
        base += 8.0

    if profile == "prudente" and not inst.defensive:
        base -= 10.0
    if profile == "dinamico" and inst.asset_class in ("bond", "cash"):
        base -= 8.0

    return _clamp(base)


def _style_coherence(inst: InstrumentDef, investor_style: str) -> float:
    if investor_style in inst.style_tags:
        return 95.0
    if investor_style == "multi_asset_prudent" and inst.defensive:
        return 82.0
    if investor_style == "macro_defensive" and inst.asset_class in ("bond", "commodity", "cash"):
        return 84.0
    if investor_style in ("value", "quality", "income") and inst.asset_class == "equity":
        return 60.0
    return 45.0


def _compute_scores(
    inst: InstrumentDef,
    metrics: dict[str, float],
    profile: str,
    horizon_months: int,
    investor_style: str,
    max_universe_volume: float,
) -> PersonalAnalysisScores:
    mom6m = metrics["mom6m"]
    vol = metrics["vol"]
    drawdown = metrics["drawdown"]
    avg_volume = metrics["avg_volume"]

    quality_score = _clamp(55.0 + mom6m * 2.0 - drawdown * 0.8)
    target_vol = PROFILE_TARGET_VOL[profile]
    risk_score = _clamp(100.0 - abs(vol - target_vol) * 4.2)
    stability_score = _clamp(100.0 - vol * 2.4 - drawdown * 1.1)
    liquidity_score = _clamp((avg_volume / max_universe_volume) * 100.0 if max_universe_volume > 0 else 0.0)
    profile_coherence_score = _profile_coherence(inst, profile, horizon_months)
    investor_style_coherence_score = _style_coherence(inst, investor_style)

    total_score = _clamp(
        quality_score * SCORE_WEIGHTS["quality"]
        + risk_score * SCORE_WEIGHTS["risk"]
        + stability_score * SCORE_WEIGHTS["stability"]
        + liquidity_score * SCORE_WEIGHTS["liquidity"]
        + profile_coherence_score * SCORE_WEIGHTS["profile_coherence"]
        + investor_style_coherence_score * SCORE_WEIGHTS["investor_style_coherence"]
    )

    return PersonalAnalysisScores(
        quality_score=round(quality_score, 2),
        risk_score=round(risk_score, 2),
        stability_score=round(stability_score, 2),
        liquidity_score=round(liquidity_score, 2),
        profile_coherence_score=round(profile_coherence_score, 2),
        investor_style_coherence_score=round(investor_style_coherence_score, 2),
        total_score=round(total_score, 2),
    )


def _build_instrument_explanation(inst: InstrumentDef, scores: PersonalAnalysisScores, metrics: dict[str, float]) -> str:
    risk_level = _risk_bucket_from_vol(metrics["vol"])
    return (
        f"Score {scores.total_score:.1f}/100 su {inst.asset_class}. "
        f"Momento 6M {metrics['mom6m']:.1f}%, volatilita {metrics['vol']:.1f}% ({risk_level}), "
        f"coerenza profilo {scores.profile_coherence_score:.0f} e stile {scores.investor_style_coherence_score:.0f}."
    )


def _weights_with_caps(raw_weights: dict[str, float], max_concentration_pct: float) -> dict[str, float]:
    weights = raw_weights.copy()

    total = sum(weights.values())
    if total <= 0:
        n = len(weights)
        return {k: 100.0 / n for k in weights}

    weights = {k: (v / total) * 100.0 for k, v in weights.items()}

    for _ in range(10):
        over = {k: v for k, v in weights.items() if v > max_concentration_pct}
        if not over:
            break

        excess = sum(v - max_concentration_pct for v in over.values())
        for k in over:
            weights[k] = max_concentration_pct

        under_keys = [k for k, v in weights.items() if v < max_concentration_pct]
        under_total = sum(weights[k] for k in under_keys)
        if under_total <= 0 or excess <= 0:
            break

        for k in under_keys:
            add = excess * (weights[k] / under_total)
            weights[k] = min(max_concentration_pct, weights[k] + add)

    total = sum(weights.values())
    if total > 0:
        weights = {k: (v / total) * 100.0 for k, v in weights.items()}

    return weights


def _enforce_min_defensive(
    ranked: list[PersonalAnalysisInstrument],
    weights: dict[str, float],
    min_defensive_pct: float,
) -> dict[str, float]:
    defensive_symbols = {row.symbol for row in ranked if row.defensive}
    current_defensive = sum(weights.get(sym, 0.0) for sym in defensive_symbols)

    if current_defensive >= min_defensive_pct:
        return weights

    gap = min_defensive_pct - current_defensive
    non_def = [sym for sym in weights if sym not in defensive_symbols and weights[sym] > 0]
    def_syms = [sym for sym in weights if sym in defensive_symbols]

    available = sum(weights[sym] for sym in non_def)
    if available <= 0 or not def_syms:
        return weights

    transfer = min(gap, available)

    for sym in non_def:
        weights[sym] = max(0.0, weights[sym] - transfer * (weights[sym] / available))

    def_total = sum(weights[sym] for sym in def_syms)
    if def_total <= 0:
        equal_add = transfer / len(def_syms)
        for sym in def_syms:
            weights[sym] += equal_add
    else:
        for sym in def_syms:
            weights[sym] += transfer * (weights[sym] / def_total)

    total = sum(weights.values())
    if total > 0:
        weights = {k: (v / total) * 100.0 for k, v in weights.items()}

    return weights


def _build_summary(
    ranked: list[PersonalAnalysisInstrument],
    allocations: list[PersonalAnalysisAllocation],
    profile: str,
    investor_style: str,
) -> str:
    if not ranked:
        return "Analisi non disponibile: dati insufficienti."

    top = ranked[0]
    top_alloc = allocations[0] if allocations else None
    alloc_text = f"Prima quota teorica su {top_alloc.symbol} ({top_alloc.weight_pct:.1f}%). " if top_alloc else ""

    return (
        f"Simulazione interna per profilo {profile} e stile {investor_style}: "
        f"strumento con score piu alto {top.symbol} ({top.scores.total_score:.1f}/100). "
        f"{alloc_text}Output usato per confronto tra scenari, non come consulenza professionale."
    )


async def run_personal_analysis(payload: PersonalAnalysisRequest) -> PersonalAnalysisResponse:
    preferences = _safe_preferences(payload.asset_class_preferences)
    custom_instruments = await _build_custom_instruments(payload.custom_instruments)
    analysis_instruments = tuple(list(INSTRUMENTS) + custom_instruments)
    instrument_by_symbol = {item.symbol: item for item in analysis_instruments}

    symbols = [item.symbol for item in analysis_instruments]
    price_map = await fetch_multiple_prices(symbols=symbols, period="1y", interval="1d")

    metric_rows: list[tuple[InstrumentDef, dict[str, float], bool]] = []
    for inst in analysis_instruments:
        df = price_map.get(inst.symbol)
        using_mock = False

        if df is None or df.empty or len(df) < 22:
            metrics = FALLBACK_METRICS_BY_CLASS[inst.asset_class].copy()
            metrics["last_close"] = 0.0
            using_mock = True
        else:
            try:
                metrics = _extract_metrics(df)
            except Exception:
                metrics = FALLBACK_METRICS_BY_CLASS[inst.asset_class].copy()
                metrics["last_close"] = 0.0
                using_mock = True

        metric_rows.append((inst, metrics, using_mock))

    max_universe_volume = median([row[1]["avg_volume"] for row in metric_rows])
    if max_universe_volume <= 0:
        max_universe_volume = 1.0

    ranked: list[PersonalAnalysisInstrument] = []
    for inst, metrics, using_mock in metric_rows:
        scores = _compute_scores(
            inst=inst,
            metrics=metrics,
            profile=payload.risk_profile,
            horizon_months=payload.time_horizon_months,
            investor_style=payload.investor_style,
            max_universe_volume=max_universe_volume,
        )

        explanation = _build_instrument_explanation(inst, scores, metrics)

        ranked.append(
            PersonalAnalysisInstrument(
                symbol=inst.symbol,
                name=inst.name,
                asset_class=inst.asset_class,
                instrument_type=inst.instrument_type,
                defensive=inst.defensive,
                risk_level=_risk_bucket_from_vol(metrics["vol"]),
                scores=scores,
                metrics={
                    "momentum_6m_pct": round(metrics["mom6m"], 2),
                    "volatility_3m_ann_pct": round(metrics["vol"], 2),
                    "max_drawdown_1y_pct": round(metrics["drawdown"], 2),
                    "avg_volume_20d": round(metrics["avg_volume"], 2),
                },
                data_source="fallback_mock" if using_mock else "market_data",
                explanation=explanation,
            )
        )

    ranked.sort(key=lambda item: item.scores.total_score, reverse=True)

    required_slots = max(8, int(ceil(100.0 / max(payload.max_concentration_pct, 1.0))))
    top_for_allocation = ranked[: min(len(ranked), required_slots)]

    raw_weights: dict[str, float] = {}
    for row in top_for_allocation:
        pref_weight = preferences.get(row.asset_class, 0.0) / 100.0
        pref_boost = 0.50 + pref_weight * 1.50

        inst_def = INSTRUMENT_BY_SYMBOL.get(row.symbol)
        if not inst_def:
            inst_def = instrument_by_symbol.get(row.symbol)
        style_boost = 1.10 if inst_def and payload.investor_style in inst_def.style_tags else 1.0

        raw_weights[row.symbol] = max(0.1, row.scores.total_score) * pref_boost * style_boost

    weights = _weights_with_caps(raw_weights, payload.max_concentration_pct)
    weights = _enforce_min_defensive(top_for_allocation, weights, payload.min_defensive_pct)
    weights = _weights_with_caps(weights, payload.max_concentration_pct)

    allocations: list[PersonalAnalysisAllocation] = []
    for row in top_for_allocation:
        weight = round(weights.get(row.symbol, 0.0), 2)
        amount = round((weight / 100.0) * payload.capital, 2)
        allocations.append(
            PersonalAnalysisAllocation(
                symbol=row.symbol,
                name=row.name,
                asset_class=row.asset_class,
                weight_pct=weight,
                amount=amount,
                risk_level=row.risk_level,
                explanation=(
                    f"Quota teorica {weight:.1f}%: score {row.scores.total_score:.1f}, "
                    f"coerenza profilo/stile e preferenza asset class {row.asset_class}."
                ),
            )
        )

    allocations = sorted(allocations, key=lambda item: item.weight_pct, reverse=True)

    avg_score = float(np.mean([row.scores.total_score for row in ranked])) if ranked else 0.0
    contains_mock = any(row.data_source == "fallback_mock" for row in ranked)

    summary = PersonalAnalysisSummary(
        average_score=round(avg_score, 2),
        analyzed_instruments=len(ranked),
        top_symbol=ranked[0].symbol if ranked else "",
        defensive_allocation_pct=round(sum(a.weight_pct for a in allocations if a.risk_level in ("basso", "medio-basso") or a.asset_class in ("bond", "cash", "commodity")), 2),
        contains_mock_data=contains_mock,
    )

    return PersonalAnalysisResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        disclaimer=(
            "Modulo interno di supporto decisionale: scoring esplicito, simulazione e confronto scenari. "
            "Non rappresenta consulenza finanziaria professionale ne promessa di rendimento."
        ),
        summary=summary,
        ranking=ranked,
        allocation=allocations,
        narrative=_build_summary(ranked, allocations, payload.risk_profile, payload.investor_style),
        scoring_formula={
            "total_score_0_100": (
                "0.24*quality_score + 0.20*risk_score + 0.18*stability_score + "
                "0.12*liquidity_score + 0.14*profile_coherence_score + 0.12*investor_style_coherence_score"
            ),
            "quality_score": "clamp(55 + 2*momentum_6m_pct - 0.8*max_drawdown_1y_pct)",
            "risk_score": "clamp(100 - 4.2*abs(volatility_3m_ann_pct - target_vol_by_profile))",
            "stability_score": "clamp(100 - 2.4*volatility_3m_ann_pct - 1.1*max_drawdown_1y_pct)",
            "liquidity_score": "clamp(avg_volume_20d / median_universe_volume * 100)",
        },
    )


def get_personal_analysis_catalog() -> PersonalAnalysisCatalogResponse:
    return PersonalAnalysisCatalogResponse(
        risk_profiles=list(RISK_PROFILES),
        investor_styles=list(INVESTOR_STYLES),
        asset_classes=list(ASSET_CLASS_KEYS),
        default_risk_profile="bilanciato",
        default_investor_style="multi_asset_prudent",
        default_time_horizon_months=60,
        default_capital=50_000.0,
        default_max_concentration_pct=25.0,
        default_min_defensive_pct=20.0,
        default_asset_class_preferences=DEFAULT_ASSET_CLASS_PREFERENCES.copy(),
        instruments=[
            PersonalAnalysisCatalogInstrument(
                symbol=item.symbol,
                name=item.name,
                asset_class=item.asset_class,
                defensive=item.defensive,
                style_tags=list(item.style_tags),
            )
            for item in INSTRUMENTS
        ],
    )
