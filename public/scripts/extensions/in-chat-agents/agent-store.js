import { getRequestHeaders } from '../../../script.js';
import { extension_settings } from '../../extensions.js';
import { uuidv4 } from '../../utils.js';
import {
    AGENT_REGEX_PLACEMENT,
    AGENT_REGEX_SUBSTITUTE,
    normalizeRegexScript,
} from './regex-scripts.js';

/**
 * @typedef {object} AgentInjection
 * @property {number} position - 0=IN_PROMPT, 1=IN_CHAT, 2=BEFORE_PROMPT
 * @property {number} depth - 0-99, depth in chat history
 * @property {number} role - 0=SYSTEM, 1=USER, 2=ASSISTANT
 * @property {number} order - Ordering at same depth
 * @property {boolean} scan - Scan for World Info keywords
 */

/**
 * @typedef {object} AgentPostProcess
 * @property {boolean} enabled
 * @property {'regex'|'append'|'extract'} type
 * @property {string} regexFind
 * @property {string} regexReplace
 * @property {string} regexFlags
 * @property {string} appendText
 * @property {string} extractPattern
 * @property {string} extractVariable
 * @property {boolean} promptTransformEnabled
 * @property {boolean} promptTransformShowNotifications
 * @property {'rewrite'|'append'} promptTransformMode
 * @property {number} promptTransformMaxTokens
 */

/**
 * @typedef {object} AgentConditions
 * @property {string[]} triggerKeywords
 * @property {number} triggerProbability - 0-100
 * @property {string[]} generationTypes
 */

/**
 * @typedef {import('../../char-data.js').RegexScriptData} AgentRegexScript
 */

/**
 * @typedef {object} AgentToolDef
 * @property {string} name - Unique ToolManager name (e.g., 'Pathfinder_Search')
 * @property {string} displayName - Human-readable label
 * @property {string} description - LLM-facing instruction text
 * @property {object} parameters - OpenAI JSON Schema for tool parameters
 * @property {string} actionKey - Key resolved from ToolActionRegistry at runtime
 * @property {string} [formatMessageKey] - Key for display text formatter
 * @property {boolean} [shouldRegister=true] - Whether to include in LLM tool list
 * @property {boolean} [stealth=false] - If true, result hidden from chat
 * @property {boolean} [enabled=true] - Per-tool toggle within the agent
 */

/**
 * @typedef {object} InChatAgent
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} icon
 * @property {'content'|'tracker'|'randomizer'|'custom'|'tool'} category
 * @property {string[]} tags
 * @property {number} version
 * @property {string} author
 * @property {string} prompt
 * @property {'pre'|'post'|'both'} phase
 * @property {AgentInjection} injection
 * @property {AgentPostProcess} postProcess
 * @property {AgentRegexScript[]} regexScripts
 * @property {string} connectionProfile
 * @property {string} modelOverride - Optional model name to use instead of profile default
 * @property {string} sourceTemplateId
 * @property {boolean} enabled
 * @property {AgentConditions} conditions
 * @property {AgentToolDef[]} tools - Tool definitions for 'tool' category agents
 * @property {object} settings - Per-agent settings object for tool agents
 * @property {boolean} phaseLocked - Prevent phase from being changed by migrations
 */

/** @type {InChatAgent[]} */
let agents = [];

/** @type {AgentGroup[]} */
let builtinGroups = [];

/** @type {AgentGroup[]} */
let customGroups = [];

/** Global settings for the In-Chat Agents extension. */
let globalSettings = {
    connectionProfile: '',
    promptTransformShowNotifications: true,
    appendAgentsExecutionMode: 'parallel',
};

/**
 * Returns the global settings.
 * @returns {{ connectionProfile: string, promptTransformShowNotifications: boolean, appendAgentsExecutionMode: 'parallel'|'sequential' }}
 */
export function getGlobalSettings() {
    return globalSettings;
}

/**
 * Updates global settings (merge).
 * @param {Partial<typeof globalSettings>} update
 */
