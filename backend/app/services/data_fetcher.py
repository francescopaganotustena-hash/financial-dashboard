"""Market data fetching service with yfinance and resilient fallbacks."""

import asyncio
import logging
from typing import Dict, Any, Tuple
from io import StringIO

import yfinance as yf
import pandas as pd
import numpy as np
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class DataFetchError(Exception):
    """Raised when both yfinance and Alpha Vantage fail."""
    pass


class DataQualityError(Exception):
    """Raised when data has too many gaps."""
    pass


class SymbolNotFoundError(Exception):
    """Raised when ticker doesn't exist."""
    pass


# Symbol metadata mapping
SYMBOLS_METADATA: Dict[str, str] = {
    "XLK": "Technology Select Sector",
    "XLE": "Energy Select Sector",
    "XLV": "Health Care Select Sector",
    "XLF": "Financial Select Sector",
    "XLI": "Industrials Select Sector",
    "XLY": "Consumer Discretionary Select Sector",
    "XLP": "Consumer Staples Select Sector",
    "XLU": "Utilities Select Sector",
    "XLRE": "Real Estate Select Sector",
    "XLB": "Materials Select Sector",
    "XLC": "Communication Services Select Sector",
    "SPY": "S&P 500",
    "QQQ": "Nasdaq 100",
    "IWM": "Russell 2000",
}


def get_symbol_name(symbol: str) -> str:
    """Get the display name for a symbol."""
    return SYMBOLS_METADATA.get(symbol, symbol)


def _forward_fill_gaps(df: pd.DataFrame, max_days: int = 3) -> pd.DataFrame:
    """Forward fill gaps of max_days, drop beyond that."""
    # Resample to daily to identify gaps
    df = df.resample('D').last()
    # Forward fill
    df = df.ffill(limit=max_days)
    # Drop rows with NaN
    df = df.dropna()
    return df


def _validate_data(df: pd.DataFrame) -> None:
    """Validate data quality, raise if too many NaN values."""
    if df.empty:
        raise DataQualityError("No data available")
    nan_ratio = df['Close'].isna().sum() / len(df)
    if nan_ratio > 0.1:
        raise DataQualityError(f"Too many NaN values: {nan_ratio:.1%}")


async def fetch_prices_yfinance(
    symbol: str,
    period: str = "1y",
    interval: str = "1d"
) -> pd.DataFrame:
    """Fetch prices using yfinance (async wrapper)."""
    logger.info(f"Fetching {symbol} data from yfinance: period={period}, interval={interval}")

    def _fetch():
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval, auto_adjust=True)
        return df

    try:
        df = await asyncio.wait_for(
            asyncio.to_thread(_fetch),
            timeout=settings.yfinance_timeout_sec,
        )
    except asyncio.TimeoutError as e:
        raise DataFetchError(f"yfinance timeout for {symbol}") from e

    if df.empty:
        raise SymbolNotFoundError(f"Symbol {symbol} not found")

    # Validate data quality
    _validate_data(df)

    # Handle missing data: forward-fill gaps of max 3 days
    df = _forward_fill_gaps(df, max_days=3)

    logger.info(f"Fetched {len(df)} data points for {symbol}")
    return df


