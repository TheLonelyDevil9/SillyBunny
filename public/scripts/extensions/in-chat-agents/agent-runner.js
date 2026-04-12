import {
    chat,
    chat_metadata,
    extension_prompts,
    setExtensionPrompt,
    substituteParams,
    generateQuietPrompt,
    saveChatDebounced,
    streamingProcessor,
} from '../../../script.js';
import { getContext } from '../../extensions.js';
import { eventSource, event_types } from '../../events.js';
import { getAgentById, getAgentRegexScripts, getEnabledAgents, getGlobalSettings } from './agent-store.js';

const PROMPT_KEY_PREFIX = 'inchat_agent_';
const MESSAGE_EXTRA_KEY = 'inChatAgents';
const PROMPT_RUNS_EXTRA_KEY = 'inChatAgentPromptRuns';
const pendingRefreshTimeouts = new Map();
const DEFAULT_PROMPT_TRANSFORM_MAX_TOKENS = 2000;
const GREETING_GENERATION_TYPE = 'first_message';

/** @type {{ generationType: string, activeAgentIds: string[] } | null} */
let pendingGenerationSnapshot = null;
let internalPromptTransformDepth = 0;
let isGenerationInProgress = false;
let generationStopRequested = false;
let deferredPostProcessing = null;
let deferredPostProcessingTimeout = null;

function normalizeGenerationType(generationType) {
    switch (String(generationType ?? '').trim().toLowerCase()) {
        case 'continue':
        case 'impersonate':
        case 'quiet':
            return String(generationType).trim().toLowerCase();
        default:
            return 'normal';
    }
}

function isGreetingGenerationType(generationType) {
    return String(generationType ?? '').trim().toLowerCase() === GREETING_GENERATION_TYPE;
}

function getStreamingTarget(messageIndex) {
    if (!Number.isInteger(Number(messageIndex))) {
        return null;
    }

    const liveStreamingProcessor = streamingProcessor;
    if (!liveStreamingProcessor || Number(liveStreamingProcessor.messageId) !== Number(messageIndex)) {
        return null;
    }

    return liveStreamingProcessor;
}

function isStreamingMessageStillActive(messageIndex) {
    const liveStreamingProcessor = getStreamingTarget(messageIndex);
    if (!liveStreamingProcessor) {
        return false;
    }

    return Boolean(
        !liveStreamingProcessor.isFinished ||
        isGenerationInProgress ||
        document.body?.dataset?.generating === 'true',
    );
}

function wasStreamingMessageStopped(messageIndex) {
    const liveStreamingProcessor = getStreamingTarget(messageIndex);
    if (!liveStreamingProcessor) {
        return false;
    }

    return Boolean(
        generationStopRequested ||
        liveStreamingProcessor.isStopped ||
        liveStreamingProcessor.abortController?.signal?.aborted,
    );
}

function clearDeferredPostProcessing() {
    if (deferredPostProcessingTimeout) {
        clearTimeout(deferredPostProcessingTimeout);
        deferredPostProcessingTimeout = null;
    }

    deferredPostProcessing = null;
}

function deferPostProcessing(messageIndex, generationType) {
    deferredPostProcessing = {
        messageIndex: Number(messageIndex),
        generationType: normalizeGenerationType(generationType),
    };
}

function scheduleDeferredPostProcessingFlush() {
    if (deferredPostProcessingTimeout) {
        clearTimeout(deferredPostProcessingTimeout);
    }

    deferredPostProcessingTimeout = setTimeout(async () => {
        deferredPostProcessingTimeout = null;

        if (!deferredPostProcessing || isGenerationInProgress || generationStopRequested) {
            return;
        }

        const pendingMessage = deferredPostProcessing;

        if (isStreamingMessageStillActive(pendingMessage.messageIndex)) {
            scheduleDeferredPostProcessingFlush();
            return;
        }

        if (wasStreamingMessageStopped(pendingMessage.messageIndex)) {
            deferredPostProcessing = null;
            return;
        }

        deferredPostProcessing = null;
        await processReceivedMessage(pendingMessage.messageIndex, pendingMessage.generationType);
    }, 0);
}

