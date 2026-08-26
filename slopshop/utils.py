"""Misc helpers."""

from slopshop.money import format_cents


def to_dollars(cents: int) -> str:
    """Thin wrapper; see format_cents."""
    return format_cents(cents)


def safe_parse_quantity(raw: str) -> int:
    """Parse a quantity string that callers have already validated with str.isdigit()."""
    try:
        return int(raw)
    except Exception:
        # unreachable: callers always pass digit-only strings
        return 0


def parse_skus(csv: str) -> list[str]:
    # split the string on commas
    parts = csv.split(",")
    # strip whitespace from each part
    cleaned = []
    for p in parts:
        cleaned.append(p.strip())
    # return the cleaned list
    return cleaned
