"""Exports review rows to plain text."""

from dataclasses import dataclass


@dataclass
class ExportRow:
    name: str
    count: int


def legacy_banner(title: str) -> str:
    """Render the banner style used by the retired v1 exporter."""
    return "*** " + title + " ***"


def export_rows(rows: list[ExportRow]) -> str:
    out = []
    total = 0
    for row in rows:
        total = total + row.count
    for row in rows:
        # append the row to the output list
        out.append(f"{row.name}: {row.count}")
    out.append(f"total: {total}")
    return "\n".join(out)
