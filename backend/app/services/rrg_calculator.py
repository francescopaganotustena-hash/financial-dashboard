"""RRG (Relative Rotation Graph) calculation engine."""

import logging
from typing import Dict, List, Any
from datetime import datetime

import pandas as pd
import numpy as np

from app.services.data_fetcher import fetch_prices, get_symbol_name

logger = logging.getLogger(__name__)


def _determine_quadrant(rs_ratio: float, rs_momentum: float) -> str:
    """Determine the quadrant based on RS-Ratio and RS-Momentum."""
    if rs_ratio >= 100 and rs_momentum >= 100:
        return "Leading"
    elif rs_ratio >= 100 and rs_momentum < 100:
        return "Weakening"
    elif rs_ratio < 100 and rs_momentum < 100:
        return "Lagging"
    else:  # rs_ratio < 100 and rs_momentum >= 100
        return "Improving"


def calculate_rrg(
    symbol_prices: pd.Series,
    benchmark_prices: pd.Series,
    ema_period_short: int = 10,
    ema_period_long: int = 52,
    momentum_period: int = 1,
    smoothing_period: int = 5,
) -> pd.DataFrame:
    """
    Calculate RS-Ratio and RS-Momentum for a symbol vs benchmark.

    Steps:
    1. Relative Price: rel_price = symbol_close / benchmark_close
    2. RS-Ratio: 10-period EMA of rel_price, normalized around 100
    3. RS-Momentum: Rate of Change of RS-Ratio, normalized around 100
    4. Final 5-period EMA smoothing on both indicators
    """
    # Align data
    aligned = pd.DataFrame({
        'symbol': symbol_prices,
        'benchmark': benchmark_prices,
    }).dropna()

    if len(aligned) < ema_period_long + 10:
        raise ValueError(f"Insufficient data: need at least {ema_period_long + 10} periods")

    # Step 1: Relative Price
    rel_price = aligned['symbol'] / aligned['benchmark']

    # Step 2: RS-Ratio (normalized around 100)
    # 10-period EMA of rel_price
    ema_rel = rel_price.ewm(span=ema_period_short, adjust=False).mean()

    # Normalize: 100 + ((EMA_rel - Rolling_Mean_52) / Rolling_Mean_Std_52)
    rolling_mean = ema_rel.rolling(window=ema_period_long).mean()
    rolling_std = ema_rel.rolling(window=ema_period_long).std()

    rs_ratio_raw = 100 + ((ema_rel - rolling_mean) / rolling_std)

    # Step 3: RS-Momentum (normalized around 100)
    # Rate of Change of RS-Ratio over 1 period
    roc = rs_ratio_raw.pct_change(periods=momentum_period)

    rolling_mean_roc = roc.rolling(window=10).mean()
    rolling_std_roc = roc.rolling(window=10).std()

    rs_momentum_raw = 100 + ((roc - rolling_mean_roc) / rolling_std_roc)

    # Step 4: Final 5-period EMA smoothing
    rs_ratio = rs_ratio_raw.ewm(span=smoothing_period, adjust=False).mean()
    rs_momentum = rs_momentum_raw.ewm(span=smoothing_period, adjust=False).mean()

    # Build result DataFrame
    result = pd.DataFrame({
        'date': aligned.index,
        'rel_price': rel_price,
        'rs_ratio': rs_ratio,
        'rs_momentum': rs_momentum,
    }).dropna()

    return result


