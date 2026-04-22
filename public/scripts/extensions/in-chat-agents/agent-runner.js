import {
    chat,
    chat_metadata,
    ensureSwipes,
    extension_prompt_roles,
    extension_prompt_types,
    extension_prompts,
    setExtensionPrompt,
    substituteParams,
    generateQuietPrompt,
    normalizeContentText,
    saveChatDebounced,
    stopGeneration,
    streamingProcessor,
    syncMesToSwipe,
} from '../../../script.js';
import { getContext } from '../../extensions.js';
import { eventSource, event_types } from '../../events.js';
import { ToolManager } from '../../tool-calling.js';
import {
    DEFAULT_AGENT_MAX_TOKENS,
    getAgentById,
    getAgentRegexScripts,
    getEnabledAgents,
    getEnabledToolAgents,
    getGlobalSettings,
    isToolAgent,
    resolveConnectionProfile,
} from './agent-store.js';
import {
    getToolAction,
    getToolFormatter,
} from './tool-action-registry.js';
import {
    getAllEntryUids as pfGetAllEntryUids,
    getSettings as getPathfinderRuntimeSettings,
    getTree as pfGetTree,
    setSettings as setPathfinderRuntimeSettings,
} from './pathfinder/tree-store.js';
import { PATHFINDER_RETRIEVAL_PROMPT_KEYS, runSidecarRetrieval } from './pathfinder/sidecar-retrieval.js';