export function setGlobalSettings(update) {
    Object.assign(globalSettings, update);
}

function normalizeConnectionProfileId(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function getDefaultConnectionProfile() {
    const globalProfileId = normalizeConnectionProfileId(globalSettings.connectionProfile);
    if (globalProfileId) {
        return globalProfileId;
    }

    const selectedConnectionManagerProfile = normalizeConnectionProfileId(
        extension_settings?.connectionManager?.selectedProfile,
    );
    return selectedConnectionManagerProfile || '';
}

export function resolveConnectionProfile(profileId = '') {
    const explicitProfileId = normalizeConnectionProfileId(profileId);
    if (explicitProfileId) {
        return explicitProfileId;
    }

    return getDefaultConnectionProfile();
}

export const LEGACY_AGENT_MAX_TOKENS = 2000;
export const DEFAULT_AGENT_MAX_TOKENS = 8192;

const TRACKER_CATEGORY_TEMPLATE_IDS = new Set([
    'tpl-cyoa-choices',
    'tpl-direction-menu',
]);

const TRACKER_CATEGORY_NAMES = new Set([
    'cyoa choices',
    'direction menu',
]);

export function normalizeAgentCategory(category = '', sourceTemplateId = '', name = '') {
    const normalizedTemplateId = typeof sourceTemplateId === 'string' ? sourceTemplateId.trim() : '';
    if (TRACKER_CATEGORY_TEMPLATE_IDS.has(normalizedTemplateId)) {
        return 'tracker';
    }

    const normalizedName = typeof name === 'string' ? name.trim().toLowerCase() : '';
    if (TRACKER_CATEGORY_NAMES.has(normalizedName)) {
        return 'tracker';
    }

    const normalizedCategory = typeof category === 'string' ? category.trim().toLowerCase() : '';
    if (['content', 'tracker', 'randomizer', 'custom', 'tool'].includes(normalizedCategory)) {
        return normalizedCategory;
    }

    return 'custom';
}

/**
 * Category display order and labels.
 */
export const AGENT_CATEGORIES = {
    tracker: { label: 'Tracker', icon: 'fa-chart-line' },
    randomizer: { label: 'Randomizer', icon: 'fa-dice' },
    content: { label: 'Content', icon: 'fa-film' },
    tool: { label: 'Tool', icon: 'fa-screwdriver-wrench' },
    custom: { label: 'Custom', icon: 'fa-puzzle-piece' },
};

function escapeRegexLiteral(value) {
    return String(value ?? '').replaceAll('/', '\\/');
}

/**
 * Converts a legacy single regex post-process block into an ST-style regex script.
 * @param {Partial<InChatAgent>} rawAgent
 * @returns {AgentRegexScript|null}
 */
export function getLegacyRegexScript(rawAgent = {}) {
    const postProcess = rawAgent.postProcess;

    if (!postProcess?.enabled || postProcess.type !== 'regex' || !postProcess.regexFind) {
        return null;
    }

    const flags = String(postProcess.regexFlags ?? 'g').trim() || 'g';
    return normalizeRegexScript({
        id: `legacy-${String(rawAgent.id ?? uuidv4())}`,
        scriptName: `${String(rawAgent.name ?? '').trim() || 'Agent'} legacy regex`,
        findRegex: `/${escapeRegexLiteral(postProcess.regexFind)}/${flags}`,
        replaceString: String(postProcess.regexReplace ?? ''),
        trimStrings: [],
        placement: [AGENT_REGEX_PLACEMENT.AI_OUTPUT],
        disabled: false,
        markdownOnly: true,
        promptOnly: false,
        runOnEdit: true,
        substituteRegex: AGENT_REGEX_SUBSTITUTE.NONE,
        minDepth: null,
        maxDepth: null,
    });
}

/**
 * Returns the usable regex scripts for an agent, including legacy regex-only agents.
 * @param {Partial<InChatAgent>} rawAgent
 * @returns {AgentRegexScript[]}
 */
export function getAgentRegexScripts(rawAgent = {}) {
    const explicitScripts = Array.isArray(rawAgent.regexScripts)
        ? rawAgent.regexScripts.map(script => normalizeRegexScript(script ?? {}))
        : [];

    if (explicitScripts.length > 0) {
        return explicitScripts;
    }

    const legacyScript = getLegacyRegexScript(rawAgent);
    return legacyScript ? [legacyScript] : [];
}

/**
 * Creates a new agent with default values.
 * @returns {InChatAgent}
 */
export function createDefaultAgent() {
    return {
        id: uuidv4(),
        name: '',
        description: '',
        icon: '',
        category: 'custom',
        tags: [],
        version: 1,
        author: '',
        prompt: '',
        phase: 'pre',
        connectionProfile: '',
        modelOverride: '',
        sourceTemplateId: '',
        injection: {
            position: 1,
            depth: 1,
            role: 0,
            order: 100,
            scan: false,
        },
        postProcess: {
            enabled: false,
            type: 'regex',
            regexFind: '',
            regexReplace: '',
            regexFlags: 'g',
            appendText: '',
            extractPattern: '',
            extractVariable: '',
            promptTransformEnabled: false,
            promptTransformShowNotifications: true,
            promptTransformMode: 'rewrite',
            promptTransformMaxTokens: DEFAULT_AGENT_MAX_TOKENS,
        },
        regexScripts: [],
        enabled: false,
        phaseLocked: false,
        conditions: {
            triggerKeywords: [],
            triggerProbability: 100,
            generationTypes: ['normal', 'continue', 'impersonate'],
        },
        tools: [],
        settings: {},
    };
}

/**
 * Normalizes a single tool definition loaded from disk or import.
 * @param {Partial<AgentToolDef>} raw
 * @returns {AgentToolDef}
 */
export function normalizeToolDef(raw = {}) {
    return {
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '',
        displayName: typeof raw.displayName === 'string' ? raw.displayName : (raw.name ?? ''),
        description: typeof raw.description === 'string' ? raw.description : '',
        parameters: raw.parameters && typeof raw.parameters === 'object' ? raw.parameters : { type: 'object', properties: {} },
        actionKey: typeof raw.actionKey === 'string' ? raw.actionKey.trim() : '',
        formatMessageKey: typeof raw.formatMessageKey === 'string' ? raw.formatMessageKey.trim() : '',
        shouldRegister: typeof raw.shouldRegister === 'boolean' ? raw.shouldRegister : true,
        stealth: typeof raw.stealth === 'boolean' ? raw.stealth : false,
        enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    };
}

/**
 * Normalizes an agent loaded from disk or import.
 * @param {Partial<InChatAgent>} rawAgent
 * @returns {InChatAgent}
 */
export function normalizeAgent(rawAgent = {}) {
    const defaults = createDefaultAgent();
    const rawPostProcess = rawAgent.postProcess && typeof rawAgent.postProcess === 'object' ? rawAgent.postProcess : {};
    const conditions = rawAgent.conditions && typeof rawAgent.conditions === 'object' ? rawAgent.conditions : {};

    return {
        ...defaults,
        ...rawAgent,
        id: typeof rawAgent.id === 'string' && rawAgent.id.trim() ? rawAgent.id.trim() : defaults.id,
        name: typeof rawAgent.name === 'string' ? rawAgent.name : defaults.name,
        description: typeof rawAgent.description === 'string' ? rawAgent.description : defaults.description,
        icon: typeof rawAgent.icon === 'string' ? rawAgent.icon : defaults.icon,
        category: normalizeAgentCategory(rawAgent.category, rawAgent.sourceTemplateId, rawAgent.name),
        tags: Array.isArray(rawAgent.tags)
            ? rawAgent.tags.map(tag => String(tag ?? '').trim()).filter(Boolean)
            : defaults.tags,
        version: Number.isFinite(Number(rawAgent.version)) ? Number(rawAgent.version) : defaults.version,
        author: typeof rawAgent.author === 'string' ? rawAgent.author : defaults.author,
        prompt: typeof rawAgent.prompt === 'string' ? rawAgent.prompt : defaults.prompt,
        phase: ['pre', 'post', 'both'].includes(rawAgent.phase) ? rawAgent.phase : defaults.phase,
        connectionProfile: typeof rawAgent.connectionProfile === 'string' ? rawAgent.connectionProfile : defaults.connectionProfile,
        modelOverride: typeof rawAgent.modelOverride === 'string' ? rawAgent.modelOverride : defaults.modelOverride,
        sourceTemplateId: typeof rawAgent.sourceTemplateId === 'string' ? rawAgent.sourceTemplateId : defaults.sourceTemplateId,
        injection: {
            ...defaults.injection,
            ...(rawAgent.injection ?? {}),
        },
        postProcess: {
            ...defaults.postProcess,
            ...rawPostProcess,
            enabled: Boolean(rawPostProcess.enabled),
            type: ['regex', 'append', 'extract'].includes(String(rawPostProcess.type))
                ? String(rawPostProcess.type)
                : defaults.postProcess.type,
            regexFind: typeof rawPostProcess.regexFind === 'string' ? rawPostProcess.regexFind : defaults.postProcess.regexFind,
            regexReplace: typeof rawPostProcess.regexReplace === 'string' ? rawPostProcess.regexReplace : defaults.postProcess.regexReplace,
            regexFlags: typeof rawPostProcess.regexFlags === 'string' ? rawPostProcess.regexFlags : defaults.postProcess.regexFlags,
            appendText: typeof rawPostProcess.appendText === 'string' ? rawPostProcess.appendText : defaults.postProcess.appendText,
            extractPattern: typeof rawPostProcess.extractPattern === 'string' ? rawPostProcess.extractPattern : defaults.postProcess.extractPattern,
            extractVariable: typeof rawPostProcess.extractVariable === 'string' ? rawPostProcess.extractVariable : defaults.postProcess.extractVariable,
            promptTransformEnabled: Boolean(rawPostProcess.promptTransformEnabled),
            promptTransformShowNotifications: Object.hasOwn(rawPostProcess, 'promptTransformShowNotifications')
                ? Boolean(rawPostProcess.promptTransformShowNotifications)
                : defaults.postProcess.promptTransformShowNotifications,
            promptTransformMode: ['rewrite', 'append'].includes(String(rawPostProcess.promptTransformMode))
                ? String(rawPostProcess.promptTransformMode)
                : defaults.postProcess.promptTransformMode,
            promptTransformMaxTokens: Number.isFinite(Number(rawPostProcess.promptTransformMaxTokens))
                ? Math.max(16, Math.min(16000, Number(rawPostProcess.promptTransformMaxTokens)))
                : defaults.postProcess.promptTransformMaxTokens,
        },
        regexScripts: Array.isArray(rawAgent.regexScripts)
            ? rawAgent.regexScripts.map(script => normalizeRegexScript(script ?? {}))
            : defaults.regexScripts,
        enabled: Boolean(rawAgent.enabled),
        phaseLocked: Boolean(rawAgent.phaseLocked),
        conditions: {
            ...defaults.conditions,
            ...conditions,
            triggerKeywords: Array.isArray(conditions.triggerKeywords)
                ? conditions.triggerKeywords.map(keyword => String(keyword ?? '').trim()).filter(Boolean)
                : defaults.conditions.triggerKeywords,
            triggerProbability: Number.isFinite(Number(conditions.triggerProbability))
                ? Math.max(0, Math.min(100, Number(conditions.triggerProbability)))
                : defaults.conditions.triggerProbability,
            generationTypes: Array.isArray(conditions.generationTypes)
                ? conditions.generationTypes.map(type => String(type ?? '').trim()).filter(Boolean)
                : defaults.conditions.generationTypes,
        },
        tools: Array.isArray(rawAgent.tools)
            ? rawAgent.tools.map(tool => normalizeToolDef(tool))
            : defaults.tools,
        settings: rawAgent.settings && typeof rawAgent.settings === 'object' && !Array.isArray(rawAgent.settings)
            ? { ...rawAgent.settings }
            : { ...defaults.settings },
    };
}

/**
 * Returns a shallow copy of the agents array.
 * @returns {InChatAgent[]}
 */
export function getAgents() {
    return [...agents];
}

/**
 * Returns enabled agents, sorted by injection order.
 * @returns {InChatAgent[]}
 */
export function getEnabledAgents() {
    return agents
        .filter(agent => agent.enabled)
        .sort((a, b) => a.injection.order - b.injection.order);
}

/**
 * Finds an agent by ID.
 * @param {string} id
 * @returns {InChatAgent|undefined}
 */
export function getAgentById(id) {
    return agents.find(agent => agent.id === id);
}

/**
 * Returns all tool-category agents.
 * @returns {InChatAgent[]}
 */
export function getToolAgents() {
    return agents.filter(agent => agent.category === 'tool');
}

/**
 * Returns enabled tool agents.
 * @returns {InChatAgent[]}
 */
export function getEnabledToolAgents() {
    return agents.filter(agent => agent.enabled && agent.category === 'tool');
}

/**
 * Checks if an agent is a tool-category agent.
 * @param {InChatAgent} agent
 * @returns {boolean}
 */
export function isToolAgent(agent) {
    return agent?.category === 'tool';
}

/**
 * Loads agents from the server settings response.
 * @param {object[]} data - Array of agent objects from settings
 */
export function loadAgents(data) {
    if (Array.isArray(data)) {
        agents = data.map(normalizeAgent);
    }
}

/**
 * Saves an agent to the server. Updates local array.
 * @param {InChatAgent} agent
 */
export async function saveAgent(agent) {
    const normalizedAgent = normalizeAgent(agent);
    const index = agents.findIndex(existingAgent => existingAgent.id === normalizedAgent.id);

    if (index >= 0) {
        agents[index] = normalizedAgent;
    } else {
        agents.push(normalizedAgent);
    }

    const response = await fetch('/api/in-chat-agents/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(normalizedAgent),
    });

    if (!response.ok) {
        throw new Error('Failed to save agent');
    }
}

