import { Fuse } from '../lib.js';

import {
    chat,
    chat_metadata,
    characters,
    eventSource,
    event_types,
    extension_prompt_roles,
    extension_prompt_types,
    extractMessageFromData,
    getCurrentChatId,
    getRequestHeaders,
    main_api,
    name1,
    name2,
    saveChatConditional,
    saveSettingsDebounced,
    this_chid,
} from '../script.js';
import { chat_completion_sources, createGenerationParameters, getChatCompletionModel, oai_settings } from './openai.js';
import { extension_settings, saveMetadataDebounced } from './extensions.js';
import { t } from './i18n.js';
import { Popup } from './popup.js';
import { debounce, getCharaFilename, onlyUnique, uuidv4 } from './utils.js';
import {
    METADATA_KEY as WORLD_INFO_METADATA_KEY,
    createWorldInfoEntry,
    loadWorldInfo,
    saveWorldInfo,
    selected_world_info,
    world_info,
} from './world-info.js';

const AGENT_METADATA_KEY = 'agent_mode';
const AGENT_CONTEXT_PROMPT_KEY = 'agent_mode_context';
const AGENT_BLACKLIST_FIELD = 'agentBlacklisted';
const AGENT_DIRECTOR_LABEL = 'Director';

const agent_director_phases = {
    PRE_GENERATION: 'pre_generation',
    POST_GENERATION: 'post_generation',
};

export const agent_service_ids = {
    RETRIEVAL: 'retrieval',
    MEMORY: 'memory',
    LOREBOOK: 'lorebook',
};

const SERVICE_LABELS = {
    [agent_service_ids.RETRIEVAL]: 'Retrieval',
    [agent_service_ids.MEMORY]: 'Memory',
    [agent_service_ids.LOREBOOK]: 'Lorebook',
};

const AGENT_SOURCES = [
    chat_completion_sources.OPENAI,
    chat_completion_sources.CUSTOM,
    chat_completion_sources.OPENROUTER,
    chat_completion_sources.CLAUDE,
    chat_completion_sources.MISTRALAI,
    chat_completion_sources.COHERE,
    chat_completion_sources.GROQ,
    chat_completion_sources.AIMLAPI,
    chat_completion_sources.XAI,
    chat_completion_sources.AZURE_OPENAI,
];

const SOURCE_LABELS = {
    [chat_completion_sources.OPENAI]: 'OpenAI',
    [chat_completion_sources.CUSTOM]: 'Custom',
    [chat_completion_sources.OPENROUTER]: 'OpenRouter',
    [chat_completion_sources.CLAUDE]: 'Claude',
    [chat_completion_sources.MISTRALAI]: 'Mistral',
    [chat_completion_sources.COHERE]: 'Cohere',
    [chat_completion_sources.GROQ]: 'Groq',
    [chat_completion_sources.AIMLAPI]: 'AIMLAPI',
    [chat_completion_sources.XAI]: 'xAI',
    [chat_completion_sources.AZURE_OPENAI]: 'Azure OpenAI',
};

const MODEL_SETTING_KEYS = {
    [chat_completion_sources.OPENAI]: 'openai_model',
    [chat_completion_sources.CUSTOM]: 'custom_model',
    [chat_completion_sources.OPENROUTER]: 'openrouter_model',
    [chat_completion_sources.CLAUDE]: 'claude_model',
    [chat_completion_sources.MISTRALAI]: 'mistralai_model',
    [chat_completion_sources.COHERE]: 'cohere_model',
    [chat_completion_sources.GROQ]: 'groq_model',
    [chat_completion_sources.AIMLAPI]: 'aimlapi_model',
    [chat_completion_sources.XAI]: 'xai_model',
    [chat_completion_sources.AZURE_OPENAI]: 'azure_openai_model',
};

const DEFAULT_GLOBAL_AGENT_SETTINGS = Object.freeze({
    services: {
        [agent_service_ids.RETRIEVAL]: { maxSteps: 4, resultLimit: 6 },
        [agent_service_ids.MEMORY]: { maxSteps: 1, resultLimit: 6 },
        [agent_service_ids.LOREBOOK]: { maxSteps: 4, resultLimit: 4 },
    },
    profiles: {
        [agent_service_ids.RETRIEVAL]: { use_main: true, chat_completion_source: chat_completion_sources.OPENAI, model: '', reverse_proxy: '', temp_openai: 0.4, openai_max_tokens: 500 },
        [agent_service_ids.MEMORY]: { use_main: true, chat_completion_source: chat_completion_sources.OPENAI, model: '', reverse_proxy: '', temp_openai: 0.3, openai_max_tokens: 450 },
        [agent_service_ids.LOREBOOK]: { use_main: true, chat_completion_source: chat_completion_sources.OPENAI, model: '', reverse_proxy: '', temp_openai: 0.4, openai_max_tokens: 700 },
    },
});

const DEFAULT_CHAT_AGENT_STATE = Object.freeze({
    enabled: false,
    services: {
        [agent_service_ids.RETRIEVAL]: { enabled: true },
        [agent_service_ids.MEMORY]: { enabled: true },
        [agent_service_ids.LOREBOOK]: { enabled: false },
    },
    memory: {
        summary: '',
        facts: [],
        unresolved_threads: [],
        updated_at: null,
    },
    last_runs: {},
    director: {
        last_turn: null,
    },
});

let currentAgentAbortController = null;
let currentAgentRun = null;
let currentDirectorTurn = null;

const renderAgentPanelDebounced = debounce(() => renderAgentPanel(), 50);

function cloneDefaultChatState() {
    return structuredClone(DEFAULT_CHAT_AGENT_STATE);
}

function cloneDefaultGlobalSettings() {
    return structuredClone(DEFAULT_GLOBAL_AGENT_SETTINGS);
}

function ensureAgentSettings() {
    if (!extension_settings.agentMode || typeof extension_settings.agentMode !== 'object') {
        extension_settings.agentMode = cloneDefaultGlobalSettings();
        return extension_settings.agentMode;
    }

    const defaults = cloneDefaultGlobalSettings();
    extension_settings.agentMode.services = {
        ...defaults.services,
        ...(extension_settings.agentMode.services ?? {}),
    };
    extension_settings.agentMode.profiles = {
        ...defaults.profiles,
        ...(extension_settings.agentMode.profiles ?? {}),
    };

    for (const serviceId of Object.values(agent_service_ids)) {
        extension_settings.agentMode.services[serviceId] = {
            ...defaults.services[serviceId],
            ...(extension_settings.agentMode.services[serviceId] ?? {}),
        };
        extension_settings.agentMode.profiles[serviceId] = {
            ...defaults.profiles[serviceId],
            ...(extension_settings.agentMode.profiles[serviceId] ?? {}),
        };
    }

    return extension_settings.agentMode;
}

