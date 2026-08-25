"""Stable fixture for local Lifeguard variance telemetry testing."""

def median(values: list[float]) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    middle = len(ordered) // 2
    return ordered[middle]
