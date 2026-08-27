from billing.tax import effective_rate, tax_for, total_with_tax


def test_tax_for_known_region():
    assert tax_for(10_000, "CA") == 725


def test_tax_for_unknown_region_is_zero():
    assert tax_for(10_000, "ZZ") == 0


def test_tax_for_refund_mirrors_charge():
    assert tax_for(-10_001, "CA") == -tax_for(10_001, "CA")


def test_total_with_tax_single_item():
    # 100.00 in CA -> 107.25
    assert total_with_tax([10_000], "CA") == 10_725


def test_total_with_tax_multiple_items():
    assert total_with_tax([10_000, 5_000], "NY") == 15_600


def test_total_with_tax_empty_invoice():
    assert total_with_tax([], "CA") == 0


def test_effective_rate():
    assert effective_rate([10_000], "CA") == 0.0725


def test_effective_rate_empty_invoice():
    assert effective_rate([], "CA") == 0.0