function ensureAgentChatState() {
    if (!chat_metadata[AGENT_METADATA_KEY] || typeof chat_metadata[AGENT_METADATA_KEY] !== 'object') {
        chat_metadata[AGENT_METADATA_KEY] = cloneDefaultChatState();
        return chat_metadata[AGENT_METADATA_KEY];
    }

    const defaults = cloneDefaultChatState();
    chat_metadata[AGENT_METADATA_KEY] = {
        ...defaults,
        ...chat_metadata[AGENT_METADATA_KEY],
        services: {
            ...defaults.services,
            ...(chat_metadata[AGENT_METADATA_KEY].services ?? {}),
        },
        memory: {
            ...defaults.memory,
            ...(chat_metadata[AGENT_METADATA_KEY].memory ?? {}),
        },
        last_runs: {
            ...(chat_metadata[AGENT_METADATA_KEY].last_runs ?? {}),
        },
        director: {
            ...defaults.director,
            ...(chat_metadata[AGENT_METADATA_KEY].director ?? {}),
        },
    };

    for (const serviceId of Object.values(agent_service_ids)) {
        chat_metadata[AGENT_METADATA_KEY].services[serviceId] = {
            ...defaults.services[serviceId],
            ...(chat_metadata[AGENT_METADATA_KEY].services[serviceId] ?? {}),
        };
    }

    return chat_metadata[AGENT_METADATA_KEY];
}

function getAgentChatState() {
    return ensureAgentChatState();
}

function getAgentDirectorState() {
    return getAgentChatState().director;
}

function getGlobalAgentSettings() {
    return ensureAgentSettings();
}

function setAgentServiceEnabled(serviceId, enabled) {
    const state = getAgentChatState();
    state.services[serviceId].enabled = Boolean(enabled);
    saveMetadataDebounced();
    renderAgentPanelDebounced();
}

function setAgentModeEnabled(enabled) {
    const state = getAgentChatState();
    state.enabled = Boolean(enabled);
    saveMetadataDebounced();
    renderAgentPanelDebounced();
}

function setAgentMemory(memoryPatch) {
    const state = getAgentChatState();
    state.memory = {
        ...state.memory,
        ...memoryPatch,
    };
}

function recordAgentRun(serviceId, patch) {
    const state = getAgentChatState();
    state.last_runs[serviceId] = {
        service: serviceId,
        updated_at: new Date().toISOString(),
        ...(state.last_runs[serviceId] ?? {}),
        ...patch,
    };
    renderAgentPanelDebounced();
}

function getServiceProfile(serviceId) {
    const globalSettings = getGlobalAgentSettings();
    return globalSettings.profiles[serviceId];
}

function getServiceRuntimeConfig(serviceId) {
    const globalSettings = getGlobalAgentSettings();
    const chatState = getAgentChatState();

    return {
        ...globalSettings.services[serviceId],
        enabled: Boolean(chatState.services[serviceId]?.enabled),
    };
}

function isAgentModeAvailable() {
    return Boolean(getCurrentChatId()) && main_api === 'openai';
}

function getServiceSkipReason(serviceId, { phase, dryRun = false, depth = 0 } = {}) {
    if (dryRun) {
        return 'Skipped during dry run';
    }

    if (depth > 0) {
        return 'Skipped on nested generation';
    }

    if (!getCurrentChatId()) {
        return 'No active chat';
    }

    if (main_api !== 'openai') {
        return 'Requires chat-completions mode';
    }

    const state = getAgentChatState();
    if (!state.enabled) {
        return 'Agent Mode is disabled for this chat';
    }

    if (!state.services[serviceId]?.enabled) {
        return `${SERVICE_LABELS[serviceId]} is disabled`;
    }

    if (phase === agent_director_phases.PRE_GENERATION && serviceId !== agent_service_ids.RETRIEVAL) {
        return 'Not scheduled for pre-generation';
    }

    return null;
}

function getServiceRunReason(serviceId, phase) {
    if (phase === agent_director_phases.PRE_GENERATION && serviceId === agent_service_ids.RETRIEVAL) {
        return 'Inject relevant context before the next reply';
    }

    if (phase === agent_director_phases.POST_GENERATION && serviceId === agent_service_ids.MEMORY) {
        return 'Capture durable memory after the reply';
    }

    if (phase === agent_director_phases.POST_GENERATION && serviceId === agent_service_ids.LOREBOOK) {
        return 'Sync durable lore after the reply';
    }

    return 'Scheduled by the turn director';
}

function cloneDirectorTurn(turn) {
    return turn ? structuredClone(turn) : null;
}

function setCurrentDirectorTurn(turn) {
    currentDirectorTurn = cloneDirectorTurn(turn);
    renderAgentPanelDebounced();
}

function finalizeDirectorTurn(turn) {
    const directorState = getAgentDirectorState();
    directorState.last_turn = cloneDirectorTurn(turn);
    currentDirectorTurn = null;
    saveMetadataDebounced();
    renderAgentPanelDebounced();
}

function getLatestDirectorTurn() {
    return currentDirectorTurn ?? getAgentDirectorState().last_turn ?? null;
}

function createDirectorServiceRun(serviceId, phase, status, reason) {
    const timestamp = new Date().toISOString();
    return {
        serviceId,
        label: SERVICE_LABELS[serviceId],
        phase,
        status,
        reason,
        summary: '',
        steps: 0,
        error: null,
        started_at: timestamp,
        completed_at: status === 'running' ? null : timestamp,
    };
}

function createDirectorTurn(phase, { dryRun = false, depth = 0 } = {}) {
    return {
        id: uuidv4(),
        phase,
        status: 'running',
        dry_run: Boolean(dryRun),
        depth: Number(depth || 0),
        started_at: new Date().toISOString(),
        completed_at: null,
        summary: '',
        services: [],
    };
}

