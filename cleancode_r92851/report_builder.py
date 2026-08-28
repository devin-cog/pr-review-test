"""Builds plain-text summary reports for review runs."""

import re
from dataclasses import dataclass


@dataclass
class ReportRow:
    name: str
    count: int


def normalize_name(value: str) -> str:
    """Turn a display name into a lowercase dash-separated identifier."""
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def format_legacy_header(title: str, width: int = 60) -> str:
    """Render the old-style boxed header used by the previous CLI."""
    line = "*" * width
    return f"{line}\n* {title}\n{line}"


def build_report(rows: list[ReportRow]) -> str:
    lines = []
    total = 0
    for row in rows:
        total = total + row.count
    for row in rows:
        # add the row to the output
        lines.append(f"{normalize_name(row.name)}: {row.count}")
    lines.append(f"total: {total}")
    return "\n".join(lines)
