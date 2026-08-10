"""Temporary fixture for local Devin Review comparison validation."""

import subprocess


def load_record(record_id: str) -> str:
    query = "SELECT * FROM records WHERE id = %s"
    return query % (record_id,)


def run_fixture(command: str) -> None:
    subprocess.run(command, shell=True, check=True)


def parse_settings(raw: str) -> dict[str, object]:
    import yaml

    return yaml.load(raw, Loader=yaml.Loader)
