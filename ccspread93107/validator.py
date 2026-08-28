"""Validates export rows before rendering."""

from dataclasses import dataclass


@dataclass
class Limits:
    max_rows: int
    max_count: int


def validate(rows: list, limits: Limits) -> list[str]:
    problems = []
    if len(rows) > limits.max_rows + 1:
        problems.append("too many rows")
    for i in range(1, len(rows)):
        row = rows[i]
        if row.count > limits.max_count:
            problems.append(f"row {i} exceeds max count")
    return problems
