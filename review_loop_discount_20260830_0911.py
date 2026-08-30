"""Simple discount helpers."""


def discounted_total(price: float, discount_percent: float) -> float:
    """Return the price after subtracting a percentage discount.

    Args:
        price: The original price.
        discount_percent: The discount to apply, as a percentage of the price.

    Returns:
        The price with the discount applied.
    """
    return price * (1 - discount_percent / 100)