/**
 * Checks whether an agent should activate this turn.
 * @param {import('./agent-store.js').InChatAgent} agent
 * @param {string} generationType
 * @returns {boolean}
 */
function shouldActivate(agent, generationType) {
    const conditions = agent.conditions;

    if (conditions.generationTypes?.length > 0 && !conditions.generationTypes.includes(generationType)) {
        return false;
    }

    if (conditions.triggerProbability < 100 && Math.random() * 100 > conditions.triggerProbability) {
        return false;
    }

    if (conditions.triggerKeywords?.length > 0) {
        const lastMessage = chat[chat.length - 1]?.mes ?? '';
        const lowerMessage = lastMessage.toLowerCase();
        const hasKeyword = conditions.triggerKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
        if (!hasKeyword) {
            return false;
        }
    }

    return true;
}

function buildActivationSnapshot(generationType) {
    const normalizedGenerationType = normalizeGenerationType(generationType);
    const activeAgents = getEnabledAgents().filter(agent => shouldActivate(agent, normalizedGenerationType));

    return {
        generationType: normalizedGenerationType,
        activeAgentIds: activeAgents.map(agent => agent.id),
    };
}

function getSnapshotAgents(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.activeAgentIds)) {
        return [];
    }

    return snapshot.activeAgentIds
        .map(id => getAgentById(id))
        .filter(Boolean);
}

function getActiveAgentsForMessage(generationType) {
    const snapshot = pendingGenerationSnapshot ?? buildActivationSnapshot(generationType);
    return getSnapshotAgents(snapshot);
}

function buildPromptDynamicMacros(messageText = '', message = null, agent = null, generationType = 'normal') {
    const normalizedGenerationType = normalizeGenerationType(generationType);
    const assistantName = String(message?.name ?? '').trim();
    const agentName = String(agent?.name ?? '').trim();

    return {
        currentMessage: messageText,
        lastMessage: messageText,
        latestMessage: messageText,
        response: messageText,
        currentResponse: messageText,
        latestResponse: messageText,
        assistantMessage: messageText,
        assistantName,
        agentName,
        generationType: normalizedGenerationType,
    };
}

function updateMessageRegexSnapshot(message, activeAgents, generationType) {
    message.extra ??= {};
    const regexScripts = activeAgents.flatMap(agent => getAgentRegexScripts(agent));

    if (regexScripts.length === 0) {
        if (message.extra[MESSAGE_EXTRA_KEY]) {
            delete message.extra[MESSAGE_EXTRA_KEY];
            return true;
        }

        return false;
    }

    message.extra[MESSAGE_EXTRA_KEY] = {
        activeAgentIds: activeAgents.map(agent => agent.id),
        generationType: normalizeGenerationType(generationType),
        regexScripts: structuredClone(regexScripts),
        edited: Boolean(message.extra[MESSAGE_EXTRA_KEY]?.edited),
    };

    return true;
}

function normalizePromptTransformMaxTokens(value) {
    if (!Number.isFinite(Number(value))) {
        return DEFAULT_PROMPT_TRANSFORM_MAX_TOKENS;
    }

    return Math.max(16, Math.min(16000, Number(value)));
}

function resolveAgentConnectionProfile(agent) {
    const agentProfileId = String(agent?.connectionProfile ?? '').trim();
    if (agentProfileId) {
        return agentProfileId;
    }

    const defaultProfileId = String(getGlobalSettings()?.connectionProfile ?? '').trim();
    return defaultProfileId || '';
}

function getPromptTransformAgents(activeAgents) {
    return activeAgents.filter(agent =>
        (agent.phase === 'post' || agent.phase === 'both') &&
        agent.postProcess?.promptTransformEnabled &&
        String(agent.prompt ?? '').trim(),
    );
}

function getPromptTransformAgentsForMessage(activeAgents, generationType) {
    if (isGreetingGenerationType(generationType)) {
        // Greeting messages should remain untouched by prompt-based rewrites/appends.
        return [];
    }

    return getPromptTransformAgents(activeAgents);
}

function getPromptTransformMode(agent) {
    return agent?.postProcess?.promptTransformMode === 'append' ? 'append' : 'rewrite';
}

function describePromptTransformMode(mode) {
    return mode === 'append' ? 'prompt append' : 'prompt rewrite';
}

