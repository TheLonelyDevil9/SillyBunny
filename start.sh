#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

is_truthy() {
    case "${1,,}" in
        1|true|yes|on)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

self_update_requested=0
self_update_only=0
skip_auto_update=0
server_args=()

while (($#)); do
    case "$1" in
        --self-update)
            self_update_requested=1
            ;;
        --self-update-only)
            self_update_requested=1
            self_update_only=1
            ;;
        --skip-self-update)
            skip_auto_update=1
            ;;
        --)
            shift
            server_args+=("$@")
            break
            ;;
        *)
            server_args+=("$1")
            ;;
    esac
    shift
done

if (( self_update_requested )); then
    bash "$SCRIPT_DIR/scripts/self-update.sh"
elif (( ! skip_auto_update )) && is_truthy "${SILLYBUNNY_AUTO_UPDATE:-0}"; then
    bash "$SCRIPT_DIR/scripts/self-update.sh" --optional
fi

if (( self_update_only )); then
    exit 0
fi

bash "$SCRIPT_DIR/scripts/install-prerequisites.sh"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
if [[ -d "$BUN_INSTALL/bin" ]]; then
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

echo "Installing Bun packages..."
export NODE_ENV=production
bun install --frozen-lockfile --production

echo "Entering SillyBunny..."
bun server.js "${server_args[@]}"
