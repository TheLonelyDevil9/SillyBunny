#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OPTIONAL=0

if [[ "${1:-}" == "--optional" ]]; then
    OPTIONAL=1
    shift
fi

finish_early() {
    local message="$1"

    if (( OPTIONAL )); then
        echo "Skipping self-update: $message" >&2
        exit 0
    fi

    echo "Self-update failed: $message" >&2
    exit 1
}

cd "$REPO_DIR"

if ! command -v git >/dev/null 2>&1; then
    finish_early "Git is not installed."
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    finish_early "this checkout is not a Git repository."
fi

current_branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
if [[ -z "$current_branch" ]]; then
    finish_early "detached HEAD checkouts cannot be updated automatically."
fi

upstream_ref="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [[ -z "$upstream_ref" ]]; then
    finish_early "branch '$current_branch' does not have an upstream configured."
fi

if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
    finish_early "the working tree is not clean. Commit, stash, or remove local changes first."
fi

upstream_remote="${upstream_ref%%/*}"

echo "Checking for updates on $upstream_ref..."
if ! git fetch --quiet "$upstream_remote"; then
    finish_early "could not fetch from '$upstream_remote'."
fi

read -r ahead behind < <(git rev-list --left-right --count HEAD...@{upstream})

if (( ahead > 0 && behind > 0 )); then
    finish_early "branch '$current_branch' has diverged from '$upstream_ref'. Resolve it manually before using self-update."
fi

if (( ahead > 0 )); then
    echo "Local branch '$current_branch' is already ahead of '$upstream_ref'; nothing to pull."
    exit 0
fi

if (( behind == 0 )); then
    echo "SillyBunny is already up to date."
    exit 0
fi

before_rev="$(git rev-parse --short HEAD)"

echo "Updating SillyBunny..."
if ! git pull --ff-only; then
    finish_early "git pull --ff-only failed."
fi

after_rev="$(git rev-parse --short HEAD)"
echo "Updated SillyBunny from $before_rev to $after_rev."
