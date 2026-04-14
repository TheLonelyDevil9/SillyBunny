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
import { debounce, getCharaFilename, onlyUnique, parseJsonFile, uuidv4 } from './utils.js';
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
const MAX_MEMORY_FACTS = 12;
const MAX_MEMORY_THREADS = 12;
const MAX_MEMORY_CHAPTERS = 8;
const MAX_MEMORY_CHAPTER_SUMMARY_LENGTH = 500;
const MAX_STORY_STATE_CHARACTERS = 10;
const MAX_STORY_STATE_LOCATIONS = 8;
const MAX_STORY_STATE_INVENTORY = 12;
const MAX_STORY_STATE_PLOT_THREADS = 10;
const MAX_STORY_STATE_FIELD_LENGTH = 220;
const MAX_LORE_REVIEW_CHANGES = 16;
const MAX_LORE_CHANGE_CONTENT_LENGTH = 2400;
const LORE_MATCH_SCORE_THRESHOLD = 0.14;
const MAX_TURN_UX_SUGGESTIONS = 5;
const MAX_TURN_UX_RECAP_SECTIONS = 4;

const AGENT_PRESET_SETTING_ALIASES = Object.freeze({
    temperature: 'temp_openai',
    frequency_penalty: 'freq_pen_openai',
    presence_penalty: 'pres_pen_openai',
    top_p: 'top_p_openai',
    top_k: 'top_k_openai',
    min_p: 'min_p_openai',
    top_a: 'top_a_openai',
    repetition_penalty: 'repetition_penalty_openai',
});

const AGENT_PRESET_NUMERIC_SETTINGS = new Set([
    'temp_openai',
    'freq_pen_openai',
    'pres_pen_openai',
    'top_p_openai',
    'top_k_openai',
    'min_p_openai',
    'top_a_openai',
    'repetition_penalty_openai',
    'openai_max_tokens',
    'seed',
]);

const AGENT_PRESET_BOOLEAN_SETTINGS = new Set([
    'show_thoughts',
    'enable_web_search',
    'use_sysprompt',
]);

const AGENT_PRESET_STRING_SETTINGS = new Set([
    'reasoning_effort',
    'verbosity',
    'assistant_prefill',
    'assistant_impersonation',
]);

const AGENT_PRESET_SETTING_KEYS = new Set([
    ...AGENT_PRESET_NUMERIC_SETTINGS,
    ...AGENT_PRESET_BOOLEAN_SETTINGS,
    ...AGENT_PRESET_STRING_SETTINGS,
]);

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
    preset: {
        name: '',
        settings_overrides: {},
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
        chapters: [],
        updated_at: null,
    },
    story_state: {
        current_location: '',
        current_time: '',
        characters: [],
        locations: [],
        inventory: [],
        plot_threads: [],
        updated_at: null,
    },
    lorebook: {
        review_mode: false,
        pending_changes: [],
        last_proposed_changes: [],
        last_applied_changes: [],
        updated_at: null,
    },
    turn_ux: {
        enabled: true,
        headline: '',
        suggestions: [],
        recap_sections: [],
        source_turn_id: null,
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

function cloneDefaultAgentPreset() {
    return structuredClone(DEFAULT_GLOBAL_AGENT_SETTINGS.preset);
}

function normalizeAgentPresetValue(key, value) {
    if (AGENT_PRESET_NUMERIC_SETTINGS.has(key)) {
        const number = Number(value);
        return Number.isFinite(number) ? number : undefined;
    }

    if (AGENT_PRESET_BOOLEAN_SETTINGS.has(key)) {
        return Boolean(value);
    }

    if (AGENT_PRESET_STRING_SETTINGS.has(key)) {
        return String(value ?? '').trim();
    }

    return undefined;
}

function normalizeAgentPresetSettingsOverrides(overrides) {
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
        return {};
    }

    const normalized = {};

    for (const [rawKey, rawValue] of Object.entries(overrides)) {
        const key = AGENT_PRESET_SETTING_ALIASES[rawKey] ?? rawKey;
        if (!AGENT_PRESET_SETTING_KEYS.has(key)) {
            continue;
        }

        const value = normalizeAgentPresetValue(key, rawValue);
        if (value !== undefined) {
            normalized[key] = value;
        }
    }

    return normalized;
}

function normalizeAgentPresetConfig(preset) {
    const defaults = cloneDefaultAgentPreset();

    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) {
        return defaults;
    }

    return {
        ...defaults,
        name: String(preset.name ?? defaults.name).trim(),
        settings_overrides: normalizeAgentPresetSettingsOverrides(preset.settings_overrides),
    };
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
    extension_settings.agentMode.preset = normalizeAgentPresetConfig(extension_settings.agentMode.preset);
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
        story_state: {
            ...defaults.story_state,
            ...(chat_metadata[AGENT_METADATA_KEY].story_state ?? {}),
        },
        lorebook: {
            ...defaults.lorebook,
            ...(chat_metadata[AGENT_METADATA_KEY].lorebook ?? {}),
        },
        turn_ux: {
            ...defaults.turn_ux,
            ...(chat_metadata[AGENT_METADATA_KEY].turn_ux ?? {}),
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

    chat_metadata[AGENT_METADATA_KEY].memory.summary = String(chat_metadata[AGENT_METADATA_KEY].memory.summary ?? '').trim();
    chat_metadata[AGENT_METADATA_KEY].memory.facts = normalizeStringArray(chat_metadata[AGENT_METADATA_KEY].memory.facts).slice(0, MAX_MEMORY_FACTS);
    chat_metadata[AGENT_METADATA_KEY].memory.unresolved_threads = normalizeStringArray(chat_metadata[AGENT_METADATA_KEY].memory.unresolved_threads).slice(0, MAX_MEMORY_THREADS);
    chat_metadata[AGENT_METADATA_KEY].memory.chapters = normalizeMemoryChapters(chat_metadata[AGENT_METADATA_KEY].memory.chapters);
    chat_metadata[AGENT_METADATA_KEY].memory.updated_at = normalizeMemoryTimestamp(chat_metadata[AGENT_METADATA_KEY].memory.updated_at);
    chat_metadata[AGENT_METADATA_KEY].story_state = normalizeStoryState(chat_metadata[AGENT_METADATA_KEY].story_state);
    chat_metadata[AGENT_METADATA_KEY].lorebook = normalizeLorebookState(chat_metadata[AGENT_METADATA_KEY].lorebook);
    chat_metadata[AGENT_METADATA_KEY].turn_ux = normalizeTurnUxState(chat_metadata[AGENT_METADATA_KEY].turn_ux);

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
    const nextMemory = {
        ...state.memory,
        ...memoryPatch,
    };
    state.memory = {
        ...nextMemory,
        summary: String(nextMemory.summary ?? '').trim(),
        facts: normalizeStringArray(nextMemory.facts).slice(0, MAX_MEMORY_FACTS),
        unresolved_threads: normalizeStringArray(nextMemory.unresolved_threads).slice(0, MAX_MEMORY_THREADS),
        chapters: normalizeMemoryChapters(nextMemory.chapters),
        updated_at: normalizeMemoryTimestamp(nextMemory.updated_at),
    };
}

function setAgentStoryState(storyStatePatch) {
    const state = getAgentChatState();
    const nextStoryState = {
        ...state.story_state,
        ...storyStatePatch,
    };
    state.story_state = normalizeStoryState(nextStoryState);
}

function setAgentLorebookState(lorebookPatch) {
    const state = getAgentChatState();
    const nextLorebookState = {
        ...state.lorebook,
        ...lorebookPatch,
    };
    state.lorebook = normalizeLorebookState(nextLorebookState);
}

