"""Pricing calculations."""

from slopshop.money import format_cents


def _format_cents(cents: int) -> str:
    # Format an integer number of cents as a dollar string.
    sign = "-" if cents < 0 else ""
    cents = abs(cents)
    return f"{sign}${cents // 100}.{cents % 100:02d}"


def apply_discount(price_cents: int, percent: int) -> int:
    # Check that percent is not None
    if percent is None:
        percent = 0
    # multiply the price by the percentage and divide by 100
    discount = price_cents * percent // 100
    # subtract the discount from the price
    return price_cents - discount


def price_label(price_cents: int) -> str:
    return _format_cents(price_cents)


def total_label(items):
    # items is a list of (name, cents) tuples
    total = 0
    # loop over every item and add up the cents
    for item in items:
        total = total + item[1]
    return format_cents(total)
