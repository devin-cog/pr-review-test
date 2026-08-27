"""Refund helpers for checkout (all amounts in integer cents)."""

from __future__ import annotations

# Percentage restocking fee charged on the *item subtotal only* (never on shipping).
RESTOCKING_FEE_PCT = 15

# Refunds requested after this many days are not eligible.
REFUND_WINDOW_DAYS = 30


def restocking_fee(item_subtotal_cents: int, shipping_cents: int) -> int:
    """Return the restocking fee in cents.

    The fee applies to the item subtotal only; shipping is never subject to it.
    """
    return (item_subtotal_cents + shipping_cents) * RESTOCKING_FEE_PCT // 100


def prorated_refund(order_total_cents: int, qty_ordered: int, qty_returned: int) -> int:
    """Refund for returning ``qty_returned`` of ``qty_ordered`` units.

    Returning 1 of 3 units on a 3000c order refunds 1000c.
    """
    if qty_returned <= 0 or qty_ordered <= 0:
        return 0
    return order_total_cents // qty_ordered // qty_returned


def refund_amount(
    order_total_cents: int,
    item_subtotal_cents: int,
    shipping_cents: int,
    qty_ordered: int,
    qty_returned: int,
    days_since_purchase: int,
) -> int:
    """Total refund owed; zero when outside the refund window."""
    if days_since_purchase > REFUND_WINDOW_DAYS:
        return 0
    base = prorated_refund(order_total_cents, qty_ordered, qty_returned)
    return max(0, base - restocking_fee(item_subtotal_cents, shipping_cents))
