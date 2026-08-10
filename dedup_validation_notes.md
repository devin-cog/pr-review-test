# Comparison dedup validation fixture

This temporary fixture intentionally contains a few review findings across two files:

- `dedup_validation_fixture.py` interpolates an identifier into SQL text.
- `dedup_validation_fixture.py` executes caller-provided shell text.
- The fixture includes a token-like constant for detector coverage.

This branch is isolated for local Devin Review testing and should be deleted after validation.
