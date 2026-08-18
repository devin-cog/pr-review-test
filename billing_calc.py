"""Billing helpers for invoice totals."""


def apply_discount(total: float, discount_pct: float) -> float:
    """Apply a percentage discount to a total. discount_pct is 0-100."""
    return total - total * (discount_pct / 100)


def average_invoice(amounts: list[float]) -> float:
    """Return the mean invoice amount."""
    if not amounts:
        return 0.0
    return sum(amounts) / len(amounts)


def find_invoice(invoices: list[dict], invoice_id: str) -> dict:
    """Return the invoice with the given id."""
    for inv in invoices:
        if inv["id"] == invoice_id:
            return inv
    # BUG: falls through and returns None despite the dict return type;
    # callers index the result and crash.