function shouldShowPromptTransformNotifications(agent) {
    return Boolean(
        getGlobalSettings()?.promptTransformShowNotifications &&
        agent?.postProcess?.promptTransformEnabled &&
        agent?.postProcess?.promptTransformShowNotifications,
    );
}

function describePromptTransformTarget(profileId = '', runner = '') {
    if (runner === 'main') {
        return 'the main model';
    }

    if (profileId) {
        return `profile "${profileId}"`;
    }

    return 'the main model';
}

function showPromptTransformResultToast(agent, result) {
    const agentName = agent?.name || result?.agentName || 'In-Chat Agent';

    switch (result?.status) {
        case 'changed':
            toastr.success('', agentName, { timeOut: 3000 });
            break;
        case 'unchanged':
            toastr.info('no change', agentName, { timeOut: 2000 });
            break;
        case 'empty-response': {
            const targetLabel = describePromptTransformTarget(result?.profileId, result?.runner);
            const modeLabel = describePromptTransformMode(result?.mode);
            toastr.warning(`${modeLabel} ran via ${targetLabel} but returned an empty response.`, agentName, {
                timeOut: 7000,
                extendedTimeOut: 10000,
            });
            break;
        }
        case 'error': {
            const targetLabel = describePromptTransformTarget(result?.profileId, result?.runner);
            const modeLabel = describePromptTransformMode(result?.mode);
            toastr.error(
                result?.error
                    ? `${modeLabel} failed via ${targetLabel}: ${result.error}`
                    : `${modeLabel} failed via ${targetLabel}.`,
                agentName,
                {
                    timeOut: 10000,
                    extendedTimeOut: 12000,
                },
            );
            break;
        }
    }
}

function updatePromptTransformRuns(message, runs) {
    message.extra ??= {};

    if (!Array.isArray(runs) || runs.length === 0) {
        if (Object.hasOwn(message.extra, PROMPT_RUNS_EXTRA_KEY)) {
            delete message.extra[PROMPT_RUNS_EXTRA_KEY];
            return true;
        }

        return false;
    }

    message.extra[PROMPT_RUNS_EXTRA_KEY] = runs;
    return true;
}

function buildPromptTransformMessages(agentPrompt, messageText, assistantName, generationType, mode) {
    const actionInstruction = mode === 'append'
        ? 'Generate only the new content that should be appended after the assistant response according to the instructions above. Do not repeat, rewrite, summarize, or quote the original assistant response. Return only the appended content, with no labels or commentary unless the appended content itself requires them.'
        : 'Rewrite the assistant response according to the instructions above. Return only the final rewritten assistant response. If no changes are needed, return the original response verbatim. Do not add commentary, labels, or code fences unless the response itself requires them.';

    return [
        {
            role: 'system',
            content: `${agentPrompt}\n\n${actionInstruction}`,
        },
        {
            role: 'user',
            content: `Assistant name: ${assistantName || 'Assistant'}\nGeneration type: ${generationType}\n\nCurrent assistant response:\n<assistant_response>\n${messageText}\n</assistant_response>`,
        },
    ];
}

function appendPromptTransformOutput(originalText, appendedText) {
    const baseText = String(originalText ?? '');
    const addition = String(appendedText ?? '').trim();

    if (!addition) {
        return baseText;
    }

    if (!baseText) {
        return addition;
    }

    if (baseText.endsWith('\n\n')) {
        return baseText + addition;
    }

    if (baseText.endsWith('\n')) {
        return `${baseText}\n${addition}`;
    }

    return `${baseText}\n\n${addition}`;
}

