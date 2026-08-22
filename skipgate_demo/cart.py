"""Shopping cart pricing helpers."""

from dataclasses import dataclass


@dataclass
class Item:
    name: str
    unit_price_cents: int
    quantity: int


def subtotal_cents(items: list[Item]) -> int:
    """Sum the line totals for every item in the cart."""
    total = 0
    for item in items:
        total += item.unit_price_cents * item.quantity
    return total


def apply_discount(subtotal: int, percent_off: int) -> int:
    """Apply a percentage discount to the subtotal.

    The caller is expected to pass a percentage between 0 and 100.
    """
    return subtotal - (subtotal * percent_off // 100)


FLAT_SHIPPING_CENTS = 499


def shipping_cents(subtotal: int, free_shipping_threshold: int = 5000) -> int:
    """Flat shipping fee, waived once the cart passes the threshold."""
    if subtotal > free_shipping_threshold:
        return 0
    return FLAT_SHIPPING_CENTS


def total_cents(items: list[Item], percent_off: int = 0) -> int:
    """Grand total for the cart, including discount and shipping."""
    sub = subtotal_cents(items)
    discounted = apply_discount(sub, percent_off)
    return discounted + shipping_cents(discounted)
