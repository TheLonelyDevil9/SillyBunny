import { getRequestHeaders } from '../../../script.js';

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
 */

/**
 * @typedef {object} AgentConditions
 * @property {string[]} triggerKeywords
 * @property {number} triggerProbability - 0-100
 * @property {string[]} generationTypes
 */

/**
 * @typedef {object} InChatAgent
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} icon
 * @property {'directive'|'formatting'|'content'|'tracker'|'randomizer'|'guard'|'custom'} category
 * @property {string[]} tags
 * @property {number} version
 * @property {string} author
 * @property {string} prompt
 * @property {'pre'|'post'|'both'} phase
 * @property {AgentInjection} injection
 * @property {AgentPostProcess} postProcess
 * @property {boolean} enabled
 * @property {AgentConditions} conditions
 */

/** @type {InChatAgent[]} */
let agents = [];

/** Global settings for the In-Chat Agents extension. */
let globalSettings = {
    connectionProfile: '',
};

/**
 * Returns the global settings.
 * @returns {{ connectionProfile: string }}
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

/**
 * Category display order and labels.
 */
export const AGENT_CATEGORIES = {
    directive: { label: 'Directive', icon: 'fa-compass' },
    formatting: { label: 'Formatting', icon: 'fa-align-left' },
    content: { label: 'Content', icon: 'fa-film' },
    tracker: { label: 'Tracker', icon: 'fa-chart-line' },
    randomizer: { label: 'Randomizer', icon: 'fa-dice' },
    guard: { label: 'Guard', icon: 'fa-shield-halved' },
    custom: { label: 'Custom', icon: 'fa-puzzle-piece' },
};

/**
 * Creates a new agent with default values.
 * @returns {InChatAgent}
 */
export function createDefaultAgent() {
    return {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        icon: '',
        category: 'custom',
        tags: [],
        version: 1,
        author: '',
        prompt: '',
        phase: 'pre',
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
        },
        enabled: false,
        conditions: {
            triggerKeywords: [],
            triggerProbability: 100,
            generationTypes: ['normal', 'continue', 'impersonate'],
        },
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
        .filter(a => a.enabled)
        .sort((a, b) => a.injection.order - b.injection.order);
}

/**
 * Finds an agent by ID.
 * @param {string} id
 * @returns {InChatAgent|undefined}
 */
export function getAgentById(id) {
    return agents.find(a => a.id === id);
}

/**
 * Loads agents from the server settings response.
 * @param {object[]} data - Array of agent objects from settings
 */
export function loadAgents(data) {
    if (Array.isArray(data)) {
        agents = data;
    }
}

/**
 * Saves an agent to the server. Updates local array.
 * @param {InChatAgent} agent
 */
export async function saveAgent(agent) {
    const idx = agents.findIndex(a => a.id === agent.id);
    if (idx >= 0) {
        agents[idx] = agent;
    } else {
        agents.push(agent);
    }

    const response = await fetch('/api/in-chat-agents/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(agent),
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
    agents = agents.filter(a => a.id !== id);

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
    for (const raw of agentsToImport) {
        const agent = { ...createDefaultAgent(), ...raw, id: crypto.randomUUID() };
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
        agents: agents,
    };
}

/**
 * Exports a single agent.
 * @param {string} id
 * @returns {InChatAgent|null}
 */
export function exportAgent(id) {
    return agents.find(a => a.id === id) || null;
}

// ===================== Agent Groups =====================

/**
 * @typedef {object} AgentGroup
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} agentTemplateIds - Template IDs (tpl-*) included in this group
 * @property {boolean} builtin - Whether this is a pre-made group
 */

/** @type {AgentGroup[]} */
let groups = [];

/**
 * Returns all groups (builtin + custom).
 * @returns {AgentGroup[]}
 */
export function getGroups() {
    return [...groups];
}

/**
 * Loads groups from settings or templates.
 * @param {AgentGroup[]} data
 */
export function loadGroups(data) {
    if (Array.isArray(data)) {
        groups = data;
    }
}

/**
 * Saves a group. Updates local array and persists via global settings.
 * @param {AgentGroup} group
 */
export function saveGroup(group) {
    const idx = groups.findIndex(g => g.id === group.id);
    if (idx >= 0) {
        groups[idx] = group;
    } else {
        groups.push(group);
    }
}

/**
 * Deletes a group by ID.
 * @param {string} id
 */
export function deleteGroup(id) {
    groups = groups.filter(g => g.id !== id);
}

/**
 * Creates a default empty group.
 * @returns {AgentGroup}
 */
export function createDefaultGroup() {
    return {
        id: crypto.randomUUID(),
        name: '',
        description: '',
        agentTemplateIds: [],
        builtin: false,
    };
}