function getDirectorPhaseLabel(phase) {
    if (phase === agent_director_phases.PRE_GENERATION) {
        return 'Pre-generation';
    }

    if (phase === agent_director_phases.POST_GENERATION) {
        return 'Post-generation';
    }

    return 'Agent turn';
}

function buildDirectorSummary(turn) {
    return turn.services
        .map(service => `${service.label} ${service.status}`)
        .join('; ');
}

async function runDirectedService(turn, serviceId, handler, { phase } = {}) {
    const serviceRun = createDirectorServiceRun(serviceId, phase, 'running', getServiceRunReason(serviceId, phase));
    turn.services.push(serviceRun);
    setCurrentDirectorTurn(turn);

    try {
        const result = await handler();
        serviceRun.status = String(result?.status ?? 'completed');
        serviceRun.summary = truncateText(result?.summary ?? '', 200);
        serviceRun.steps = Number(result?.steps ?? 0);
        serviceRun.error = result?.error ? summarizeError(result.error) : null;
        serviceRun.completed_at = new Date().toISOString();
        setCurrentDirectorTurn(turn);
        return result;
    } catch (error) {
        const errorMessage = summarizeError(error);
        console.error(`[AgentMode] ${serviceId} failed`, error);
        toastr.warning(`${SERVICE_LABELS[serviceId]} agent failed: ${errorMessage}`, t`Agent Mode`);
        serviceRun.status = 'failed';
        serviceRun.error = errorMessage;
        serviceRun.completed_at = new Date().toISOString();
        setCurrentDirectorTurn(turn);
        return null;
    }
}

async function runAgentDirectorTurn(phase, services, { dryRun = false, depth = 0 } = {}) {
    const turn = createDirectorTurn(phase, { dryRun, depth });
    const results = {};

    setCurrentDirectorTurn(turn);

    for (const serviceId of services) {
        const skipReason = getServiceSkipReason(serviceId, { phase, dryRun, depth });
        if (skipReason) {
            turn.services.push(createDirectorServiceRun(serviceId, phase, 'skipped', skipReason));
            setCurrentDirectorTurn(turn);
            continue;
        }

        results[serviceId] = await runDirectedService(turn, serviceId, () => {
            switch (serviceId) {
                case agent_service_ids.RETRIEVAL:
                    return runRetrievalAgent();
                case agent_service_ids.MEMORY:
                    return runMemoryAgent();
                case agent_service_ids.LOREBOOK:
                    return runLorebookAgent();
                default:
                    throw new Error(`Unknown directed service "${serviceId}"`);
            }
        }, { phase });
    }

    turn.completed_at = new Date().toISOString();

    if (turn.services.every(service => service.status === 'skipped')) {
        turn.status = 'skipped';
    } else if (turn.services.some(service => service.status === 'failed')) {
        turn.status = 'failed';
    } else {
        turn.status = 'completed';
    }

    turn.summary = buildDirectorSummary(turn);
    finalizeDirectorTurn(turn);

    return { turn, results };
}

function createPromptExtension(value, role = extension_prompt_roles.SYSTEM) {
    return {
        value,
        position: extension_prompt_types.IN_PROMPT,
        depth: 0,
        scan: false,
        role,
        filter: null,
    };
}

function getCurrentCharacterName() {
    return this_chid !== undefined ? characters[this_chid]?.name ?? name2 : name2;
}