async def fetch_prices_alpha_vantage(
    symbol: str,
    period: str = "1y",
    interval: str = "1d"
) -> pd.DataFrame:
    """Fallback: fetch prices using Alpha Vantage API."""
    if not settings.alpha_vantage_key:
        raise DataFetchError("Alpha Vantage key not configured")

    logger.info(f"Fetching {symbol} data from Alpha Vantage: period={period}, interval={interval}")

    is_weekly = interval == "1wk"
    function = "TIME_SERIES_WEEKLY_ADJUSTED" if is_weekly else "TIME_SERIES_DAILY_ADJUSTED"
    outputsize = "compact" if period in ["1mo", "3mo"] else "full"

    async with httpx.AsyncClient() as client:
        url = "https://www.alphavantage.co/query"
        params = {
            "function": function,
            "symbol": symbol,
            "apikey": settings.alpha_vantage_key,
        }
        # outputsize is only meaningful for daily adjusted
        if not is_weekly:
            params["outputsize"] = outputsize

        response = await client.get(url, params=params)
        data = response.json()

        if "Error Message" in data or "Note" in data or "Information" in data:
            raise DataFetchError(f"Alpha Vantage error: {data}")

        # API key names vary by function.
        time_series = (
            data.get("Weekly Adjusted Time Series")
            or data.get("Time Series (Daily)")
            or data.get("Weekly Time Series")
            or {}
        )
        if not time_series:
            raise DataFetchError(f"No data returned for {symbol}")

        # Convert to DataFrame
        records = []
        for date_str, values in time_series.items():
            adj_close = values.get("5. adjusted close") or values.get("4. close")
            volume = values.get("6. volume") or values.get("5. volume") or 0
            open_val = values.get("1. open") or adj_close
            high_val = values.get("2. high") or adj_close
            low_val = values.get("3. low") or adj_close
            close_val = values.get("4. close") or adj_close
            records.append({
                "Date": pd.to_datetime(date_str),
                "Open": float(open_val),
                "High": float(high_val),
                "Low": float(low_val),
                "Close": float(adj_close or close_val),
                "Volume": int(float(volume)),
            })

        df = pd.DataFrame(records)
        df = df.sort_values("Date").set_index("Date")

        # Validate
        _validate_data(df)

        return df


async def fetch_prices_stooq(
    symbol: str,
    period: str = "1y",
    interval: str = "1d"
) -> pd.DataFrame:
    """Second fallback for common US symbols via stooq CSV endpoint."""
    # Stooq fallback is mainly for plain US tickers used in RRG benchmarks.
    if "." in symbol:
        raise DataFetchError("Stooq fallback supports plain US symbols only")

    stooq_symbol = f"{symbol.lower()}.us"
    url = "https://stooq.com/q/d/l/"
    params = {"s": stooq_symbol, "i": "w" if interval == "1wk" else "d"}
    logger.info(f"Fetching {symbol} data from Stooq: period={period}, interval={interval}")

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        text = response.text.strip()

    if not text or text.lower().startswith("no_data"):
        raise DataFetchError(f"Stooq returned no data for {symbol}")

    df = pd.read_csv(StringIO(text))
    if df.empty or "Date" not in df.columns:
        raise DataFetchError(f"Invalid Stooq payload for {symbol}")

    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"]).set_index("Date").sort_index()

    required = ["Open", "High", "Low", "Close", "Volume"]
    for col in required:
        if col not in df.columns:
            raise DataFetchError(f"Missing column '{col}' in Stooq payload for {symbol}")
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["Close"])
    if df.empty:
        raise DataFetchError(f"Stooq returned empty close series for {symbol}")

    _validate_data(df)
    return df


async def fetch_prices(
    symbol: str,
    period: str = "1y",
    interval: str = "1d"
) -> pd.DataFrame:
    """
    Fetch prices for a symbol.
    Primary: yfinance
    Fallback: Alpha Vantage
    """
    try:
        return await fetch_prices_yfinance(symbol, period, interval)
    except Exception as e:
        logger.warning(f"yfinance failed for {symbol}: {e}, trying Alpha Vantage")
        try:
            return await fetch_prices_alpha_vantage(symbol, period, interval)
        except Exception as e2:
            logger.warning(f"Alpha Vantage failed for {symbol}: {e2}, trying Stooq")
            try:
                return await fetch_prices_stooq(symbol, period, interval)
            except Exception as e3:
                logger.error(f"Stooq also failed for {symbol}: {e3}")
                detail = str(e3).strip() or repr(e3)
                raise DataFetchError(f"Failed to fetch data for {symbol}: {detail}")


