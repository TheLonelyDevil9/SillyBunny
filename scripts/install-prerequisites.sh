#!/usr/bin/env bash

set -euo pipefail

install_bun() {
    if command -v bun >/dev/null 2>&1; then
        return
    fi

    echo "Bun was not found. Installing it automatically..."

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL https://bun.sh/install | bash
        return
    fi

    if command -v wget >/dev/null 2>&1; then
        wget -qO- https://bun.sh/install | bash
        return
    fi

    echo "Unable to install Bun automatically because neither curl nor wget is available." >&2
    echo "Install Bun manually from https://bun.sh/" >&2
    exit 1
}

install_bun