function summarizeError(error) {
    if (!error) {
        return 'Unknown agent error';
    }

    if (typeof error === 'string') {
        return error;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return JSON.stringify(error);
}

function toArray(value) {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

function truncateText(value, maxLength = 300) {
    const text = String(value ?? '').trim();
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength - 1)}…`;
}

function normalizeStringArray(value) {
    return toArray(value)
        .map(item => String(item ?? '').trim())
        .filter(Boolean)
        .filter(onlyUnique);
}

function getProfileModelSettingKey(source) {
    return MODEL_SETTING_KEYS[source] ?? MODEL_SETTING_KEYS[chat_completion_sources.OPENAI];
}

function applyProfileModel(agentSettings, source, model) {
    const modelKey = getProfileModelSettingKey(source);
    if (typeof model === 'string' && model.trim().length > 0) {
        agentSettings[modelKey] = model.trim();
    }
}

function buildAgentSettings(serviceId) {
    const profile = getServiceProfile(serviceId);
    const agentSettings = structuredClone(oai_settings);

    if (!profile.use_main) {
        agentSettings.chat_completion_source = profile.chat_completion_source || agentSettings.chat_completion_source;
        applyProfileModel(agentSettings, agentSettings.chat_completion_source, profile.model);
        agentSettings.reverse_proxy = String(profile.reverse_proxy ?? '').trim();
    }

    agentSettings.stream_openai = false;
    agentSettings.function_calling = false;
    agentSettings.n = 1;
    agentSettings.show_thoughts = false;
    agentSettings.enable_web_search = false;
    agentSettings.request_images = false;
    agentSettings.temp_openai = Number(profile.temp_openai ?? agentSettings.temp_openai);
    agentSettings.openai_max_tokens = Number(profile.openai_max_tokens ?? agentSettings.openai_max_tokens);

    return agentSettings;
}

function getCurrentMemoryState() {
    return getAgentChatState().memory;
}

function buildChatSearchCorpus() {
    return chat
        .map((message, index) => ({ message, index }))
        .filter(({ message }) => message && !message.is_system)
        .map(({ message, index }) => ({
            index,
            role: message.is_user ? 'user' : 'assistant',
            name: message.name ?? (message.is_user ? name1 : name2),
            content: String(message.mes ?? '').replace(/<[^>]+>/g, ' ').trim(),
        }))
        .filter(entry => entry.content.length > 0);
}

async function getAccessibleWorldBooks() {
    const books = [];

    if (Array.isArray(selected_world_info)) {
        books.push(...selected_world_info);
    }

    const chatWorld = chat_metadata[WORLD_INFO_METADATA_KEY];
    if (chatWorld) {
        books.push(chatWorld);
    }

    if (this_chid !== undefined) {
        const character = characters[this_chid];
        const primaryWorld = character?.data?.extensions?.world;
        if (primaryWorld) {
            books.push(primaryWorld);
        }

        const characterFileName = getCharaFilename(this_chid);
        const extraLore = world_info.charLore?.find(entry => entry.name === characterFileName);
        if (Array.isArray(extraLore?.extraBooks)) {
            books.push(...extraLore.extraBooks);
        }
    }

    return normalizeStringArray(books);
}

async function getAccessibleWorldEntries() {
    const books = await getAccessibleWorldBooks();
    const entries = [];

    for (const bookName of books) {
        const data = await loadWorldInfo(bookName);
        const worldEntries = Object.values(data?.entries ?? {});

        for (const entry of worldEntries) {
            if (!entry || entry.disable || entry[AGENT_BLACKLIST_FIELD]) {
                continue;
            }

            entries.push({
                bookName,
                uid: entry.uid,
                comment: entry.comment || `Entry ${entry.uid}`,
                content: String(entry.content ?? ''),
                key: normalizeStringArray(entry.key),
                keysecondary: normalizeStringArray(entry.keysecondary),
            });
        }
    }

    return entries;
}

function normalizeToolCalls(data) {
    if (Array.isArray(data?.choices?.[0]?.message?.tool_calls)) {
        return data.choices[0].message.tool_calls;
    }

    if (data?.message?.tool_calls) {
        return Array.isArray(data.message.tool_calls) ? data.message.tool_calls : [data.message.tool_calls];
    }

    if (Array.isArray(data?.content)) {
        const toolCalls = data.content
            .filter(item => item?.type === 'tool_use')
            .map(item => ({
                id: item.id || uuidv4(),
                function: {
                    name: item.name,
                    arguments: item.input ?? {},
                },
            }));
        if (toolCalls.length > 0) {
            return toolCalls;
        }
    }

    const googleParts = data?.candidates?.[0]?.content?.parts ?? data?.responseContent?.parts ?? [];
    const googleToolCalls = googleParts
        .filter(part => part?.functionCall?.name)
        .map(part => ({
            id: uuidv4(),
            function: {
                name: part.functionCall.name,
                arguments: part.functionCall.args ?? {},
            },
        }));

    if (googleToolCalls.length > 0) {
        return googleToolCalls;
    }

    return [];
}

function toolResultToContent(result) {
    return typeof result === 'string' ? result : JSON.stringify(result);
}

async function sendAgentCompletionRequest(agentSettings, messages, customTools, signal) {
    const model = getChatCompletionModel(agentSettings);

    if (!model) {
        throw new Error('Agent profile is missing a model.');
    }

    const { generate_data } = await createGenerationParameters(agentSettings, model, 'normal', messages);

    if (Array.isArray(customTools) && customTools.length > 0) {
        generate_data.tools = customTools;
        generate_data.tool_choice = 'auto';
    }

    const response = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST',
        body: JSON.stringify(generate_data),
        headers: getRequestHeaders(),
        signal,
    });

    if (!response.ok) {
        let details = response.statusText;
        try {
            details = await response.text();
        } catch {
            // Do nothing.
        }
        throw new Error(`Agent request failed (${response.status}): ${details}`);
    }

    return await response.json();
}

function withAgentAbortController(signal) {
    currentAgentAbortController = new AbortController();
    currentAgentRun = true;

    if (signal instanceof AbortSignal) {
        signal.addEventListener('abort', () => currentAgentAbortController?.abort(signal.reason), { once: true });
    }

    return currentAgentAbortController;
}

function clearAgentAbortController() {
    currentAgentAbortController = null;
    currentAgentRun = null;
}

function buildAgentMessages(systemPrompt, userPrompt) {
    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
}

async function executeAgentLoop(serviceId, systemPrompt, userPrompt, tools, { signal } = {}) {
    const config = getServiceRuntimeConfig(serviceId);
    const agentSettings = buildAgentSettings(serviceId);
    const abortController = withAgentAbortController(signal);
    const messages = buildAgentMessages(systemPrompt, userPrompt);
    const toolMap = new Map(tools.map(tool => [tool.name, tool]));
    const openAiTools = tools.map(tool => tool.definition);
    let lastText = '';
    let steps = 0;

    recordAgentRun(serviceId, { status: 'running', summary: '', steps: 0, error: null });
    await eventSource.emit(event_types.AGENT_SERVICE_STARTED, { serviceId });

    try {
        while (steps < config.maxSteps) {
            steps += 1;
            await eventSource.emit(event_types.AGENT_STEP_UPDATED, { serviceId, step: steps });

            const response = await sendAgentCompletionRequest(agentSettings, messages, openAiTools, abortController.signal);
            const assistantText = extractMessageFromData(response, 'openai');
            const toolCalls = normalizeToolCalls(response);
            lastText = assistantText || lastText;

            if (!toolCalls.length) {
                recordAgentRun(serviceId, { status: 'completed', summary: truncateText(assistantText, 200), steps, error: null });
                await eventSource.emit(event_types.AGENT_SERVICE_FINISHED, { serviceId, steps, summary: assistantText });
                return { steps, text: assistantText, terminalResult: null };
            }

            messages.push({
                role: 'assistant',
                content: assistantText ?? '',
                tool_calls: toolCalls,
            });

            for (const toolCall of toolCalls) {
                const toolName = toolCall?.function?.name;
                const tool = toolMap.get(toolName);

                if (!tool) {
                    throw new Error(`Unknown agent tool "${toolName}"`);
                }

                let toolArguments = toolCall.function.arguments ?? {};
                if (typeof toolArguments === 'string' && toolArguments.trim().length > 0) {
                    toolArguments = JSON.parse(toolArguments);
                }

                await eventSource.emit(event_types.AGENT_TOOL_STARTED, { serviceId, toolName });
                const result = await tool.execute(toolArguments);
                await eventSource.emit(event_types.AGENT_TOOL_FINISHED, { serviceId, toolName, result });

                if (tool.terminal) {
                    recordAgentRun(serviceId, { status: 'completed', summary: truncateText(result.summary || assistantText, 200), steps, error: null });
                    await eventSource.emit(event_types.AGENT_SERVICE_FINISHED, { serviceId, steps, summary: result.summary || assistantText });
                    return { steps, text: assistantText, terminalResult: result };
                }

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id || uuidv4(),
                    content: toolResultToContent(result),
                });
            }
        }

        recordAgentRun(serviceId, { status: 'stopped', summary: truncateText(lastText, 200), steps, error: 'Max steps reached' });
        await eventSource.emit(event_types.AGENT_SERVICE_FINISHED, { serviceId, steps, summary: lastText, reason: 'max_steps' });
        return { steps, text: lastText, terminalResult: null };
    } catch (error) {
        const errorMessage = summarizeError(error);
        recordAgentRun(serviceId, { status: 'failed', summary: '', steps, error: errorMessage });
        await eventSource.emit(event_types.AGENT_SERVICE_FAILED, { serviceId, steps, error: errorMessage });
        throw error;
    } finally {
        clearAgentAbortController();
    }
}

function createAgentTool(name, description, parameters, execute, { terminal = false } = {}) {
    return {
        name,
        definition: {
            type: 'function',
            function: {
                name,
                description,
                parameters,
            },
        },
        execute,
        terminal,
    };
}

async function runRetrievalAgent() {
    const worldEntries = await getAccessibleWorldEntries();
    const chatCorpus = buildChatSearchCorpus();
    const memory = getCurrentMemoryState();
    const resultLimit = getServiceRuntimeConfig(agent_service_ids.RETRIEVAL).resultLimit;
    const worldFuse = new Fuse(worldEntries, {
        keys: ['comment', 'content', 'key', 'keysecondary', 'bookName'],
        threshold: 0.3,
        ignoreLocation: true,
    });
    const chatFuse = new Fuse(chatCorpus, {
        keys: ['content', 'name', 'role'],
        threshold: 0.35,
        ignoreLocation: true,
    });

    const tools = [
        createAgentTool(
            'search_world_info',
            'Search the available lorebooks/world info by query and return the most relevant matching entries.',
            {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    limit: { type: 'integer', minimum: 1, maximum: 10 },
                },
                required: ['query'],
            },
            async ({ query, limit = resultLimit }) => {
                return worldFuse.search(String(query ?? ''), { limit: Number(limit) || resultLimit }).map(({ item }) => ({
                    book: item.bookName,
                    uid: item.uid,
                    title: item.comment,
                    primary_keywords: item.key,
                    secondary_keywords: item.keysecondary,
                    content: truncateText(item.content, 500),
                }));
            },
        ),
        createAgentTool(
            'search_chat_history',
            'Search the recent chat history for relevant prior messages.',
            {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    limit: { type: 'integer', minimum: 1, maximum: 10 },
                },
                required: ['query'],
            },
            async ({ query, limit = resultLimit }) => {
                return chatFuse.search(String(query ?? ''), { limit: Number(limit) || resultLimit }).map(({ item }) => ({
                    index: item.index,
                    role: item.role,
                    name: item.name,
                    content: truncateText(item.content, 400),
                }));
            },
        ),
        createAgentTool(
            'read_memory',
            'Read the current durable memory for this chat.',
            {
                type: 'object',
                properties: {},
            },
            async () => ({
                summary: memory.summary,
                facts: normalizeStringArray(memory.facts),
                unresolved_threads: normalizeStringArray(memory.unresolved_threads),
            }),
        ),
        createAgentTool(
            'finish_retrieval',
            'Finish retrieval and provide a concise context block that can be injected into the next assistant prompt.',
            {
                type: 'object',
                properties: {
                    summary: { type: 'string' },
                    prompt_section: { type: 'string' },
                },
                required: ['summary', 'prompt_section'],
            },
            async ({ summary, prompt_section }) => ({
                summary: String(summary ?? ''),
                promptSection: String(prompt_section ?? ''),
            }),
            { terminal: true },
        ),
    ];

    const recentMessages = chatCorpus.slice(-8).map(item => `${item.name}: ${truncateText(item.content, 180)}`).join('\n');
    const memorySummary = memory.summary || 'No durable memory saved yet.';

    const systemPrompt = [
        'You are the Retrieval Agent for a roleplay/chat application.',
        'Use tools to gather only the most relevant background needed for the assistant to answer the current turn well.',
        'Prefer precise lore and recent unresolved context over broad summaries.',
        'Never invent facts.',
        'When done, call finish_retrieval with:',
        '- a short summary',
        '- a prompt_section containing concise bullet-like context for the assistant',
    ].join('\n');

    const userPrompt = [
        `Current user: ${name1}`,
        `Current character: ${getCurrentCharacterName()}`,
        `Current durable memory:\n${memorySummary}`,
        `Recent messages:\n${recentMessages || '(no recent chat found)'}`,
        `World info entries available: ${worldEntries.length}`,
        'Retrieve only what is likely to matter for the next reply.',
    ].join('\n\n');

    const result = await executeAgentLoop(agent_service_ids.RETRIEVAL, systemPrompt, userPrompt, tools);
    const terminalResult = result.terminalResult ?? {
        summary: result.text || '',
        promptSection: result.text ? `Relevant context:\n${result.text}` : '',
    };

    return {
        status: 'completed',
        steps: result.steps,
        summary: terminalResult.summary,
        promptSection: terminalResult.promptSection,
    };
}

async function runMemoryAgent() {
    const memory = getCurrentMemoryState();
    const recentMessages = buildChatSearchCorpus().slice(-12).map(item => `${item.name}: ${truncateText(item.content, 220)}`).join('\n');

    const tools = [
        createAgentTool(
            'finish_memory_update',
            'Finish the memory update with a compact durable summary and short lists of lasting facts and unresolved threads.',
            {
                type: 'object',
                properties: {
                    summary: { type: 'string' },
                    facts: { type: 'array', items: { type: 'string' } },
                    unresolved_threads: { type: 'array', items: { type: 'string' } },
                },
                required: ['summary'],
            },
            async ({ summary, facts = [], unresolved_threads = [] }) => ({
                summary: String(summary ?? ''),
                facts: normalizeStringArray(facts).slice(0, 8),
                unresolved_threads: normalizeStringArray(unresolved_threads).slice(0, 8),
            }),
            { terminal: true },
        ),
    ];

    const systemPrompt = [
        'You are the Memory Agent for a roleplay/chat application.',
        'Capture only durable facts that should persist across future turns.',
        'Do not store chain-of-thought, transient phrasing, or one-off stylistic details.',
        'When done, call finish_memory_update.',
    ].join('\n');

    const userPrompt = [
        `Existing memory summary:\n${memory.summary || '(empty)'}`,
        `Existing facts:\n${normalizeStringArray(memory.facts).join('\n') || '(none)'}`,
        `Existing unresolved threads:\n${normalizeStringArray(memory.unresolved_threads).join('\n') || '(none)'}`,
        `Recent conversation:\n${recentMessages || '(no recent chat found)'}`,
        'Update the durable memory for this chat.',
    ].join('\n\n');

    const result = await executeAgentLoop(agent_service_ids.MEMORY, systemPrompt, userPrompt, tools);
    const terminalResult = result.terminalResult ?? {
        summary: result.text || memory.summary || '',
        facts: normalizeStringArray(memory.facts),
        unresolved_threads: normalizeStringArray(memory.unresolved_threads),
    };

    setAgentMemory({
        summary: terminalResult.summary,
        facts: terminalResult.facts,
        unresolved_threads: terminalResult.unresolved_threads,
        updated_at: new Date().toISOString(),
    });
    await eventSource.emit(event_types.AGENT_MEMORY_UPDATED, { memory: getCurrentMemoryState() });

    return {
        status: 'completed',
        steps: result.steps,
        summary: terminalResult.summary,
    };
}

async function runLorebookAgent() {
    const bookNames = await getAccessibleWorldBooks();

    if (!bookNames.length) {
        recordAgentRun(agent_service_ids.LOREBOOK, { status: 'skipped', summary: 'No active lorebooks', steps: 0, error: null });
        return {
            status: 'skipped',
            steps: 0,
            summary: 'No active lorebooks',
            changes: [],
        };
    }

    const workingBooks = new Map();
    const pendingChanges = [];

    for (const bookName of bookNames) {
        const data = await loadWorldInfo(bookName);
        if (data) {
            workingBooks.set(bookName, structuredClone(data));
        }
    }

    const searchableEntries = [];
    for (const [bookName, data] of workingBooks.entries()) {
        for (const entry of Object.values(data.entries ?? {})) {
            if (!entry || entry[AGENT_BLACKLIST_FIELD]) {
                continue;
            }

            searchableEntries.push({
                bookName,
                uid: entry.uid,
                comment: entry.comment || `Entry ${entry.uid}`,
                content: String(entry.content ?? ''),
                key: normalizeStringArray(entry.key),
                keysecondary: normalizeStringArray(entry.keysecondary),
            });
        }
    }

    const entryFuse = new Fuse(searchableEntries, {
        keys: ['comment', 'content', 'key', 'keysecondary', 'bookName'],
        threshold: 0.3,
        ignoreLocation: true,
    });

    const tools = [
        createAgentTool(
            'list_lorebooks',
            'List the currently active lorebooks and their editable entry counts.',
            {
                type: 'object',
                properties: {},
            },
            async () => {
                return Array.from(workingBooks.entries()).map(([bookName, data]) => ({
                    book: bookName,
                    entry_count: Object.values(data.entries ?? {}).filter(entry => entry && !entry[AGENT_BLACKLIST_FIELD]).length,
                }));
            },
        ),
        createAgentTool(
            'search_lore_entries',
            'Search editable lorebook entries by query.',
            {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    limit: { type: 'integer', minimum: 1, maximum: 10 },
                },
                required: ['query'],
            },
            async ({ query, limit = 5 }) => {
                return entryFuse.search(String(query ?? ''), { limit: Number(limit) || 5 }).map(({ item }) => ({
                    book: item.bookName,
                    uid: item.uid,
                    title: item.comment,
                    primary_keywords: item.key,
                    secondary_keywords: item.keysecondary,
                    content: truncateText(item.content, 500),
                }));
            },
        ),
        createAgentTool(
            'create_lore_entry',
            'Create a new editable lorebook entry in one of the active lorebooks.',
            {
                type: 'object',
                properties: {
                    book: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    primary_keywords: { type: 'array', items: { type: 'string' } },
                    secondary_keywords: { type: 'array', items: { type: 'string' } },
                },
                required: ['book', 'title', 'content', 'primary_keywords'],
            },
            async ({ book, title, content, primary_keywords = [], secondary_keywords = [] }) => {
                const bookName = String(book ?? '').trim();
                const data = workingBooks.get(bookName);
                if (!data) {
                    throw new Error(`Lorebook "${bookName}" is not available.`);
                }

                const entry = createWorldInfoEntry(bookName, data);
                if (!entry) {
                    throw new Error(`Could not create an entry in "${bookName}".`);
                }

                entry.comment = String(title ?? '').trim();
                entry.content = String(content ?? '').trim();
                entry.key = normalizeStringArray(primary_keywords);
                entry.keysecondary = normalizeStringArray(secondary_keywords);
                entry[AGENT_BLACKLIST_FIELD] = false;

                pendingChanges.push({ type: 'create', book: bookName, uid: entry.uid, title: entry.comment });

                return {
                    created: true,
                    book: bookName,
                    uid: entry.uid,
                    title: entry.comment,
                };
            },
        ),
        createAgentTool(
            'update_lore_entry',
            'Update an editable lorebook entry in one of the active lorebooks.',
            {
                type: 'object',
                properties: {
                    book: { type: 'string' },
                    uid: { type: 'integer' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    primary_keywords: { type: 'array', items: { type: 'string' } },
                    secondary_keywords: { type: 'array', items: { type: 'string' } },
                },
                required: ['book', 'uid'],
            },
            async ({ book, uid, title, content, primary_keywords, secondary_keywords }) => {
                const bookName = String(book ?? '').trim();
                const data = workingBooks.get(bookName);
                const entry = data?.entries?.[uid];

                if (!entry) {
                    throw new Error(`Entry ${uid} was not found in "${bookName}".`);
                }

                if (entry[AGENT_BLACKLIST_FIELD]) {
                    throw new Error(`Entry ${uid} in "${bookName}" is agent-blacklisted.`);
                }

                if (typeof title === 'string' && title.trim().length > 0) {
                    entry.comment = title.trim();
                }

                if (typeof content === 'string' && content.trim().length > 0) {
                    entry.content = content.trim();
                }

                if (primary_keywords !== undefined) {
                    entry.key = normalizeStringArray(primary_keywords);
                }

                if (secondary_keywords !== undefined) {
                    entry.keysecondary = normalizeStringArray(secondary_keywords);
                }

                pendingChanges.push({ type: 'update', book: bookName, uid: entry.uid, title: entry.comment });

                return {
                    updated: true,
                    book: bookName,
                    uid: entry.uid,
                    title: entry.comment,
                };
            },
        ),
        createAgentTool(
            'finish_lorebook_update',
            'Finish the lorebook maintenance run with a concise summary.',
            {
                type: 'object',
                properties: {
                    summary: { type: 'string' },
                },
                required: ['summary'],
            },
            async ({ summary }) => ({
                summary: String(summary ?? ''),
            }),
            { terminal: true },
        ),
    ];

    const recentMessages = buildChatSearchCorpus().slice(-10).map(item => `${item.name}: ${truncateText(item.content, 220)}`).join('\n');
    const memory = getCurrentMemoryState();

    const systemPrompt = [
        'You are the Lorebook Agent for a roleplay/chat application.',
        'Use tools to create or update only durable lore that should persist beyond the current scene.',
        'Do not store fleeting emotions or wording-only changes.',
        'Do not touch blacklisted entries.',
        'Finish by calling finish_lorebook_update.',
    ].join('\n');

    const userPrompt = [
        `Active lorebooks: ${bookNames.join(', ')}`,
        `Current durable memory:\n${memory.summary || '(none)'}`,
        `Recent conversation:\n${recentMessages || '(no recent chat found)'}`,
        'Review whether the latest conversation creates or changes durable world knowledge.',
    ].join('\n\n');

    const result = await executeAgentLoop(agent_service_ids.LOREBOOK, systemPrompt, userPrompt, tools);
    const terminalResult = result.terminalResult ?? { summary: result.text || '' };

    if (pendingChanges.length > 0) {
        for (const [bookName, data] of workingBooks.entries()) {
            await saveWorldInfo(bookName, data, true);
        }
    }

    return {
        status: 'completed',
        steps: result.steps,
        summary: terminalResult.summary,
        changes: pendingChanges,
    };
}

async function runServiceSafely(serviceId, handler, { saveAfter = false } = {}) {
    try {
        const result = await handler();
        if (saveAfter) {
            await saveChatConditional();
        }
        return result;
    } catch (error) {
        console.error(`[AgentMode] ${serviceId} failed`, error);
        toastr.warning(`${SERVICE_LABELS[serviceId]} agent failed: ${summarizeError(error)}`, t`Agent Mode`);
        return null;
    }
}

export async function runPreGenerationAgents({ dryRun, depth } = {}) {
    if (dryRun || depth > 0) {
        return {};
    }

    const { results } = await runAgentDirectorTurn(
        agent_director_phases.PRE_GENERATION,
        [agent_service_ids.RETRIEVAL],
        { dryRun, depth },
    );

    const retrievalResult = results[agent_service_ids.RETRIEVAL];
    if (!retrievalResult?.promptSection) {
        return {};
    }

    return {
        [AGENT_CONTEXT_PROMPT_KEY]: createPromptExtension(retrievalResult.promptSection),
    };
}

export async function runPostGenerationAgents({ depth } = {}) {
    if (depth > 0) {
        return;
    }

    const { turn } = await runAgentDirectorTurn(
        agent_director_phases.POST_GENERATION,
        [agent_service_ids.MEMORY, agent_service_ids.LOREBOOK],
        { depth },
    );

    if (turn.status !== 'skipped') {
        await saveChatConditional();
    }
}

async function runLorebookSyncFromUi() {
    if (!isAgentModeAvailable()) {
        toastr.info(t`Agent mode only runs in chat-completions mode with an active chat.`, t`Agent Mode`);
        return;
    }

    if (!getAgentChatState().enabled) {
        toastr.info(t`Enable Agent Mode for this chat first.`, t`Agent Mode`);
        return;
    }

    await runServiceSafely(agent_service_ids.LOREBOOK, () => runLorebookAgent(), { saveAfter: true });
}

async function clearAgentMemoryFromUi() {
    const confirmation = await Popup.show.confirm(t`Clear agent memory for this chat?`, t`This only removes agent memory, not your chat history.`);
    if (!confirmation) {
        return;
    }

    setAgentMemory({
        summary: '',
        facts: [],
        unresolved_threads: [],
        updated_at: null,
    });
    recordAgentRun(agent_service_ids.MEMORY, { status: 'cleared', summary: '', steps: 0, error: null });
    await saveChatConditional();
    renderAgentPanelDebounced();
}

function getProfileFieldId(serviceId, field) {
    return `#agent_profile_${serviceId}_${field}`;
}

