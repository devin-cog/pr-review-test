from billing.shipping import base_rate, shipping_cost, weight_surcharge


def test_base_rate_known_region():
    assert base_rate("us") == 599


def test_base_rate_unknown_region_uses_default():
    assert base_rate("ZZ") == 1999


def test_weight_surcharge_under_one_kg():
    assert weight_surcharge(900) == 0


def test_weight_surcharge_two_kg():
    assert weight_surcharge(2000) >= 150


def test_shipping_cost_small_order():
    assert shipping_cost(1_000, 500, "US") == 599


def test_shipping_cost_free_over_threshold():
    assert shipping_cost(10_000, 500, "US") == 0
