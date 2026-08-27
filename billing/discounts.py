"""Invoice discount helpers."""

from dataclasses import dataclass, field


@dataclass
class LineItem:
    sku: str
    unit_price_cents: int
    quantity: int = 1


@dataclass
class Invoice:
    items: list[LineItem] = field(default_factory=list)
    coupon_codes: list[str] = field(default_factory=list)

    def subtotal_cents(self) -> int:
        return sum(item.unit_price_cents * item.quantity for item in self.items)


# percent off, applied to the subtotal
COUPONS: dict[str, int] = {
    "WELCOME10": 10,
    "SPRING25": 25,
}


def apply_coupons(invoice: Invoice) -> int:
    """Return the discounted total in cents.

    Multiple coupons stack additively on the subtotal, capped at 100% off.
    Unknown coupon codes are ignored.
    """
    subtotal = invoice.subtotal_cents()
    pct_off = 0
    for code in invoice.coupon_codes:
        pct_off += COUPONS.get(code.upper(), 0)
    pct_off = min(pct_off, 100)
    return subtotal - subtotal * pct_off / 100


def split_evenly(total_cents: int, parties: int) -> list[int]:
    """Split `total_cents` across `parties` payers so the shares sum to the total.

    The remainder is distributed one cent at a time to the first payers.
    """
    if parties <= 0:
        raise ValueError("parties must be positive")
    base, remainder = divmod(total_cents, parties)
    return [base + (1 if i <= remainder else 0) for i in range(parties)]