/**
 * Deletes an agent from the server and local array.
 * @param {string} id
 */
export async function deleteAgent(id) {
    agents = agents.filter(agent => agent.id !== id);

    const response = await fetch('/api/in-chat-agents/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ id }),
    });

    if (!response.ok) {
        throw new Error('Failed to delete agent');
    }
}

/**
 * Imports agents from a JSON object (single or pack).
 * @param {object} data - Agent or agent pack
 * @returns {InChatAgent[]} - Imported agents
 */
export async function importAgents(data) {
    let agentsToImport = [];

    if (data.format === 'sillybunny-inchat-agents' && Array.isArray(data.agents)) {
        agentsToImport = data.agents;
    } else if (data.id && data.prompt !== undefined) {
        agentsToImport = [data];
    } else {
        throw new Error('Unrecognized agent format');
    }

    const imported = [];
    for (const rawAgent of agentsToImport) {
        const agent = normalizeAgent({ ...createDefaultAgent(), ...rawAgent, id: uuidv4() });
        await saveAgent(agent);
        imported.push(agent);
    }

    return imported;
}

/**
 * Exports all agents as an agent pack.
 * @returns {object}
 */
export function exportAllAgents() {
    return {
        format: 'sillybunny-inchat-agents',
        version: 1,
        agents,
    };
}

