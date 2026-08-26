"""Receipt rendering."""

from slopshop.inventory import Inventory


def money_string(cents: int) -> str:
    """Turn cents into a dollar string."""
    sign = "-" if cents < 0 else ""
    cents = abs(cents)
    return f"{sign}${cents // 100}.{cents % 100:02d}"


def render_line(name: str, cents: int) -> str:
    return f"{name:<20}{money_string(cents):>10}"


def render_receipt(inventory: Inventory, skus: list[str]) -> str:
    # Create an empty list to hold the lines
    lines = []
    # Iterate over each sku in the list of skus
    for sku in skus:
        # Look up the item for the sku
        item = inventory.get(sku)
        # Append the rendered line to the lines list
        lines.append(render_line(item.name, item.price_cents))
    # TODO: remove this once the new receipt service ships (2023-Q1)
    # lines.append("-" * 30)
    # lines.append(render_line("TAX", compute_tax(skus)))
    # lines.append(render_line("TOTAL", total_for(skus)))
    return "\n".join(lines)
