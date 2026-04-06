import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

import express from 'express';
import yaml from 'yaml';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { sync as commandExistsSync } from 'command-exists';
import { CheckRepoActions, default as simpleGit } from 'simple-git';

import { APP_NAME, formatRuntimeLabel, isBunRuntime } from '../runtime.js';
import { serverDirectory } from '../server-directory.js';
import { requireAdminMiddleware } from '../users.js';
import { getVersion } from '../util.js';

const GIT_OPTIONS = Object.freeze({ timeout: { block: 10 * 60 * 1000 } });
const RESTART_RESPONSE_DELAY_MS = 200;
const CHAT_COMPLETION_CONFIG_DEFAULTS = Object.freeze({
    claude: Object.freeze({
        enableSystemPromptCache: false,
        cachingAtDepth: -1,
        extendedTTL: false,
        enableAdaptiveThinking: true,
    }),
    gemini: Object.freeze({
        apiVersion: 'v1beta',
        thoughtSignatures: true,
        enableSystemPromptCache: false,
    }),
});

export const router = express.Router();

function getConfigFilePath() {
    const configPath = globalThis.COMMAND_LINE_ARGS?.configPath;
    return path.resolve(configPath || path.join(serverDirectory, 'config.yaml'));
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function toTrimmedString(value) {
    return String(value ?? '').trim();
}

function truncateOutput(value, maxLength = 6000) {
    const text = String(value ?? '').trim();
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 1).trimEnd()}\n…`;
}

function readConfigDocument() {
    const configPath = getConfigFilePath();

    if (!fs.existsSync(configPath)) {
        throw createHttpError(404, `Config file not found at ${configPath}`);
    }

    const stat = fs.statSync(configPath);
    const content = fs.readFileSync(configPath, 'utf8');
    const document = yaml.parseDocument(content, { prettyErrors: true });

    if (document.errors.length > 0) {
        throw createHttpError(400, document.errors.map(error => error.message).join('\n\n'));
    }

    return {
        configPath,
        stat,
        content,
        document,
    };
}

function ensureExpectedConfigMtime(stat, expectedLastModifiedMs) {
    if (Number.isFinite(expectedLastModifiedMs) && Math.trunc(stat.mtimeMs) !== Math.trunc(expectedLastModifiedMs)) {
        throw createHttpError(409, 'config.yaml changed on disk. Reload it before saving again.');
    }
}

function writeConfigDocument(configPath, document) {
    const nextContent = document.toString();
    const serializedContent = nextContent.endsWith('\n') ? nextContent : `${nextContent}\n`;
    writeFileAtomicSync(configPath, serializedContent, 'utf8');
    return fs.statSync(configPath);
}

function getChatCompletionConfigState(document) {
    const claudeNode = document.getIn(['claude']) ?? {};
    const geminiNode = document.getIn(['gemini']) ?? {};

    const cachingAtDepth = Number.parseInt(String(claudeNode?.cachingAtDepth ?? CHAT_COMPLETION_CONFIG_DEFAULTS.claude.cachingAtDepth), 10);

    return {
        claude: {
            enableSystemPromptCache: Boolean(claudeNode?.enableSystemPromptCache ?? CHAT_COMPLETION_CONFIG_DEFAULTS.claude.enableSystemPromptCache),
            cachingAtDepth: Number.isFinite(cachingAtDepth) ? cachingAtDepth : CHAT_COMPLETION_CONFIG_DEFAULTS.claude.cachingAtDepth,
            extendedTTL: Boolean(claudeNode?.extendedTTL ?? CHAT_COMPLETION_CONFIG_DEFAULTS.claude.extendedTTL),
            enableAdaptiveThinking: Boolean(claudeNode?.enableAdaptiveThinking ?? CHAT_COMPLETION_CONFIG_DEFAULTS.claude.enableAdaptiveThinking),
        },
        gemini: {
            apiVersion: toTrimmedString(geminiNode?.apiVersion || CHAT_COMPLETION_CONFIG_DEFAULTS.gemini.apiVersion) || CHAT_COMPLETION_CONFIG_DEFAULTS.gemini.apiVersion,
            thoughtSignatures: Boolean(geminiNode?.thoughtSignatures ?? CHAT_COMPLETION_CONFIG_DEFAULTS.gemini.thoughtSignatures),
            enableSystemPromptCache: Boolean(geminiNode?.enableSystemPromptCache ?? CHAT_COMPLETION_CONFIG_DEFAULTS.gemini.enableSystemPromptCache),
        },
    };
}

function normalizeChatCompletionConfigInput(settings) {
    const cachingAtDepth = Number.parseInt(String(settings?.claude?.cachingAtDepth ?? CHAT_COMPLETION_CONFIG_DEFAULTS.claude.cachingAtDepth), 10);

    return {
        claude: {
            enableSystemPromptCache: Boolean(settings?.claude?.enableSystemPromptCache),
            cachingAtDepth: Number.isFinite(cachingAtDepth) ? cachingAtDepth : CHAT_COMPLETION_CONFIG_DEFAULTS.claude.cachingAtDepth,
            extendedTTL: Boolean(settings?.claude?.extendedTTL),
            enableAdaptiveThinking: Boolean(settings?.claude?.enableAdaptiveThinking ?? CHAT_COMPLETION_CONFIG_DEFAULTS.claude.enableAdaptiveThinking),
        },
        gemini: {
            apiVersion: toTrimmedString(settings?.gemini?.apiVersion || CHAT_COMPLETION_CONFIG_DEFAULTS.gemini.apiVersion) || CHAT_COMPLETION_CONFIG_DEFAULTS.gemini.apiVersion,
            thoughtSignatures: Boolean(settings?.gemini?.thoughtSignatures ?? CHAT_COMPLETION_CONFIG_DEFAULTS.gemini.thoughtSignatures),
            enableSystemPromptCache: Boolean(settings?.gemini?.enableSystemPromptCache),
        },
    };
}

function applyChatCompletionConfigState(document, settings) {
    document.setIn(['claude', 'enableSystemPromptCache'], settings.claude.enableSystemPromptCache);
    document.setIn(['claude', 'cachingAtDepth'], settings.claude.cachingAtDepth);
    document.setIn(['claude', 'extendedTTL'], settings.claude.extendedTTL);
    document.setIn(['claude', 'enableAdaptiveThinking'], settings.claude.enableAdaptiveThinking);
    document.setIn(['gemini', 'apiVersion'], settings.gemini.apiVersion);
    document.setIn(['gemini', 'thoughtSignatures'], settings.gemini.thoughtSignatures);
    document.setIn(['gemini', 'enableSystemPromptCache'], settings.gemini.enableSystemPromptCache);
}

function getRestartPayload() {
    const payload = {
        parentPid: process.pid,
        cwd: serverDirectory,
        command: [process.argv[0], ...process.argv.slice(1)],
    };

    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function scheduleRestart(response) {
    const helperScriptPath = path.join(serverDirectory, 'src', 'restart-helper.js');
    const helper = spawn(process.argv[0], [helperScriptPath, getRestartPayload()], {
        cwd: serverDirectory,
        detached: true,
        stdio: 'ignore',
        env: process.env,
    });

    helper.unref();

    response.once('finish', () => {
        setTimeout(() => {
            try {
                process.kill(process.pid, 'SIGTERM');
            } catch (error) {
                console.error('Failed to stop current process during restart.', error);
            }
        }, RESTART_RESPONSE_DELAY_MS);
    });
}

async function runCommand(command, args, options = {}) {
    return await new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: serverDirectory,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
            ...options,
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', chunk => {
            stdout += String(chunk);
        });

        child.stderr?.on('data', chunk => {
            stderr += String(chunk);
        });

        child.once('error', reject);
        child.once('close', code => {
            if (code === 0) {
                resolve({ stdout, stderr });
                return;
            }

            const output = truncateOutput(stderr || stdout || `Command failed with exit code ${code}.`);
            const error = new Error(output);
            error.code = code;
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
        });
    });
}

function getInstallCommand() {
    const bunLockPath = path.join(serverDirectory, 'bun.lock');
    const packageLockPath = path.join(serverDirectory, 'package-lock.json');

    if ((isBunRuntime() || fs.existsSync(bunLockPath)) && commandExistsSync('bun')) {
        return {
            command: 'bun',
            args: ['install'],
        };
    }

    if (fs.existsSync(packageLockPath) && commandExistsSync('npm')) {
        return {
            command: 'npm',
            args: ['install', '--no-audit', '--no-fund'],
        };
    }

    return null;
}

async function getRepositoryStatus() {
    const status = {
        supported: false,
        isRepo: false,
        branch: '',
        trackingBranch: '',
        currentCommit: '',
        remoteCommit: '',
        ahead: 0,
        behind: 0,
        hasLocalChanges: false,
        changedFiles: [],
        changedFilesCount: 0,
        canUpdate: false,
        message: '',
    };

    if (!commandExistsSync('git')) {
        status.message = 'Git is not available in this environment.';
        return status;
    }

    status.supported = true;

    const git = simpleGit({ baseDir: serverDirectory, ...GIT_OPTIONS });
    const isRepo = await git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT).catch(() => false);

    if (!isRepo) {
        status.message = 'This install is not running from a Git repository.';
        return status;
    }

    status.isRepo = true;
    status.branch = toTrimmedString(await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => ''));
    status.currentCommit = toTrimmedString(await git.revparse(['--short', 'HEAD']).catch(() => ''));

    const gitStatus = await git.status();
    status.hasLocalChanges = !gitStatus.isClean();
    status.changedFilesCount = gitStatus.files.length;
    status.changedFiles = gitStatus.files.slice(0, 12).map(file => ({
        path: file.path,
        index: file.index,
        workingDir: file.working_dir,
    }));

    const trackingBranch = toTrimmedString(await git.revparse(['--abbrev-ref', '@{u}']).catch(() => ''));
    status.trackingBranch = trackingBranch;

    if (!trackingBranch) {
        status.message = 'This branch is not tracking an upstream remote.';
        return status;
    }

    await git.fetch();

    const [aheadRaw = '0', behindRaw = '0'] = (await git.raw(['rev-list', '--left-right', '--count', `HEAD...${trackingBranch}`]))
        .trim()
        .split(/\s+/);

    status.ahead = Number(aheadRaw) || 0;
    status.behind = Number(behindRaw) || 0;
    status.remoteCommit = toTrimmedString(await git.revparse(['--short', trackingBranch]).catch(() => ''));
    status.canUpdate = status.behind > 0 && status.ahead === 0 && !status.hasLocalChanges;

    if (status.behind > 0 && status.ahead > 0) {
        status.message = 'This branch has diverged from upstream and needs manual Git resolution.';
    } else if (status.hasLocalChanges) {
        status.message = 'Local changes are present, so auto-update is blocked to protect your work.';
    } else if (status.behind > 0) {
        status.message = `${status.behind} upstream commit${status.behind === 1 ? '' : 's'} available.`;
    } else if (status.ahead > 0) {
        status.message = 'This branch is ahead of upstream, likely because of local bundle patches.';
    } else {
        status.message = 'Already up to date.';
    }

    return status;
}

router.post('/status', requireAdminMiddleware, async (_request, response) => {
    try {
        const version = await getVersion();
        const repository = await getRepositoryStatus();
        response.json({
            runtime: formatRuntimeLabel(),
            configPath: getConfigFilePath(),
            version,
            repository,
        });
    } catch (error) {
        console.error('Failed to get server admin status.', error);
        response.status(500).json({ error: error.message || 'Failed to get server status.' });
    }
});

router.post('/config/get', requireAdminMiddleware, async (_request, response) => {
    try {
        const { configPath, stat, content } = readConfigDocument();

        response.json({
            path: configPath,
            content,
            lastModifiedMs: stat.mtimeMs,
        });
    } catch (error) {
        console.error('Failed to read config.yaml.', error);
        response.status(error.status || 500).json({ error: error.message || 'Failed to read config.yaml.' });
    }
});

router.post('/config/save', requireAdminMiddleware, async (request, response) => {
    try {
        const content = String(request.body?.content ?? '');
        const restart = Boolean(request.body?.restart);
        const expectedLastModifiedMs = Number(request.body?.expectedLastModifiedMs);

        if (!content.trim()) {
            return response.status(400).json({ error: 'Config content cannot be empty.' });
        }

        const { configPath, stat } = readConfigDocument();
        ensureExpectedConfigMtime(stat, expectedLastModifiedMs);

        const parsed = yaml.parseDocument(content, { prettyErrors: true });
        if (parsed.errors.length > 0) {
            return response.status(400).json({
                error: parsed.errors.map(error => error.message).join('\n\n'),
            });
        }

        const nextContent = content.endsWith('\n') ? content : `${content}\n`;
        writeFileAtomicSync(configPath, nextContent, 'utf8');
        const nextStat = fs.statSync(configPath);

        if (restart) {
            scheduleRestart(response);
            return response.status(202).json({
                ok: true,
                restarting: true,
                path: configPath,
                lastModifiedMs: nextStat.mtimeMs,
                message: 'Config saved. Restarting SillyBunny now.',
            });
        }

        return response.json({
            ok: true,
            restarting: false,
            path: configPath,
            lastModifiedMs: nextStat.mtimeMs,
            message: 'Config saved. Restart the server to apply changes.',
        });
    } catch (error) {
        console.error('Failed to save config.yaml.', error);
        response.status(error.status || 500).json({ error: error.message || 'Failed to save config.yaml.' });
    }
});

router.post('/config/chat-completions/get', requireAdminMiddleware, async (_request, response) => {
    try {
        const { configPath, stat, document } = readConfigDocument();

        response.json({
            path: configPath,
            lastModifiedMs: stat.mtimeMs,
            settings: getChatCompletionConfigState(document),
        });
    } catch (error) {
        console.error('Failed to read chat completions config settings.', error);
        response.status(error.status || 500).json({ error: error.message || 'Failed to read chat completions config settings.' });
    }
});

router.post('/config/chat-completions/save', requireAdminMiddleware, async (request, response) => {
    try {
        const restart = Boolean(request.body?.restart);
        const expectedLastModifiedMs = Number(request.body?.expectedLastModifiedMs);
        const normalizedSettings = normalizeChatCompletionConfigInput(request.body?.settings);
        const { configPath, stat, document } = readConfigDocument();

        ensureExpectedConfigMtime(stat, expectedLastModifiedMs);
        applyChatCompletionConfigState(document, normalizedSettings);

        const nextStat = writeConfigDocument(configPath, document);
        const nextSettings = getChatCompletionConfigState(document);

        if (restart) {
            scheduleRestart(response);
            return response.status(202).json({
                ok: true,
                restarting: true,
                path: configPath,
                lastModifiedMs: nextStat.mtimeMs,
                settings: nextSettings,
                message: 'Chat completion server config saved. Restarting SillyBunny now.',
            });
        }

        return response.json({
            ok: true,
            restarting: false,
            path: configPath,
            lastModifiedMs: nextStat.mtimeMs,
            settings: nextSettings,
            message: 'Chat completion server config saved. Restart the server to apply changes.',
        });
    } catch (error) {
        console.error('Failed to save chat completions config settings.', error);
        response.status(error.status || 500).json({ error: error.message || 'Failed to save chat completions config settings.' });
    }
});

router.post('/restart', requireAdminMiddleware, async (_request, response) => {
    try {
        scheduleRestart(response);
        response.status(202).json({
            ok: true,
            restarting: true,
            message: `${APP_NAME} is restarting.`,
        });
    } catch (error) {
        console.error('Failed to restart server.', error);
        response.status(500).json({ error: error.message || 'Failed to restart server.' });
    }
});

router.post('/update', requireAdminMiddleware, async (_request, response) => {
    try {
        const repository = await getRepositoryStatus();

        if (!repository.supported) {
            return response.status(400).json({ error: repository.message || 'Git updates are unavailable in this environment.' });
        }

        if (!repository.isRepo) {
            return response.status(400).json({ error: repository.message || 'This install is not running from a Git repository.' });
        }

        if (!repository.trackingBranch) {
            return response.status(409).json({ error: repository.message || 'This branch is not tracking an upstream remote.', repository });
        }

        if (repository.hasLocalChanges) {
            return response.status(409).json({ error: repository.message || 'Local changes are present, so auto-update is blocked.', repository });
        }

        if (repository.ahead > 0 && repository.behind > 0) {
            return response.status(409).json({ error: repository.message || 'This branch has diverged from upstream.', repository });
        }

        if (repository.behind === 0) {
            return response.json({
                updated: false,
                restarting: false,
                message: 'Already up to date.',
                repository,
            });
        }

        const git = simpleGit({ baseDir: serverDirectory, ...GIT_OPTIONS });
        await git.fetch();
        await git.raw(['pull', '--ff-only']);

        const installCommand = getInstallCommand();
        let installResult = null;

        if (installCommand) {
            installResult = await runCommand(installCommand.command, installCommand.args);
        }

        const nextRepository = await getRepositoryStatus();
        const nextVersion = await getVersion();

        scheduleRestart(response);

        response.status(202).json({
            updated: true,
            restarting: true,
            message: 'Update applied. Restarting SillyBunny now.',
            version: nextVersion,
            repository: nextRepository,
            install: installResult ? {
                command: [installCommand.command, ...installCommand.args].join(' '),
                stdout: truncateOutput(installResult.stdout),
                stderr: truncateOutput(installResult.stderr),
            } : null,
        });
    } catch (error) {
        console.error('Failed to update SillyBunny.', error);
        response.status(500).json({
            error: error.message || 'Failed to update SillyBunny.',
        });
    }
});