/**
 * Exports a single agent.
 * @param {string} id
 * @returns {InChatAgent|null}
 */
export function exportAgent(id) {
    return agents.find(agent => agent.id === id) || null;
}

// ===================== Agent Groups =====================

/**
 * @typedef {object} AgentGroup
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} agentTemplateIds - Template IDs (tpl-*) included in this group
 * @property {Partial<InChatAgent>[]} customAgents - Custom agent snapshots included in this group
 * @property {boolean} builtin - Whether this is a pre-made group
 */

/**
 * Creates a default empty group.
 * @returns {AgentGroup}
 */
export function createDefaultGroup() {
    return {
        id: uuidv4(),
        name: '',
        description: '',
        agentTemplateIds: [],
        customAgents: [],
        builtin: false,
    };
}

/**
 * Normalizes an agent snapshot used inside custom groups.
 * @param {Partial<InChatAgent>} rawAgent
 * @returns {Partial<InChatAgent>}
 */
function normalizeGroupAgentSnapshot(rawAgent = {}) {
    const normalizedAgent = normalizeAgent(rawAgent);
    delete normalizedAgent.id;
    normalizedAgent.enabled = false;
    return normalizedAgent;
}

/**
 * Normalizes a group payload.
 * @param {Partial<AgentGroup>} rawGroup
 * @param {object} [options]
 * @param {boolean} [options.builtin]
 * @returns {AgentGroup}
 */
