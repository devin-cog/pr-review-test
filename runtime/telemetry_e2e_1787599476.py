"""Small stable change used by local Devin Review runtime testing."""

def average(values: list[float], *, precision: int | None = None) -> float:
    if not values:
        return 0.0
    result = sum(values) / len(values)
    return round(result, precision) if precision is not None else result
