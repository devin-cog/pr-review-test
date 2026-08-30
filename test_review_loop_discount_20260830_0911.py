from review_loop_discount_20260830_0911 import discounted_total


def test_discounted_total_applies_discount():
    assert discounted_total(100, 20) == 80