function normalizeGroup(rawGroup = {}, { builtin = false } = {}) {
    const defaults = createDefaultGroup();

    return {
        ...defaults,
        ...rawGroup,
        id: typeof rawGroup.id === 'string' && rawGroup.id.trim() ? rawGroup.id.trim() : defaults.id,
        name: String(rawGroup.name ?? '').trim(),
        description: String(rawGroup.description ?? '').trim(),
        agentTemplateIds: Array.isArray(rawGroup.agentTemplateIds)
            ? rawGroup.agentTemplateIds.map(id => String(id ?? '').trim()).filter(Boolean)
            : [],
        customAgents: Array.isArray(rawGroup.customAgents)
            ? rawGroup.customAgents.map(agent => normalizeGroupAgentSnapshot(agent ?? {}))
            : [],
        builtin: builtin || Boolean(rawGroup.builtin),
    };
}

/**
 * Returns all groups (builtin + custom).
 * @returns {AgentGroup[]}
 */
export function getGroups() {
    return [...builtinGroups, ...customGroups];
}

/**
 * Returns custom groups only.
 * @returns {AgentGroup[]}
 */
export function getCustomGroups() {
    return [...customGroups];
}

/**
 * Loads builtin groups from extension templates.
 * @param {AgentGroup[]} data
 */
