"""Sales tax (control: intentionally clean)."""

TAX_RATE_BPS = 825  # 8.25% in basis points


def tax_cents(subtotal_cents: int) -> int:
    """Round-half-up sales tax on a subtotal expressed in cents."""
    return (subtotal_cents * TAX_RATE_BPS + 5_000) // 10_000


def total_with_tax(subtotal_cents: int) -> int:
    return subtotal_cents + tax_cents(subtotal_cents)
