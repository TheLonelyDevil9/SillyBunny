#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

bash "$SCRIPT_DIR/scripts/install-prerequisites.sh"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
if [[ -d "$BUN_INSTALL/bin" ]]; then
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

echo "Installing Bun packages..."
export NODE_ENV=production
bun install --frozen-lockfile --production

echo "Entering SillyBunny..."
bun server.js "$@"