export function loadBuiltinGroups(data) {
    builtinGroups = Array.isArray(data)
        ? data.map(group => normalizeGroup(group, { builtin: true }))
        : [];
}

/**
 * Loads custom groups from backend storage.
 * @param {AgentGroup[]} data
 */
export function loadCustomGroups(data) {
    customGroups = Array.isArray(data)
        ? data.map(group => normalizeGroup(group, { builtin: false }))
        : [];
}

/**
 * Saves a custom group to the backend and local state.
 * @param {AgentGroup} group
 * @returns {Promise<AgentGroup>}
 */
export async function saveGroup(group) {
    const normalizedGroup = normalizeGroup(group, { builtin: false });
    const index = customGroups.findIndex(existingGroup => existingGroup.id === normalizedGroup.id);

    if (index >= 0) {
        customGroups[index] = normalizedGroup;
    } else {
        customGroups.push(normalizedGroup);
    }

    const response = await fetch('/api/in-chat-agents/groups/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(normalizedGroup),
    });

    if (!response.ok) {
        throw new Error('Failed to save group');
    }

    return normalizedGroup;
}

/**
 * Deletes a custom group by ID.
 * @param {string} id
 */
export async function deleteGroup(id) {
    customGroups = customGroups.filter(group => group.id !== id);

    const response = await fetch('/api/in-chat-agents/groups/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ id }),
    });

    if (!response.ok) {
        throw new Error('Failed to delete group');
    }
}