async function requestPromptTransform(agent, promptMessages, maxTokens) {
    const profileId = resolveAgentConnectionProfile(agent);
    const context = getContext();
    const CMRS = context?.ConnectionManagerRequestService;

    if (profileId) {
        if (!CMRS || typeof CMRS.sendRequest !== 'function') {
            throw new Error(`Connection profile "${profileId}" is set, but Connection Manager is unavailable.`);
        }

        const response = await CMRS.sendRequest(profileId, promptMessages, maxTokens, {
            extractData: true,
            includePreset: true,
            includeInstruct: true,
            stream: false,
        });

        return {
            output: typeof response === 'string'
                ? response
                : (response?.content || response?.toString() || ''),
            runner: 'profile',
            profileId,
        };
    }

    const quietPrompt = promptMessages
        .map(message => `${message.role.toUpperCase()}:\n${message.content}`)
        .join('\n\n');
    const preservedPrompts = Object.entries(extension_prompts)
        .filter(([key]) => key.startsWith(PROMPT_KEY_PREFIX));

    for (const [key] of preservedPrompts) {
        delete extension_prompts[key];
    }

    internalPromptTransformDepth++;
    try {
        return {
            output: await generateQuietPrompt({
                quietPrompt,
                quietName: 'In-Chat Agent',
                skipWIAN: true,
                responseLength: maxTokens,
                removeReasoning: true,
            }),
            runner: 'main',
            profileId: '',
        };
    } finally {
        internalPromptTransformDepth = Math.max(0, internalPromptTransformDepth - 1);

        for (const [key, value] of preservedPrompts) {
            extension_prompts[key] = value;
        }
    }
}

async function runPromptTransformAgent(agent, message, generationType, messageTextOverride = null) {
    const currentMessageText = messageTextOverride !== null ? String(messageTextOverride) : String(message?.mes ?? '');
    const normalizedGenerationType = normalizeGenerationType(generationType);
    const promptTransformMode = getPromptTransformMode(agent);
    const profileId = resolveAgentConnectionProfile(agent);
    const showNotifications = shouldShowPromptTransformNotifications(agent);

    if (!currentMessageText.trim()) {
        const result = {
            agentId: agent.id,
            agentName: agent.name,
            changed: false,
            status: 'skipped-empty-message',
            mode: promptTransformMode,
            profileId,
            runner: 'none',
            timestamp: new Date().toISOString(),
        };

        return result;
    }

    const expandedPrompt = substituteParams(agent.prompt, {
        name2Override: String(message?.name ?? '').trim(),
        original: currentMessageText,
        dynamicMacros: buildPromptDynamicMacros(currentMessageText, message, agent, normalizedGenerationType),
    }).trim();

    if (!expandedPrompt) {
        const result = {
            agentId: agent.id,
            agentName: agent.name,
            changed: false,
            status: 'skipped-empty-prompt',
            mode: promptTransformMode,
            profileId,
            runner: 'none',
            timestamp: new Date().toISOString(),
        };

        return result;
    }

    const promptMessages = buildPromptTransformMessages(
        expandedPrompt,
        currentMessageText,
        String(message?.name ?? '').trim(),
        normalizedGenerationType,
        promptTransformMode,
    );

    try {
        const maxTokens = normalizePromptTransformMaxTokens(agent.postProcess?.promptTransformMaxTokens);
        const response = await requestPromptTransform(agent, promptMessages, maxTokens);
        const promptOutputText = String(response.output ?? '').trim();

        if (!promptOutputText) {
            console.warn(`[InChatAgents] ${describePromptTransformMode(promptTransformMode)} agent "${agent.name}" returned an empty response.`);
            const result = {
                agentId: agent.id,
                agentName: agent.name,
                changed: false,
                status: 'empty-response',
                mode: promptTransformMode,
                profileId: response.profileId,
                runner: response.runner,
                timestamp: new Date().toISOString(),
            };

            if (showNotifications) {
                showPromptTransformResultToast(agent, result);
            }

            return result;
        }

        const nextMessageText = promptTransformMode === 'append'
            ? appendPromptTransformOutput(currentMessageText, promptOutputText)
            : promptOutputText;
        const changed = nextMessageText !== currentMessageText;
        if (changed) {
            message.mes = nextMessageText;
        }

        console.info(`[InChatAgents] ${describePromptTransformMode(promptTransformMode)} agent "${agent.name}" ran via ${response.runner === 'profile' ? `profile "${response.profileId}"` : 'the main model'}${changed ? ' and changed the message.' : ' with no text change.'}`);

        const result = {
            agentId: agent.id,
            agentName: agent.name,
            changed,
            status: changed ? 'changed' : 'unchanged',
            mode: promptTransformMode,
            profileId: response.profileId,
            runner: response.runner,
            timestamp: new Date().toISOString(),
        };

        if (showNotifications) {
            showPromptTransformResultToast(agent, result);
        }

        return result;
    } catch (error) {
        console.warn(`[InChatAgents] ${describePromptTransformMode(promptTransformMode)} failed in agent "${agent.name}":`, error);
        const result = {
            agentId: agent.id,
            agentName: agent.name,
            changed: false,
            status: 'error',
            mode: promptTransformMode,
            error: error instanceof Error ? error.message : String(error),
            profileId,
            runner: 'error',
            timestamp: new Date().toISOString(),
        };

        if (showNotifications) {
            showPromptTransformResultToast(agent, result);
        }

        return result;
    }
}

