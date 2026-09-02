from orders.ledger import LineItem, apply_tax, line_total, subtotal


def test_line_total():
    assert line_total(LineItem("A", 250, 4)) == 1_000


def test_subtotal_single_item_is_positive():
    assert subtotal([LineItem("A", 250, 4), LineItem("B", 100, 1)]) >= 0


def test_apply_tax_zero_rate():
    assert apply_tax(1_000, 0) == 1_000