function populateSourceSelect($select) {
    if ($select.children().length > 0) {
        return;
    }

    for (const source of AGENT_SOURCES) {
        const option = document.createElement('option');
        option.value = source;
        option.textContent = SOURCE_LABELS[source] ?? source;
        $select.append(option);
    }
}

function updateProfileInputState(serviceId) {
    const profile = getServiceProfile(serviceId);
    const disabled = Boolean(profile.use_main);
    $(getProfileFieldId(serviceId, 'source')).prop('disabled', disabled);
    $(getProfileFieldId(serviceId, 'model')).prop('disabled', disabled);
    $(getProfileFieldId(serviceId, 'reverse_proxy')).prop('disabled', disabled);
}

function renderStatusList() {
    const $container = $('#agent_status_list');
    if ($container.length === 0) {
        return;
    }

    $container.empty();
    const lastRuns = getAgentChatState().last_runs ?? {};
    const directorTurn = getLatestDirectorTurn();

    if (directorTurn) {
        const row = $('<div class="flex-container flexFlowColumn marginBot5"></div>');
        const headline = $('<strong></strong>').text(AGENT_DIRECTOR_LABEL);
        const detailParts = [
            getDirectorPhaseLabel(directorTurn.phase),
            directorTurn.status,
        ];

        if (directorTurn.summary) {
            detailParts.push(truncateText(directorTurn.summary, 180));
        }

        const status = $('<small></small>').text(detailParts.filter(Boolean).join(', '));
        row.append(headline, status);
        $container.append(row);
    }

    for (const serviceId of Object.values(agent_service_ids)) {
        const directedRun = directorTurn?.services?.find(service => service.serviceId === serviceId);
        const run = directedRun ?? lastRuns[serviceId];
        const row = $('<div class="flex-container flexFlowColumn marginBot5"></div>');
        const headline = $('<strong></strong>').text(SERVICE_LABELS[serviceId]);
        const statusText = run
            ? `${run.status || 'idle'}${run.reason ? `, ${run.reason}` : ''}${run.steps ? `, ${run.steps} step${run.steps === 1 ? '' : 's'}` : ''}${run.summary ? `, ${truncateText(run.summary, 120)}` : ''}${run.error ? `, ${run.error}` : ''}`
            : 'idle';
        const status = $('<small></small>').text(statusText);
        row.append(headline, status);
        $container.append(row);
    }

    if (currentAgentRun && !currentDirectorTurn) {
        $container.prepend($('<div class="menu_button marginBot5"></div>').text('Agent service running...'));
    }
}

