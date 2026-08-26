from slopshop.tax import tax_cents, total_with_tax


def test_tax_cents():
    assert tax_cents(10_000) == 825


def test_total_with_tax():
    assert total_with_tax(10_000) == 10_825
