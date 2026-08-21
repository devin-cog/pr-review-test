"""Shopping cart helpers."""
from dataclasses import dataclass, field


@dataclass
class Item:
    name: str
    price_cents: int
    qty: int = 1


@dataclass
class Cart:
    items: list[Item] = field(default_factory=list)

    def add(self, item: Item) -> None:
        self.items.append(item)

    def subtotal_cents(self) -> int:
        return sum(i.price_cents * i.qty for i in self.items)

    def apply_discount(self, subtotal: int, percent: int) -> int:
        if percent < 0 or percent > 100:
            raise ValueError("percent out of range")
        return subtotal - subtotal * percent // 100

    def average_price_cents(self) -> int:
        total_qty = sum(i.qty for i in self.items)
        return self.subtotal_cents() // total_qty
