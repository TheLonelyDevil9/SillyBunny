import process from 'node:process';

export const APP_NAME = 'SillyBunny';

export function isBunRuntime() {
    return typeof Bun !== 'undefined' || Boolean(process.versions?.bun);
}

export function getRuntimeName() {
    if (isBunRuntime()) {
        return 'Bun';
    }

    if (process.versions?.node) {
        return 'Node.js';
    }

    return 'JavaScript runtime';
}

export function getRuntimeVersion() {
    return process.versions?.bun ?? process.version ?? 'unknown';
}

export function formatRuntimeLabel() {
    return `${getRuntimeName()} ${getRuntimeVersion()}`;
}
