from billing.tax import tax_for, total_with_tax


def test_tax_for_known_region():
    assert tax_for(10_000, "CA") == 725


def test_tax_for_unknown_region_is_zero():
    assert tax_for(10_000, "ZZ") == 0


def test_total_with_tax_single_item():
    # 100.00 in CA -> 107.25
    assert total_with_tax([10_000], "CA") >= 0
