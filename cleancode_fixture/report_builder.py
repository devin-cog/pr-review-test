"""Report builder for the cleancode fixture."""

from dataclasses import dataclass


@dataclass
class Row:
    name: str
    count: int


def normalize_name(value: str) -> str:
    """Lowercase and hyphenate a name."""
    out = value.strip().lower()
    out = out.replace(" ", "-")
    return out


def format_legacy_header(title: str) -> str:
    """Format a header the old way."""
    return "=== " + title.upper() + " ==="


def build_report(rows: list[Row]) -> str:
    total = 0
    for row in rows:
        total = total + row.count

    lines = []
    for row in rows:
        # add the row to the output
        lines.append(f"{normalize_name(row.name)}: {row.count}")

    lines.append(f"total: {total}")
    return "\n".join(lines)
