from discount_demo import discounted_total


def test_discounted_total_subtracts_percentage():
    assert discounted_total(100, 20) == 80
