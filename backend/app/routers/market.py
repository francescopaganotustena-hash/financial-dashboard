"""Market watch API router."""

from datetime import datetime
from typing import Any
import asyncio
import logging

import yfinance as yf
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/markets", tags=["markets"])
_YF_CONCURRENCY_LIMIT = 4


MARKET_CATALOG: dict[str, dict[str, Any]] = {
    "italy": {
        "label": "Italia",
        "flag": "🇮🇹",
        "indices": {
            "ftse_mib": {
                "label": "FTSE MIB (Milano)",
                "symbols": [
                    ("TIT.MI", "Telecom Italia"),
                    ("STLAM.MI", "Stellantis NV"),
                    ("G.MI", "Assicurazioni Generali"),
                    ("SRG.MI", "Snam Rete"),
                    ("PRY.MI", "Prysmian"),
                    ("ISP.MI", "Intesa Sanpaolo"),
                    ("UCG.MI", "UniCredit"),
                    ("BMED.MI", "Banca Mediolanum"),
                    ("LDO.MI", "Leonardo"),
                    ("ENEL.MI", "Enel"),
                    ("TEN.MI", "Tenaris"),
                    ("ENI.MI", "Eni"),
                ],
            },
        },
    },
    "usa": {
        "label": "Stati Uniti",
        "flag": "🇺🇸",
        "indices": {
            "dow30_watch": {
                "label": "USA Large Caps",
                "symbols": [
                    ("AAPL", "Apple"),
                    ("MSFT", "Microsoft"),
                    ("NVDA", "NVIDIA"),
                    ("JPM", "JPMorgan"),
                    ("V", "Visa"),
                    ("GS", "Goldman Sachs"),
                    ("DIS", "Walt Disney"),
                    ("KO", "Coca-Cola"),
                    ("BA", "Boeing"),
                    ("IBM", "IBM"),
                    ("MCD", "McDonald's"),
                    ("WMT", "Walmart"),
                ],
            },
        },
    },
    "germany": {
        "label": "Germania",
        "flag": "🇩🇪",
        "indices": {
            "dax_watch": {
                "label": "DAX (Francoforte)",
                "symbols": [
                    ("SAP.DE", "SAP"),
                    ("SIE.DE", "Siemens"),
                    ("ALV.DE", "Allianz"),
                    ("BAS.DE", "BASF"),
                    ("BMW.DE", "BMW"),
                    ("MBG.DE", "Mercedes-Benz"),
                    ("DTE.DE", "Deutsche Telekom"),
                    ("AIR.DE", "Airbus"),
                    ("ADS.DE", "Adidas"),
                    ("BAYN.DE", "Bayer"),
                ],
            },
        },
    },
    "uk": {
        "label": "Regno Unito",
        "flag": "🇬🇧",
        "indices": {
            "ftse100_watch": {
                "label": "FTSE 100 (Londra)",
                "symbols": [
                    ("HSBA.L", "HSBC"),
                    ("SHEL.L", "Shell"),
                    ("AZN.L", "AstraZeneca"),
                    ("BP.L", "BP"),
                    ("VOD.L", "Vodafone"),
                    ("ULVR.L", "Unilever"),
                    ("RIO.L", "Rio Tinto"),
                    ("GSK.L", "GSK"),
                    ("NG.L", "National Grid"),
                    ("BARC.L", "Barclays"),
                ],
            },
        },
    },
    "france": {
        "label": "Francia",
        "flag": "🇫🇷",
        "indices": {
            "cac40_watch": {
                "label": "CAC 40 (Parigi)",
                "symbols": [
                    ("MC.PA", "LVMH"),
                    ("OR.PA", "L'Oreal"),
                    ("AIR.PA", "Airbus"),
                    ("TTE.PA", "TotalEnergies"),
                    ("SAN.PA", "Sanofi"),
                    ("BNP.PA", "BNP Paribas"),
                    ("RMS.PA", "Hermes"),
                    ("SU.PA", "Schneider Electric"),
                    ("CAP.PA", "Capgemini"),
                    ("ENGI.PA", "Engie"),
                ],
            },
        },
    },
    "japan": {
        "label": "Giappone",
        "flag": "🇯🇵",
        "indices": {
            "nikkei225_watch": {
                "label": "Nikkei 225 (Tokyo)",
                "symbols": [
                    ("7203.T", "Toyota"),
                    ("6758.T", "Sony Group"),
                    ("9984.T", "SoftBank Group"),
                    ("9432.T", "NTT"),
                    ("8035.T", "Tokyo Electron"),
                    ("8306.T", "Mitsubishi UFJ"),
                    ("6501.T", "Hitachi"),
                    ("8058.T", "Mitsubishi Corp"),
                    ("6861.T", "Keyence"),
                    ("7267.T", "Honda"),
                ],
            },
        },
    },
}


