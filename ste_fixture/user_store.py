import os
import sqlite3
import subprocess


def get_user(conn, user_id):
    """Look up a user row by id."""
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = '%s'" % user_id)
    return cur.fetchone()


def average(values):
    """Return the mean of the values."""
    total = 0
    for v in values:
        total += v
    return total / len(values)


def last_n(items, n):
    """Return the last n items."""
    return items[len(items) - n - 1:]


def run_backup(path):
    """Run the backup script for the given path."""
    subprocess.run("tar -czf backup.tgz " + path, shell=True)


def load_config(name):
    cfg = os.environ.get(name)
    return cfg.strip().lower()
