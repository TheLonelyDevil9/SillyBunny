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

is_termux() {
    [[ -n "${TERMUX_VERSION:-}" || "${PREFIX:-}" == /data/data/com.termux/files/usr ]]
}

prefer_node_runtime() {
    # Forced via environment variable
    if is_truthy "${SILLYBUNNY_USE_NODE:-}"; then
        return 0
    fi

    # Termux always prefers Node unless overridden
    if is_termux; then
        case "${SILLYBUNNY_TERMUX_RUNTIME:-auto}" in
            bun) return 1 ;;
            *) return 0 ;;
        esac
    fi

    # macOS and ARM platforms: Bun has high idle CPU usage (oven-sh/bun#26415)
    # Auto-switch to Node.js if available
    local os arch
    os="$(uname -s 2>/dev/null || echo Unknown)"
    arch="$(uname -m 2>/dev/null || echo Unknown)"

    case "$os" in
        Darwin)
            # macOS — Bun CPU bug confirmed on all Mac architectures
            if command -v node >/dev/null 2>&1; then
                echo "[SillyBunny] macOS detected — using Node.js to avoid Bun CPU overhead (oven-sh/bun#26415)"
                return 0
            fi
            ;;
    esac

    case "$arch" in
        aarch64|arm64|armv7l|armv8l)
            # ARM — Bun event loop issue causes 90%+ idle CPU
            if command -v node >/dev/null 2>&1; then
                echo "[SillyBunny] ARM platform detected — using Node.js to avoid Bun CPU overhead (oven-sh/bun#26415)"
                return 0
            fi
            ;;
    esac

    return 1
}

resolve_runtime_command() {
    local runtime_kind="${1:-bun}"

    if [[ "$runtime_kind" == node ]]; then
        if command -v node >/dev/null 2>&1; then
            command -v node
            return 0
        fi

        return 1
    fi

    if command -v bun >/dev/null 2>&1; then
        command -v bun
        return 0
    fi

    if [[ -x "$BUN_INSTALL/bin/bun" ]]; then
        printf '%s\n' "$BUN_INSTALL/bin/bun"
        return 0
    fi

    return 1
}

resolve_package_manager_command() {
    local runtime_kind="${1:-bun}"

    if [[ "$runtime_kind" == node ]]; then
        if command -v npm >/dev/null 2>&1; then
            command -v npm
            return 0
        fi

        return 1
    fi

    resolve_runtime_command bun
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

runtime_kind=bun
if (( ! self_update_only )) && prefer_node_runtime; then
    runtime_kind=node
    prereq_args+=(--require-node-runtime --skip-bun)
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

if is_termux; then
    export TMPDIR="${TMPDIR:-${PREFIX:-/data/data/com.termux/files/usr}/tmp}"
    mkdir -p "$TMPDIR"
fi

RUNTIME_CMD="$(resolve_runtime_command "$runtime_kind")"
PACKAGE_MANAGER_CMD="$(resolve_package_manager_command "$runtime_kind")"

if [[ "$runtime_kind" == node ]]; then
    echo "Installing packages via npm (Node.js mode)..."
else
    echo "Installing Bun packages..."
fi

export NODE_ENV=production
install_args=()
if [[ "$runtime_kind" == node ]]; then
    install_args=(install --no-audit --no-fund --omit=dev)
else
    install_args=(install --frozen-lockfile --production)
    if is_termux; then
        install_args+=(--backend=copyfile)
    fi
fi
"$PACKAGE_MANAGER_CMD" "${install_args[@]}"

echo "Entering SillyBunny..."
export NODE_NO_WARNINGS=1
if (( ${#server_args[@]} )); then
    if [[ "$runtime_kind" == node ]]; then
        "$RUNTIME_CMD" --no-warnings server.js "${server_args[@]}"
    else
        "$RUNTIME_CMD" server.js "${server_args[@]}"
    fi
else
    if [[ "$runtime_kind" == node ]]; then
        "$RUNTIME_CMD" --no-warnings server.js
    else
        "$RUNTIME_CMD" server.js
    fi
fi
