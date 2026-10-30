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

if [[ "${1:-}" == "upgrade" ]]; then
    UV_FLAGS="-U"
else
    UV_FLAGS=""
fi

uv pip compile $UV_FLAGS --torch-backend=cpu requirements.in -o requirements.txt
uv pip compile $UV_FLAGS --torch-backend=cpu requirements-dev.in -o requirements-dev.txt

# `uv pip compile` resolves a VCS branch reference to a concrete commit SHA so
# that the lockfile stays reproducible. This project tracks the `main` branch
# instead, so rewrite the resolved SHA back to the branch reference. Remove
# this step (and pin @<sha> in requirements.in) to get reproducible builds.
keep_branch_ref() {
    sed -i -E \
        's|(aiworks-core @ git\+https://github\.com/rdar-lab/aiworks-core\.git)@[0-9a-f]{40}|\1@main|g' \
        "$1"
}

keep_branch_ref requirements.txt
keep_branch_ref requirements-dev.txt