const PROMPT_KEY_PREFIX = 'inchat_agent_';
const MESSAGE_EXTRA_KEY = 'inChatAgents';
export const PROMPT_RUNS_EXTRA_KEY = 'inChatAgentPromptRuns';
export const PROMPT_TRANSFORM_HISTORY_KEY = 'inChatAgentTransformHistory';
const MAX_TRANSFORM_HISTORY = 10;
const pendingRefreshTimeouts = new Map();
const DEFAULT_PROMPT_TRANSFORM_MAX_TOKENS = DEFAULT_AGENT_MAX_TOKENS;
const GREETING_GENERATION_TYPE = 'first_message';
const PREPEND_PROMPT_TRANSFORM_TEMPLATE_IDS = new Set([
    'tpl-scene-tracker',
    'tpl-time-tracker',
]);
const PREPEND_PROMPT_TRANSFORM_TAG_RE = /\[(?:SCENE|TIME)\|/;
const ASSISTANT_RESPONSE_WRAPPER_RE = /^\s*<assistant_response>\s*([\s\S]*?)\s*<\/assistant_response>\s*$/i;

/** @type {{ generationType: string, activeAgentIds: string[] } | null} */
let pendingGenerationSnapshot = null;
let internalPromptTransformDepth = 0;
let isGenerationInProgress = false;
let generationStopRequested = false;
let deferredPostProcessing = null;
let deferredPostProcessingTimeout = null;
const activePromptTransformToasts = new Set();

/** Track which tool names were registered by the agent system so we can cleanly unregister only our own. */
const agentRegisteredToolNames = new Set();

/** Guard to prevent re-registration during generation when WORLDINFO_UPDATED fires. */
let toolSyncDuringGeneration = false;

/** Recursion depth tracker for tool-call passes. */
let toolRecursionDepth = 0;

export function isAgentGenerationActive() {
    return internalPromptTransformDepth > 0 || isGenerationInProgress;
}

export function cancelAgentGeneration() {
    const wasActive = isAgentGenerationActive() || Boolean(streamingProcessor);
    generationStopRequested = true;
    clearDeferredPostProcessing();
    clearAllPromptTransformRunningToasts();

    const stopped = stopGeneration();
    if (stopped || wasActive) {
        toastr.info('Stopping agent generation...');
        return true;
    }

    toastr.info('No agent generation is currently running.');
    return false;
}

function isPathfinderToolAgent(agent) {
    return agent?.sourceTemplateId === 'tpl-pathfinder' ||
        agent?.name === 'Pathfinder' ||
        (agent?.category === 'tool' && agent?.tools?.some(tool => tool.name?.startsWith('Pathfinder_')));
}

function getPathfinderRuntimeAgent(agents = getEnabledToolAgents()) {
    return agents.find(isPathfinderToolAgent) ?? null;
}

function syncPathfinderRuntimeSettings(agent = getPathfinderRuntimeAgent()) {
    const currentRuntimeSettings = getPathfinderRuntimeSettings();
    const nextRuntimeSettings = agent?.settings
        ? {
            ...agent.settings,
            pipelinePrompts: currentRuntimeSettings.pipelinePrompts,
            pipelines: currentRuntimeSettings.pipelines,
        }
        : {
            pipelinePrompts: currentRuntimeSettings.pipelinePrompts,
            pipelines: currentRuntimeSettings.pipelines,
        };

    setPathfinderRuntimeSettings(nextRuntimeSettings);
}

function getRegisterableAgentTools(agent) {
    if (isPathfinderToolAgent(agent) && !agent?.settings?.sidecarEnabled) {
        return [];
    }

    return (agent.tools ?? []).filter(tool => tool.enabled !== false);
}

/**
 * Syncs tool registrations for all enabled tool-category agents.
 * Unregisters tools from disabled agents, registers tools from enabled ones.
 */
export function syncToolAgentRegistrations() {
    if (toolSyncDuringGeneration) {
        return;
    }

    const desiredTools = new Set();
    const enabledToolAgents = getEnabledToolAgents();
    syncPathfinderRuntimeSettings(getPathfinderRuntimeAgent(enabledToolAgents));

    for (const agent of enabledToolAgents) {
        const enabledTools = getRegisterableAgentTools(agent);
        for (const tool of enabledTools) {
            desiredTools.add(tool.name);
        }
    }

    for (const name of agentRegisteredToolNames) {
        if (!desiredTools.has(name)) {
            ToolManager.unregisterFunctionTool(name);
            agentRegisteredToolNames.delete(name);
        }
    }

    for (const agent of enabledToolAgents) {
        const enabledTools = getRegisterableAgentTools(agent);
        for (const toolDef of enabledTools) {
            const action = getToolAction(toolDef.actionKey);
            if (!action) {
                console.warn(`[InChatAgents] Tool "${toolDef.name}" has actionKey "${toolDef.actionKey}" with no registered action. Skipping.`);
                continue;
            }

            const formatMessage = getToolFormatter(toolDef.formatMessageKey) ?? (async () => `Calling ${toolDef.displayName}...`);

            ToolManager.registerFunctionTool({
                name: toolDef.name,
                displayName: toolDef.displayName,
                description: toolDef.description,
                parameters: toolDef.parameters,
                action,
                formatMessage,
                shouldRegister: async () => true,
                stealth: toolDef.stealth ?? false,
            });

            agentRegisteredToolNames.add(toolDef.name);
        }
    }
}

/**
 * Unregisters all agent-owned tools from ToolManager.
 */
export function unregisterAllAgentTools() {
    for (const name of agentRegisteredToolNames) {
        ToolManager.unregisterFunctionTool(name);
    }
    agentRegisteredToolNames.clear();
}

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
    return resolveConnectionProfile(agent?.connectionProfile);
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

function getConnectionProfileDisplayName(profileId = '') {
    const normalizedProfileId = String(profileId ?? '').trim();
    if (!normalizedProfileId) {
        return '';
    }

    const connectionProfilesSelect = document.getElementById('connection_profiles');
    if (connectionProfilesSelect instanceof HTMLSelectElement) {
        const matchingOption = Array.from(connectionProfilesSelect.options)
            .find(option => String(option.value ?? '').trim() === normalizedProfileId);
        const optionLabel = String(matchingOption?.textContent ?? '').trim();
        if (optionLabel) {
            return optionLabel;
        }
    }

    const context = getContext();
    const CMRS = context?.ConnectionManagerRequestService;
    if (CMRS && typeof CMRS.getProfile === 'function') {
        try {
            const profile = CMRS.getProfile(normalizedProfileId);
            const profileName = String(profile?.name ?? '').trim();
            if (profileName) {
                return profileName;
            }
        } catch {
            // Fall back to the raw profile id when the profile no longer exists.
        }
    }

    return normalizedProfileId;
}

function describePromptTransformTarget(profileId = '', runner = '') {
    if (runner === 'main') {
        return 'the main model';
    }

    if (profileId) {
        return `profile "${getConnectionProfileDisplayName(profileId)}"`;
    }

    return 'the main model';
}

function showPromptTransformRunningToast(agent, mode, profileId = '') {
    const agentName = agent?.name || 'In-Chat Agent';
    const modeLabel = describePromptTransformMode(mode);
    const targetLabel = describePromptTransformTarget(profileId, profileId ? 'profile' : 'main');

    const toast = toastr.info(`Running ${modeLabel} via ${targetLabel}...`, agentName, {
        timeOut: 0,
        extendedTimeOut: 0,
        tapToDismiss: true,
        closeButton: true,
        escapeHtml: true,
    });

    if (toast) {
        activePromptTransformToasts.add(toast);
    }

    return toast;
}

function clearPromptTransformRunningToast(toast) {
    if (!toast) {
        return;
    }

    activePromptTransformToasts.delete(toast);
    toastr.clear(toast);
}

function clearAllPromptTransformRunningToasts() {
    for (const toast of activePromptTransformToasts) {
        toastr.clear(toast);
    }

    activePromptTransformToasts.clear();

    $('.toast').filter((_, element) => {
        const title = $(element).find('.toast-title').text().trim();
        const message = $(element).find('.toast-message').text().trim();
        return title === 'In-Chat Agent' && /^Running prompt (rewrite|append) via /u.test(message);
    }).each((_, element) => toastr.clear($(element)));
}

async function commitOpenEditorForMessage(messageIndex) {
    if (!Number.isInteger(Number(messageIndex))) {
        return;
    }

    const editorDoneButton = $(`.mes[mesid="${Number(messageIndex)}"] .mes_edit_done:visible`).first();
    if (!editorDoneButton.length) {
        return;
    }

    editorDoneButton.trigger('click');
    await Promise.resolve();
}

function syncPromptTransformMessageState(message, messageIndex) {
    if (!message || message.is_user || message.is_system) {
        return;
    }

    if (message.extra?.display_text) {
        delete message.extra.display_text;
    }

    ensureSwipes(message);

    if (typeof message.swipe_id === 'number' && Array.isArray(message.swipes) && typeof message.swipes[message.swipe_id] === 'string') {
        message.swipes[message.swipe_id] = message.mes;
    }

    syncMesToSwipe(messageIndex);
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

    message.extra[PROMPT_RUNS_EXTRA_KEY] = runs.map(result => sanitizePromptTransformRunForStorage(result));
    return true;
}

function updatePromptTransformHistory(message, run) {
    if (!message || !run || !run.changed) {
        return false;
    }

    message.extra ??= {};
    const history = Array.isArray(message.extra[PROMPT_TRANSFORM_HISTORY_KEY])
        ? message.extra[PROMPT_TRANSFORM_HISTORY_KEY]
        : [];

    history.push({
        agentId: run.agentId,
        agentName: run.agentName,
        mode: run.mode,
        beforeText: normalizeContentText(run.beforeText),
        afterText: normalizeContentText(run.nextMessageText),
        timestamp: run.timestamp,
    });

    while (history.length > MAX_TRANSFORM_HISTORY) {
        history.shift();
    }

    message.extra[PROMPT_TRANSFORM_HISTORY_KEY] = history;
    return true;
}

function unwrapAssistantResponseWrapper(value) {
    let text = normalizeContentText(value);
    let previousText = null;
    let passCount = 0;

    while (text !== previousText && passCount < 8) {
        previousText = text;
        const match = text.match(ASSISTANT_RESPONSE_WRAPPER_RE);
        if (!match) {
            break;
        }

        text = match[1];
        passCount += 1;
    }

    return text;
}

function buildPromptTransformMessages(agentPrompt, messageText, assistantName, generationType, mode) {
    const actionInstruction = mode === 'append'
        ? 'Generate only the new content that should be appended after the assistant response according to the instructions above. Do not repeat, rewrite, summarize, or quote the original assistant response. Return only the appended content, with no labels or commentary unless the appended content itself requires them.'
        : 'Rewrite the assistant response according to the instructions above. Return only the final rewritten assistant response. If no changes are needed, return the original response verbatim. Do not add commentary, labels, or code fences unless the response itself requires them.';
    const currentAssistantResponse = unwrapAssistantResponseWrapper(messageText);

    return [
        {
            role: 'system',
            content: `${agentPrompt}\n\n${actionInstruction}`,
        },
        {
            role: 'user',
            content: `Assistant name: ${assistantName || 'Assistant'}\nGeneration type: ${generationType}\n\nCurrent assistant response:\n<assistant_response>\n${currentAssistantResponse}\n</assistant_response>`,
        },
    ];
}

function appendPromptTransformOutput(originalText, appendedText) {
    const baseText = unwrapAssistantResponseWrapper(originalText);
    const addition = unwrapAssistantResponseWrapper(appendedText).trim();

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

function joinPromptTransformText(leftText, rightText) {
    const left = unwrapAssistantResponseWrapper(leftText);
    const right = unwrapAssistantResponseWrapper(rightText);

    if (!left) {
        return right;
    }

    if (!right) {
        return left;
    }

    if (left.endsWith('\n\n') || right.startsWith('\n\n')) {
        return left + right;
    }

    if (left.endsWith('\n') || right.startsWith('\n')) {
        return `${left}\n${right}`;
    }

    return `${left}\n\n${right}`;
}

function shouldPrependPromptTransformOutput(agent, outputText = '') {
    const templateId = String(agent?.sourceTemplateId ?? '').trim();
    if (PREPEND_PROMPT_TRANSFORM_TEMPLATE_IDS.has(templateId)) {
        return true;
    }

    return PREPEND_PROMPT_TRANSFORM_TAG_RE.test(normalizeContentText(outputText));
}

function sanitizePromptTransformRunForStorage(result) {
    if (!result || typeof result !== 'object') {
        return result;
    }

    // Keep beforeText and nextMessageText for diff/undo — only strip raw outputText
    const storedResult = { ...result };
    delete storedResult.outputText;
    return storedResult;
}

function consolidateAppendPromptTransformOutputs(baseText, agents, results) {
    const prependSegments = [];
    const appendSegments = [];
    const seenSegments = new Set();
    const agentMap = new Map((Array.isArray(agents) ? agents : []).map(agent => [agent.id, agent]));
    const normalizedBaseText = unwrapAssistantResponseWrapper(baseText);

    for (const result of Array.isArray(results) ? results : []) {
        const outputText = unwrapAssistantResponseWrapper(result?.outputText).trim();
        if (!outputText) {
            continue;
        }

        const agent = agentMap.get(result.agentId);
        const shouldPrepend = shouldPrependPromptTransformOutput(agent, outputText);
        const dedupeKey = `${shouldPrepend ? 'prepend' : 'append'}:${outputText}`;
        if (seenSegments.has(dedupeKey)) {
            continue;
        }

        seenSegments.add(dedupeKey);
        (shouldPrepend ? prependSegments : appendSegments).push(outputText);
    }

    let mergedText = normalizedBaseText;
    if (prependSegments.length > 0) {
        mergedText = joinPromptTransformText(prependSegments.join('\n\n'), mergedText);
    }
    if (appendSegments.length > 0) {
        mergedText = joinPromptTransformText(mergedText, appendSegments.join('\n\n'));
    }

    return {
        text: mergedText,
        changed: mergedText !== normalizedBaseText,
        beforeText: normalizedBaseText,
    };
}

function extractProfileResponseText(response) {
    return normalizeContentText(response?.content)
        || normalizeContentText(response?.choices?.[0]?.message?.content)
        || normalizeContentText(response?.candidates?.[0]?.content?.parts)
        || normalizeContentText(response?.candidates?.[0]?.output?.parts)
        || normalizeContentText(response?.text)
        || normalizeContentText(response?.output)
        || normalizeContentText(response?.message?.content)
        || normalizeContentText(response?.message?.tool_plan)
        || normalizeContentText(response?.message)
        || '';
}

function buildFallbackPromptText(promptMessages) {
    return promptMessages
        .map(message => `${String(message?.role ?? 'user').toUpperCase()}:\n${normalizeContentText(message?.content)}`)
        .join('\n\n');
}

async function requestProfilePromptTransform(CMRS, profileId, promptMessages, maxTokens, modelOverride = '') {
    const requestOptions = {
        extractData: true,
        includePreset: true,
        includeInstruct: true,
        stream: false,
    };

    if (modelOverride && modelOverride.trim()) {
        requestOptions.modelOverride = modelOverride.trim();
    }

    try {
        const primaryResponse = await CMRS.sendRequest(profileId, promptMessages, maxTokens, requestOptions);
        const primaryOutput = extractProfileResponseText(primaryResponse);
        if (primaryOutput.trim()) {
            return {
                output: primaryOutput,
                runner: 'profile',
                profileId,
            };
        }
    } catch (error) {
        console.warn(`[InChatAgents] Primary prompt transform request via ${describePromptTransformTarget(profileId, 'profile')} failed, retrying with fallback prompt formatting.`, error);
    }

    let fallbackPrompt = '';
    if (typeof CMRS.constructPrompt === 'function') {
        try {
            fallbackPrompt = CMRS.constructPrompt(promptMessages, profileId) ?? '';
        } catch (error) {
            console.warn(`[InChatAgents] Failed to construct fallback prompt for ${describePromptTransformTarget(profileId, 'profile')}.`, error);
        }
    }

    const fallbackRequestPrompt = Array.isArray(fallbackPrompt)
        ? fallbackPrompt
        : (normalizeContentText(fallbackPrompt).trim() ? normalizeContentText(fallbackPrompt) : buildFallbackPromptText(promptMessages));

    const fallbackOptions = {
        extractData: true,
        includePreset: true,
        includeInstruct: false,
        stream: false,
    };

    if (modelOverride && modelOverride.trim()) {
        fallbackOptions.modelOverride = modelOverride.trim();
    }

    const fallbackResponse = await CMRS.sendRequest(profileId, fallbackRequestPrompt, maxTokens, fallbackOptions);

    return {
        output: extractProfileResponseText(fallbackResponse),
        runner: 'profile',
        profileId,
    };
}

async function requestPromptTransform(agent, promptMessages, maxTokens) {
    const profileId = resolveAgentConnectionProfile(agent);
    const modelOverride = typeof agent.modelOverride === 'string' ? agent.modelOverride.trim() : '';
    const context = getContext();
    const CMRS = context?.ConnectionManagerRequestService;
    const runAsInternalPromptTransform = async (requestFn) => {
        internalPromptTransformDepth++;
        try {
            return await requestFn();
        } finally {
            internalPromptTransformDepth = Math.max(0, internalPromptTransformDepth - 1);
        }
    };

    if (profileId) {
        if (!CMRS || typeof CMRS.sendRequest !== 'function') {
            throw new Error(`${describePromptTransformTarget(profileId, 'profile')} is set, but Connection Manager is unavailable.`);
        }

        return await runAsInternalPromptTransform(async () =>
            await requestProfilePromptTransform(CMRS, profileId, promptMessages, maxTokens, modelOverride),
        );
    }

    const quietPrompt = promptMessages
        .map(message => `${message.role.toUpperCase()}:\n${normalizeContentText(message?.content)}`)
        .join('\n\n');
    const preservedPrompts = Object.entries(extension_prompts)
        .filter(([key]) => key.startsWith(PROMPT_KEY_PREFIX));

    for (const [key] of preservedPrompts) {
        delete extension_prompts[key];
    }

    try {
        return await runAsInternalPromptTransform(async () => ({
            output: await generateQuietPrompt({
                quietPrompt,
                quietName: 'In-Chat Agent',
                skipWIAN: true,
                responseLength: maxTokens,
                removeReasoning: true,
            }),
            runner: 'main',
            profileId: '',
        }));
    } finally {
        for (const [key, value] of preservedPrompts) {
            extension_prompts[key] = value;
        }
    }
}

async function runPromptTransformAgent(agent, message, generationType, messageTextOverride = null, messageIndex = null, options = {}) {
    const applyToMessage = options.applyToMessage !== false;
    const currentMessageText = unwrapAssistantResponseWrapper(
        messageTextOverride !== null ? messageTextOverride : message?.mes,
    );
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
            outputText: '',
            nextMessageText: currentMessageText,
            beforeText: currentMessageText,
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
            outputText: '',
            nextMessageText: currentMessageText,
            beforeText: currentMessageText,
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
    const runningToast = showNotifications
        ? showPromptTransformRunningToast(agent, promptTransformMode, profileId)
        : null;

    try {
        const maxTokens = normalizePromptTransformMaxTokens(agent.postProcess?.promptTransformMaxTokens);
        const response = await requestPromptTransform(agent, promptMessages, maxTokens);
        const promptOutputText = unwrapAssistantResponseWrapper(response.output).trim();

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
                outputText: '',
                nextMessageText: currentMessageText,
                beforeText: currentMessageText,
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
        if (changed && applyToMessage) {
            message.mes = nextMessageText;
            syncPromptTransformMessageState(message, messageIndex);
        }

        console.info(`[InChatAgents] ${describePromptTransformMode(promptTransformMode)} agent "${agent.name}" ran via ${describePromptTransformTarget(response.profileId, response.runner)}${changed ? ' and changed the message.' : ' with no text change.'}`);

        const result = {
            agentId: agent.id,
            agentName: agent.name,
            changed,
            status: changed ? 'changed' : 'unchanged',
            mode: promptTransformMode,
            profileId: response.profileId,
            runner: response.runner,
            timestamp: new Date().toISOString(),
            outputText: promptOutputText,
            nextMessageText,
            beforeText: currentMessageText,
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
            outputText: '',
            nextMessageText: currentMessageText,
            beforeText: currentMessageText,
        };

        if (showNotifications) {
            showPromptTransformResultToast(agent, result);
        }

        return result;
    } finally {
        clearPromptTransformRunningToast(runningToast);
    }
}

async function runPromptTransformAppendBatch(agents, message, generationType, messageTextOverride = null, messageIndex = null) {
    const currentMessageText = unwrapAssistantResponseWrapper(
        messageTextOverride !== null ? messageTextOverride : message?.mes,
    );
    const globalSettings = getGlobalSettings();
    const executionMode = globalSettings.appendAgentsExecutionMode === 'sequential' ? 'sequential' : 'parallel';

    let results = [];

    if (executionMode === 'sequential') {
        for (const agent of agents) {
            try {
                const result = await runPromptTransformAgent(agent, message, generationType, currentMessageText, messageIndex, {
                    applyToMessage: false,
                });
                results.push(result);
            } catch (error) {
                results.push({
                    agentId: agent.id,
                    agentName: agent.name,
                    changed: false,
                    status: 'error',
                    mode: getPromptTransformMode(agent),
                    error: error instanceof Error ? error.message : String(error),
                    runner: 'error',
                    timestamp: new Date().toISOString(),
                    outputText: '',
                    nextMessageText: currentMessageText,
                    beforeText: currentMessageText,
                });
            }
        }
    } else {
        results = await Promise.all(
            agents.map(async (agent) => {
                try {
                    return await runPromptTransformAgent(agent, message, generationType, currentMessageText, messageIndex, {
                        applyToMessage: false,
                    });
                } catch (error) {
                    return {
                        agentId: agent.id,
                        agentName: agent.name,
                        changed: false,
                        status: 'error',
                        mode: getPromptTransformMode(agent),
                        error: error instanceof Error ? error.message : String(error),
                        runner: 'error',
                        timestamp: new Date().toISOString(),
                        outputText: '',
                        nextMessageText: currentMessageText,
                        beforeText: currentMessageText,
                    };
                }
            }),
        );
    }

    const consolidated = consolidateAppendPromptTransformOutputs(currentMessageText, agents, results);
    if (consolidated.changed) {
        message.mes = consolidated.text;
        syncPromptTransformMessageState(message, messageIndex);
    }

    return {
        results,
        changed: consolidated.changed,
        nextMessageText: consolidated.text,
        beforeText: currentMessageText,
    };
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
    toolSyncDuringGeneration = true;
    generationStopRequested = false;
    clearDeferredPostProcessing();
    clearAllPromptTransformRunningToasts();
    pendingGenerationSnapshot = null;

    const lastMsg = chat[chat.length - 1];
    const isRecursiveToolPass = lastMsg?.extra?.tool_invocations != null;
    if (isRecursiveToolPass) {
        toolRecursionDepth++;
    } else {
        toolRecursionDepth = 0;
    }

    for (const key of Object.keys(extension_prompts)) {
        if (key.startsWith(PROMPT_KEY_PREFIX) || PATHFINDER_RETRIEVAL_PROMPT_KEYS.includes(key)) {
            delete extension_prompts[key];
        }
    }
}

function onGenerationEnded() {
    if (internalPromptTransformDepth > 0) {
        return;
    }

    isGenerationInProgress = false;
    toolSyncDuringGeneration = false;
    generationStopRequested = false;
    clearAllPromptTransformRunningToasts();
    scheduleDeferredPostProcessingFlush();
}

function onGenerationStopped() {
    if (internalPromptTransformDepth > 0) {
        return;
    }

    generationStopRequested = true;
    isGenerationInProgress = false;
    clearDeferredPostProcessing();
    clearAllPromptTransformRunningToasts();
}

/**
 * Injects pre-generation agent prompts.
 * @param {string} generationType
 * @param {object} _options
 * @param {boolean} dryRun
 */
async function onGenerationAfterCommands(generationType, _options, dryRun) {
    if (dryRun || internalPromptTransformDepth > 0) {
        return;
    }

    pendingGenerationSnapshot = buildActivationSnapshot(generationType);
    const activeAgents = getSnapshotAgents(pendingGenerationSnapshot);
    const pathfinderAgent = getPathfinderRuntimeAgent(activeAgents);

    if (pathfinderAgent) {
        syncPathfinderRuntimeSettings(pathfinderAgent);
        await runSidecarRetrieval(setExtensionPrompt, extension_prompt_types, extension_prompt_roles);
    }

    const promptAgents = activeAgents.filter(agent => agent.phase === 'pre' || agent.phase === 'both');

    for (const agent of promptAgents) {
        if (isToolAgent(agent)) {
            continue;
        }

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

    syncToolAgentRegistrations();
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
        agent.postProcess?.enabled &&
        agent.postProcess.type !== 'regex' &&
        (
            agent.phase === 'post' ||
            agent.phase === 'both' ||
            agent.postProcess.type === 'extract'
        ),
    );

    let chatStateChanged = false;
    let messageDisplayChanged = false;

    const promptRuns = [];
    let currentPromptTransformText = unwrapAssistantResponseWrapper(message.mes);
    if (currentPromptTransformText !== normalizeContentText(message.mes)) {
        message.mes = currentPromptTransformText;
        syncPromptTransformMessageState(message, messageIndex);
        chatStateChanged = true;
        messageDisplayChanged = true;
    }
    let appendBatch = [];
    const flushAppendBatch = async () => {
        if (appendBatch.length === 0) {
            return;
        }

        const batchAgents = appendBatch;
        appendBatch = [];

        const batchResult = await runPromptTransformAppendBatch(
            batchAgents,
            message,
            generationType,
            currentPromptTransformText,
            messageIndex,
        );
        promptRuns.push(...batchResult.results);
        currentPromptTransformText = batchResult.nextMessageText;

        if (batchResult.changed) {
            chatStateChanged = true;
            messageDisplayChanged = true;
        }
    };

    for (const agent of promptTransformAgents) {
        if (getPromptTransformMode(agent) === 'append') {
            appendBatch.push(agent);
            continue;
        }

        await flushAppendBatch();

        try {
            const result = await runPromptTransformAgent(agent, message, generationType, currentPromptTransformText, messageIndex);
            promptRuns.push(result);
            currentPromptTransformText = result.nextMessageText;

            if (result.changed) {
                chatStateChanged = true;
                messageDisplayChanged = true;
            }
        } catch (error) {
            promptRuns.push({
                agentId: agent.id,
                agentName: agent.name,
                changed: false,
                status: 'error',
                mode: getPromptTransformMode(agent),
                error: error instanceof Error ? error.message : String(error),
                runner: 'error',
                timestamp: new Date().toISOString(),
            });
        }
    }

    await flushAppendBatch();

    if (updatePromptTransformRuns(message, promptRuns)) {
        chatStateChanged = true;
    }

    for (const run of promptRuns) {
        updatePromptTransformHistory(message, run);
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

async function onImpersonateReady() {
    if (internalPromptTransformDepth > 0) {
        return;
    }

    if (!pendingGenerationSnapshot) {
        return;
    }

    const messageIndex = chat.length - 1;
    const message = chat[messageIndex];
    if (!message || message.is_user || message.is_system) {
        return;
    }

    const generationType = pendingGenerationSnapshot.generationType ?? 'impersonate';

    if (isStreamingMessageStillActive(messageIndex)) {
        deferPostProcessing(messageIndex, generationType);
        return;
    }

    if (wasStreamingMessageStopped(messageIndex)) {
        if (deferredPostProcessing?.messageIndex === messageIndex) {
            clearDeferredPostProcessing();
        }
        return;
    }

    if (deferredPostProcessing?.messageIndex === messageIndex) {
        clearDeferredPostProcessing();
    }

    await processReceivedMessage(messageIndex, generationType);
}

async function onMessageSwiped(data) {
    if (internalPromptTransformDepth > 0) {
        return;
    }

    // `MESSAGE_SWIPED` fires during swipe navigation before any overswipe generation starts.
    // Re-running prompt-transform / append agents here mutates the current swipe again,
    // which makes agents like Prose Polisher fire just from browsing swipes.
    // Real swipe generations are handled later by `MESSAGE_RECEIVED`.
    void data;
}

/**
 * Handles CHAT_COMPLETION_SETTINGS_READY for tool-category agents.
 * Converts registered tools to Anthropic format when needed,
 * and strips tools on the final recursion pass to force narrative output.
 * @param {object} data Generation data being prepared for the API call
 */
function onChatCompletionSettingsReady(data) {
    if (agentRegisteredToolNames.size === 0) {
        return;
    }

    const recurseLimit = ToolManager.RECURSE_LIMIT ?? 5;
    if (toolRecursionDepth >= recurseLimit - 1) {
        delete data.tools;
        data.tool_choice = 'none';
        return;
    }

    if (!Array.isArray(data.tools) || data.tools.length === 0) {
        return;
    }

    const isClaude = String(data.model ?? '').startsWith('claude') ||
        data.chat_completion_source === 'claude';

    if (isClaude && Array.isArray(data.tools)) {
        data.tools = data.tools.map(tool => {
            if (tool.type === 'function' && tool.function) {
                return {
                    name: tool.function.name,
                    description: tool.function.description,
                    input_schema: tool.function.parameters,
                };
            }
            return tool;
        });

        if (data.tool_choice === 'auto') {
            data.tool_choice = { type: 'auto' };
        } else if (typeof data.tool_choice === 'object' && data.tool_choice?.function?.name) {
            data.tool_choice = { type: 'tool', name: data.tool_choice.function.name };
        }
    }
}

/**
 * Handles WORLDINFO_ENTRIES_LOADED for tool-category agents.
 * Suppresses keyword-based scanning for lorebooks managed by tool agents
 * (e.g., Pathfinder) to prevent double-injection.
 * @param {object} data World info data with globalLore, characterLore, etc.
 */
function onWorldInfoEntriesLoaded(data) {
    const enabledToolAgents = getEnabledToolAgents();
    if (enabledToolAgents.length === 0) return;

    const managedUids = getPfManagedEntryUids(enabledToolAgents);
    if (managedUids.size === 0) return;

    const loreArrayKeys = ['globalLore', 'characterLore', 'chatLore', 'personaLore'];
    for (const key of loreArrayKeys) {
        if (!Array.isArray(data[key])) continue;
        data[key] = data[key].filter(entry => {
            if (!entry) return true;
            return !managedUids.has(entry.uid);
        });
    }
}

function getPfManagedEntryUids(toolAgents) {
    const uids = new Set();
    for (const agent of toolAgents) {
        const books = agent.settings?.enabledLorebooks ?? [];
        for (const bookName of books) {
            const tree = pfGetTree(bookName);
            if (tree) {
                for (const uid of pfGetAllEntryUids(tree)) uids.add(uid);
            }
        }
    }
    return uids;
}

let _onChatChangedToolSync = false;

function onChatChangedToolSync() {
    if (_onChatChangedToolSync) {
        return;
    }
    _onChatChangedToolSync = true;

    requestAnimationFrame(() => {
        _onChatChangedToolSync = false;
        toolRecursionDepth = 0;
        syncToolAgentRegistrations();
    });
}

function onWorldInfoUpdatedToolSync() {
    if (toolSyncDuringGeneration || isGenerationInProgress) {
        return;
    }
    syncToolAgentRegistrations();
}

export function undoPromptTransform(messageIndex) {
    const message = chat[messageIndex];
    if (!message || message.is_user || message.is_system) {
        return false;
    }

    const history = Array.isArray(message.extra?.[PROMPT_TRANSFORM_HISTORY_KEY])
        ? message.extra[PROMPT_TRANSFORM_HISTORY_KEY]
        : [];

    if (history.length === 0) {
        return false;
    }

    const lastEntry = history[history.length - 1];
    message.mes = lastEntry.beforeText;
    syncPromptTransformMessageState(message, messageIndex);
    saveChatDebounced();
    scheduleMessageRefresh(messageIndex, message);
    return true;
}

export function redoPromptTransform(messageIndex) {
    const message = chat[messageIndex];
    if (!message || message.is_user || message.is_system) {
        return false;
    }

    const history = Array.isArray(message.extra?.[PROMPT_TRANSFORM_HISTORY_KEY])
        ? message.extra[PROMPT_TRANSFORM_HISTORY_KEY]
        : [];

    if (history.length === 0) {
        return false;
    }

    const lastEntry = history[history.length - 1];
    message.mes = lastEntry.afterText;
    syncPromptTransformMessageState(message, messageIndex);
    saveChatDebounced();
    scheduleMessageRefresh(messageIndex, message);
    return true;
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

    if (event_types.IMPERSONATE_READY) {
        eventSource.on(event_types.IMPERSONATE_READY, onImpersonateReady);
    }

    if (event_types.MESSAGE_SWIPED) {
        eventSource.on(event_types.MESSAGE_SWIPED, onMessageSwiped);
    }

    if (event_types.CHAT_COMPLETION_SETTINGS_READY) {
        eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, onChatCompletionSettingsReady);
    }

    if (event_types.WORLDINFO_ENTRIES_LOADED) {
        eventSource.on(event_types.WORLDINFO_ENTRIES_LOADED, onWorldInfoEntriesLoaded);
    }

    if (event_types.CHAT_CHANGED) {
        eventSource.on(event_types.CHAT_CHANGED, onChatChangedToolSync);
    }

    if (event_types.WORLDINFO_UPDATED) {
        eventSource.on(event_types.WORLDINFO_UPDATED, onWorldInfoUpdatedToolSync);
    }
}

/**
 * Manually runs a single agent on a specific message (on-demand, not triggered by generation).
 * @param {string} agentId
 * @param {number} messageIndex
 * @returns {Promise<import('./agent-store.js').InChatAgent | null>}
 */
export async function runAgentOnMessage(agentId, messageIndex) {
    if (internalPromptTransformDepth > 0) {
        toastr.warning('Cannot run an agent while another is in progress.');
        return null;
    }

    await commitOpenEditorForMessage(messageIndex);

    const agent = getAgentById(agentId);
    if (!agent) {
        toastr.error('Agent not found.');
        return null;
    }

    const message = chat[messageIndex];
    if (!message || message.is_user || message.is_system) {
        return null;
    }

    const generationType = 'normal';
    const result = await runPromptTransformAgent(agent, message, generationType, null, messageIndex);

    if (updatePromptTransformRuns(message, [result])) {
        saveChatDebounced();
    }

    updatePromptTransformHistory(message, result);

    if (result.changed) {
        scheduleMessageRefresh(messageIndex, message);
    }

    return result;
}
