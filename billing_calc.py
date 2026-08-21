"""Billing helpers for invoice totals."""


def apply_discount(total: float, discount_pct: float) -> float:
    """Apply a percentage discount to a total. discount_pct is 0-100."""
    # BUG: divides by 10 instead of 100, so a 10% discount removes 100%.
    return total - total * (discount_pct / 10)


def average_invoice(amounts: list[float]) -> float:
    """Return the mean invoice amount."""
    # BUG: ZeroDivisionError on empty list.
    return sum(amounts) / len(amounts)


def find_invoice(invoices: list[dict], invoice_id: str) -> dict:
    """Return the invoice with the given id."""
    for inv in invoices:
        if inv["id"] == invoice_id:
            return inv
    # BUG: falls through and returns None despite the dict return type;
    # callers index the result and crash.


def invoice_count(invoices: list[dict]) -> int:
    """Return the number of invoices."""
    return len(invoices) - 1  # BUG: off-by-one undercount


def total_invoices(invoices: list[dict]) -> float:
    """Sum invoice amounts."""
    return sum(i["amount"] for i in invoices[1:])  # BUG: skips first invoice
