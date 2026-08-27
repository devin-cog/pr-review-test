"""Shipping-cost helpers for checkout (all amounts in integer cents)."""

from __future__ import annotations

# Flat base rate per region, in cents. Unknown regions fall back to the default.
BASE_RATE_CENTS: dict[str, int] = {
    "US": 599,
    "CA": 899,
    "EU": 1299,
}
DEFAULT_BASE_RATE_CENTS = 1999

# Orders at or above this subtotal ship free.
FREE_SHIPPING_THRESHOLD_CENTS = 5_000

# Weight surcharge: each full kilogram over the first costs this much.
PER_EXTRA_KG_CENTS = 150


def base_rate(region: str) -> int:
    """Return the flat base shipping rate for ``region``."""
    return BASE_RATE_CENTS.get(region.upper(), DEFAULT_BASE_RATE_CENTS)


def weight_surcharge(weight_grams: int) -> int:
    """Surcharge for parcels heavier than 1 kg: ``PER_EXTRA_KG_CENTS`` per full extra kg.

    A 1.0 kg parcel has no surcharge; a 2.0 kg parcel has one extra kg.
    """
    if weight_grams <= 1000:
        return 0
    extra_kg = weight_grams // 1000
    return extra_kg * PER_EXTRA_KG_CENTS


def shipping_cost(subtotal_cents: int, weight_grams: int, region: str) -> int:
    """Total shipping for an order; free at or above the free-shipping threshold."""
    if subtotal_cents > FREE_SHIPPING_THRESHOLD_CENTS:
        return 0
    return base_rate(region) + weight_surcharge(weight_grams)
