"""Sales-tax helpers for invoice totals (all amounts in integer cents)."""

from __future__ import annotations

# Tax rates in basis points (1 bp = 0.01%). Regions not listed are untaxed.
TAX_RATE_BPS: dict[str, int] = {
    "CA": 725,
    "NY": 400,
    "TX": 625,
}


def tax_for(subtotal_cents: int, region: str) -> int:
    """Return the tax owed for ``subtotal_cents`` in ``region``, in cents.

    Unknown regions owe no tax. Negative subtotals (refunds) owe negative tax,
    rounded toward zero so a refund never returns more tax than the matching
    charge collected.
    """
    rate_bps = TAX_RATE_BPS.get(region.upper(), 0)
    sign = -1 if subtotal_cents < 0 else 1
    return sign * (abs(subtotal_cents) * rate_bps // 10_000)


def total_with_tax(line_items_cents: list[int], region: str) -> int:
    """Sum the line items and add tax for ``region``.

    Tax is computed on the full subtotal (not per line) so rounding happens once.
    """
    subtotal = sum(line_items_cents)
    return subtotal + tax_for(subtotal, region)


def effective_rate(line_items_cents: list[int], region: str) -> float:
    """Return the effective tax rate as a fraction (e.g. 0.0725).

    An empty invoice has a rate of 0.0.
    """
    subtotal = sum(line_items_cents)
    if subtotal == 0:
        return 0.0
    return tax_for(subtotal, region) / subtotal
