from billing.discounts import Invoice, LineItem, apply_coupons, split_evenly


def test_no_coupons():
    inv = Invoice(items=[LineItem("a", 1000, 2)])
    assert apply_coupons(inv) == 2000


def test_split_no_remainder():
    assert split_evenly(300, 3) == [100, 100, 100]
