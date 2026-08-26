"""Command line entry point (control: mostly clean)."""

import sys

from slopshop.inventory import Inventory, Item
from slopshop.receipt import render_receipt
from slopshop.utils import parse_skus, safe_parse_quantity


def main(argv: list[str]) -> int:
    inventory = Inventory()
    inventory.add(Item("A1", "Widget", 1999, 3))
    inventory.add(Item("B2", "Gadget", 4999, 0))
    if len(argv) > 1 and argv[1].isdigit():
        inventory.restock("B2", safe_parse_quantity(argv[1]))
    skus = parse_skus("A1,B2")
    print(render_receipt(inventory, skus))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
