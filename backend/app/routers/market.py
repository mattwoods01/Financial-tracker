import time

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.models import User
from app.schemas import MarketPoint, MarketQuote

router = APIRouter(prefix="/market", tags=["market"])

# Yahoo Finance's public chart endpoint — unofficial/undocumented, but it's the same
# data backing finance.yahoo.com's own stock page graph, and needs no API key.
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

# range -> the candle interval that makes sense for it (mirrors Yahoo's own chart tabs).
RANGE_INTERVALS = {
    "1d": "5m",
    "5d": "15m",
    "1mo": "1d",
    "6mo": "1d",
    "1y": "1wk",
    "5y": "1mo",
}

# Small in-memory cache so repeated/concurrent requests for the same symbol+range don't
# hammer Yahoo (and risk getting the server's IP rate-limited or blocked).
_CACHE: dict[tuple[str, str], tuple[float, MarketQuote]] = {}
_CACHE_TTL_SECONDS = 60


@router.get("/quote/{symbol}", response_model=MarketQuote)
def get_quote(symbol: str, range: str = "1d", user: User = Depends(get_current_user)):
    symbol = symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    if range not in RANGE_INTERVALS:
        raise HTTPException(status_code=400, detail=f"range must be one of {', '.join(RANGE_INTERVALS)}")

    cache_key = (symbol, range)
    cached = _CACHE.get(cache_key)
    if cached and time.time() - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    interval = RANGE_INTERVALS[range]
    params = {"interval": interval, "range": range, "includePrePost": "false"}
    try:
        resp = httpx.get(
            YAHOO_CHART_URL.format(symbol=symbol),
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach the market data provider")

    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail=f'No data found for "{symbol}"')

    chart = resp.json().get("chart", {})
    if chart.get("error") or not chart.get("result"):
        raise HTTPException(status_code=404, detail=f'No data found for "{symbol}"')

    result = chart["result"][0]
    meta = result.get("meta", {})
    timestamps = result.get("timestamp") or []
    closes = (result.get("indicators", {}).get("quote") or [{}])[0].get("close") or []

    points = [
        MarketPoint(time=ts, price=round(price, 4))
        for ts, price in zip(timestamps, closes)
        if price is not None
    ]
    if not points:
        raise HTTPException(status_code=404, detail=f'No price data available for "{symbol}"')

    current_price = meta.get("regularMarketPrice", points[-1].price)
    previous_close = meta.get("chartPreviousClose") or meta.get("previousClose") or points[0].price
    change = current_price - previous_close
    change_percent = (change / previous_close * 100) if previous_close else 0.0

    quote = MarketQuote(
        symbol=meta.get("symbol", symbol),
        currency=meta.get("currency", "USD"),
        exchange=meta.get("exchangeName"),
        price=current_price,
        previous_close=previous_close,
        change=change,
        change_percent=change_percent,
        range=range,
        points=points,
    )
    _CACHE[cache_key] = (time.time(), quote)
    return quote
