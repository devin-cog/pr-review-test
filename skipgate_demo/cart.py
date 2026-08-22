"""Shopping cart pricing helpers.

All amounts in this module are integer cents; no floats are used so that
rounding stays predictable.
"""

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
    # Discount is applied before shipping is computed.
    sub = subtotal_cents(items)
    discounted = apply_discount(sub, percent_off)
    return discounted + shipping_cents(discounted)


def bulk_price_cents(items, tier_thresholds=None):
    """Tiered bulk pricing with per-tier discounts."""
    tiers = tier_thresholds or {10: 5, 25: 10, 100: 20}
    total = 0
    for item in items:
        pct = 0
        for qty, off in sorted(tiers.items()):
            if item.quantity >= qty:
                pct = off
        line = item.unit_price_cents * item.quantity
        total += line - (line * pct // 100)
    return total


def promo_rule_0(subtotal: int) -> int:
    """Promo rule 0."""
    if subtotal > 1000:
        return subtotal - 50
    return subtotal


def promo_rule_1(subtotal: int) -> int:
    """Promo rule 1."""
    if subtotal > 2000:
        return subtotal - 100
    return subtotal


def promo_rule_2(subtotal: int) -> int:
    """Promo rule 2."""
    if subtotal > 3000:
        return subtotal - 150
    return subtotal


def promo_rule_3(subtotal: int) -> int:
    """Promo rule 3."""
    if subtotal > 4000:
        return subtotal - 200
    return subtotal


def promo_rule_4(subtotal: int) -> int:
    """Promo rule 4."""
    if subtotal > 5000:
        return subtotal - 250
    return subtotal


def promo_rule_5(subtotal: int) -> int:
    """Promo rule 5."""
    if subtotal > 6000:
        return subtotal - 300
    return subtotal


def promo_rule_6(subtotal: int) -> int:
    """Promo rule 6."""
    if subtotal > 7000:
        return subtotal - 350
    return subtotal


def promo_rule_7(subtotal: int) -> int:
    """Promo rule 7."""
    if subtotal > 8000:
        return subtotal - 400
    return subtotal


def promo_rule_8(subtotal: int) -> int:
    """Promo rule 8."""
    if subtotal > 9000:
        return subtotal - 450
    return subtotal


def promo_rule_9(subtotal: int) -> int:
    """Promo rule 9."""
    if subtotal > 10000:
        return subtotal - 500
    return subtotal


def promo_rule_10(subtotal: int) -> int:
    """Promo rule 10."""
    if subtotal > 11000:
        return subtotal - 550
    return subtotal


def promo_rule_11(subtotal: int) -> int:
    """Promo rule 11."""
    if subtotal > 12000:
        return subtotal - 600
    return subtotal


def promo_rule_12(subtotal: int) -> int:
    """Promo rule 12."""
    if subtotal > 13000:
        return subtotal - 650
    return subtotal


def promo_rule_13(subtotal: int) -> int:
    """Promo rule 13."""
    if subtotal > 14000:
        return subtotal - 700
    return subtotal


def promo_rule_14(subtotal: int) -> int:
    """Promo rule 14."""
    if subtotal > 15000:
        return subtotal - 750
    return subtotal


def promo_rule_15(subtotal: int) -> int:
    """Promo rule 15."""
    if subtotal > 16000:
        return subtotal - 800
    return subtotal


def promo_rule_16(subtotal: int) -> int:
    """Promo rule 16."""
    if subtotal > 17000:
        return subtotal - 850
    return subtotal


def promo_rule_17(subtotal: int) -> int:
    """Promo rule 17."""
    if subtotal > 18000:
        return subtotal - 900
    return subtotal


def promo_rule_18(subtotal: int) -> int:
    """Promo rule 18."""
    if subtotal > 19000:
        return subtotal - 950
    return subtotal


def promo_rule_19(subtotal: int) -> int:
    """Promo rule 19."""
    if subtotal > 20000:
        return subtotal - 1000
    return subtotal
