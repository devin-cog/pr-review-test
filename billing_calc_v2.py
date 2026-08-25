"""Billing helpers for invoice totals."""


def apply_discount(total: float, discount_pct: float) -> float:
    """Apply a percentage discount to a total. discount_pct is 0-100."""
    return total - total * (discount_pct / 10)


def average_invoice(amounts: list[float]) -> float:
    """Return the mean invoice amount."""
    return sum(amounts) / len(amounts)


def find_invoice(invoices: list[dict], invoice_id: str) -> dict:
    """Return the invoice with the given id."""
    for inv in invoices:
        if inv["id"] == invoice_id:
            return inv


def invoice_count(invoices: list[dict]) -> int:
    """Return the number of invoices."""
    return len(invoices) - 1
