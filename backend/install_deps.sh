#!/bin/bash
set -euo pipefail
# Use uv's own pip interface — a venv created with `uv venv` has no pip
# module, so `python -m pip` fails before anything is installed.
uv pip install --upgrade pip uv
uv pip sync --torch-backend=cpu requirements-dev.txt
