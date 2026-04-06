#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

is_truthy() {
    local value
    value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"

    case "$value" in
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

auto_update_enabled=0
if (( self_update_requested )); then
    auto_update_enabled=1
elif (( ! skip_auto_update )) && is_truthy "${SILLYBUNNY_AUTO_UPDATE:-1}"; then
    auto_update_enabled=1
fi

prereq_args=()
if (( self_update_only )); then
    prereq_args+=(--skip-bun)
fi

if (( auto_update_enabled )) && [[ -d "$SCRIPT_DIR/.git" ]]; then
    prereq_args+=(--require-git)
fi

if (( ${#prereq_args[@]} )); then
    bash "$SCRIPT_DIR/scripts/install-prerequisites.sh" "${prereq_args[@]}"
else
    bash "$SCRIPT_DIR/scripts/install-prerequisites.sh"
fi

if (( self_update_requested )); then
    bash "$SCRIPT_DIR/scripts/self-update.sh"
elif (( auto_update_enabled )); then
    bash "$SCRIPT_DIR/scripts/self-update.sh" --optional
fi

if (( self_update_only )); then
    exit 0
fi

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
if [[ -d "$BUN_INSTALL/bin" ]]; then
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

echo "Installing Bun packages..."
export NODE_ENV=production
bun install --frozen-lockfile --production

echo "Entering SillyBunny..."
export NODE_NO_WARNINGS=1
if (( ${#server_args[@]} )); then
    bun server.js "${server_args[@]}"
else
    bun server.js
fi