function renderAgentPanel() {
    if ($('#agent_mode_panel').length === 0) {
        return;
    }

    ensureAgentSettings();
    ensureAgentChatState();

    const state = getAgentChatState();
    const available = isAgentModeAvailable();
    const hasChat = Boolean(getCurrentChatId());

    $('#agent_mode_enabled').prop('checked', Boolean(state.enabled));
    $('#agent_service_retrieval').prop('checked', Boolean(state.services[agent_service_ids.RETRIEVAL]?.enabled));
    $('#agent_service_memory').prop('checked', Boolean(state.services[agent_service_ids.MEMORY]?.enabled));
    $('#agent_service_lorebook').prop('checked', Boolean(state.services[agent_service_ids.LOREBOOK]?.enabled));
    $('#agent_memory_summary').val(state.memory.summary || '');

    const availabilityText = !hasChat
        ? t`Open a chat to configure per-chat agent mode.`
        : !available
            ? t`Agent mode currently runs only through chat-completions providers.`
            : t`The turn director runs retrieval before the next reply, then memory and lorebook after the reply is saved.`;
    $('#agent_mode_status_hint').text(availabilityText);

    for (const serviceId of Object.values(agent_service_ids)) {
        const profile = getServiceProfile(serviceId);
        populateSourceSelect($(getProfileFieldId(serviceId, 'source')));
        $(getProfileFieldId(serviceId, 'use_main')).prop('checked', Boolean(profile.use_main));
        $(getProfileFieldId(serviceId, 'source')).val(profile.chat_completion_source || chat_completion_sources.OPENAI);
        $(getProfileFieldId(serviceId, 'model')).val(profile.model || '');
        $(getProfileFieldId(serviceId, 'reverse_proxy')).val(profile.reverse_proxy || '');
        $(getProfileFieldId(serviceId, 'temp')).val(Number(profile.temp_openai ?? 0.7));
        $(getProfileFieldId(serviceId, 'tokens')).val(Number(profile.openai_max_tokens ?? 500));
        updateProfileInputState(serviceId);
    }

    renderStatusList();
}