async def calculate_rrg_for_symbols(
    symbols: List[str],
    benchmark: str = "SPY",
    period: str = "weekly",
    tail_length: int = 12,
) -> Dict[str, Any]:
    """
    Calculate RRG for multiple symbols vs a benchmark.

    Args:
        symbols: List of ticker symbols (e.g., ["XLK", "XLE", "XLV"])
        benchmark: Benchmark ticker (default: "SPY")
        period: "weekly" or "daily"
        tail_length: Number of periods to include in tail (default: 12)

    Returns:
        Dictionary with RRG data for all symbols
    """
    logger.info(f"Calculating RRG for {symbols} vs {benchmark}, period={period}")

    # Map period to yfinance parameters
    if period == "weekly":
        yf_period = "2y"
        yf_interval = "1wk"
    else:
        yf_period = "1y"
        yf_interval = "1d"

    # Fetch symbol data concurrently
    import asyncio
    symbol_tasks = [fetch_prices(s, yf_period, yf_interval) for s in symbols]
    symbol_results = await asyncio.gather(*symbol_tasks, return_exceptions=True)

    valid_symbol_prices: Dict[str, pd.DataFrame] = {}
    for symbol, prices in zip(symbols, symbol_results):
        if isinstance(prices, Exception) or prices is None or prices.empty:
            continue
        valid_symbol_prices[symbol] = prices

    # Fetch benchmark data after symbols, so we can fall back to synthetic benchmark.
    benchmark_used = benchmark
    benchmark_close: pd.Series | None = None
    try:
        benchmark_prices = await fetch_prices(benchmark, yf_period, yf_interval)
        if benchmark_prices is not None and not benchmark_prices.empty:
            benchmark_close = benchmark_prices["Close"]
    except Exception as e:
        logger.warning(f"Benchmark fetch failed for {benchmark}: {e}")

    if benchmark_close is None or benchmark_close.empty:
        # Graceful degradation: if benchmark feed is unavailable, use equal-weight
        # close series from available assets, so API returns useful RRG instead of 503.
        if len(valid_symbol_prices) >= 2:
            close_frame = pd.concat(
                [df["Close"].rename(sym) for sym, df in valid_symbol_prices.items()],
                axis=1
            ).dropna(how="all")
            synthetic = close_frame.mean(axis=1, skipna=True).dropna()
            if synthetic.empty:
                raise ValueError(f"Failed to build synthetic benchmark for {benchmark}")
            benchmark_close = synthetic
            benchmark_used = "EQUAL_WEIGHT"
            logger.warning(
                f"Using synthetic benchmark '{benchmark_used}' because '{benchmark}' was unavailable"
            )
        else:
            raise ValueError(
                f"Failed to fetch benchmark '{benchmark}' and insufficient symbols for fallback"
            )

    assets = []
    for symbol, prices in zip(symbols, symbol_results):
        if isinstance(prices, Exception) or prices is None or prices.empty:
            logger.warning(f"Skipping {symbol}: no data available")
            continue

        try:
            symbol_close = prices['Close']

            # Calculate RRG
            rrg_data = calculate_rrg(symbol_close, benchmark_close)

            if rrg_data.empty:
                logger.warning(f"Skipping {symbol}: insufficient data for RRG calculation")
                continue

            # Get current values (last row)
            current = rrg_data.iloc[-1]
            current_rs_ratio = float(current['rs_ratio'])
            current_rs_momentum = float(current['rs_momentum'])
            quadrant = _determine_quadrant(current_rs_ratio, current_rs_momentum)

            # Get tail data (last N periods)
            tail_df = rrg_data.tail(tail_length)
            tail = [
                {
                    "date": row['date'].strftime("%Y-%m-%d"),
                    "rs_ratio": round(float(row['rs_ratio']), 2),
                    "rs_momentum": round(float(row['rs_momentum']), 2),
                }
                for _, row in tail_df.iterrows()
            ]

            assets.append({
                "symbol": symbol,
                "name": get_symbol_name(symbol),
                "quadrant": quadrant,
                "current": {
                    "rs_ratio": round(current_rs_ratio, 2),
                    "rs_momentum": round(current_rs_momentum, 2),
                },
                "tail": tail,
            })

            logger.info(f"{symbol}: {quadrant} (RS-Ratio: {current_rs_ratio:.2f}, RS-Momentum: {current_rs_momentum:.2f})")

        except Exception as e:
            logger.error(f"Error calculating RRG for {symbol}: {e}")
            continue

    return {
        "benchmark": benchmark_used,
        "period": period,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "assets": assets,
    }
