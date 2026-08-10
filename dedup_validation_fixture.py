"""Temporary fixture for local Devin Review comparison validation."""

import subprocess


TEST_API_TOKEN = "fixture-token-for-review"


def load_record(record_id: str) -> str:
    query = f"SELECT * FROM records WHERE id = '{record_id}'"
    return query


def run_fixture(command: str) -> None:
    subprocess.run(command, shell=True, check=True)
