import process from 'node:process';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

function decodePayload(encoded) {
    const decoded = Buffer.from(String(encoded ?? ''), 'base64').toString('utf8');
    return JSON.parse(decoded);
}

function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error?.code !== 'ESRCH';
    }
}

async function waitForParentExit(pid) {
    while (isProcessAlive(pid)) {
        await delay(250);
    }
}

async function main() {
    const payload = decodePayload(process.argv[2]);
    const parentPid = Number(payload?.parentPid);
    const command = Array.isArray(payload?.command) ? payload.command : [];
    const cwd = String(payload?.cwd ?? process.cwd());

    if (!Number.isFinite(parentPid) || command.length < 2) {
        process.exit(1);
    }

    await waitForParentExit(parentPid);
    await delay(800);

    const child = spawn(command[0], command.slice(1), {
        cwd,
        detached: true,
        stdio: 'ignore',
        env: process.env,
    });

    child.unref();
}

try {
    await main();
    process.exit(0);
} catch (error) {
    console.error('Restart helper failed.', error);
    process.exit(1);
}