async function refreshMessageAfterMutation(messageIndex, message) {
    const context = getContext();
    const messageElement = document.querySelector(`.mes[mesid="${messageIndex}"]`);

    if (messageElement && typeof context?.updateMessageBlock === 'function') {
        context.updateMessageBlock(messageIndex, message);

        if (typeof eventSource?.emit === 'function' && event_types?.MESSAGE_UPDATED) {
            await eventSource.emit(event_types.MESSAGE_UPDATED, messageIndex);
        }

        return;
    }

    if (typeof context?.saveChat === 'function') {
        await context.saveChat();
    }

    if (typeof context?.reloadCurrentChat === 'function') {
        await context.reloadCurrentChat();
        return;
    }

    if (typeof eventSource?.emit === 'function' && event_types?.MESSAGE_UPDATED) {
        await eventSource.emit(event_types.MESSAGE_UPDATED, messageIndex);
        return;
    }

    if (typeof eventSource?.emit === 'function' && event_types?.CHAT_CHANGED) {
        await eventSource.emit(event_types.CHAT_CHANGED);
    }
}

function scheduleMessageRefresh(messageIndex, expectedMessage) {
    const existingTimeout = pendingRefreshTimeouts.get(messageIndex);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    const timeoutId = setTimeout(async () => {
        pendingRefreshTimeouts.delete(messageIndex);

        const liveMessage = chat[messageIndex];
        if (!liveMessage || liveMessage !== expectedMessage) {
            return;
        }

        await refreshMessageAfterMutation(messageIndex, liveMessage);
    }, 0);

    pendingRefreshTimeouts.set(messageIndex, timeoutId);
}

/**
 * Cleans up all in-chat agent extension prompts before a new generation.
 */
function onGenerationStarted() {
    if (internalPromptTransformDepth > 0) {
        return;
    }

    isGenerationInProgress = true;
    generationStopRequested = false;
    clearDeferredPostProcessing();
    pendingGenerationSnapshot = null;

    for (const key of Object.keys(extension_prompts)) {
        if (key.startsWith(PROMPT_KEY_PREFIX)) {
            delete extension_prompts[key];
        }
    }
}

function onGenerationEnded() {
    if (internalPromptTransformDepth > 0) {
        return;
    }

    isGenerationInProgress = false;
    scheduleDeferredPostProcessingFlush();
}

function onGenerationStopped() {
    if (internalPromptTransformDepth > 0) {
        return;
    }

    generationStopRequested = true;
    isGenerationInProgress = false;
    clearDeferredPostProcessing();
}

/**
 * Injects pre-generation agent prompts.
 * @param {string} generationType
 * @param {object} _options
 * @param {boolean} dryRun
 */
function onGenerationAfterCommands(generationType, _options, dryRun) {
    if (dryRun || internalPromptTransformDepth > 0) {
        return;
    }

    pendingGenerationSnapshot = buildActivationSnapshot(generationType);
    const activeAgents = getSnapshotAgents(pendingGenerationSnapshot);
    const promptAgents = activeAgents.filter(agent => agent.phase === 'pre' || agent.phase === 'both');

    for (const agent of promptAgents) {
        const expandedPrompt = substituteParams(agent.prompt, {
            dynamicMacros: buildPromptDynamicMacros('', null, agent, generationType),
        });
        if (!expandedPrompt.trim()) {
            continue;
        }

        const key = PROMPT_KEY_PREFIX + agent.id;
        setExtensionPrompt(
            key,
            expandedPrompt,
            agent.injection.position,
            agent.injection.depth,
            agent.injection.scan,
            agent.injection.role,
        );
    }
}

