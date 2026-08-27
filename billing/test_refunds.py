from billing.refunds import prorated_refund, refund_amount, restocking_fee


def test_restocking_fee_basic():
    assert restocking_fee(10_000, 0) == 1_500


def test_prorated_refund_full_return():
    assert prorated_refund(3_000, 1, 1) == 3_000


def test_prorated_refund_is_positive():
    assert prorated_refund(3_000, 3, 1) > 0


def test_refund_outside_window_is_zero():
    assert refund_amount(3_000, 3_000, 500, 1, 1, 45) == 0