async def fetch_multiple_prices(
    symbols: list[str],
    period: str = "1y",
    interval: str = "1d"
) -> Dict[str, pd.DataFrame]:
    """Fetch prices for multiple symbols concurrently."""
    tasks = [fetch_prices(s, period, interval) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    data = {}
    for symbol, result in zip(symbols, results):
        if isinstance(result, Exception):
            logger.error(f"Failed to fetch {symbol}: {result}")
            data[symbol] = None
        else:
            data[symbol] = result

    return data


async def search_symbols(query: str, limit: int = 8) -> list[Dict[str, Any]]:
    """Search symbols from Yahoo Finance by ticker or company name."""
    term = query.strip()
    if not term:
        return []

    url = "https://query1.finance.yahoo.com/v1/finance/search"
    params = {
        "q": term,
        "quotesCount": max(limit * 3, 15),
        "newsCount": 0,
        "listsCount": 0,
        "enableFuzzyQuery": True,
    }
    headers = {
        "User-Agent": "Mozilla/5.0",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
    except Exception as e:
        logger.warning(f"Symbol search failed for '{term}': {e}")
        return []

    upper_term = term.upper()
    supported_quote_types = {"EQUITY", "ETF"}
    deduped: dict[str, Dict[str, Any]] = {}

    for quote in payload.get("quotes", []):
        symbol = str(quote.get("symbol", "")).upper().strip()
        if not symbol:
            continue

        quote_type = str(quote.get("quoteType", "")).upper().strip()
        if quote_type not in supported_quote_types:
            continue

        name = (
            quote.get("shortname")
            or quote.get("longname")
            or quote.get("name")
            or symbol
        )
        exchange = quote.get("exchDisp") or quote.get("exchange") or ""

        score = 100
        if symbol == upper_term:
            score = 0
        elif symbol.startswith(upper_term):
            score = 10
        elif upper_term in symbol:
            score = 20
        elif upper_term in str(name).upper():
            score = 30

        existing = deduped.get(symbol)
        if existing is None or score < existing["score"]:
            deduped[symbol] = {
                "symbol": symbol,
                "name": name,
                "exchange": exchange,
                "type": quote_type,
                "score": score,
            }

    ordered = sorted(
        deduped.values(),
        key=lambda item: (item["score"], len(item["symbol"]), item["symbol"]),
    )

    return [
        {
            "symbol": item["symbol"],
            "name": item["name"],
            "exchange": item["exchange"],
            "type": item["type"],
        }
        for item in ordered[:limit]
    ]


async def fetch_stock_overview(symbol: str) -> Dict[str, Any]:
    """Fetch company and quote overview for a symbol."""
    symbol = symbol.strip().upper()
    if not symbol:
        raise SymbolNotFoundError("Symbol is required")

    logger.info(f"Fetching stock overview for {symbol}")

    def _fetch() -> Dict[str, Any]:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}

        try:
            fast_info = dict(ticker.fast_info or {})
        except Exception:
            fast_info = {}

        return {
            "info": info if isinstance(info, dict) else {},
            "fast_info": fast_info if isinstance(fast_info, dict) else {},
        }

    try:
        payload = await asyncio.wait_for(
            asyncio.to_thread(_fetch),
            timeout=settings.yfinance_timeout_sec,
        )
    except asyncio.TimeoutError as e:
        raise DataFetchError(f"yfinance overview timeout for {symbol}") from e
    info = payload.get("info", {})
    fast_info = payload.get("fast_info", {})

    if not info and not fast_info:
        raise SymbolNotFoundError(f"Symbol {symbol} not found")

    display_symbol = (info.get("symbol") or symbol or "").upper()
    if not display_symbol:
        raise SymbolNotFoundError(f"Symbol {symbol} not found")

    long_summary = (
        info.get("longBusinessSummary")
        or info.get("description")
        or ""
    )

    return {
        "symbol": display_symbol,
        "name": info.get("longName") or info.get("shortName") or display_symbol,
        "exchange": info.get("exchange") or info.get("fullExchangeName") or "",
        "type": info.get("quoteType") or "",
        "currency": info.get("currency") or "",
        "sector": info.get("sector") or "",
        "industry": info.get("industry") or "",
        "country": info.get("country") or "",
        "website": info.get("website") or "",
        "summary": long_summary,
        "market_cap": info.get("marketCap") or fast_info.get("market_cap"),
        "price": info.get("currentPrice") or info.get("regularMarketPrice") or fast_info.get("lastPrice"),
        "change_percent": info.get("regularMarketChangePercent"),
        "trailing_pe": info.get("trailingPE"),
        "forward_pe": info.get("forwardPE"),
        "dividend_yield": info.get("dividendYield"),
        "beta": info.get("beta"),
        "fifty_two_week_high": info.get("fiftyTwoWeekHigh") or fast_info.get("yearHigh"),
        "fifty_two_week_low": info.get("fiftyTwoWeekLow") or fast_info.get("yearLow"),
        "volume": info.get("volume") or fast_info.get("lastVolume"),
        "average_volume": info.get("averageVolume") or info.get("averageVolume10days"),
    }


async def fetch_news_with_source(symbol: str, limit: int = 10) -> Tuple[list[Dict[str, Any]], str]:
    """Fetch financial news and return items with the provider used."""

    def _normalize_yf_news(raw_items: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        normalized: list[Dict[str, Any]] = []
        for item in raw_items[:limit]:
            # yfinance news format can be flat or nested in "content"
            content = item.get("content", item)
            if not isinstance(content, dict):
                content = item

            ts = content.get("providerPublishTime") or item.get("providerPublishTime")
            published = content.get("pubDate", "") or content.get("displayTime", "")
            if not published and isinstance(ts, (int, float)):
                published = datetime.utcfromtimestamp(ts).isoformat() + "Z"

            provider = content.get("provider", {})
            source = content.get("publisher", "") or item.get("publisher", "")
            if not source and isinstance(provider, dict):
                source = provider.get("displayName", "")

            canonical = content.get("canonicalUrl", {})
            clickthrough = content.get("clickThroughUrl", {})
            url = content.get("link", "") or item.get("link", "")
            if not url and isinstance(canonical, dict):
                url = canonical.get("url", "")
            if not url and isinstance(clickthrough, dict):
                url = clickthrough.get("url", "")

            normalized.append({
                "title": content.get("title", "") or item.get("title", ""),
                "source": source or "Yahoo Finance",
                "url": url,
                "published_at": published,
                "summary": content.get("summary", "") or content.get("description", "") or item.get("summary", "") or item.get("snippet", ""),
            })
        return normalized

    async def _fetch_news_yfinance() -> list[Dict[str, Any]]:
        logger.info(f"Fetching news for {symbol} from yfinance fallback")

        def _fetch():
            ticker = yf.Ticker(symbol)
            return ticker.news or []

        raw = await asyncio.to_thread(_fetch)
        if not isinstance(raw, list):
            return []
        return _normalize_yf_news(raw)

    logger.info(f"Fetching news for {symbol}")

    if settings.newsapi_key:
        async with httpx.AsyncClient() as client:
            url = "https://newsapi.org/v2/everything"
            params = {
                "q": symbol,
                "language": "en",
                "sortBy": "publishedAt",
                "pageSize": limit,
                "apiKey": settings.newsapi_key,
            }

            try:
                response = await client.get(url, params=params)
                data = response.json()

                if data.get("status") == "ok":
                    articles = data.get("articles", [])[:limit]
                    return [{
                        "title": article.get("title", ""),
                        "source": article.get("source", {}).get("name", ""),
                        "url": article.get("url", ""),
                        "published_at": article.get("publishedAt", ""),
                        "summary": article.get("description", ""),
                    } for article in articles], "NewsAPI"

                logger.warning(f"NewsAPI error: {data.get('message', 'Unknown error')}, using yfinance fallback")
            except Exception as e:
                logger.error(f"NewsAPI request failed: {e}, using yfinance fallback")
    else:
        logger.warning("NewsAPI key not configured, using yfinance fallback")

    try:
        return await _fetch_news_yfinance(), "Yahoo Finance (fallback)"
    except Exception as e:
        logger.error(f"yfinance news fallback failed: {e}")
        return [], "Unavailable"


async def fetch_news(symbol: str, limit: int = 10) -> list[Dict[str, Any]]:
    """Backward-compatible wrapper returning only news items."""
    news, _ = await fetch_news_with_source(symbol, limit)
    return news