/**
 * Runs post-generation utilities on the received message and snapshots active regex scripts.
 * @param {number} messageIndex
 * @param {string} generationType
 */
async function processReceivedMessage(messageIndex, generationType) {
    const message = chat[messageIndex];
    if (!message || message.is_user || message.is_system) {
        return;
    }

    const activeAgents = getActiveAgentsForMessage(generationType);
    const promptTransformAgents = getPromptTransformAgentsForMessage(activeAgents, generationType);
    const utilityAgents = activeAgents.filter(agent =>
        (agent.phase === 'post' || agent.phase === 'both') &&
        agent.postProcess?.enabled &&
        agent.postProcess.type !== 'regex',
    );

    let chatStateChanged = false;
    let messageDisplayChanged = false;

    const originalMessageText = String(message.mes ?? '');
    const settledRuns = await Promise.allSettled(
        promptTransformAgents.map(agent => runPromptTransformAgent(agent, message, generationType, originalMessageText)),
    );
    const promptRuns = settledRuns.map(r =>
        r.status === 'fulfilled'
            ? r.value
            : { status: 'error', changed: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
    );

    for (const result of promptRuns) {
        if (result.changed) {
            chatStateChanged = true;
            messageDisplayChanged = true;
        }
    }

    if (updatePromptTransformRuns(message, promptRuns)) {
        chatStateChanged = true;
    }

    for (const agent of utilityAgents) {
        const postProcess = agent.postProcess;

        switch (postProcess.type) {
            case 'extract': {
                if (!postProcess.extractPattern || !postProcess.extractVariable) {
                    break;
                }

                try {
                    const regex = new RegExp(postProcess.extractPattern, 'g');
                    const matches = message.mes.match(regex);
                    if (matches) {
                        chat_metadata[`agent_${postProcess.extractVariable}`] = matches.join('\n');
                        chatStateChanged = true;
                    }
                } catch (error) {
                    console.warn(`[InChatAgents] Extract error in agent "${agent.name}":`, error);
                }
                break;
            }

            case 'append': {
                if (!postProcess.appendText) {
                    break;
                }

                const appendedText = substituteParams(postProcess.appendText);
                if (appendedText.trim()) {
                    message.mes += appendedText;
                    chatStateChanged = true;
                    messageDisplayChanged = true;
                }
                break;
            }
        }
    }

    if (updateMessageRegexSnapshot(message, activeAgents, generationType)) {
        chatStateChanged = true;
        messageDisplayChanged = true;
    }

    if (chatStateChanged) {
        saveChatDebounced();
    }

    if (messageDisplayChanged) {
        scheduleMessageRefresh(messageIndex, message);
    }
}

async function onMessageReceived(messageIndex, generationType) {
    if (internalPromptTransformDepth > 0) {
        return;
    }

    const numericMessageIndex = Number(messageIndex);
    const message = chat[numericMessageIndex];
    if (!message || message.is_user || message.is_system) {
        return;
    }

    if (isStreamingMessageStillActive(numericMessageIndex)) {
        deferPostProcessing(numericMessageIndex, generationType);
        return;
    }

    if (wasStreamingMessageStopped(numericMessageIndex)) {
        if (deferredPostProcessing?.messageIndex === numericMessageIndex) {
            clearDeferredPostProcessing();
        }
        return;
    }

    if (deferredPostProcessing?.messageIndex === numericMessageIndex) {
        clearDeferredPostProcessing();
    }

    await processReceivedMessage(numericMessageIndex, generationType);
}

function onMessageEdited(messageIndex) {
    const message = chat[messageIndex];
    if (!message || !message.extra?.[MESSAGE_EXTRA_KEY]) {
        return;
    }

    message.extra[MESSAGE_EXTRA_KEY].edited = true;
    saveChatDebounced();
}

/**
 * Registers all event listeners for the agent runner.
 */
export function initAgentRunner() {
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, onGenerationAfterCommands);
    eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
    eventSource.on(event_types.GENERATION_STOPPED, onGenerationStopped);
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.MESSAGE_EDITED, onMessageEdited);
}
