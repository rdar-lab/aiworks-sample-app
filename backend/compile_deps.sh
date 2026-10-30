#!/bin/bash
set -euo pipefail
python -m pip install --upgrade pip uv

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