def _format_last_time(ts: Any) -> str:
    if hasattr(ts, "strftime"):
        # If market data is daily and midnight, display the date.
        if getattr(ts, "hour", 0) == 0 and getattr(ts, "minute", 0) == 0:
            return ts.strftime("%Y-%m-%d")
        return ts.strftime("%H:%M:%S")
    return datetime.utcnow().strftime("%H:%M:%S")


async def _fetch_symbol_snapshot(symbol: str) -> dict[str, Any] | None:
    def _fetch() -> dict[str, Any] | None:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1mo", interval="1d", auto_adjust=False)
        if hist is None or hist.empty:
            return None

        hist = hist.dropna(how="all")
        if hist.empty:
            return None

        latest = hist.iloc[-1]
        previous = hist.iloc[-2] if len(hist) > 1 else latest

        last_close = float(latest.get("Close", 0.0))
        prev_close = float(previous.get("Close", last_close))
        var_abs = last_close - prev_close
        var_pct = (var_abs / prev_close * 100) if prev_close else 0.0
        closes = [float(v) for v in hist["Close"].tail(15).tolist() if v is not None]
        avg_volume_20d = float(hist["Volume"].tail(20).mean()) if "Volume" in hist else 0.0

        return {
            "symbol": symbol,
            "last": last_close,
            "prev_close": prev_close,
            "high": float(latest.get("High", last_close)),
            "low": float(latest.get("Low", last_close)),
            "var_abs": var_abs,
            "var_pct": var_pct,
            "volume": float(latest.get("Volume", 0.0)),
            "avg_volume_20d": avg_volume_20d,
            "sparkline": closes,
            "time": _format_last_time(hist.index[-1]),
        }

    try:
        return await asyncio.to_thread(_fetch)
    except Exception as e:
        logger.warning(f"Failed snapshot for {symbol}: {e}")
        return None


@router.get("/catalog")
async def get_market_catalog():
    """Return available countries and indices for market watch."""
    markets = []
    for market_key, market_data in MARKET_CATALOG.items():
        indices = []
        for index_key, index_data in market_data["indices"].items():
            indices.append({
                "key": index_key,
                "label": index_data["label"],
            })
        markets.append({
            "key": market_key,
            "label": market_data["label"],
            "flag": market_data["flag"],
            "indices": indices,
        })
    return {"markets": markets}


@router.get("/watch")
async def get_market_watch(
    market: str = Query(..., description="Market key (e.g. italy, usa)"),
    index: str = Query(..., description="Index key from catalog"),
):
    """Return watchlist quote table for selected market/index."""
    market_key = market.strip().lower()
    index_key = index.strip().lower()

    if market_key not in MARKET_CATALOG:
        raise HTTPException(status_code=400, detail="Invalid market key")

    market_data = MARKET_CATALOG[market_key]
    if index_key not in market_data["indices"]:
        raise HTTPException(status_code=400, detail="Invalid index key for this market")

    index_data = market_data["indices"][index_key]
    pairs: list[tuple[str, str]] = index_data["symbols"]

    semaphore = asyncio.Semaphore(_YF_CONCURRENCY_LIMIT)

    async def _limited_snapshot(symbol: str) -> dict[str, Any] | None:
        async with semaphore:
            return await _fetch_symbol_snapshot(symbol)

    snapshots = await asyncio.gather(
        *[_limited_snapshot(symbol) for symbol, _ in pairs],
        return_exceptions=False,
    )

    rows = []
    for (symbol, name), snapshot in zip(pairs, snapshots):
        if not snapshot:
            continue
        rows.append({
            "symbol": symbol,
            "name": name,
            "flag": market_data["flag"],
            "last": snapshot["last"],
            "prev_close": snapshot["prev_close"],
            "high": snapshot["high"],
            "low": snapshot["low"],
            "var_abs": snapshot["var_abs"],
            "var_pct": snapshot["var_pct"],
            "volume": snapshot["volume"],
            "avg_volume_20d": snapshot["avg_volume_20d"],
            "sparkline": snapshot["sparkline"],
            "time": snapshot["time"],
        })

    return {
        "market": market_key,
        "market_label": market_data["label"],
        "flag": market_data["flag"],
        "index": index_key,
        "index_label": index_data["label"],
        "rows": rows,
    }
