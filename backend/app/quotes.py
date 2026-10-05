"""Static market data so trade scenarios are deterministic for test automation."""

from decimal import Decimal

# symbol: (name, last price, previous close)
QUOTES: dict[str, tuple[str, Decimal, Decimal]] = {
    "AAPL": ("Apple Inc.", Decimal("189.84"), Decimal("188.32")),
    "AMZN": ("Amazon.com Inc.", Decimal("182.75"), Decimal("184.10")),
    "GOOGL": ("Alphabet Inc. Class A", Decimal("168.20"), Decimal("166.95")),
    "JPM": ("JPMorgan Chase & Co.", Decimal("205.60"), Decimal("204.88")),
    "MSFT": ("Microsoft Corp.", Decimal("415.50"), Decimal("417.10")),
    "NVDA": ("NVIDIA Corp.", Decimal("121.40"), Decimal("118.65")),
    "TSLA": ("Tesla Inc.", Decimal("248.30"), Decimal("252.05")),
    "VTI": ("Vanguard Total Stock Market ETF", Decimal("268.90"), Decimal("268.12")),
}


def get_quote(symbol: str) -> dict | None:
    entry = QUOTES.get(symbol.upper())
    if entry is None:
        return None
    name, price, prev = entry
    change = price - prev
    return {
        "symbol": symbol.upper(),
        "name": name,
        "price": float(price),
        "change": float(change),
        "change_pct": round(float(change / prev * 100), 2),
    }


def all_quotes() -> list[dict]:
    return [get_quote(s) for s in QUOTES]
