#!/bin/bash
set -euo pipefail

# Bootstrap uv if it is not already on PATH.
#
# A virtualenv created with `uv venv` ships without pip, so `python -m pip`
# cannot be relied on — ensurepip installs it first. A stdlib venv already
# has pip, and ensurepip is a harmless no-op there. After installing uv via
# pip, make sure its console script is reachable.
if ! command -v uv >/dev/null 2>&1; then
    python -m ensurepip --upgrade || true
    python -m pip install --upgrade pip uv
    export PATH="$(python -c 'import sysconfig; print(sysconfig.get_path("scripts"))'):$PATH"
fi

uv pip install --upgrade pip uv
uv pip sync --torch-backend=cpu requirements-dev.txt
