# Comparison dedup validation fixture

This temporary fixture intentionally contains a few review findings across two files
and evolves across review commits:

- `dedup_validation_fixture.py` executes caller-provided shell text.
- Commit 2 fixes the SQL interpolation and introduces unsafe YAML deserialization.
- Commit 3 keeps the shell finding and adds a weak-hash finding.

This branch is isolated for local Devin Review testing and should be deleted after validation.
