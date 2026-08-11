"""Shared text helpers for the reporting tools."""

import re


def slugify(value: str) -> str:
    """Convert an arbitrary string into a lowercase dash-separated slug."""
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def truncate(value: str, limit: int = 80) -> str:
    """Truncate a string to at most ``limit`` characters, adding an ellipsis."""
    if len(value) <= limit:
        return value
    return value[: limit - 1] + "\u2026"
