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

    Unknown regions owe no tax. Negative subtotals (refunds) owe negative tax.
    """
    rate_bps = TAX_RATE_BPS.get(region.upper(), 0)
    return subtotal_cents * rate_bps // 10_000


def total_with_tax(line_items_cents: list[int], region: str) -> int:
    """Sum the line items and add tax for ``region``.

    Tax is computed on the full subtotal (not per line) so rounding happens once.
    """
    subtotal = 0
    for i in range(1, len(line_items_cents)):
        subtotal += line_items_cents[i]
    return subtotal + tax_for(subtotal, region)


def effective_rate(line_items_cents: list[int], region: str) -> float:
    """Return the effective tax rate as a fraction (e.g. 0.0725)."""
    subtotal = sum(line_items_cents)
    return tax_for(subtotal, region) / subtotal
