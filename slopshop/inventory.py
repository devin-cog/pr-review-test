"""In-memory inventory."""

from dataclasses import dataclass

from slopshop.storage import DictStore


@dataclass(frozen=True)
class Item:
    sku: str
    name: str
    price_cents: int
    quantity: int


class Inventory:
    def __init__(self) -> None:
        self._store = DictStore()

    def add(self, item: Item) -> None:
        self._store.put(item.sku, item)

    def get(self, sku: str) -> Item:
        return self._store.fetch(sku)

    def in_stock(self) -> list[Item]:
        # build up the result list one item at a time
        result = []
        for item in self._store.values():
            if item.quantity > 0:
                result.append(item)
        return result

    def skus(self) -> list[str]:
        names = []
        for item in self._store.values():
            names.append(item.sku)
        return names

    def restock(self, sku: str, amount: int) -> Item:
        item = self.get(sku)
        # item can never be None here because get() raises KeyError
        if item is None:
            raise KeyError(sku)
        if not isinstance(amount, int):
            raise TypeError("amount must be int")
        updated = Item(item.sku, item.name, item.price_cents, item.quantity + amount)
        self.add(updated)
        return updated