function setAgentTurnUxState(turnUxPatch) {
    const state = getAgentChatState();
    const nextTurnUxState = {
        ...state.turn_ux,
        ...turnUxPatch,
    };
    state.turn_ux = normalizeTurnUxState(nextTurnUxState);
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
        proposed_count: 0,
        applied_count: 0,
        pending_count: 0,
        skipped_count: 0,
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
        serviceRun.proposed_count = Number(result?.proposedChanges?.length ?? result?.proposed_count ?? 0);
        serviceRun.applied_count = Number(result?.appliedChanges?.length ?? result?.applied_count ?? 0);
        serviceRun.pending_count = Number(result?.pendingChanges?.length ?? result?.pending_count ?? 0);
        serviceRun.skipped_count = Number(result?.skippedChanges?.length ?? result?.skipped_count ?? 0);
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

function normalizeMemoryTimestamp(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeChapterTitle(value, fallbackIndex = 0) {
    const title = String(value ?? '').trim();
    return title.length > 0 ? truncateText(title, 80) : `Chapter ${fallbackIndex + 1}`;
}

function normalizeChapterSummary(value) {
    return truncateText(value, MAX_MEMORY_CHAPTER_SUMMARY_LENGTH);
}

function normalizeMemoryChapters(value) {
    const seen = new Set();

    return toArray(value)
        .map((item, index) => {
            const chapter = item && typeof item === 'object' ? item : { summary: item };
            const title = normalizeChapterTitle(chapter.title, index);
            const summary = normalizeChapterSummary(chapter.summary);
            const keywords = normalizeStringArray(chapter.keywords).slice(0, 8);

            if (!summary) {
                return null;
            }

            const dedupeKey = `${title.toLowerCase()}::${summary.toLowerCase()}`;
            if (seen.has(dedupeKey)) {
                return null;
            }

            seen.add(dedupeKey);
            return {
                title,
                summary,
                keywords,
            };
        })
        .filter(Boolean)
        .slice(-MAX_MEMORY_CHAPTERS);
}

function formatMemoryChaptersForPrompt(chapters) {
    const normalizedChapters = normalizeMemoryChapters(chapters);
    if (!normalizedChapters.length) {
        return '(none)';
    }

    return normalizedChapters
        .map((chapter, index) => {
            const keywords = chapter.keywords.length > 0 ? chapter.keywords.join(', ') : '(none)';
            return `${index + 1}. ${chapter.title}\nSummary: ${chapter.summary}\nKeywords: ${keywords}`;
        })
        .join('\n\n');
}

function normalizeStoryStateText(value, maxLength = MAX_STORY_STATE_FIELD_LENGTH) {
    return truncateText(value, maxLength);
}

function normalizeStoryStateCharacters(value) {
    const seen = new Set();

    return toArray(value)
        .map(item => {
            const character = item && typeof item === 'object' ? item : { name: item };
            const name = normalizeStoryStateText(character.name, 80);
            const role = normalizeStoryStateText(character.role, 120);
            const status = normalizeStoryStateText(character.status, 140);
            const goal = normalizeStoryStateText(character.goal, 160);

            if (!name) {
                return null;
            }

            const dedupeKey = name.toLowerCase();
            if (seen.has(dedupeKey)) {
                return null;
            }

            seen.add(dedupeKey);
            return {
                name,
                role,
                status,
                goal,
            };
        })
        .filter(Boolean)
        .slice(0, MAX_STORY_STATE_CHARACTERS);
}

function normalizeStoryStateLocations(value) {
    const seen = new Set();

    return toArray(value)
        .map(item => {
            const location = item && typeof item === 'object' ? item : { name: item };
            const name = normalizeStoryStateText(location.name, 90);
            const summary = normalizeStoryStateText(location.summary, 180);

            if (!name) {
                return null;
            }

            const dedupeKey = name.toLowerCase();
            if (seen.has(dedupeKey)) {
                return null;
            }

            seen.add(dedupeKey);
            return {
                name,
                summary,
            };
        })
        .filter(Boolean)
        .slice(0, MAX_STORY_STATE_LOCATIONS);
}

function normalizeStoryStateInventory(value) {
    const seen = new Set();

    return toArray(value)
        .map(item => {
            const inventoryItem = item && typeof item === 'object' ? item : { name: item };
            const name = normalizeStoryStateText(inventoryItem.name, 90);
            const holder = normalizeStoryStateText(inventoryItem.holder, 90);
            const summary = normalizeStoryStateText(inventoryItem.summary, 160);

            if (!name) {
                return null;
            }

            const dedupeKey = `${name.toLowerCase()}::${holder.toLowerCase()}`;
            if (seen.has(dedupeKey)) {
                return null;
            }

            seen.add(dedupeKey);
            return {
                name,
                holder,
                summary,
            };
        })
        .filter(Boolean)
        .slice(0, MAX_STORY_STATE_INVENTORY);
}

function normalizeStoryStatePlotThreads(value) {
    const seen = new Set();

    return toArray(value)
        .map(item => {
            const plotThread = item && typeof item === 'object' ? item : { title: item };
            const title = normalizeStoryStateText(plotThread.title, 100);
            const status = normalizeStoryStateText(plotThread.status, 80);
            const summary = normalizeStoryStateText(plotThread.summary, 180);

            if (!title) {
                return null;
            }

            const dedupeKey = title.toLowerCase();
            if (seen.has(dedupeKey)) {
                return null;
            }

            seen.add(dedupeKey);
            return {
                title,
                status,
                summary,
            };
        })
        .filter(Boolean)
        .slice(0, MAX_STORY_STATE_PLOT_THREADS);
}

function normalizeStoryState(value) {
    const storyState = value && typeof value === 'object' ? value : {};

    return {
        current_location: normalizeStoryStateText(storyState.current_location, 120),
        current_time: normalizeStoryStateText(storyState.current_time, 120),
        characters: normalizeStoryStateCharacters(storyState.characters),
        locations: normalizeStoryStateLocations(storyState.locations),
        inventory: normalizeStoryStateInventory(storyState.inventory),
        plot_threads: normalizeStoryStatePlotThreads(storyState.plot_threads),
        updated_at: normalizeMemoryTimestamp(storyState.updated_at),
    };
}

function formatStoryStateCollectionForPrompt(title, entries, formatter) {
    if (!entries.length) {
        return `${title}:\n(none)`;
    }

    return `${title}:\n${entries.map((entry, index) => `${index + 1}. ${formatter(entry)}`).join('\n')}`;
}

function formatStoryStateForPrompt(storyState) {
    const normalizedStoryState = normalizeStoryState(storyState);

    return [
        `Current location: ${normalizedStoryState.current_location || '(unknown)'}`,
        `Current time: ${normalizedStoryState.current_time || '(unspecified)'}`,
        formatStoryStateCollectionForPrompt('Characters', normalizedStoryState.characters, character => [
            character.name,
            character.role ? `role: ${character.role}` : '',
            character.status ? `status: ${character.status}` : '',
            character.goal ? `goal: ${character.goal}` : '',
        ].filter(Boolean).join(' | ')),
        formatStoryStateCollectionForPrompt('Locations', normalizedStoryState.locations, location => [
            location.name,
            location.summary ? `summary: ${location.summary}` : '',
        ].filter(Boolean).join(' | ')),
        formatStoryStateCollectionForPrompt('Inventory', normalizedStoryState.inventory, inventoryItem => [
            inventoryItem.name,
            inventoryItem.holder ? `holder: ${inventoryItem.holder}` : '',
            inventoryItem.summary ? `summary: ${inventoryItem.summary}` : '',
        ].filter(Boolean).join(' | ')),
        formatStoryStateCollectionForPrompt('Plot threads', normalizedStoryState.plot_threads, plotThread => [
            plotThread.title,
            plotThread.status ? `status: ${plotThread.status}` : '',
            plotThread.summary ? `summary: ${plotThread.summary}` : '',
        ].filter(Boolean).join(' | ')),
    ].join('\n\n');
}

function normalizeLoreChangeAction(value, fallback = 'create') {
    const action = String(value ?? '').trim().toLowerCase();
    return action === 'update' ? 'update' : fallback;
}

function normalizeLoreChangeUid(value) {
    const uid = Number(value);
    return Number.isInteger(uid) && uid >= 0 ? uid : null;
}

function normalizeLoreChange(value) {
    const change = value && typeof value === 'object' ? value : {};
    const normalizedUid = normalizeLoreChangeUid(change.uid);
    const explicitTitle = truncateText(change.title, 140);
    const normalizedTitle = explicitTitle || (normalizedUid !== null ? `Entry ${normalizedUid}` : '');

    return {
        id: String(change.id ?? uuidv4()),
        status: String(change.status ?? 'proposed').trim() || 'proposed',
        requested_action: normalizeLoreChangeAction(change.requested_action ?? change.action ?? 'create'),
        resolved_action: normalizeLoreChangeAction(change.resolved_action ?? change.requested_action ?? change.action ?? 'create'),
        book: String(change.book ?? '').trim(),
        uid: normalizedUid,
        title: normalizedTitle,
        has_explicit_title: Boolean(explicitTitle),
        content: truncateText(change.content, MAX_LORE_CHANGE_CONTENT_LENGTH),
        primary_keywords: normalizeStringArray(change.primary_keywords).slice(0, 12),
        secondary_keywords: normalizeStringArray(change.secondary_keywords).slice(0, 12),
        reason: truncateText(change.reason, 220),
        resolution_note: truncateText(change.resolution_note, 220),
        created_at: normalizeMemoryTimestamp(change.created_at) ?? new Date().toISOString(),
    };
}

function normalizeLoreChangeList(value, maxLength = MAX_LORE_REVIEW_CHANGES) {
    const seen = new Set();

    return toArray(value)
        .map(item => normalizeLoreChange(item))
        .filter(change => change.book && (change.title || change.uid !== null) && change.content)
        .filter(change => {
            const dedupeKey = `${change.resolved_action}:${change.book.toLowerCase()}:${change.uid ?? change.title.toLowerCase()}:${change.content.toLowerCase()}`;
            if (seen.has(dedupeKey)) {
                return false;
            }

            seen.add(dedupeKey);
            return true;
        })
        .slice(-maxLength);
}

function normalizeLorebookState(value) {
    const lorebookState = value && typeof value === 'object' ? value : {};

    return {
        review_mode: Boolean(lorebookState.review_mode),
        pending_changes: normalizeLoreChangeList(lorebookState.pending_changes, MAX_LORE_REVIEW_CHANGES),
        last_proposed_changes: normalizeLoreChangeList(lorebookState.last_proposed_changes, MAX_LORE_REVIEW_CHANGES),
        last_applied_changes: normalizeLoreChangeList(lorebookState.last_applied_changes, MAX_LORE_REVIEW_CHANGES),
        updated_at: normalizeMemoryTimestamp(lorebookState.updated_at),
    };
}

function getLoreChangeKey(change) {
    const normalizedChange = normalizeLoreChange(change);
    return `${normalizedChange.resolved_action}:${normalizedChange.book.toLowerCase()}:${normalizedChange.uid ?? normalizedChange.title.toLowerCase()}`;
}

function summarizeLoreChange(change) {
    const normalizedChange = normalizeLoreChange(change);
    const action = normalizedChange.resolved_action === 'update' ? 'Update' : 'Create';
    return [
        `${action} ${normalizedChange.book}:${normalizedChange.title}`,
        normalizedChange.uid !== null ? `uid ${normalizedChange.uid}` : '',
        normalizedChange.reason ? `Reason: ${normalizedChange.reason}` : '',
        normalizedChange.resolution_note,
    ].filter(Boolean).join(' | ');
}

function buildLorebookRunSummary({ proposedChanges = [], appliedChanges = [], pendingChanges = [], skippedChanges = [] } = {}) {
    const parts = [];

    if (proposedChanges.length > 0) {
        parts.push(`${proposedChanges.length} proposed`);
    }

    if (appliedChanges.length > 0) {
        parts.push(`${appliedChanges.length} applied`);
    }

    if (pendingChanges.length > 0) {
        parts.push(`${pendingChanges.length} pending review`);
    }

    if (skippedChanges.length > 0) {
        parts.push(`${skippedChanges.length} skipped`);
    }

    if (parts.length === 0) {
        return 'No lore changes proposed';
    }

    return parts.join(', ');
}

function normalizeTurnUxText(value, maxLength = 220) {
    return truncateText(value, maxLength);
}

function normalizeTurnUxSuggestions(value) {
    return toArray(value)
        .map(item => normalizeTurnUxText(item, 200))
        .filter(Boolean)
        .filter(onlyUnique)
        .slice(0, MAX_TURN_UX_SUGGESTIONS);
}

function normalizeTurnUxRecapSection(value) {
    const section = value && typeof value === 'object' ? value : {};

    return {
        title: normalizeTurnUxText(section.title, 80),
        detail: normalizeTurnUxText(section.detail, 260),
    };
}

function normalizeTurnUxRecapSections(value) {
    const seen = new Set();

    return toArray(value)
        .map(item => normalizeTurnUxRecapSection(item))
        .filter(section => section.title && section.detail)
        .filter(section => {
            const dedupeKey = `${section.title.toLowerCase()}::${section.detail.toLowerCase()}`;
            if (seen.has(dedupeKey)) {
                return false;
            }

            seen.add(dedupeKey);
            return true;
        })
        .slice(0, MAX_TURN_UX_RECAP_SECTIONS);
}

function normalizeTurnUxState(value) {
    const turnUxState = value && typeof value === 'object' ? value : {};

    return {
        enabled: turnUxState.enabled !== false,
        headline: normalizeTurnUxText(turnUxState.headline, 180),
        suggestions: normalizeTurnUxSuggestions(turnUxState.suggestions),
        recap_sections: normalizeTurnUxRecapSections(turnUxState.recap_sections),
        source_turn_id: typeof turnUxState.source_turn_id === 'string' && turnUxState.source_turn_id.trim().length > 0 ? turnUxState.source_turn_id : null,
        updated_at: normalizeMemoryTimestamp(turnUxState.updated_at),
    };
}

function isClosedPlotThreadStatus(status) {
    const normalizedStatus = String(status ?? '').trim().toLowerCase();
    if (!normalizedStatus) {
        return false;
    }

    return ['closed', 'complete', 'completed', 'resolved', 'finished', 'done'].some(keyword => normalizedStatus.includes(keyword));
}

function buildTurnUxSuggestions({ memory, storyState }) {
    const suggestions = [];

    for (const thread of normalizeStringArray(memory.unresolved_threads)) {
        suggestions.push(`Follow up on ${thread}.`);
    }

    for (const plotThread of normalizeStoryStatePlotThreads(storyState.plot_threads).filter(thread => !isClosedPlotThreadStatus(thread.status))) {
        suggestions.push(`Advance "${plotThread.title}".`);
    }

    for (const character of normalizeStoryStateCharacters(storyState.characters)) {
        if (character.goal) {
            suggestions.push(`Ask ${character.name} about ${character.goal}.`);
            continue;
        }

        if (character.status) {
            suggestions.push(`Check in with ${character.name}.`);
        }
    }

    if (storyState.current_location) {
        suggestions.push(`Explore ${storyState.current_location}.`);
    }

    for (const inventoryItem of normalizeStoryStateInventory(storyState.inventory)) {
        const locationSuffix = storyState.current_location ? ` in ${storyState.current_location}` : '';
        suggestions.push(`Use ${inventoryItem.name}${locationSuffix}.`);
    }

    return normalizeTurnUxSuggestions(suggestions);
}

function buildTurnUxRecapSections({ memory, storyState, lorebookState, lastRuns }) {
    const sections = [];
    const memoryRun = lastRuns[agent_service_ids.MEMORY];
    const loreRun = lastRuns[agent_service_ids.LOREBOOK];

    if (memory.summary || memoryRun?.summary) {
        sections.push({
            title: 'Memory',
            detail: memory.summary || memoryRun.summary,
        });
    }

    const worldParts = [
        storyState.current_location ? `Location: ${storyState.current_location}` : '',
        storyState.current_time ? `Time: ${storyState.current_time}` : '',
        storyState.characters.length ? `${storyState.characters.length} tracked characters` : '',
        storyState.plot_threads.length ? `${storyState.plot_threads.length} plot threads` : '',
    ].filter(Boolean);
    if (worldParts.length > 0) {
        sections.push({
            title: 'World State',
            detail: worldParts.join(' | '),
        });
    }

    const loreParts = [
        loreRun?.applied_count ? `${loreRun.applied_count} lore change${loreRun.applied_count === 1 ? '' : 's'} applied` : '',
        loreRun?.pending_count ? `${loreRun.pending_count} lore change${loreRun.pending_count === 1 ? '' : 's'} pending review` : '',
        lorebookState.review_mode ? 'Review mode enabled' : '',
    ].filter(Boolean);
    if (loreParts.length > 0 || loreRun?.summary) {
        sections.push({
            title: 'Lore',
            detail: loreParts.length > 0 ? loreParts.join(' | ') : loreRun.summary,
        });
    }

    const promptingParts = [
        memory.unresolved_threads.length ? `${memory.unresolved_threads.length} unresolved thread${memory.unresolved_threads.length === 1 ? '' : 's'}` : '',
        storyState.inventory.length ? `${storyState.inventory.length} notable item${storyState.inventory.length === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    if (promptingParts.length > 0) {
        sections.push({
            title: 'Adventure Assist',
            detail: promptingParts.join(' | '),
        });
    }

    return normalizeTurnUxRecapSections(sections);
}

function buildTurnUxHeadline({ suggestions, lorebookState }) {
    const parts = [];

    if (suggestions.length > 0) {
        parts.push(`${suggestions.length} suggested next action${suggestions.length === 1 ? '' : 's'} ready`);
    }

    if (lorebookState.pending_changes.length > 0) {
        parts.push(`${lorebookState.pending_changes.length} lore change${lorebookState.pending_changes.length === 1 ? '' : 's'} waiting for review`);
    }

    return parts.length > 0 ? parts.join('; ') : 'Adventure assist is ready for the next turn.';
}

function refreshAgentTurnUxState({ sourceTurnId = null } = {}) {
    const memory = getCurrentMemoryState();
    const storyState = normalizeStoryState(getCurrentStoryState());
    const lorebookState = normalizeLorebookState(getCurrentLorebookState());
    const currentTurnUxState = normalizeTurnUxState(getCurrentTurnUxState());
    const lastRuns = getAgentChatState().last_runs ?? {};
    const suggestions = buildTurnUxSuggestions({ memory, storyState });
    const recapSections = buildTurnUxRecapSections({ memory, storyState, lorebookState, lastRuns });

    setAgentTurnUxState({
        headline: buildTurnUxHeadline({ suggestions, lorebookState }),
        suggestions,
        recap_sections: recapSections,
        source_turn_id: sourceTurnId ?? currentTurnUxState.source_turn_id,
        updated_at: new Date().toISOString(),
    });
}

function getProfileModelSettingKey(source) {
    return MODEL_SETTING_KEYS[source] ?? MODEL_SETTING_KEYS[chat_completion_sources.OPENAI];
}

function getGlobalAgentPreset() {
    return getGlobalAgentSettings().preset;
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
    const preset = getGlobalAgentPreset();

    if (preset && Object.keys(preset.settings_overrides).length > 0) {
        Object.assign(agentSettings, structuredClone(preset.settings_overrides));
    }

    if (!profile.use_main) {
        agentSettings.chat_completion_source = profile.chat_completion_source || agentSettings.chat_completion_source;
        applyProfileModel(agentSettings, agentSettings.chat_completion_source, profile.model);
        agentSettings.reverse_proxy = String(profile.reverse_proxy ?? '').trim();
    }

    agentSettings.stream_openai = false;
    agentSettings.function_calling = false;
    agentSettings.n = 1;
    agentSettings.request_images = false;
    agentSettings.temp_openai = Number(profile.temp_openai ?? agentSettings.temp_openai);
    agentSettings.openai_max_tokens = Number(profile.openai_max_tokens ?? agentSettings.openai_max_tokens);

    return agentSettings;
}

function getCurrentMemoryState() {
    return getAgentChatState().memory;
}

function getCurrentStoryState() {
    return getAgentChatState().story_state;
}

function getCurrentLorebookState() {
    return getAgentChatState().lorebook;
}

function getCurrentTurnUxState() {
    return getAgentChatState().turn_ux;
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

async function loadAccessibleLorebookWorkspace() {
    const bookNames = await getAccessibleWorldBooks();
    const workingBooks = new Map();

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
        includeScore: true,
    });

    return {
        bookNames,
        workingBooks,
        searchableEntries,
        entryFuse,
    };
}

function findBestLoreEntryMatch(searchableEntries, entryFuse, proposal) {
    const normalizedProposal = normalizeLoreChange(proposal);
    const requestedBook = normalizedProposal.book.toLowerCase();
    const requestedUid = normalizedProposal.uid;
    const requestedTitle = normalizedProposal.title.toLowerCase();

    if (requestedUid !== null) {
        const directUidMatch = searchableEntries.find(entry => entry.bookName.toLowerCase() === requestedBook && Number(entry.uid) === requestedUid);
        if (directUidMatch) {
            return { entry: directUidMatch, resolutionNote: 'Matched the requested lore entry by UID.' };
        }
    }

    if (requestedTitle) {
        const exactTitleMatch = searchableEntries.find(entry => entry.bookName.toLowerCase() === requestedBook && String(entry.comment ?? '').trim().toLowerCase() === requestedTitle);
        if (exactTitleMatch) {
            return { entry: exactTitleMatch, resolutionNote: 'Matched an existing lore entry with the same title.' };
        }

        const exactTitleAnywhere = searchableEntries.find(entry => String(entry.comment ?? '').trim().toLowerCase() === requestedTitle);
        if (exactTitleAnywhere) {
            return { entry: exactTitleAnywhere, resolutionNote: `Matched an existing lore entry with the same title in "${exactTitleAnywhere.bookName}".` };
        }
    }

    const query = [
        normalizedProposal.title,
        ...normalizedProposal.primary_keywords,
        ...normalizedProposal.secondary_keywords,
    ].filter(Boolean).join(' ');

    if (!query) {
        return { entry: null, resolutionNote: '' };
    }

    const fuseResults = entryFuse.search(query, { limit: 5 });
    const sameBookResult = fuseResults.find(result => result.item.bookName.toLowerCase() === requestedBook && (result.score ?? 1) <= LORE_MATCH_SCORE_THRESHOLD);
    if (sameBookResult) {
        return {
            entry: sameBookResult.item,
            resolutionNote: `Matched a similar existing lore entry in "${sameBookResult.item.bookName}".`,
        };
    }

    const anyBookResult = fuseResults.find(result => (result.score ?? 1) <= LORE_MATCH_SCORE_THRESHOLD);
    if (anyBookResult) {
        return {
            entry: anyBookResult.item,
            resolutionNote: `Matched a similar existing lore entry in "${anyBookResult.item.bookName}".`,
        };
    }

    return { entry: null, resolutionNote: '' };
}

function resolveLoreChangeProposals(proposals, searchableEntries, entryFuse) {
    const resolvedChanges = [];
    const seen = new Set();

    for (const proposal of normalizeLoreChangeList(proposals, MAX_LORE_REVIEW_CHANGES * 2)) {
        const resolvedChange = normalizeLoreChange({
            ...proposal,
            status: 'proposed',
        });

        const { entry, resolutionNote } = findBestLoreEntryMatch(searchableEntries, entryFuse, resolvedChange);

        if (resolvedChange.requested_action === 'create') {
            if (entry) {
                resolvedChange.resolved_action = 'update';
                resolvedChange.book = entry.bookName;
                resolvedChange.uid = Number(entry.uid);
                resolvedChange.resolution_note = resolutionNote || 'Converted create request into an update for an existing entry.';
            } else {
                resolvedChange.resolved_action = 'create';
                resolvedChange.resolution_note = 'No close existing entry matched, so this remains a create.';
            }
        } else {
            if (entry) {
                resolvedChange.resolved_action = 'update';
                resolvedChange.book = entry.bookName;
                resolvedChange.uid = Number(entry.uid);
                if (!resolvedChange.title) {
                    resolvedChange.title = entry.comment || `Entry ${entry.uid}`;
                }
                resolvedChange.resolution_note = resolutionNote || 'Update target confirmed.';
            } else if (resolvedChange.has_explicit_title) {
                resolvedChange.resolved_action = 'create';
                resolvedChange.uid = null;
                resolvedChange.resolution_note = 'Update target was not found, so this was converted into a new entry.';
            } else {
                resolvedChange.status = 'skipped';
                resolvedChange.resolution_note = 'Update target was not found, and no replacement title was provided.';
            }
        }

        const changeKey = getLoreChangeKey(resolvedChange);
        if (seen.has(changeKey)) {
            resolvedChange.status = 'skipped';
            resolvedChange.resolution_note = 'Duplicate lore proposal skipped.';
        } else {
            seen.add(changeKey);
        }

        resolvedChanges.push(resolvedChange);
    }

    return resolvedChanges.slice(-MAX_LORE_REVIEW_CHANGES);
}

function applyLoreChangesToWorkspace(workingBooks, resolvedChanges) {
    const appliedChanges = [];
    const skippedChanges = [];
    const changedBooks = new Set();

    for (const resolvedChange of normalizeLoreChangeList(resolvedChanges, MAX_LORE_REVIEW_CHANGES * 2)) {
        if (resolvedChange.status === 'skipped') {
            skippedChanges.push(resolvedChange);
            continue;
        }

        const data = workingBooks.get(resolvedChange.book);
        if (!data) {
            skippedChanges.push(normalizeLoreChange({
                ...resolvedChange,
                status: 'skipped',
                resolution_note: `Lorebook "${resolvedChange.book}" is no longer available.`,
            }));
            continue;
        }

        if (resolvedChange.resolved_action === 'update') {
            const entry = data.entries?.[resolvedChange.uid];
            if (!entry || entry[AGENT_BLACKLIST_FIELD]) {
                skippedChanges.push(normalizeLoreChange({
                    ...resolvedChange,
                    status: 'skipped',
                    resolution_note: `Lore entry ${resolvedChange.uid} is not editable anymore.`,
                }));
                continue;
            }

            entry.comment = resolvedChange.title || entry.comment;
            entry.content = resolvedChange.content || entry.content;
            entry.key = normalizeStringArray(resolvedChange.primary_keywords);
            entry.keysecondary = normalizeStringArray(resolvedChange.secondary_keywords);

            appliedChanges.push(normalizeLoreChange({
                ...resolvedChange,
                status: 'applied',
                uid: Number(entry.uid),
            }));
            changedBooks.add(resolvedChange.book);
            continue;
        }

        const newEntry = createWorldInfoEntry(resolvedChange.book, data);
        if (!newEntry) {
            skippedChanges.push(normalizeLoreChange({
                ...resolvedChange,
                status: 'skipped',
                resolution_note: `Could not create a new lore entry in "${resolvedChange.book}".`,
            }));
            continue;
        }

        newEntry.comment = resolvedChange.title;
        newEntry.content = resolvedChange.content;
        newEntry.key = normalizeStringArray(resolvedChange.primary_keywords);
        newEntry.keysecondary = normalizeStringArray(resolvedChange.secondary_keywords);
        newEntry[AGENT_BLACKLIST_FIELD] = false;

        appliedChanges.push(normalizeLoreChange({
            ...resolvedChange,
            status: 'applied',
            uid: Number(newEntry.uid),
            resolved_action: 'create',
        }));
        changedBooks.add(resolvedChange.book);
    }

    return {
        appliedChanges,
        skippedChanges,
        changedBooks,
    };
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
    const storyState = getCurrentStoryState();
    const chapterCorpus = normalizeMemoryChapters(memory.chapters).map((chapter, index) => ({
        ...chapter,
        index,
    }));
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
    const chapterFuse = chapterCorpus.length > 0
        ? new Fuse(chapterCorpus, {
            keys: ['title', 'summary', 'keywords'],
            threshold: 0.32,
            ignoreLocation: true,
        })
        : null;

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
            'search_memory_chapters',
            'Search durable chapter summaries for older events, arcs, and long-horizon context.',
            {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                    limit: { type: 'integer', minimum: 1, maximum: 10 },
                },
                required: ['query'],
            },
            async ({ query, limit = resultLimit }) => {
                if (!chapterFuse) {
                    return [];
                }

                return chapterFuse.search(String(query ?? ''), { limit: Number(limit) || resultLimit }).map(({ item }) => ({
                    index: item.index,
                    title: item.title,
                    keywords: item.keywords,
                    summary: truncateText(item.summary, 400),
                }));
            },
        ),
        createAgentTool(
            'read_memory',
            'Read the current durable memory for this chat, including summary, facts, open threads, and chapter index info.',
            {
                type: 'object',
                properties: {},
            },
            async () => ({
                summary: memory.summary,
                facts: normalizeStringArray(memory.facts),
                unresolved_threads: normalizeStringArray(memory.unresolved_threads),
                chapter_count: chapterCorpus.length,
                chapter_titles: chapterCorpus.map(chapter => chapter.title),
            }),
        ),
        createAgentTool(
            'read_story_state',
            'Read the current structured story state for this chat, including location, time, characters, inventory, and plot threads.',
            {
                type: 'object',
                properties: {},
            },
            async () => normalizeStoryState(storyState),
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
    const chapterTitles = chapterCorpus.map(chapter => chapter.title).join(', ');
    const storyStateSummary = [
        storyState.current_location ? `location: ${storyState.current_location}` : '',
        storyState.current_time ? `time: ${storyState.current_time}` : '',
        storyState.characters.length ? `${storyState.characters.length} characters` : '',
        storyState.inventory.length ? `${storyState.inventory.length} inventory items` : '',
        storyState.plot_threads.length ? `${storyState.plot_threads.length} plot threads` : '',
    ].filter(Boolean).join(', ');

    const systemPrompt = [
        'You are the Retrieval Agent for a roleplay/chat application.',
        'Use tools to gather only the most relevant background needed for the assistant to answer the current turn well.',
        'Prefer precise lore and recent unresolved context over broad summaries.',
        'Prefer structured story state for current location, cast, inventory, quest, and time context when available.',
        'When recent chat is not enough, inspect durable chapter summaries before pulling large amounts of older context.',
        'Never invent facts.',
        'When done, call finish_retrieval with:',
        '- a short summary',
        '- a prompt_section containing concise bullet-like context for the assistant',
    ].join('\n');

    const userPrompt = [
        `Current user: ${name1}`,
        `Current character: ${getCurrentCharacterName()}`,
        `Current durable memory summary:\n${memorySummary}`,
        `Saved chapter summaries: ${chapterCorpus.length}`,
        `Chapter titles:\n${chapterTitles || '(none)'}`,
        `Structured story state snapshot:\n${storyStateSummary || '(none yet)'}`,
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
    const storyState = getCurrentStoryState();
    const existingChapters = normalizeMemoryChapters(memory.chapters);
    const existingStoryState = normalizeStoryState(storyState);
    const recentMessages = buildChatSearchCorpus().slice(-12).map(item => `${item.name}: ${truncateText(item.content, 220)}`).join('\n');

    const tools = [
        createAgentTool(
            'finish_memory_update',
            'Finish the memory update with a compact durable summary, short lists of lasting facts and unresolved threads, chapter summaries for older arcs, and updated structured story state.',
            {
                type: 'object',
                properties: {
                    summary: { type: 'string' },
                    facts: { type: 'array', items: { type: 'string' } },
                    unresolved_threads: { type: 'array', items: { type: 'string' } },
                    chapters: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                summary: { type: 'string' },
                                keywords: { type: 'array', items: { type: 'string' } },
                            },
                            required: ['summary'],
                        },
                    },
                    story_state: {
                        type: 'object',
                        properties: {
                            current_location: { type: 'string' },
                            current_time: { type: 'string' },
                            characters: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        role: { type: 'string' },
                                        status: { type: 'string' },
                                        goal: { type: 'string' },
                                    },
                                    required: ['name'],
                                },
                            },
                            locations: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        summary: { type: 'string' },
                                    },
                                    required: ['name'],
                                },
                            },
                            inventory: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        holder: { type: 'string' },
                                        summary: { type: 'string' },
                                    },
                                    required: ['name'],
                                },
                            },
                            plot_threads: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        status: { type: 'string' },
                                        summary: { type: 'string' },
                                    },
                                    required: ['title'],
                                },
                            },
                        },
                    },
                },
                required: ['summary'],
            },
            async ({ summary, facts, unresolved_threads, chapters, story_state }) => ({
                summary: String(summary ?? ''),
                facts: facts === undefined ? normalizeStringArray(memory.facts) : normalizeStringArray(facts).slice(0, MAX_MEMORY_FACTS),
                unresolved_threads: unresolved_threads === undefined ? normalizeStringArray(memory.unresolved_threads) : normalizeStringArray(unresolved_threads).slice(0, MAX_MEMORY_THREADS),
                chapters: chapters === undefined ? existingChapters : normalizeMemoryChapters(chapters),
                story_state: story_state === undefined ? existingStoryState : normalizeStoryState(story_state),
            }),
            { terminal: true },
        ),
    ];

    const systemPrompt = [
        'You are the Memory Agent for a roleplay/chat application.',
        'Capture only durable facts that should persist across future turns.',
        'Maintain three layers of memory: an overall summary, short durable fact/thread lists, and chapter summaries for older arcs or major transitions.',
        'Also maintain structured story state for current location, time, important characters, relevant locations, inventory, and plot threads.',
        'Prefer refreshing or merging chapter summaries over creating many tiny entries.',
        'Prefer updating existing story-state entries over creating duplicates with slightly different wording.',
        'Do not store chain-of-thought, transient phrasing, or one-off stylistic details.',
        'When done, call finish_memory_update.',
    ].join('\n');

    const userPrompt = [
        `Existing memory summary:\n${memory.summary || '(empty)'}`,
        `Existing facts:\n${normalizeStringArray(memory.facts).join('\n') || '(none)'}`,
        `Existing unresolved threads:\n${normalizeStringArray(memory.unresolved_threads).join('\n') || '(none)'}`,
        `Existing chapter summaries:\n${formatMemoryChaptersForPrompt(existingChapters)}`,
        `Existing structured story state:\n${formatStoryStateForPrompt(existingStoryState)}`,
        `Recent conversation:\n${recentMessages || '(no recent chat found)'}`,
        `Keep at most ${MAX_MEMORY_CHAPTERS} concise chapter summaries with keywords for retrieval.`,
        `Keep at most ${MAX_STORY_STATE_CHARACTERS} characters, ${MAX_STORY_STATE_LOCATIONS} locations, ${MAX_STORY_STATE_INVENTORY} inventory items, and ${MAX_STORY_STATE_PLOT_THREADS} plot threads.`,
        'Update the durable memory for this chat.',
    ].join('\n\n');

    const result = await executeAgentLoop(agent_service_ids.MEMORY, systemPrompt, userPrompt, tools);
    const terminalResult = result.terminalResult ?? {
        summary: result.text || memory.summary || '',
        facts: normalizeStringArray(memory.facts),
        unresolved_threads: normalizeStringArray(memory.unresolved_threads),
        chapters: existingChapters,
        story_state: existingStoryState,
    };

    setAgentMemory({
        summary: terminalResult.summary,
        facts: terminalResult.facts,
        unresolved_threads: terminalResult.unresolved_threads,
        chapters: terminalResult.chapters,
        updated_at: new Date().toISOString(),
    });
    setAgentStoryState({
        ...terminalResult.story_state,
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
    const {
        bookNames,
        workingBooks,
        searchableEntries,
        entryFuse,
    } = await loadAccessibleLorebookWorkspace();
    const lorebookState = getCurrentLorebookState();

    if (!bookNames.length) {
        recordAgentRun(agent_service_ids.LOREBOOK, { status: 'skipped', summary: 'No active lorebooks', steps: 0, error: null });
        return {
            status: 'skipped',
            steps: 0,
            summary: 'No active lorebooks',
            changes: [],
        };
    }

    const proposedChanges = [];

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
            'queue_lore_create',
            'Queue a proposed lorebook entry creation. The app will validate whether this should remain a create or become an update to an existing entry.',
            {
                type: 'object',
                properties: {
                    book: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    primary_keywords: { type: 'array', items: { type: 'string' } },
                    secondary_keywords: { type: 'array', items: { type: 'string' } },
                    reason: { type: 'string' },
                },
                required: ['book', 'title', 'content', 'primary_keywords', 'reason'],
            },
            async ({ book, title, content, primary_keywords = [], secondary_keywords = [], reason }) => {
                const bookName = String(book ?? '').trim();
                if (!workingBooks.has(bookName)) {
                    throw new Error(`Lorebook "${bookName}" is not available.`);
                }

                const proposal = normalizeLoreChange({
                    requested_action: 'create',
                    resolved_action: 'create',
                    book: bookName,
                    title,
                    content,
                    primary_keywords,
                    secondary_keywords,
                    reason,
                });
                proposedChanges.push(proposal);

                return {
                    queued: true,
                    action: 'create',
                    book: bookName,
                    title: proposal.title,
                };
            },
        ),
        createAgentTool(
            'queue_lore_update',
            'Queue a proposed lorebook entry update. The app will validate the target and may retarget or convert it if needed.',
            {
                type: 'object',
                properties: {
                    book: { type: 'string' },
                    uid: { type: 'integer' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    primary_keywords: { type: 'array', items: { type: 'string' } },
                    secondary_keywords: { type: 'array', items: { type: 'string' } },
                    reason: { type: 'string' },
                },
                required: ['book', 'uid', 'content', 'reason'],
            },
            async ({ book, uid, title, content, primary_keywords, secondary_keywords, reason }) => {
                const bookName = String(book ?? '').trim();
                if (!workingBooks.has(bookName)) {
                    throw new Error(`Lorebook "${bookName}" is not available.`);
                }

                const proposal = normalizeLoreChange({
                    requested_action: 'update',
                    resolved_action: 'update',
                    book: bookName,
                    uid,
                    title,
                    content,
                    primary_keywords,
                    secondary_keywords,
                    reason,
                });
                proposedChanges.push(proposal);

                return {
                    queued: true,
                    action: 'update',
                    book: bookName,
                    uid: proposal.uid,
                    title: proposal.title || `Entry ${proposal.uid}`,
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
    const storyState = getCurrentStoryState();
    const pendingReviewSummary = normalizeLoreChangeList(lorebookState.pending_changes)
        .map(change => summarizeLoreChange(change))
        .join('\n');

    const systemPrompt = [
        'You are the Lorebook Agent for a roleplay/chat application.',
        'Use tools to propose only durable lore updates that should persist beyond the current scene.',
        'Search before proposing changes when possible.',
        'Prefer updating an existing entry over creating a duplicate when the subject already exists.',
        'Do not store fleeting emotions or wording-only changes.',
        'Do not touch blacklisted entries.',
        'Every queued change must include a brief reason.',
        'Finish by calling finish_lorebook_update.',
    ].join('\n');

    const userPrompt = [
        `Active lorebooks: ${bookNames.join(', ')}`,
        `Current durable memory:\n${memory.summary || '(none)'}`,
        `Current story state:\n${formatStoryStateForPrompt(storyState)}`,
        `Pending lore review items:\n${pendingReviewSummary || '(none)'}`,
        `Review mode before writes: ${lorebookState.review_mode ? 'enabled' : 'disabled'}`,
        `Recent conversation:\n${recentMessages || '(no recent chat found)'}`,
        'Review whether the latest conversation creates or changes durable world knowledge.',
    ].join('\n\n');

    const result = await executeAgentLoop(agent_service_ids.LOREBOOK, systemPrompt, userPrompt, tools);
    const terminalResult = result.terminalResult ?? { summary: result.text || '' };
    const resolvedChanges = resolveLoreChangeProposals(proposedChanges, searchableEntries, entryFuse);
    const proposalSkips = resolvedChanges.filter(change => change.status === 'skipped');
    const actionableChanges = resolvedChanges.filter(change => change.status !== 'skipped');
    let appliedChanges = [];
    let pendingReviewChanges = [];
    let applySkips = [];
    let status = 'completed';

    if (lorebookState.review_mode && actionableChanges.length > 0) {
        pendingReviewChanges = normalizeLoreChangeList([
            ...lorebookState.pending_changes,
            ...actionableChanges.map(change => ({
                ...change,
                status: 'pending_review',
            })),
        ]);
        setAgentLorebookState({
            pending_changes: pendingReviewChanges,
            last_proposed_changes: resolvedChanges,
            updated_at: new Date().toISOString(),
        });
        status = 'pending_review';
    } else if (actionableChanges.length > 0) {
        const applyResult = applyLoreChangesToWorkspace(workingBooks, actionableChanges);
        appliedChanges = applyResult.appliedChanges;
        applySkips = applyResult.skippedChanges;

        if (applyResult.changedBooks.size > 0) {
            for (const bookName of applyResult.changedBooks) {
                const data = workingBooks.get(bookName);
                if (data) {
                    await saveWorldInfo(bookName, data, true);
                }
            }
        }

        setAgentLorebookState({
            pending_changes: [],
            last_proposed_changes: resolvedChanges,
            last_applied_changes: appliedChanges,
            updated_at: new Date().toISOString(),
        });
    } else {
        setAgentLorebookState({
            last_proposed_changes: resolvedChanges,
            updated_at: new Date().toISOString(),
        });
    }

    const skippedChanges = normalizeLoreChangeList([...proposalSkips, ...applySkips], MAX_LORE_REVIEW_CHANGES * 2);
    const countSummary = buildLorebookRunSummary({
        proposedChanges: resolvedChanges,
        appliedChanges,
        pendingChanges: pendingReviewChanges,
        skippedChanges,
    });
    const summary = [countSummary, terminalResult.summary]
        .filter(Boolean)
        .join('. ');

    recordAgentRun(agent_service_ids.LOREBOOK, {
        status,
        summary,
        steps: result.steps,
        error: null,
        proposed_count: resolvedChanges.length,
        applied_count: appliedChanges.length,
        pending_count: pendingReviewChanges.length,
        skipped_count: skippedChanges.length,
        proposed_changes: resolvedChanges,
        applied_changes: appliedChanges,
        pending_changes: pendingReviewChanges,
    });

    return {
        status,
        steps: result.steps,
        summary,
        changes: appliedChanges,
        proposedChanges: resolvedChanges,
        appliedChanges,
        pendingChanges: pendingReviewChanges,
        skippedChanges,
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
        refreshAgentTurnUxState({ sourceTurnId: turn.id });
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

    const result = await runServiceSafely(agent_service_ids.LOREBOOK, () => runLorebookAgent(), { saveAfter: false });
    if (result) {
        refreshAgentTurnUxState();
        await saveChatConditional();
    }
}

async function applyPendingLoreReviewFromUi() {
    if (!isAgentModeAvailable()) {
        toastr.info(t`Agent mode only runs in chat-completions mode with an active chat.`, t`Agent Mode`);
        return;
    }

    const lorebookState = getCurrentLorebookState();
    const pendingChanges = normalizeLoreChangeList(lorebookState.pending_changes);

    if (!pendingChanges.length) {
        toastr.info(t`There are no pending lore changes to review.`, t`Agent Mode`);
        return;
    }

    const confirmation = await Popup.show.confirm(t`Apply pending lore changes for this chat?`, t`This will write the queued lore proposals into the active lorebooks.`);
    if (!confirmation) {
        return;
    }

    const { bookNames, workingBooks } = await loadAccessibleLorebookWorkspace();
    if (!bookNames.length) {
        toastr.info(t`No active lorebooks are available for review right now.`, t`Agent Mode`);
        return;
    }

    const applyResult = applyLoreChangesToWorkspace(workingBooks, pendingChanges);

    if (applyResult.changedBooks.size > 0) {
        for (const bookName of applyResult.changedBooks) {
            const data = workingBooks.get(bookName);
            if (data) {
                await saveWorldInfo(bookName, data, true);
            }
        }
    }

    const remainingPending = applyResult.skippedChanges.map(change => ({
        ...change,
        status: 'pending_review',
    }));
    const summary = buildLorebookRunSummary({
        proposedChanges: pendingChanges,
        appliedChanges: applyResult.appliedChanges,
        skippedChanges: applyResult.skippedChanges,
    });

    setAgentLorebookState({
        pending_changes: remainingPending,
        last_proposed_changes: pendingChanges,
        last_applied_changes: applyResult.appliedChanges.length > 0 ? applyResult.appliedChanges : lorebookState.last_applied_changes,
        updated_at: new Date().toISOString(),
    });

    recordAgentRun(agent_service_ids.LOREBOOK, {
        status: applyResult.appliedChanges.length > 0 ? 'reviewed' : 'skipped',
        summary,
        steps: 0,
        error: null,
        proposed_count: pendingChanges.length,
        applied_count: applyResult.appliedChanges.length,
        pending_count: remainingPending.length,
        skipped_count: applyResult.skippedChanges.length,
        proposed_changes: pendingChanges,
        applied_changes: applyResult.appliedChanges,
        pending_changes: remainingPending,
    });

    refreshAgentTurnUxState();
    await saveChatConditional();
    renderAgentPanelDebounced();
}

async function discardPendingLoreReviewFromUi() {
    if (!getCurrentChatId()) {
        toastr.info(t`Open a chat to review pending lore changes.`, t`Agent Mode`);
        return;
    }

    const lorebookState = getCurrentLorebookState();
    const pendingChanges = normalizeLoreChangeList(lorebookState.pending_changes);

    if (!pendingChanges.length) {
        toastr.info(t`There are no pending lore changes to discard.`, t`Agent Mode`);
        return;
    }

    const confirmation = await Popup.show.confirm(t`Discard pending lore changes for this chat?`, t`This only removes queued review items. It does not touch already-applied lorebook entries.`);
    if (!confirmation) {
        return;
    }

    setAgentLorebookState({
        pending_changes: [],
        updated_at: new Date().toISOString(),
    });
    recordAgentRun(agent_service_ids.LOREBOOK, {
        status: 'discarded',
        summary: `${pendingChanges.length} pending lore change${pendingChanges.length === 1 ? '' : 's'} discarded`,
        steps: 0,
        error: null,
        proposed_count: pendingChanges.length,
        applied_count: 0,
        pending_count: 0,
        skipped_count: 0,
        proposed_changes: pendingChanges,
        applied_changes: [],
        pending_changes: [],
    });

    refreshAgentTurnUxState();
    await saveChatConditional();
    renderAgentPanelDebounced();
}

async function clearAgentMemoryFromUi() {
    const confirmation = await Popup.show.confirm(t`Clear agent memory and story state for this chat?`, t`This removes agent-generated memory and story state, but not your chat history.`);
    if (!confirmation) {
        return;
    }

    setAgentMemory({
        summary: '',
        facts: [],
        unresolved_threads: [],
        chapters: [],
        updated_at: null,
    });
    setAgentStoryState({
        current_location: '',
        current_time: '',
        characters: [],
        locations: [],
        inventory: [],
        plot_threads: [],
        updated_at: null,
    });
    setAgentTurnUxState({
        headline: '',
        suggestions: [],
        recap_sections: [],
        source_turn_id: null,
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
        const countParts = [
            run?.proposed_count ? `${run.proposed_count} proposed` : '',
            run?.applied_count ? `${run.applied_count} applied` : '',
            run?.pending_count ? `${run.pending_count} pending` : '',
            run?.skipped_count ? `${run.skipped_count} skipped` : '',
        ].filter(Boolean);
        const row = $('<div class="flex-container flexFlowColumn marginBot5"></div>');
        const headline = $('<strong></strong>').text(SERVICE_LABELS[serviceId]);
        const statusText = run
            ? `${run.status || 'idle'}${run.reason ? `, ${run.reason}` : ''}${run.steps ? `, ${run.steps} step${run.steps === 1 ? '' : 's'}` : ''}${countParts.length ? `, ${countParts.join(', ')}` : ''}${run.summary ? `, ${truncateText(run.summary, 120)}` : ''}${run.error ? `, ${run.error}` : ''}`
            : 'idle';
        const status = $('<small></small>').text(statusText);
        row.append(headline, status);
        $container.append(row);
    }

    if (currentAgentRun && !currentDirectorTurn) {
        $container.prepend($('<div class="menu_button marginBot5"></div>').text('Agent service running...'));
    }
}

function renderStoryStateValue(selector, value, emptyText = '(none)') {
    const $container = $(selector);
    if ($container.length === 0) {
        return;
    }

    $container.empty().text(String(value ?? '').trim() || emptyText);
}

function renderStoryStateEntries(selector, entries, buildEntry) {
    const $container = $(selector);
    if ($container.length === 0) {
        return;
    }

    $container.empty();

    if (!entries.length) {
        $container.append($('<small class="sb-agent-state-empty"></small>').text('(none)'));
        return;
    }

    for (const entry of entries) {
        const { title, detail } = buildEntry(entry);
        const row = $('<div class="sb-agent-state-entry"></div>');
        row.append($('<strong class="sb-agent-state-entry-title"></strong>').text(title));

        if (detail) {
            row.append($('<small class="sb-agent-state-entry-detail"></small>').text(detail));
        }

        $container.append(row);
    }
}

function renderStoryStatePanel(storyState) {
    const normalizedStoryState = normalizeStoryState(storyState);

    renderStoryStateValue('#agent_story_state_current_location', normalizedStoryState.current_location, '(unknown)');
    renderStoryStateValue('#agent_story_state_current_time', normalizedStoryState.current_time, '(unspecified)');
    renderStoryStateEntries('#agent_story_state_characters', normalizedStoryState.characters, character => ({
        title: character.name,
        detail: [
            character.role,
            character.status,
            character.goal ? `Goal: ${character.goal}` : '',
        ].filter(Boolean).join(' | '),
    }));
    renderStoryStateEntries('#agent_story_state_locations', normalizedStoryState.locations, location => ({
        title: location.name,
        detail: location.summary,
    }));
    renderStoryStateEntries('#agent_story_state_inventory', normalizedStoryState.inventory, inventoryItem => ({
        title: inventoryItem.name,
        detail: [
            inventoryItem.holder ? `Holder: ${inventoryItem.holder}` : '',
            inventoryItem.summary,
        ].filter(Boolean).join(' | '),
    }));
    renderStoryStateEntries('#agent_story_state_plot_threads', normalizedStoryState.plot_threads, plotThread => ({
        title: plotThread.title,
        detail: [
            plotThread.status,
            plotThread.summary,
        ].filter(Boolean).join(' | '),
    }));
}

function renderLoreChangeList(selector, changes, emptyText = '(none)') {
    const $container = $(selector);
    if ($container.length === 0) {
        return;
    }

    $container.empty();

    if (!changes.length) {
        $container.append($('<small class="sb-agent-state-empty"></small>').text(emptyText));
        return;
    }

    for (const change of changes) {
        const normalizedChange = normalizeLoreChange(change);
        const actionLabel = normalizedChange.resolved_action === 'update' ? 'Update' : 'Create';
        const title = `${actionLabel} · ${normalizedChange.book} · ${normalizedChange.title}`;
        const detail = [
            normalizedChange.uid !== null ? `UID ${normalizedChange.uid}` : '',
            normalizedChange.reason ? `Reason: ${normalizedChange.reason}` : '',
            normalizedChange.resolution_note,
        ].filter(Boolean).join(' | ');

        const row = $('<div class="sb-agent-state-entry"></div>');
        row.append($('<strong class="sb-agent-state-entry-title"></strong>').text(title));
        if (detail) {
            row.append($('<small class="sb-agent-state-entry-detail"></small>').text(detail));
        }
        $container.append(row);
    }
}

function renderLorebookReviewPanel(lorebookState) {
    const normalizedLorebookState = normalizeLorebookState(lorebookState);
    const pendingChanges = normalizeLoreChangeList(normalizedLorebookState.pending_changes);

    $('#agent_lore_review_mode').prop('checked', Boolean(normalizedLorebookState.review_mode));
    $('#agent_apply_lore_review').toggleClass('disabled', pendingChanges.length === 0);
    $('#agent_discard_lore_review').toggleClass('disabled', pendingChanges.length === 0);

    renderLoreChangeList('#agent_lore_pending_list', pendingChanges, '(no pending changes)');
    renderLoreChangeList('#agent_lore_applied_list', normalizeLoreChangeList(normalizedLorebookState.last_applied_changes), '(no applied changes yet)');
}

function insertTurnUxSuggestionIntoChatInput(suggestion) {
    const $textarea = $('#send_textarea');
    if ($textarea.length === 0) {
        return;
    }

    const currentValue = String($textarea.val() ?? '').trim();
    const nextValue = currentValue.length > 0
        ? `${currentValue}\n${suggestion}`
        : suggestion;

    $textarea.val(nextValue)[0].dispatchEvent(new Event('input', { bubbles: true }));
    $textarea.trigger('focus');
}

function normalizeInteractiveAgentOptionText(rawText) {
    const normalizedLines = String(rawText ?? '')
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);

    if (normalizedLines.length === 0) {
        return '';
    }

    normalizedLines[0] = normalizedLines[0].replace(/^(?:\d+|[A-Z])\.\s*/, '').trim();
    return normalizedLines.join('\n').trim();
}

function bindInteractiveAgentOptionClicks() {
    const optionSelector = '.mes_text .pura-choice, .mes_text .pura-direction';

    $(document).off('click.sbInteractiveAgentOptions', optionSelector);
    $(document).on('click.sbInteractiveAgentOptions', optionSelector, function (event) {
        const optionElement = event.target instanceof Element
            ? event.target.closest(optionSelector)
            : null;

        if (!(optionElement instanceof HTMLElement)) {
            return;
        }

        const suggestion = normalizeInteractiveAgentOptionText(optionElement.textContent);
        if (!suggestion) {
            return;
        }

        insertTurnUxSuggestionIntoChatInput(suggestion);
    });
}

function renderTurnUxPanel(turnUxState) {
    const normalizedTurnUxState = normalizeTurnUxState(turnUxState);
    const $suggestions = $('#agent_turn_ux_suggestions');
    const $recap = $('#agent_turn_ux_recap');

    $('#agent_turn_ux_enabled').prop('checked', Boolean(normalizedTurnUxState.enabled));
    renderStoryStateValue('#agent_turn_ux_headline', normalizedTurnUxState.headline, normalizedTurnUxState.enabled ? '(no recap yet)' : 'Adventure helpers are disabled for this chat.');

    if ($recap.length > 0) {
        $recap.empty();
        if (!normalizedTurnUxState.enabled) {
            $recap.append($('<small class="sb-agent-state-empty"></small>').text('Enable turn helpers to surface recaps and guided next actions.'));
        } else if (!normalizedTurnUxState.recap_sections.length) {
            $recap.append($('<small class="sb-agent-state-empty"></small>').text('(no recap yet)'));
        } else {
            for (const section of normalizedTurnUxState.recap_sections) {
                const row = $('<div class="sb-agent-state-entry"></div>');
                row.append($('<strong class="sb-agent-state-entry-title"></strong>').text(section.title));
                row.append($('<small class="sb-agent-state-entry-detail"></small>').text(section.detail));
                $recap.append(row);
            }
        }
    }

    if ($suggestions.length > 0) {
        $suggestions.empty();
        if (!normalizedTurnUxState.enabled) {
            $suggestions.append($('<small class="sb-agent-state-empty"></small>').text('Turn helpers are currently off.'));
        } else if (!normalizedTurnUxState.suggestions.length) {
            $suggestions.append($('<small class="sb-agent-state-empty"></small>').text('(no suggestions yet)'));
        } else {
            for (const suggestion of normalizedTurnUxState.suggestions) {
                const button = $('<button type="button" class="menu_button sb-agent-action-button"></button>').text(suggestion);
                button.on('click', () => insertTurnUxSuggestionIntoChatInput(suggestion));
                $suggestions.append(button);
            }
        }
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
    const preset = getGlobalAgentPreset();
    const presetOverrideKeys = Object.keys(preset.settings_overrides ?? {});

    $('#agent_mode_enabled').prop('checked', Boolean(state.enabled));
    $('#agent_service_retrieval').prop('checked', Boolean(state.services[agent_service_ids.RETRIEVAL]?.enabled));
    $('#agent_service_memory').prop('checked', Boolean(state.services[agent_service_ids.MEMORY]?.enabled));
    $('#agent_service_lorebook').prop('checked', Boolean(state.services[agent_service_ids.LOREBOOK]?.enabled));
    $('#agent_memory_summary').val(state.memory.summary || '');
    renderStoryStatePanel(state.story_state);
    renderLorebookReviewPanel(state.lorebook);
    renderTurnUxPanel(state.turn_ux);

    const loreReviewText = state.lorebook?.review_mode
        ? t` Lore updates will stay in review until you apply them.`
        : t` Lore updates auto-apply after validation.`;
    const availabilityText = !hasChat
        ? t`Open a chat to configure per-chat agent mode.`
        : !available
            ? t`Agent mode currently runs only through chat-completions providers.`
            : `${t`The turn director runs retrieval before the next reply, then updates durable memory, story state, and lorebook context after the reply is saved.`}${loreReviewText}`;
    $('#agent_mode_status_hint').text(availabilityText);
    $('#agent_preset_status').text(
        preset.name
            ? `Agent preset: ${preset.name} (${presetOverrideKeys.length} compatible tuning override${presetOverrideKeys.length === 1 ? '' : 's'})`
            : 'Agent preset: none imported',
    );

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

function getAgentPresetFileBaseName(fileName) {
    return String(fileName ?? '').replace(/\.(json|settings)$/i, '').trim();
}

function buildImportedAgentPreset(rawPreset, fallbackName = '') {
    if (!rawPreset || typeof rawPreset !== 'object' || Array.isArray(rawPreset)) {
        throw new Error('The selected preset file does not contain a JSON object.');
    }

    const extractedSettings = normalizeAgentPresetSettingsOverrides(rawPreset);
    const presetName = String(rawPreset.name ?? fallbackName).trim();
    const settingsOverrides = { ...extractedSettings };
    const importedTemp = settingsOverrides.temp_openai;
    const importedMaxTokens = settingsOverrides.openai_max_tokens;

    if (Object.keys(settingsOverrides).length === 0 && importedTemp === undefined && importedMaxTokens === undefined) {
        throw new Error('No agent-compatible tuning fields were found in that preset.');
    }

    return {
        preset: {
            name: presetName,
            settings_overrides: settingsOverrides,
        },
        temp_openai: importedTemp,
        openai_max_tokens: importedMaxTokens,
    };
}

function applyImportedAgentPreset(importedPreset) {
    const settings = getGlobalAgentSettings();
    settings.preset = normalizeAgentPresetConfig(importedPreset.preset);

    for (const serviceId of Object.values(agent_service_ids)) {
        const profile = getServiceProfile(serviceId);

        if (importedPreset.temp_openai !== undefined) {
            profile.temp_openai = Number(importedPreset.temp_openai);
        }

        if (importedPreset.openai_max_tokens !== undefined) {
            profile.openai_max_tokens = Number(importedPreset.openai_max_tokens);
        }
    }

    saveSettingsDebounced();
    renderAgentPanelDebounced();
}

async function importAgentPresetFromFileInput(event) {
    const input = event.target;
    const file = input instanceof HTMLInputElement ? input.files?.[0] : null;

    if (!file) {
        return;
    }

    try {
        const rawPreset = await parseJsonFile(file);
        const importedPreset = buildImportedAgentPreset(rawPreset, getAgentPresetFileBaseName(file.name));
        applyImportedAgentPreset(importedPreset);
        toastr.success(`Applied ${importedPreset.preset.name || 'chat preset'} to all agents.`, t`Agent Mode`);
    } catch (error) {
        console.error('Failed to import agent preset', error);
        toastr.error(summarizeError(error), t`Failed to import agent preset`);
    } finally {
        if (input instanceof HTMLInputElement) {
            input.value = '';
        }
    }
}

async function clearImportedAgentPreset() {
    const settings = getGlobalAgentSettings();
    const hasPreset = Boolean(settings.preset?.name) || Object.keys(settings.preset?.settings_overrides ?? {}).length > 0;

    if (!hasPreset) {
        toastr.info(t`There is no imported agent preset to clear.`, t`Agent Mode`);
        return;
    }

    const confirmation = await Popup.show.confirm(
        t`Clear the imported agent preset?`,
        t`This removes the shared tuning overlay from agent requests. Per-agent temperature and max token fields stay as currently set.`,
    );

    if (!confirmation) {
        return;
    }

    settings.preset = cloneDefaultAgentPreset();
    saveSettingsDebounced();
    renderAgentPanelDebounced();
    toastr.success(t`Removed the imported agent preset overlay.`, t`Agent Mode`);
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
    $('#agent_lore_review_mode').on('input', function () {
        setAgentLorebookState({
            review_mode: $(this).prop('checked'),
            updated_at: new Date().toISOString(),
        });
        refreshAgentTurnUxState();
        saveMetadataDebounced();
        renderAgentPanelDebounced();
    });
    $('#agent_turn_ux_enabled').on('input', function () {
        setAgentTurnUxState({
            enabled: $(this).prop('checked'),
            updated_at: new Date().toISOString(),
        });
        if ($(this).prop('checked')) {
            refreshAgentTurnUxState({ sourceTurnId: getCurrentTurnUxState().source_turn_id });
        }
        saveMetadataDebounced();
        renderAgentPanelDebounced();
    });

    $('#agent_copy_main_profile').on('click', copyMainProfileToAllAgents);
    $('#agent_import_preset').on('click', () => $('#agent_preset_import_file').trigger('click'));
    $('#agent_preset_import_file').on('change', event => void importAgentPresetFromFileInput(event));
    $('#agent_clear_preset').on('click', () => void clearImportedAgentPreset());
    $('#agent_clear_memory').on('click', () => void clearAgentMemoryFromUi());
    $('#agent_run_lorebook').on('click', () => void runLorebookSyncFromUi());
    $('#agent_apply_lore_review').on('click', () => void applyPendingLoreReviewFromUi());
    $('#agent_discard_lore_review').on('click', () => void discardPendingLoreReviewFromUi());

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
    bindInteractiveAgentOptionClicks();

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
