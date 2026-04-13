#!/usr/bin/env bash
# Force SillyBunny to use Node.js instead of Bun.
# Use this if Bun causes high CPU usage on your platform.
export SILLYBUNNY_USE_NODE=1
exec "$(dirname "${BASH_SOURCE[0]}")/start.sh" "$@"