function bindProfileField(serviceId, field, mutator) {
    const $field = $(getProfileFieldId(serviceId, field));
    $field.on('input change', function () {
        const profile = getServiceProfile(serviceId);
        mutator(profile, $(this));
        saveSettingsDebounced();
        renderAgentPanelDebounced();
    });
}

function copyMainProfileToAllAgents() {
    const globalSettings = getGlobalAgentSettings();
    const model = getChatCompletionModel(oai_settings) ?? '';

    for (const serviceId of Object.values(agent_service_ids)) {
        globalSettings.profiles[serviceId] = {
            ...globalSettings.profiles[serviceId],
            use_main: false,
            chat_completion_source: oai_settings.chat_completion_source,
            model,
            reverse_proxy: oai_settings.reverse_proxy || '',
            temp_openai: Number(oai_settings.temp_openai),
            openai_max_tokens: Number(oai_settings.openai_max_tokens),
        };
    }

    saveSettingsDebounced();
    renderAgentPanelDebounced();
}

function bindAgentPanel() {
    $('#agent_mode_enabled').on('input', function () {
        setAgentModeEnabled($(this).prop('checked'));
    });
    $('#agent_service_retrieval').on('input', function () {
        setAgentServiceEnabled(agent_service_ids.RETRIEVAL, $(this).prop('checked'));
    });
    $('#agent_service_memory').on('input', function () {
        setAgentServiceEnabled(agent_service_ids.MEMORY, $(this).prop('checked'));
    });
    $('#agent_service_lorebook').on('input', function () {
        setAgentServiceEnabled(agent_service_ids.LOREBOOK, $(this).prop('checked'));
    });

    $('#agent_copy_main_profile').on('click', copyMainProfileToAllAgents);
    $('#agent_clear_memory').on('click', () => void clearAgentMemoryFromUi());
    $('#agent_run_lorebook').on('click', () => void runLorebookSyncFromUi());

    for (const serviceId of Object.values(agent_service_ids)) {
        bindProfileField(serviceId, 'use_main', (profile, $input) => {
            profile.use_main = $input.prop('checked');
        });
        bindProfileField(serviceId, 'source', (profile, $input) => {
            profile.chat_completion_source = String($input.val());
        });
        bindProfileField(serviceId, 'model', (profile, $input) => {
            profile.model = String($input.val());
        });
        bindProfileField(serviceId, 'reverse_proxy', (profile, $input) => {
            profile.reverse_proxy = String($input.val());
        });
        bindProfileField(serviceId, 'temp', (profile, $input) => {
            profile.temp_openai = Number($input.val());
        });
        bindProfileField(serviceId, 'tokens', (profile, $input) => {
            profile.openai_max_tokens = Number($input.val());
        });
    }
}

export function initAgents() {
    ensureAgentSettings();
    ensureAgentChatState();
    bindAgentPanel();

    eventSource.on(event_types.CHAT_CHANGED, renderAgentPanelDebounced);
    eventSource.on(event_types.SETTINGS_LOADED_AFTER, renderAgentPanelDebounced);
    eventSource.on(event_types.GENERATION_STOPPED, () => {
        currentAgentAbortController?.abort('Generation stopped');
    });
    eventSource.on(event_types.AGENT_SERVICE_STARTED, renderAgentPanelDebounced);
    eventSource.on(event_types.AGENT_STEP_UPDATED, renderAgentPanelDebounced);
    eventSource.on(event_types.AGENT_SERVICE_FINISHED, renderAgentPanelDebounced);
    eventSource.on(event_types.AGENT_SERVICE_FAILED, renderAgentPanelDebounced);
    eventSource.on(event_types.AGENT_MEMORY_UPDATED, renderAgentPanelDebounced);

    renderAgentPanel();
}
