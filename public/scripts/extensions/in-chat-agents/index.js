import { extension_settings, renderExtensionTemplateAsync, getContext } from '../../extensions.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../popup.js';
import { download, getSortableDelay, uuidv4 } from '../../utils.js';
import { CLIENT_VERSION, chat, getRequestHeaders, generateQuietPrompt, saveSettingsDebounced } from '../../../script.js';
import { eventSource, event_types } from '../../events.js';
import {
    getAgents,
    getAgentById,
    getAgentRegexScripts,
    loadAgents,
    saveAgent,
    deleteAgent,
    createDefaultAgent,
    importAgents,
    exportAllAgents,
    exportAgent,
    AGENT_CATEGORIES,
    DEFAULT_AGENT_MAX_TOKENS,
    getGlobalSettings,
    LEGACY_AGENT_MAX_TOKENS,
    normalizeAgentCategory,
    resolveConnectionProfile,
    setGlobalSettings,
    getGroups,
    getCustomGroups,
    loadBuiltinGroups,
    loadCustomGroups,
    saveGroup,
    deleteGroup,
    createDefaultGroup,
    isToolAgent,
    getEnabledToolAgents,
    normalizeToolDef,
} from './agent-store.js';
import { initAgentRunner, runAgentOnMessage, syncToolAgentRegistrations } from './agent-runner.js';
import {
    AGENT_REGEX_PLACEMENT,
    AGENT_REGEX_SUBSTITUTE,
    createDefaultRegexScript,
    normalizeRegexScript,
} from './regex-scripts.js';
import { initPathfinder, getPathfinderToolDefinitions, runDiagnostics as runPathfinderDiagnostics, buildPathfinderTree, getPathfinderSettings, setPathfinderSettings } from './pathfinder-init.js';
import { openPathfinderSettings, isPathfinderAgent } from './pathfinder-settings-ui.js';

const MODULE_NAME = 'in-chat-agents';

let collapsedCategories = new Set();

/** Built-in templates loaded from JSON files. */
let templates = [];
let templateRegexBundles = {};
let autoSeededTemplateIds = new Set();

const DEFAULT_BUNDLED_TEMPLATE_IDS = new Set([
    'tpl-prose-polisher',
    'tpl-pathfinder',
]);

/** Whether the agent list is in multi-select mode. */
let selectModeActive = false;
/** Set of agent IDs currently selected in select mode. */
const selectedAgentIds = new Set();
let suppressCardClickUntil = 0;

const REMOVED_BUNDLED_TEMPLATE_IDS = new Set([
    'tpl-anti-slop-regex',
    'tpl-director-core',
    'tpl-nsfw-mode',
]);

const REMOVED_BUNDLED_AGENT_NAMES = new Set([
    'anti-slop regex',
    'director core',
    'nsfw mode',
]);

const REMOVED_BUNDLED_GROUP_IDS = new Set([
    'grp-pura-director',
]);

const BUNDLED_REGEX_POST_DEFAULT_EXCLUDED_TEMPLATE_IDS = new Set();

const REGEX_PLACEMENT_LABELS = {
    [AGENT_REGEX_PLACEMENT.AI_OUTPUT]: 'AI Output',
    [AGENT_REGEX_PLACEMENT.USER_INPUT]: 'User Input',
    [AGENT_REGEX_PLACEMENT.SLASH_COMMAND]: 'Slash Command',
    [AGENT_REGEX_PLACEMENT.WORLD_INFO]: 'World Info',
    [AGENT_REGEX_PLACEMENT.REASONING]: 'Reasoning',
};

function getTemplateAssetUrl(filename) {
    return `/scripts/extensions/${MODULE_NAME}/templates/${filename}?v=${encodeURIComponent(CLIENT_VERSION || 'dev')}`;
}

function persistExtensionState() {
    extension_settings.inChatAgents = {
        ...(extension_settings.inChatAgents ?? {}),
        globalSettings: structuredClone(getGlobalSettings()),
        autoSeededTemplateIds: [...autoSeededTemplateIds],
    };
    delete extension_settings.inChatAgents.groups;
    saveSettingsDebounced();
}

function restoreAutoSeededTemplateIds(savedState) {
    const rawIds = Array.isArray(savedState?.autoSeededTemplateIds) ? savedState.autoSeededTemplateIds : [];
    autoSeededTemplateIds = new Set(
        rawIds
            .map(id => String(id ?? '').trim())
            .filter(Boolean),
    );
}

function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
}

function stopEventPropagation(event) {
    event.stopPropagation();
}

function normalizeAgentOrderValue(value, fallback = 100) {
    if (!Number.isFinite(Number(value))) {
        return fallback;
    }

    return Math.max(0, Math.min(999, Math.round(Number(value))));
}

function getConnectionManagerRequestService() {
    try {
        return SillyTavern.getContext().ConnectionManagerRequestService ?? null;
    } catch {
        return null;
    }
}

function getSupportedConnectionProfiles() {
    const CMRS = getConnectionManagerRequestService();
    if (!CMRS || typeof CMRS.getSupportedProfiles !== 'function') {
        return [];
    }

    try {
        return CMRS.getSupportedProfiles();
    } catch {
        return [];
    }
}

function populateConnectionProfileSelect(select, { emptyLabel = 'Use default profile', selectedValue = '' } = {}) {
    if (!(select instanceof HTMLSelectElement)) {
        return;
    }

    const profiles = getSupportedConnectionProfiles();
    const resolvedValue = typeof selectedValue === 'string' ? selectedValue : '';
    select.innerHTML = '';

    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = emptyLabel;
    select.appendChild(emptyOption);

    for (const profile of profiles) {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name || profile.id;
        select.appendChild(option);
    }

    if (resolvedValue && !profiles.some(profile => profile.id === resolvedValue)) {
        const missingOption = document.createElement('option');
        missingOption.value = resolvedValue;
        missingOption.textContent = `Missing profile (${resolvedValue})`;
        select.appendChild(missingOption);
    }

    select.value = resolvedValue;
}

function buildProfileNameMap() {
    return new Map(
        getSupportedConnectionProfiles()
            .map(profile => [profile.id, profile.name || profile.id]),
    );
}

function findTemplateById(templateId) {
    return templates.find(template => template.id === templateId);
}

function findTemplateForAgent(agent) {
    const sourceTemplateId = String(agent?.sourceTemplateId ?? '').trim();
    if (sourceTemplateId) {
        return findTemplateById(sourceTemplateId) ?? null;
    }

    const agentName = String(agent?.name ?? '').trim().toLowerCase();
    const agentPrompt = String(agent?.prompt ?? '').trim();
    if (!agentName) {
        return null;
    }

    return templates.find(template =>
        String(template?.name ?? '').trim().toLowerCase() === agentName &&
        String(template?.prompt ?? '').trim() === agentPrompt,
    ) ?? null;
}

function getBundledRegexScriptsForTemplate(templateId) {
    const bundledScripts = templateRegexBundles[String(templateId ?? '').trim()];
    return Array.isArray(bundledScripts)
        ? bundledScripts.map(script => normalizeRegexScript(script ?? {}))
        : [];
}

function shouldUseTrackerPromptPassDefaults(template) {
    return String(template?.category ?? '') === 'tracker';
}

function applyBundledTrackerPromptPass(template) {
    if (!shouldUseTrackerPromptPassDefaults(template)) {
        return template;
    }

    const postProcess = template?.postProcess && typeof template.postProcess === 'object'
        ? template.postProcess
        : {};

    return {
        ...template,
        phase: 'pre',
        postProcess: {
            ...postProcess,
            promptTransformEnabled: false,
            promptTransformShowNotifications: Object.hasOwn(postProcess, 'promptTransformShowNotifications')
                ? Boolean(postProcess.promptTransformShowNotifications)
                : true,
            promptTransformMode: 'append',
            promptTransformMaxTokens: Number.isFinite(Number(postProcess.promptTransformMaxTokens))
                ? Number(postProcess.promptTransformMaxTokens)
                : DEFAULT_AGENT_MAX_TOKENS,
        },
    };
}

function isBundledRegexPostDefaultTemplate(template, bundledScripts = null) {
    const templateId = String(template?.id ?? '').trim();
    if (!template
        || shouldUseTrackerPromptPassDefaults(template)
        || BUNDLED_REGEX_POST_DEFAULT_EXCLUDED_TEMPLATE_IDS.has(templateId)) {
        return false;
    }

    const resolvedScripts = Array.isArray(bundledScripts)
        ? bundledScripts
        : (Array.isArray(template?.regexScripts) ? template.regexScripts : getBundledRegexScriptsForTemplate(templateId));

    return Array.isArray(resolvedScripts) && resolvedScripts.length > 0;
}

function getBundledRegexPromptTransformMode(template) {
    return shouldUseTrackerPromptPassDefaults(template) ? 'append' : 'rewrite';
}

function applyBundledRegexPostDefaults(template, bundledScripts = null) {
    if (!isBundledRegexPostDefaultTemplate(template, bundledScripts)) {
        return template;
    }

    const postProcess = template?.postProcess && typeof template.postProcess === 'object'
        ? template.postProcess
        : {};
    const hasPrompt = Boolean(String(template?.prompt ?? '').trim());

    return {
        ...template,
        phase: 'post',
        postProcess: {
            ...postProcess,
            promptTransformEnabled: hasPrompt ? true : Boolean(postProcess.promptTransformEnabled),
            promptTransformShowNotifications: Object.hasOwn(postProcess, 'promptTransformShowNotifications')
                ? Boolean(postProcess.promptTransformShowNotifications)
                : true,
            promptTransformMode: hasPrompt
                ? getBundledRegexPromptTransformMode(template)
                : (postProcess.promptTransformMode === 'append' ? 'append' : 'rewrite'),
            promptTransformMaxTokens: Number.isFinite(Number(postProcess.promptTransformMaxTokens))
                ? Number(postProcess.promptTransformMaxTokens)
                : DEFAULT_AGENT_MAX_TOKENS,
        },
    };
}

function mergeTemplateDefaults(template) {
    const normalizedTemplate = {
        ...template,
        category: normalizeAgentCategory(template?.category, template?.id, template?.name),
    };
    const templateWithPromptPass = applyBundledTrackerPromptPass(normalizedTemplate);
    const bundledScripts = getBundledRegexScriptsForTemplate(templateWithPromptPass?.id);
    const templateWithRegexPostDefaults = applyBundledRegexPostDefaults(templateWithPromptPass, bundledScripts);
    if (bundledScripts.length === 0) {
        return {
            ...templateWithRegexPostDefaults,
            regexScripts: getAgentRegexScripts(templateWithRegexPostDefaults),
        };
    }

    return {
        ...templateWithRegexPostDefaults,
        regexScripts: bundledScripts,
    };
}

function getDefaultBundledTemplates() {
    return templates.filter(template => DEFAULT_BUNDLED_TEMPLATE_IDS.has(String(template?.id ?? '').trim()));
}

function getTemplateRegexCount(template) {
    return Array.isArray(template?.regexScripts) ? template.regexScripts.length : 0;
}

function describeRegexPlacements(regexScript) {
    return (regexScript.placement || [])
        .map(placement => REGEX_PLACEMENT_LABELS[placement] || `Placement ${placement}`)
        .join(', ');
}

function describeRegexScript(regexScript) {
    const mode = regexScript.promptOnly
        ? 'prompt'
        : (regexScript.markdownOnly ? 'markdown' : 'raw');
    const toggles = [
        mode,
        regexScript.runOnEdit ? 'edit' : null,
        regexScript.disabled ? 'disabled' : null,
    ].filter(Boolean).join(' • ');
    const placements = describeRegexPlacements(regexScript) || 'AI Output';
    return `${placements} • ${toggles}`;
}

function buildRegexTemplateLabel(regexCount) {
    if (regexCount <= 0) {
        return '';
    }

    return regexCount === 1 ? '1 regex' : `${regexCount} regex`;
}

function hasPromptTransform(agent) {
    return Boolean(
        agent?.postProcess?.promptTransformEnabled &&
        ['post', 'both'].includes(String(agent?.phase ?? '')) &&
        String(agent?.prompt ?? '').trim(),
    );
}

function getPromptTransformMode(agent) {
    return agent?.postProcess?.promptTransformMode === 'append' ? 'append' : 'rewrite';
}

function getPromptTransformLabel(agent) {
    return getPromptTransformMode(agent) === 'append' ? 'prompt append' : 'prompt rewrite';
}

function buildAgentFromTemplate(template) {
    return {
        ...createDefaultAgent(),
        ...structuredClone(mergeTemplateDefaults(template)),
        id: uuidv4(),
        sourceTemplateId: template.id,
        enabled: false,
    };
}

function buildAgentFromSnapshot(snapshot) {
    return {
        ...createDefaultAgent(),
        ...structuredClone(snapshot),
        id: uuidv4(),
        enabled: false,
    };
}

function shouldSkipBundledTemplateMigrations(agent) {
    return Boolean(agent?.phaseLocked);
}

function lockBundledAgentCustomization(agent, template = null) {
    const linkedTemplate = template ?? findTemplateForAgent(agent);
    const templateId = String(linkedTemplate?.id ?? agent?.sourceTemplateId ?? '').trim();
    if (!templateId) {
        return false;
    }

    agent.sourceTemplateId = templateId;
    agent.phaseLocked = true;
    return true;
}

function shouldMigrateBundledRegex(agent) {
    if (!agent || shouldSkipBundledTemplateMigrations(agent) || getAgentRegexScripts(agent).length > 0) {
        return false;
    }

    const template = findTemplateForAgent(agent);
    return Boolean(template && getTemplateRegexCount(template) > 0);
}

async function migrateBundledRegexScriptsToSavedAgents() {
    for (const agent of getAgents()) {
        if (!shouldMigrateBundledRegex(agent)) {
            continue;
        }

        const template = findTemplateForAgent(agent);
        if (!template) {
            continue;
        }

        agent.regexScripts = structuredClone(template.regexScripts);
        agent.sourceTemplateId = agent.sourceTemplateId || template.id;
        await saveAgent(agent);
    }
}

async function migrateBundledTemplateMetadataToSavedAgents() {
    let migratedCount = 0;

    for (const agent of getAgents()) {
        if (shouldSkipBundledTemplateMigrations(agent)) {
            continue;
        }

        const template = findTemplateForAgent(agent);
        if (!template) {
            continue;
        }

        const desiredTemplate = mergeTemplateDefaults(template);
        const desiredAuthor = typeof desiredTemplate.author === 'string' ? desiredTemplate.author : '';
        const currentAuthor = typeof agent.author === 'string' ? agent.author : '';

        if (currentAuthor === desiredAuthor) {
            continue;
        }

        agent.author = desiredAuthor;
        agent.sourceTemplateId = agent.sourceTemplateId || template.id;
        await saveAgent(agent);
        migratedCount++;
    }

    return migratedCount;
}

function shouldMigrateBundledTrackerPromptPass(agent, template) {
    if (!template || !shouldUseTrackerPromptPassDefaults(template)) {
        return false;
    }

    if (shouldSkipBundledTemplateMigrations(agent)) {
        return false;
    }

    if (String(agent?.name ?? '').trim() !== String(template?.name ?? '').trim()) {
        return false;
    }

    if (String(agent?.prompt ?? '').trim() !== String(template?.prompt ?? '').trim()) {
        return false;
    }

    const mergedDefaults = mergeTemplateDefaults(template);
    const desiredPhase = mergedDefaults.phase ?? 'pre';
    const desiredRole = mergedDefaults.injection?.role ?? 1;
    const desiredPromptTransformEnabled = Boolean(mergedDefaults.postProcess?.promptTransformEnabled);
    const desiredPromptTransformMode = mergedDefaults.postProcess?.promptTransformMode === 'append' ? 'append' : 'rewrite';
    return String(agent?.phase ?? '') !== desiredPhase
        || Number(agent?.injection?.role ?? 0) !== desiredRole
        || Boolean(agent?.postProcess?.promptTransformEnabled) !== desiredPromptTransformEnabled
        || (agent?.postProcess?.promptTransformMode ?? 'rewrite') !== desiredPromptTransformMode;
}

async function migrateBundledTrackerPromptPassesToSavedAgents() {
    let migratedCount = 0;

    for (const agent of getAgents()) {
        const template = findTemplateForAgent(agent);
        if (!shouldMigrateBundledTrackerPromptPass(agent, template)) {
            continue;
        }

        const mergedTemplate = mergeTemplateDefaults(template);
        agent.phase = String(mergedTemplate.phase ?? 'pre');
        agent.injection.role = Number(mergedTemplate.injection?.role ?? 1);
        agent.sourceTemplateId = agent.sourceTemplateId || template.id;
        agent.postProcess.promptTransformEnabled = Boolean(mergedTemplate.postProcess?.promptTransformEnabled);
        agent.postProcess.promptTransformShowNotifications = Object.hasOwn(mergedTemplate.postProcess ?? {}, 'promptTransformShowNotifications')
            ? Boolean(mergedTemplate.postProcess?.promptTransformShowNotifications)
            : true;
        agent.postProcess.promptTransformMode = mergedTemplate.postProcess?.promptTransformMode === 'append' ? 'append' : 'rewrite';
        agent.postProcess.promptTransformMaxTokens = Number(mergedTemplate.postProcess?.promptTransformMaxTokens) || DEFAULT_AGENT_MAX_TOKENS;
        await saveAgent(agent);
        migratedCount++;
    }

    return migratedCount;
}

function shouldMigrateBundledRegexPostDefaults(agent, template) {
    if (!template) {
        return false;
    }

    if (shouldSkipBundledTemplateMigrations(agent)) {
        return false;
    }

    const desiredTemplate = mergeTemplateDefaults(template);
    if (!isBundledRegexPostDefaultTemplate(desiredTemplate, desiredTemplate.regexScripts)) {
        return false;
    }

    if (String(agent?.name ?? '').trim() !== String(template?.name ?? '').trim()) {
        return false;
    }

    if (String(agent?.prompt ?? '').trim() !== String(template?.prompt ?? '').trim()) {
        return false;
    }

    if (String(agent?.phase ?? '') !== String(desiredTemplate?.phase ?? 'post')) {
        return true;
    }

    if (!Boolean(desiredTemplate?.postProcess?.promptTransformEnabled)) {
        return false;
    }

    if (!Boolean(agent?.postProcess?.promptTransformEnabled)) {
        return true;
    }

    return getPromptTransformMode(agent) !== getPromptTransformMode(desiredTemplate);
}

async function migrateBundledRegexPostDefaultsToSavedAgents() {
    let migratedCount = 0;

    for (const agent of getAgents()) {
        const template = findTemplateForAgent(agent);
        if (!shouldMigrateBundledRegexPostDefaults(agent, template)) {
            continue;
        }

        const desiredTemplate = mergeTemplateDefaults(template);
        agent.phase = String(desiredTemplate.phase ?? 'post');
        agent.sourceTemplateId = agent.sourceTemplateId || template.id;

        if (Boolean(desiredTemplate?.postProcess?.promptTransformEnabled)) {
            agent.postProcess.promptTransformEnabled = true;
            agent.postProcess.promptTransformShowNotifications = Object.hasOwn(desiredTemplate.postProcess ?? {}, 'promptTransformShowNotifications')
                ? Boolean(desiredTemplate.postProcess.promptTransformShowNotifications)
                : true;
            agent.postProcess.promptTransformMode = getPromptTransformMode(desiredTemplate);
            agent.postProcess.promptTransformMaxTokens = Number(desiredTemplate.postProcess?.promptTransformMaxTokens) || DEFAULT_AGENT_MAX_TOKENS;
        }

        await saveAgent(agent);
        migratedCount++;
    }

    return migratedCount;
}

async function migrateLegacyPromptTransformMaxTokens() {
    let migratedCount = 0;

    for (const agent of getAgents()) {
        if (shouldSkipBundledTemplateMigrations(agent)) {
            continue;
        }

        const currentValue = Number(agent?.postProcess?.promptTransformMaxTokens);
        if (currentValue !== LEGACY_AGENT_MAX_TOKENS) {
            continue;
        }

        agent.postProcess.promptTransformMaxTokens = DEFAULT_AGENT_MAX_TOKENS;
        await saveAgent(agent);
        migratedCount++;
    }

    return migratedCount;
}

function getAgentDuplicateKey(agent) {
    const agentName = String(agent?.name ?? '').trim().toLowerCase();
    const agentPrompt = String(agent?.prompt ?? '').trim();
    if (!agentName || !agentPrompt) {
        return '';
    }

    return `${agentName}\u0000${agentPrompt}`;
}

async function removeRedundantBundledAgentDuplicates() {
    const groupedAgents = new Map();

    for (const agent of getAgents()) {
        const key = getAgentDuplicateKey(agent);
        if (!key) {
            continue;
        }

        if (!groupedAgents.has(key)) {
            groupedAgents.set(key, []);
        }

        groupedAgents.get(key).push(agent);
    }

    const redundantIds = new Set();

    for (const grouped of groupedAgents.values()) {
        if (grouped.length < 2) {
            continue;
        }

        const templateBacked = grouped.filter(agent => String(agent?.sourceTemplateId ?? '').trim());
        const unsourced = grouped.filter(agent => !String(agent?.sourceTemplateId ?? '').trim());

        if (templateBacked.length !== 1 || unsourced.length === 0) {
            continue;
        }

        const template = findTemplateForAgent(templateBacked[0]);
        if (!template) {
            continue;
        }

        for (const agent of unsourced) {
            redundantIds.add(agent.id);
        }
    }

    for (const agentId of redundantIds) {
        await deleteAgent(agentId);
    }

    return redundantIds.size;
}

async function purgeRemovedBundledAgents() {
    let removedCount = 0;

    for (const agent of [...getAgents()]) {
        const sourceTemplateId = String(agent?.sourceTemplateId ?? '').trim();
        const agentName = String(agent?.name ?? '').trim().toLowerCase();
        const agentAuthor = String(agent?.author ?? '').trim().toLowerCase();
        const isRemovedBundledAgent = REMOVED_BUNDLED_TEMPLATE_IDS.has(sourceTemplateId)
            || (REMOVED_BUNDLED_AGENT_NAMES.has(agentName) && agentAuthor === 'sillybunny');

        if (!isRemovedBundledAgent) {
            continue;
        }

        await deleteAgent(agent.id);
        removedCount++;
    }

    return removedCount;
}

async function loadCustomGroupsFromServer() {
    const response = await fetch('/api/in-chat-agents/groups/list', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (!response.ok) {
        throw new Error('Failed to load custom groups');
    }

    const groups = await response.json();
    loadCustomGroups(groups);
}

async function ensureDefaultBundledAgents() {
    let touchedSeedState = false;

    for (const template of getDefaultBundledTemplates()) {
        const templateId = String(template?.id ?? '').trim();
        if (!templateId) {
            continue;
        }

        if (!autoSeededTemplateIds.has(templateId)) {
            const seededAgent = buildAgentFromTemplate(template);
            if (!hasMatchingAgentSnapshot(seededAgent)) {
                await saveAgent(seededAgent);
            }

            autoSeededTemplateIds.add(templateId);
            touchedSeedState = true;
        }
    }

    if (touchedSeedState) {
        persistExtensionState();
    }
}

async function migrateLegacyGroups(legacyGroups = []) {
    if (!Array.isArray(legacyGroups) || legacyGroups.length === 0) {
        return 0;
    }

    const existingCustomGroupIds = new Set(getCustomGroups().map(group => group.id));
    let migratedCount = 0;

    for (const group of legacyGroups) {
        if (!group || typeof group !== 'object') {
            continue;
        }

        const groupId = String(group.id ?? '').trim();
        if (groupId && existingCustomGroupIds.has(groupId)) {
            continue;
        }

        await saveGroup({
            ...structuredClone(group),
            builtin: false,
        });
        if (groupId) {
            existingCustomGroupIds.add(groupId);
        }
        migratedCount++;
    }

    return migratedCount;
}

function hasMatchingAgentSnapshot(snapshot, existingAgents = getAgents()) {
    const snapshotTemplateId = String(snapshot?.sourceTemplateId ?? '').trim();
    const snapshotName = String(snapshot?.name ?? '').trim().toLowerCase();
    const snapshotPrompt = String(snapshot?.prompt ?? '').trim();

    return existingAgents.some(agent => {
        const existingTemplateId = String(agent?.sourceTemplateId ?? '').trim();
        const existingName = String(agent?.name ?? '').trim().toLowerCase();
        const existingPrompt = String(agent?.prompt ?? '').trim();

        if (snapshotTemplateId && existingTemplateId === snapshotTemplateId) {
            return true;
        }

        if (snapshotTemplateId && snapshotName && existingName === snapshotName) {
            return true;
        }

        if (!snapshotName || existingName !== snapshotName) {
            return false;
        }

        if (snapshotPrompt) {
            return existingPrompt === snapshotPrompt;
        }

        return true;
    });
}

// ===================== Panel Rendering =====================

/**
 * Attaches touch-based drag-and-drop to a card element for mobile support.
 * The HTML5 drag API is not available on touch devices, so we use pointer events.
 * @param {HTMLElement} cardEl
 * @param {HTMLElement} itemsEl
 * @param {string} agentId
 */
function shouldInsertCardBeforeTarget(draggedEl, targetEl, clientX, clientY) {
    const targetRect = targetEl.getBoundingClientRect();
    const fallbackInsertBefore = clientY < targetRect.top + (targetRect.height / 2);

    if (!(draggedEl instanceof HTMLElement)) {
        return fallbackInsertBefore;
    }

    const draggedRect = draggedEl.getBoundingClientRect();
    const draggedMidY = draggedRect.top + (draggedRect.height / 2);
    const targetMidY = targetRect.top + (targetRect.height / 2);
    const sameRowThreshold = Math.min(draggedRect.height, targetRect.height) * 0.6;
    const isSameVisualRow = Math.abs(draggedMidY - targetMidY) <= sameRowThreshold;

    if (isSameVisualRow) {
        return clientX < targetRect.left + (targetRect.width / 2);
    }

    return fallbackInsertBefore;
}

function attachTouchDrag(cardEl, itemsEl, agentId) {
    let touchDragActive = false;
    let longPressTimer = null;
    let ghost = null;
    let ghostOffsetY = 0;

    function getCardAtPoint(x, y) {
        if (ghost) ghost.style.display = 'none';
        const el = document.elementFromPoint(x, y);
        if (ghost) ghost.style.display = '';
        return el ? el.closest('.ica--agent-card') : null;
    }

    function updateDropIndicator(clientX, clientY) {
        itemsEl.querySelectorAll('.ica--drop-indicator').forEach(el => el.remove());
        const target = getCardAtPoint(clientX, clientY);
        if (!target || target === cardEl) return;
        const indicator = document.createElement('div');
        indicator.className = 'ica--drop-indicator';
        if (shouldInsertCardBeforeTarget(cardEl, target, clientX, clientY)) {
            target.before(indicator);
        } else {
            target.after(indicator);
        }
    }

    function cancelLongPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }

    function cleanup() {
        cancelLongPress();
        touchDragActive = false;
        cardEl.classList.remove('ica--dragging');
        if (ghost) {
            ghost.remove();
            ghost = null;
        }
        itemsEl.querySelectorAll('.ica--drop-indicator').forEach(el => el.remove());
    }

    cardEl.addEventListener('touchstart', (event) => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        const startX = touch.clientX;
        const startY = touch.clientY;

        cancelLongPress();
        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            touchDragActive = true;
            cardEl.classList.add('ica--dragging');

            ghost = cardEl.cloneNode(true);
            ghost.classList.add('ica--drag-ghost');
            ghost.style.cssText = `
                position: fixed;
                left: ${cardEl.getBoundingClientRect().left}px;
                top: ${cardEl.getBoundingClientRect().top}px;
                width: ${cardEl.offsetWidth}px;
                opacity: 0.8;
                pointer-events: none;
                z-index: 9999;
                transform: scale(1.02);
            `;
            ghostOffsetY = startY - cardEl.getBoundingClientRect().top;
            document.body.appendChild(ghost);

            // Haptic feedback if available
            if (navigator.vibrate) navigator.vibrate(30);
        }, 500);
    }, { passive: true });

    cardEl.addEventListener('touchmove', (event) => {
        if (event.touches.length !== 1) { cleanup(); return; }
        const touch = event.touches[0];

        if (!touchDragActive) {
            // User is scrolling — cancel the long-press timer
            cancelLongPress();
            return;
        }

        event.preventDefault();
        ghost.style.top = `${touch.clientY - ghostOffsetY}px`;
        updateDropIndicator(touch.clientX, touch.clientY);
    }, { passive: false });

    cardEl.addEventListener('touchend', async (event) => {
        cancelLongPress();
        if (!touchDragActive) return;
        touchDragActive = false;
        cardEl.classList.remove('ica--dragging');

        if (ghost) {
            ghost.remove();
            ghost = null;
        }

        itemsEl.querySelectorAll('.ica--drop-indicator').forEach(el => el.remove());

        const touch = event.changedTouches[0];
        const target = getCardAtPoint(touch.clientX, touch.clientY);
        if (!target || target === cardEl || !itemsEl.contains(target)) return;

        const insertBefore = shouldInsertCardBeforeTarget(cardEl, target, touch.clientX, touch.clientY);
        if (insertBefore) {
            itemsEl.insertBefore(cardEl, target);
        } else {
            target.after(cardEl);
        }

        const orderedIds = Array.from(itemsEl.querySelectorAll('.ica--agent-card')).map(el => el.dataset.agentId);
        await reorderAgentsInGroup(orderedIds);
    });

    cardEl.addEventListener('touchcancel', cleanup);
}

async function reorderAgentsInGroup(orderedIds) {
    const normalizedOrderedIds = Array.from(new Set(
        orderedIds
            .map(id => String(id ?? '').trim())
            .filter(Boolean),
    ));

    if (normalizedOrderedIds.length === 0) {
        renderAgentList();
        return;
    }

    const firstAgent = getAgentById(normalizedOrderedIds[0]);
    if (!firstAgent) {
        renderAgentList();
        return;
    }

    const targetCategory = String(firstAgent.category ?? '').trim();
    const sortedAgents = getAgents()
        .sort((a, b) => Number(a?.injection?.order ?? 0) - Number(b?.injection?.order ?? 0));
    const categoryIds = sortedAgents
        .filter(agent => String(agent?.category ?? '').trim() === targetCategory)
        .map(agent => agent.id);

    if (categoryIds.length === 0) {
        renderAgentList();
        return;
    }

    const visibleIdSet = new Set(normalizedOrderedIds);
    const reorderedCategoryIds = [
        ...normalizedOrderedIds.filter(id => categoryIds.includes(id)),
        ...categoryIds.filter(id => !visibleIdSet.has(id)),
    ];

    let categoryIndex = 0;
    const finalOrderIds = sortedAgents.map(agent => {
        if (String(agent?.category ?? '').trim() !== targetCategory) {
            return agent.id;
        }

        const nextId = reorderedCategoryIds[categoryIndex];
        categoryIndex += 1;
        return nextId ?? agent.id;
    });

    for (let i = 0; i < finalOrderIds.length; i++) {
        const agent = getAgentById(finalOrderIds[i]);
        if (!agent) {
            continue;
        }

        const desiredOrder = i * 10;
        if (Number(agent?.injection?.order ?? 0) === desiredOrder) {
            continue;
        }

        agent.injection.order = desiredOrder;
        await saveAgent(agent);
    }

    renderAgentList();
}

function isTouchSortableDevice() {
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches
        || window.matchMedia?.('(any-pointer: coarse)').matches;
    return Boolean(coarsePointer);
}

function setupCategorySortable(itemsEl) {
    const items = $(itemsEl);
    if (!items.length || typeof items.sortable !== 'function') {
        return;
    }

    if (items.sortable('instance') !== undefined) {
        items.sortable('destroy');
    }

    const touchSortable = isTouchSortableDevice();

    items.sortable({
        items: '.ica--agent-card',
        handle: touchSortable ? '.ica--card-drag-handle' : null,
        delay: touchSortable ? 1500 : getSortableDelay(),
        distance: touchSortable ? 16 : 8,
        tolerance: 'pointer',
        cancel: '.ica--card-actions, .ica--card-actions *, .ica--card-toggle, .ica--card-select',
        placeholder: 'ica--agent-card-placeholder',
        forcePlaceholderSize: true,
        start: function (_event, ui) {
            suppressCardClickUntil = Date.now() + 750;
            ui.placeholder.height(ui.item.outerHeight());
        },
        stop: async function () {
            suppressCardClickUntil = Date.now() + 750;
            const orderedIds = items.children('.ica--agent-card').map((_, el) => el.dataset.agentId).get();
            await reorderAgentsInGroup(orderedIds);
        },
    });
}

function updateBulkBar() {
    const count = selectedAgentIds.size;
    $('#ica--bulkCount').text(`${count} selected`);
    $('#ica--bulkBar').toggle(selectModeActive);
    $('#ica--selectMode').toggleClass('is-active', selectModeActive);
}

function exitSelectMode() {
    selectModeActive = false;
    selectedAgentIds.clear();
    updateBulkBar();
    renderAgentList();
}

function openBulkEditPopup() {
    const popup = document.getElementById('ica--bulkEditPopup');
    if (!popup) return;
    $('#ica--bulkEdit-role').val('');
    $('#ica--bulkEdit-phase').val('');
    $('#ica--bulkEdit-promptMode').val('');
    $('#ica--bulkEdit-promptEnabled').val('');
    $('#ica--bulkEdit-ppEnabled').val('');
    $('#ica--bulkEdit-scan').val('');
    popup.style.display = '';
}

function closeBulkEditPopup() {
    const popup = document.getElementById('ica--bulkEditPopup');
    if (popup) popup.style.display = 'none';
}

function getScrollContainer(element) {
    let current = element instanceof HTMLElement ? element : null;

    while (current) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        const isScrollable = ['auto', 'scroll', 'overlay'].includes(overflowY)
            && current.scrollHeight > current.clientHeight;
        if (isScrollable) {
            return current;
        }

        current = current.parentElement;
    }

    return document.scrollingElement instanceof HTMLElement
        ? document.scrollingElement
        : document.documentElement;
}

function captureAgentListScrollState(agentListElement) {
    const scrollContainer = getScrollContainer(agentListElement);
    if (!(scrollContainer instanceof HTMLElement)) {
        return null;
    }

    return {
        container: scrollContainer,
        scrollTop: scrollContainer.scrollTop,
        scrollLeft: scrollContainer.scrollLeft,
    };
}

function restoreAgentListScrollState(scrollState) {
    if (!(scrollState?.container instanceof HTMLElement)) {
        return;
    }

    requestAnimationFrame(() => {
        scrollState.container.scrollTop = Math.min(
            scrollState.scrollTop,
            Math.max(0, scrollState.container.scrollHeight - scrollState.container.clientHeight),
        );
        scrollState.container.scrollLeft = scrollState.scrollLeft;
    });
}

async function applyBulkEdit() {
    const role = $('#ica--bulkEdit-role').val();
    const phase = $('#ica--bulkEdit-phase').val();
    const promptMode = $('#ica--bulkEdit-promptMode').val();
    const promptEnabled = $('#ica--bulkEdit-promptEnabled').val();
    const ppEnabled = $('#ica--bulkEdit-ppEnabled').val();
    const scan = $('#ica--bulkEdit-scan').val();

    if (!role && !phase && !promptMode && !promptEnabled && !ppEnabled && !scan) {
        toastr.info('No properties selected to change.');
        return;
    }

    let changed = 0;
    for (const id of selectedAgentIds) {
        const agent = getAgentById(id);
        if (!agent) continue;
        let dirty = false;

        if (role !== '') {
            const r = Number(role);
            if (agent.injection.role !== r) {
                agent.injection.role = r;
                dirty = true;
            }
        }
        if (phase !== '') {
            if (agent.phase !== phase) {
                agent.phase = phase;
                dirty = true;
            }
        }
        if (promptMode !== '') {
            agent.postProcess = agent.postProcess || {};
            if (agent.postProcess.promptTransformMode !== promptMode) {
                agent.postProcess.promptTransformMode = promptMode;
                dirty = true;
            }
        }
        if (promptEnabled !== '') {
            agent.postProcess = agent.postProcess || {};
            const val = promptEnabled === 'true';
            if (Boolean(agent.postProcess.promptTransformEnabled) !== val) {
                agent.postProcess.promptTransformEnabled = val;
                dirty = true;
            }
        }
        if (ppEnabled !== '') {
            agent.postProcess = agent.postProcess || {};
            const val = ppEnabled === 'true';
            if (Boolean(agent.postProcess.enabled) !== val) {
                agent.postProcess.enabled = val;
                dirty = true;
            }
        }
        if (scan !== '') {
            const val = scan === 'true';
            if (Boolean(agent.injection.scan) !== val) {
                agent.injection.scan = val;
                dirty = true;
            }
        }

        if (dirty) {
            lockBundledAgentCustomization(agent);
            await saveAgent(agent);
            changed++;
        }
    }

    closeBulkEditPopup();
    if (changed > 0) {
        toastr.success(`Updated ${changed} agent(s).`);
    } else {
        toastr.info('No agents needed updating.');
    }
    exitSelectMode();
}

/**
 * Re-renders the agent list panel.
 */
function renderAgentList() {
    const container = $('#ica--agentList');
    const scrollState = captureAgentListScrollState(container[0]);
    container.empty();
    const profileNames = buildProfileNameMap();

    const searchTerm = ($('#ica--search').val() || '').toString().toLowerCase();
    const categoryFilter = ($('#ica--categoryFilter').val() || '').toString();

    let agents = getAgents().sort((a, b) => a.injection.order - b.injection.order);

    if (searchTerm) {
        agents = agents.filter(a =>
            a.name.toLowerCase().includes(searchTerm) ||
            a.description.toLowerCase().includes(searchTerm) ||
            a.tags.some(t => t.toLowerCase().includes(searchTerm)),
        );
    }

    if (categoryFilter) {
        agents = agents.filter(a => a.category === categoryFilter);
    }

    // Group by category
    const grouped = {};
    for (const cat of Object.keys(AGENT_CATEGORIES)) {
        const catAgents = agents.filter(a => a.category === cat);
        if (catAgents.length > 0) {
            grouped[cat] = catAgents;
        }
    }

    if (Object.keys(grouped).length === 0) {
        container.append('<div class="ica--empty-state">No agents yet. Click <b>New Agent</b> or <b>Templates</b> to get started.</div>');
        restoreAgentListScrollState(scrollState);
        return;
    }

    const phaseLabels = { pre: 'pre', post: 'post', both: 'pre + post' };

    for (const [cat, catAgents] of Object.entries(grouped)) {
        const catInfo = AGENT_CATEGORIES[cat];
        const group = $('<div class="ica--category-group"></div>');

        const header = $(`
            <div class="ica--category-header${collapsedCategories.has(cat) ? ' collapsed' : ''}">
                <i class="fa-solid fa-chevron-down ica--chevron"></i>
                <i class="fa-solid ${catInfo.icon}"></i>
                ${catInfo.label}
                <span class="ica--category-count">${catAgents.length}</span>
            </div>
        `);
        header.on('click', function () {
            $(this).toggleClass('collapsed');
            if ($(this).hasClass('collapsed')) {
                collapsedCategories.add(cat);
            } else {
                collapsedCategories.delete(cat);
            }
        });
        group.append(header);

        const items = $('<div class="ica--category-items"></div>');

        for (const agent of catAgents) {
            const enabledClass = agent.enabled ? 'is-enabled' : '';
            const toggleClass = agent.enabled ? 'is-on' : '';
            const desc = agent.description || agent.prompt.substring(0, 80).replace(/\n/g, ' ') + (agent.prompt.length > 80 ? '...' : '');
            const regexCount = getAgentRegexScripts(agent).length;
            const promptTransformEnabled = hasPromptTransform(agent);
            const promptTransformLabel = getPromptTransformLabel(agent);
            const connectionProfileLabel = agent.connectionProfile
                ? profileNames.get(agent.connectionProfile) || `Missing profile (${agent.connectionProfile})`
                : '';
            const modelOverrideLabel = agent.modelOverride && agent.modelOverride.trim()
                ? agent.modelOverride.trim()
                : '';

            const card = $(`
                <div class="ica--agent-card ${enabledClass}${selectModeActive ? ' ica--selectable' : ''}${selectedAgentIds.has(agent.id) ? ' ica--selected' : ''}" data-agent-id="${escapeHtml(agent.id)}">
                    <div class="ica--card-header">
                        ${selectModeActive ? `<input type="checkbox" class="ica--card-select" title="Select agent" ${selectedAgentIds.has(agent.id) ? 'checked' : ''} />` : `<button type="button" class="ica--card-toggle ${toggleClass}" title="${agent.enabled ? 'Disable' : 'Enable'}"></button>`}
                        <span class="ica--card-name">${escapeHtml(agent.name)}</span>
                        <span class="ica--card-phase">${phaseLabels[agent.phase] || agent.phase}</span>
                        <button type="button" class="ica--card-drag-handle" title="Hold and drag to reorder">
                            <i class="fa-solid fa-grip-vertical"></i>
                        </button>
                    </div>
                    <div class="ica--card-desc">${escapeHtml(desc)}</div>
                    <div class="ica--card-meta">
                        ${agent.conditions.triggerProbability < 100 ? `<span class="ica--card-pill"><i class="fa-solid fa-dice fa-xs"></i> ${agent.conditions.triggerProbability}%</span>` : ''}
                        ${agent.injection.position === 1 ? `<span class="ica--card-pill">depth ${agent.injection.depth}</span>` : ''}
                        ${promptTransformEnabled ? `<span class="ica--card-pill"><i class="fa-solid fa-robot fa-xs"></i> ${promptTransformLabel}</span>` : ''}
                        ${regexCount > 0 ? `<span class="ica--card-pill"><i class="fa-solid fa-wand-magic-sparkles fa-xs"></i> ${regexCount} regex</span>` : ''}
                        ${connectionProfileLabel ? `<span class="ica--card-pill"><i class="fa-solid fa-plug fa-xs"></i> ${escapeHtml(connectionProfileLabel)}</span>` : ''}
                        ${modelOverrideLabel ? `<span class="ica--card-pill"><i class="fa-solid fa-microchip fa-xs"></i> ${escapeHtml(modelOverrideLabel)}</span>` : ''}
                    </div>
                    <div class="ica--card-actions">
                        ${isPathfinderAgent(agent) ? '' : '<button type="button" class="ica--card-btn ica--btn-run" title="Manually apply this agent to the last assistant reply"><i class="fa-solid fa-robot"></i> Apply to Last Reply</button>'}
                        <button type="button" class="ica--card-btn ica--btn-edit"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                        ${isPathfinderAgent(agent) ? '' : '<button type="button" class="ica--card-btn ica--btn-export"><i class="fa-solid fa-download"></i> Export</button>'}
                        <button type="button" class="ica--card-btn ica--btn-delete caution"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `);

            card.on('click', () => {
                if (Date.now() < suppressCardClickUntil) {
                    return;
                }

                if (selectModeActive) {
                    if (selectedAgentIds.has(agent.id)) {
                        selectedAgentIds.delete(agent.id);
                    } else {
                        selectedAgentIds.add(agent.id);
                    }
                    updateBulkBar();
                    renderAgentList();
                    return;
                }
                openEditor(agent.id);
            });

            card.find('.ica--card-select').on('click change', function (event) {
                event.stopPropagation();
                if ($(this).prop('checked')) {
                    selectedAgentIds.add(agent.id);
                } else {
                    selectedAgentIds.delete(agent.id);
                }
                updateBulkBar();
                renderAgentList();
            });

            card.find('.ica--card-drag-handle').on('click', stopEvent);

            card.find('.ica--card-toggle').on('click', async function (event) {
                stopEvent(event);
                agent.enabled = !agent.enabled;
                await saveAgent(agent);
                renderAgentList();
            });

            card.find('.ica--btn-edit').on('click', event => {
                stopEvent(event);
                openEditor(agent.id);
            });

            card.find('.ica--btn-run').on('click', async event => {
                stopEvent(event);
                const lastCharMessageIndex = chat.findLastIndex(m => m && !m.is_user && !m.is_system);
                if (lastCharMessageIndex < 0) {
                    toastr.warning('No assistant reply yet to manually apply this agent to.');
                    return;
                }
                await runAgentOnMessage(agent.id, lastCharMessageIndex);
            });

            card.find('.ica--btn-export').on('click', event => {
                stopEvent(event);
                const data = exportAgent(agent.id);
                if (data) download(JSON.stringify(data, null, 2), `${agent.name}.json`, 'application/json');
            });

            card.find('.ica--btn-delete').on('click', async event => {
                stopEvent(event);
                const result = await new Popup('Delete agent "' + escapeHtml(agent.name) + '"?', POPUP_TYPE.CONFIRM).show();
                if (result === POPUP_RESULT.AFFIRMATIVE) {
                    await deleteAgent(agent.id);
                    renderAgentList();
                }
            });

            items.append(card);
        }

        setupCategorySortable(items[0]);
        group.append(items);
        container.append(group);
    }

    restoreAgentListScrollState(scrollState);
}

// ===================== Editor Modal =====================

async function openRegexScriptEditor(existingScript = null) {
    const regexScript = existingScript
        ? normalizeRegexScript(structuredClone(existingScript))
        : createDefaultRegexScript();

    const placementOptions = [
        AGENT_REGEX_PLACEMENT.AI_OUTPUT,
        AGENT_REGEX_PLACEMENT.USER_INPUT,
        AGENT_REGEX_PLACEMENT.SLASH_COMMAND,
        AGENT_REGEX_PLACEMENT.WORLD_INFO,
        AGENT_REGEX_PLACEMENT.REASONING,
    ].map(placement => `
        <label class="checkbox_label">
            <input type="checkbox" name="ica--regex-placement" value="${placement}" ${regexScript.placement.includes(placement) ? 'checked' : ''} />
            <span>${REGEX_PLACEMENT_LABELS[placement]}</span>
        </label>
    `).join('');

    const html = $(`
        <div class="ica--regex-editor">
            <label class="ica--editor-row">Script Name
                <input type="text" id="ica--regex-name" class="text_pole" placeholder="Regex script name" value="${escapeHtml(regexScript.scriptName)}" />
            </label>
            <label class="ica--editor-row">Find Regex
                <textarea id="ica--regex-find" class="text_pole textarea_compact" rows="4" placeholder="/pattern/g or plain regex">${escapeHtml(regexScript.findRegex)}</textarea>
            </label>
            <label class="ica--editor-row">Replace String
                <textarea id="ica--regex-replace" class="text_pole textarea_compact" rows="4" placeholder="Replacement text">${escapeHtml(regexScript.replaceString)}</textarea>
            </label>
            <label class="ica--editor-row">Trim Strings <small>(one per line)</small>
                <textarea id="ica--regex-trim" class="text_pole textarea_compact" rows="3" placeholder="Text removed from capture groups before substitution">${escapeHtml((regexScript.trimStrings || []).join('\n'))}</textarea>
            </label>
            <div class="ica--editor-section ica--regex-subsection">
                <strong>Placement</strong>
                <div class="ica--regex-placement-grid">${placementOptions}</div>
                <div class="ica--regex-note">Bundled in-chat agent regex currently executes on output formatting. Other placements are preserved for compatibility.</div>
            </div>
            <div class="ica--editor-row flex-container flexGap5">
                <label class="flex1">Substitute Find Regex
                    <select id="ica--regex-substitute" class="text_pole">
                        <option value="${AGENT_REGEX_SUBSTITUTE.NONE}">None</option>
                        <option value="${AGENT_REGEX_SUBSTITUTE.RAW}">Raw macros</option>
                        <option value="${AGENT_REGEX_SUBSTITUTE.ESCAPED}">Escaped macros</option>
                    </select>
                </label>
                <label class="flex1">Min Depth
                    <input type="number" id="ica--regex-minDepth" class="text_pole" placeholder="blank" value="${regexScript.minDepth ?? ''}" />
                </label>
                <label class="flex1">Max Depth
                    <input type="number" id="ica--regex-maxDepth" class="text_pole" placeholder="blank" value="${regexScript.maxDepth ?? ''}" />
                </label>
            </div>
            <div class="ica--regex-toggles">
                <label class="checkbox_label"><input type="checkbox" id="ica--regex-markdownOnly" ${regexScript.markdownOnly ? 'checked' : ''} /><span>Markdown only</span></label>
                <label class="checkbox_label"><input type="checkbox" id="ica--regex-promptOnly" ${regexScript.promptOnly ? 'checked' : ''} /><span>Prompt only</span></label>
                <label class="checkbox_label"><input type="checkbox" id="ica--regex-runOnEdit" ${regexScript.runOnEdit ? 'checked' : ''} /><span>Run on edit</span></label>
                <label class="checkbox_label"><input type="checkbox" id="ica--regex-disabled" ${regexScript.disabled ? 'checked' : ''} /><span>Disabled</span></label>
            </div>
        </div>
    `);

    html.find('#ica--regex-substitute').val(String(regexScript.substituteRegex ?? AGENT_REGEX_SUBSTITUTE.NONE));

    const result = await new Popup(html, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Save Regex',
        cancelButton: 'Cancel',
        wide: true,
        large: true,
    }).show();

    if (result !== POPUP_RESULT.AFFIRMATIVE) {
        return null;
    }

    const placement = [];
    html.find('input[name="ica--regex-placement"]:checked').each(function () {
        placement.push(Number($(this).val()));
    });

    const findRegex = html.find('#ica--regex-find').val()?.toString() ?? '';
    if (!findRegex.trim()) {
        toastr.warning('Regex scripts need a find pattern.');
        return null;
    }

    return normalizeRegexScript({
        ...regexScript,
        scriptName: html.find('#ica--regex-name').val()?.toString().trim() || 'Regex Script',
        findRegex,
        replaceString: html.find('#ica--regex-replace').val()?.toString() ?? '',
        trimStrings: html.find('#ica--regex-trim').val()?.toString()
            .split('\n')
            .map(value => value.trim())
            .filter(Boolean),
        placement,
        substituteRegex: Number(html.find('#ica--regex-substitute').val()),
        markdownOnly: html.find('#ica--regex-markdownOnly').prop('checked'),
        promptOnly: html.find('#ica--regex-promptOnly').prop('checked'),
        runOnEdit: html.find('#ica--regex-runOnEdit').prop('checked'),
        disabled: html.find('#ica--regex-disabled').prop('checked'),
        minDepth: html.find('#ica--regex-minDepth').val()?.toString() ?? '',
        maxDepth: html.find('#ica--regex-maxDepth').val()?.toString() ?? '',
    });
}

/**
 * Opens the agent editor for the given agent ID (or creates a new one).
 * @param {string|null} agentId
 */
async function openEditor(agentId = null) {
    const existingAgent = agentId ? getAgentById(agentId) : null;
    if (agentId && !existingAgent) return;
    const agent = existingAgent ? structuredClone(existingAgent) : createDefaultAgent();
    const originalAgentState = JSON.stringify(agent);
    if (!agent) return;

    // Check if this is a Pathfinder agent - open special settings panel
    if (isPathfinderAgent(agent)) {
        await openPathfinderEditor(agent);
        return;
    }

    let regexScripts = getAgentRegexScripts(agent).map(script => structuredClone(script));
    const template = findTemplateForAgent(agent);
    const bundledRegexScripts = Array.isArray(template?.regexScripts)
        ? template.regexScripts.map(script => structuredClone(script))
        : [];

    const html = await renderExtensionTemplateAsync(MODULE_NAME, 'editor');
    if (!html) {
        toastr.error('Could not load the agent editor. Please refresh the page and try again.');
        return;
    }

    const editorEl = $(html);

    // Populate fields
    editorEl.find('#ica--editor-name').val(agent.name);
    editorEl.find('#ica--editor-category').val(agent.category);
    editorEl.find('#ica--editor-phase').val(agent.phase);
    editorEl.find('#ica--editor-description').val(agent.description);
    editorEl.find('#ica--editor-prompt').val(agent.prompt);
    populateConnectionProfileSelect(editorEl.find('#ica--editor-connectionProfile')[0], {
        emptyLabel: 'Use extension default',
        selectedValue: agent.connectionProfile || '',
    });
    editorEl.find('#ica--editor-modelOverride').val(agent.modelOverride || '');

    // Injection
    editorEl.find('#ica--editor-position').val(agent.injection.position);
    editorEl.find('#ica--editor-depth').val(agent.injection.depth);
    editorEl.find('#ica--editor-role').val(agent.injection.role);
    editorEl.find('#ica--editor-order').val(agent.injection.order);
    editorEl.find('#ica--editor-scan').prop('checked', agent.injection.scan);

    // Post-process
    const postProcessType = agent.postProcess.type === 'append' ? 'append' : 'extract';
    editorEl.find('#ica--editor-pp-promptEnabled').prop('checked', Boolean(agent.postProcess.promptTransformEnabled));
    editorEl.find('#ica--editor-pp-promptMode').val(getPromptTransformMode(agent));
    editorEl.find('#ica--editor-pp-promptMaxTokens').val(agent.postProcess.promptTransformMaxTokens ?? DEFAULT_AGENT_MAX_TOKENS);
    editorEl.find('#ica--editor-pp-promptShowNotifications').prop('checked', Boolean(agent.postProcess.promptTransformShowNotifications));
    editorEl.find('#ica--editor-pp-enabled').prop('checked', agent.postProcess.enabled && agent.postProcess.type !== 'regex');
    editorEl.find('#ica--editor-pp-type').val(postProcessType);
    editorEl.find('#ica--editor-pp-extractPattern').val(agent.postProcess.extractPattern);
    editorEl.find('#ica--editor-pp-extractVariable').val(agent.postProcess.extractVariable);
    editorEl.find('#ica--editor-pp-appendText').val(agent.postProcess.appendText);

    // Conditions
    editorEl.find('#ica--editor-probability').val(agent.conditions.triggerProbability);
    editorEl.find('#ica--editor-keywords').val((agent.conditions.triggerKeywords || []).join(', '));
    editorEl.find('#ica--editor-type-normal').prop('checked', agent.conditions.generationTypes.includes('normal'));
    editorEl.find('#ica--editor-type-continue').prop('checked', agent.conditions.generationTypes.includes('continue'));
    editorEl.find('#ica--editor-type-impersonate').prop('checked', agent.conditions.generationTypes.includes('impersonate'));
    editorEl.find('#ica--editor-type-quiet').prop('checked', agent.conditions.generationTypes.includes('quiet'));

    // Show/hide sections based on phase
    function updatePhaseVisibility() {
        const phase = editorEl.find('#ica--editor-phase').val();
        editorEl.find('#ica--injection-section').toggle(phase === 'pre' || phase === 'both');
        editorEl.find('#ica--postprocess-section').toggle(phase === 'post' || phase === 'both');
    }
    editorEl.find('#ica--editor-phase').on('change', updatePhaseVisibility);
    updatePhaseVisibility();

    // Show/hide post-process options
    function updatePPVisibility() {
        const promptEnabled = editorEl.find('#ica--editor-pp-promptEnabled').prop('checked');
        editorEl.find('#ica--pp-prompt-options').toggle(promptEnabled);

        const enabled = editorEl.find('#ica--editor-pp-enabled').prop('checked');
        editorEl.find('#ica--pp-options').toggle(enabled);

        const type = editorEl.find('#ica--editor-pp-type').val();
        editorEl.find('#ica--pp-extract').toggle(type === 'extract');
        editorEl.find('#ica--pp-append').toggle(type === 'append');
    }
    editorEl.find('#ica--editor-pp-promptEnabled, #ica--editor-pp-enabled, #ica--editor-pp-type').on('change', updatePPVisibility);
    updatePPVisibility();

    function renderRegexList() {
        const list = editorEl.find('#ica--regex-list');
        list.empty();

        if (regexScripts.length === 0) {
            list.append('<div class="ica--regex-empty">No regex scripts yet. Add one or load bundled template regex.</div>');
            return;
        }

        for (const [index, script] of regexScripts.entries()) {
            const item = $(`
                <div class="ica--regex-item">
                    <div class="ica--regex-item-main">
                        <div class="ica--regex-item-title">${escapeHtml(script.scriptName || 'Regex Script')}</div>
                        <div class="ica--regex-item-meta">${escapeHtml(describeRegexScript(script))}</div>
                        <div class="ica--regex-item-pattern">${escapeHtml(script.findRegex)}</div>
                    </div>
                    <div class="ica--regex-item-actions">
                        <button type="button" class="ica--card-btn ica--regex-up" title="Move up"><i class="fa-solid fa-arrow-up"></i></button>
                        <button type="button" class="ica--card-btn ica--regex-down" title="Move down"><i class="fa-solid fa-arrow-down"></i></button>
                        <button type="button" class="ica--card-btn ica--regex-edit"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                        <button type="button" class="ica--card-btn caution ica--regex-delete"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `);

            item.find('.ica--regex-edit').on('click', async () => {
                const updatedScript = await openRegexScriptEditor(script);
                if (updatedScript) {
                    regexScripts[index] = updatedScript;
                    renderRegexList();
                }
            });

            item.find('.ica--regex-up').on('click', () => {
                if (index === 0) return;
                [regexScripts[index - 1], regexScripts[index]] = [regexScripts[index], regexScripts[index - 1]];
                renderRegexList();
            });

            item.find('.ica--regex-down').on('click', () => {
                if (index >= regexScripts.length - 1) return;
                [regexScripts[index + 1], regexScripts[index]] = [regexScripts[index], regexScripts[index + 1]];
                renderRegexList();
            });

            item.find('.ica--regex-delete').on('click', () => {
                regexScripts.splice(index, 1);
                renderRegexList();
            });

            list.append(item);
        }
    }

    editorEl.find('#ica--regex-note').text(
        bundledRegexScripts.length > 0
            ? `This template ships with ${buildRegexTemplateLabel(bundledRegexScripts.length)}.`
            : 'Attach ST-style regex scripts that run when this agent activates.',
    );

    if (bundledRegexScripts.length > 0) {
        editorEl.find('#ica--regex-resetTemplate').show();
        editorEl.find('#ica--regex-resetTemplate').on('click', () => {
            regexScripts = bundledRegexScripts.map(script => structuredClone(script));
            renderRegexList();
            toastr.success('Loaded bundled template regex.');
        });
    }

    editorEl.find('#ica--regex-add').on('click', async () => {
        const newScript = await openRegexScriptEditor();
        if (newScript) {
            regexScripts.push(newScript);
            renderRegexList();
        }
    });
    renderRegexList();

    // Refine with AI button
    editorEl.find('#ica--editor-refine').on('click', async () => {
        const currentPrompt = editorEl.find('#ica--editor-prompt').val()?.toString() || '';
        const category = editorEl.find('#ica--editor-category').val()?.toString() || 'custom';
        const phase = editorEl.find('#ica--editor-phase').val()?.toString() || 'pre';
        const connectionProfile = editorEl.find('#ica--editor-connectionProfile').val()?.toString() || '';
        const refined = await refinePromptWithAI(currentPrompt, category, phase, connectionProfile);
        if (refined) {
            editorEl.find('#ica--editor-prompt').val(refined);
        }
    });

    // Show popup
    const result = await new Popup(editorEl, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Save',
        cancelButton: 'Cancel',
        wide: true,
        large: true,
    }).show();

    if (result !== POPUP_RESULT.AFFIRMATIVE) return;

    // Read values back
    agent.name = editorEl.find('#ica--editor-name').val().toString().trim() || 'Untitled Agent';
    agent.category = editorEl.find('#ica--editor-category').val().toString();
    agent.phase = editorEl.find('#ica--editor-phase').val().toString();
    agent.description = editorEl.find('#ica--editor-description').val().toString().trim();
    agent.connectionProfile = editorEl.find('#ica--editor-connectionProfile').val()?.toString() || '';
    agent.modelOverride = editorEl.find('#ica--editor-modelOverride').val()?.toString().trim() || '';
    agent.prompt = editorEl.find('#ica--editor-prompt').val().toString();

    agent.injection.position = Number(editorEl.find('#ica--editor-position').val());
    agent.injection.depth = Number(editorEl.find('#ica--editor-depth').val());
    agent.injection.role = Number(editorEl.find('#ica--editor-role').val());
    agent.injection.order = Number(editorEl.find('#ica--editor-order').val());
    agent.injection.scan = editorEl.find('#ica--editor-scan').prop('checked');

    if (editorEl.find('#ica--editor-pp-promptEnabled').prop('checked') && !agent.prompt.trim()) {
        toastr.warning('Prompt-based post-generation passes need an agent prompt.');
        return;
    }

    agent.postProcess.enabled = editorEl.find('#ica--editor-pp-enabled').prop('checked');
    agent.postProcess.type = editorEl.find('#ica--editor-pp-type').val().toString();
    agent.postProcess.extractPattern = editorEl.find('#ica--editor-pp-extractPattern').val().toString();
    agent.postProcess.extractVariable = editorEl.find('#ica--editor-pp-extractVariable').val().toString();
    agent.postProcess.appendText = editorEl.find('#ica--editor-pp-appendText').val().toString();
    agent.postProcess.promptTransformEnabled = editorEl.find('#ica--editor-pp-promptEnabled').prop('checked');
    agent.postProcess.promptTransformShowNotifications = editorEl.find('#ica--editor-pp-promptShowNotifications').prop('checked');
    agent.postProcess.promptTransformMode = editorEl.find('#ica--editor-pp-promptMode').val()?.toString() === 'append' ? 'append' : 'rewrite';
    agent.postProcess.promptTransformMaxTokens = Number(editorEl.find('#ica--editor-pp-promptMaxTokens').val()) || DEFAULT_AGENT_MAX_TOKENS;
    agent.regexScripts = regexScripts.map(script => normalizeRegexScript(script));

    agent.conditions.triggerProbability = Number(editorEl.find('#ica--editor-probability').val());
    const kwText = editorEl.find('#ica--editor-keywords').val().toString();
    agent.conditions.triggerKeywords = kwText ? kwText.split(',').map(s => s.trim()).filter(Boolean) : [];

    const genTypes = [];
    if (editorEl.find('#ica--editor-type-normal').prop('checked')) genTypes.push('normal');
    if (editorEl.find('#ica--editor-type-continue').prop('checked')) genTypes.push('continue');
    if (editorEl.find('#ica--editor-type-impersonate').prop('checked')) genTypes.push('impersonate');
    if (editorEl.find('#ica--editor-type-quiet').prop('checked')) genTypes.push('quiet');
    agent.conditions.generationTypes = genTypes;

    if (JSON.stringify(agent) !== originalAgentState || agent.phaseLocked) {
        lockBundledAgentCustomization(agent, template);
    }

    await saveAgent(agent);
    renderAgentList();
}

// ===================== Template Browser =====================

/**
 * Loads built-in template agents from the templates directory.
 */
async function loadTemplates() {
    if (templates.length > 0) {
        return;
    }

    try {
        const [templateResponse, regexBundleResponse, groupResponse] = await Promise.all([
            fetch(getTemplateAssetUrl('index.json')),
            fetch(getTemplateAssetUrl('regex-bundles.json')),
            fetch(getTemplateAssetUrl('groups.json')),
        ]);

        const rawTemplates = templateResponse.ok ? await templateResponse.json() : [];
        templateRegexBundles = regexBundleResponse.ok ? await regexBundleResponse.json() : {};
        templates = Array.isArray(rawTemplates)
            ? rawTemplates
                .filter(template => !REMOVED_BUNDLED_TEMPLATE_IDS.has(String(template?.id ?? '').trim()))
                .map(template => mergeTemplateDefaults(template))
            : [];

        if (groupResponse.ok) {
            const rawGroups = await groupResponse.json();
            const builtinGroups = Array.isArray(rawGroups)
                ? rawGroups
                    .filter(group => !REMOVED_BUNDLED_GROUP_IDS.has(String(group?.id ?? '').trim()))
                    .map(group => ({
                        ...group,
                        agentTemplateIds: Array.isArray(group?.agentTemplateIds)
                            ? group.agentTemplateIds.filter(id => !REMOVED_BUNDLED_TEMPLATE_IDS.has(String(id ?? '').trim()))
                            : [],
                    }))
                : [];
            loadBuiltinGroups(builtinGroups);
        }
    } catch (e) {
        console.warn('[InChatAgents] Failed to load templates:', e);
    }
}

/**
 * Opens the template browser modal.
 */
async function openTemplateBrowser() {
    await loadTemplates();

    if (templates.length === 0) {
        toastr.info('No templates available.');
        return;
    }

    const wrapper = $('<div class="ica--template-browser"></div>');

    // Groups section
    const allGroups = getGroups();
    if (allGroups.length > 0) {
        const groupSection = $('<div class="ica--template-section"></div>');
        groupSection.append('<div class="ica--template-section-title"><i class="fa-solid fa-layer-group"></i> Agent Groups</div>');
        groupSection.append('<p class="ica--template-section-desc">Apply a whole set of agents at once. Agents you already have won\'t be duplicated.</p>');

        const groupGrid = $('<div class="ica--group-grid"></div>');
        for (const group of allGroups) {
            const count = group.agentTemplateIds.length + (group.customAgents?.length ?? 0);
            const card = $(`
                <div class="ica--group-card">
                    <div class="ica--group-card-header">
                        <strong>${escapeHtml(group.name)}</strong>
                        <span class="ica--card-pill">${count} agents</span>
                    </div>
                    <div class="ica--group-card-desc">${escapeHtml(group.description)}</div>
                    <div class="ica--group-card-actions">
                        <button type="button" class="ica--card-btn ica--grp-apply"><i class="fa-solid fa-download"></i> Apply Group</button>
                        ${!group.builtin ? '<button type="button" class="ica--card-btn ica--grp-delete caution"><i class="fa-solid fa-trash"></i></button>' : ''}
                    </div>
                </div>
            `);

            card.on('click', async () => {
                await applyGroup(group);
            });

            card.find('.ica--grp-apply').on('click', async event => {
                stopEvent(event);
                await applyGroup(group);
            });

            card.find('.ica--grp-delete').on('click', async event => {
                stopEvent(event);
                const r = await new Popup(`Delete group "${escapeHtml(group.name)}"?`, POPUP_TYPE.CONFIRM).show();
                if (r === POPUP_RESULT.AFFIRMATIVE) {
                    await deleteGroup(group.id);
                    card.remove();
                    toastr.success(`Deleted group "${group.name}".`);
                }
            });

            groupGrid.append(card);
        }

        // "Create Group" card
        const createCard = $(`
            <div class="ica--group-card ica--group-card-create">
                <div class="ica--group-card-header">
                    <strong><i class="fa-solid fa-plus"></i> Create Custom Group</strong>
                </div>
                <div class="ica--group-card-desc">Save your current agents as a reusable group.</div>
            </div>
        `);
        createCard.on('click', async () => {
            await createCustomGroup();
        });
        groupGrid.append(createCard);

        groupSection.append(groupGrid);
        wrapper.append(groupSection);
    }

    // Individual templates section
    const tplSection = $('<div class="ica--template-section"></div>');
    tplSection.append('<div class="ica--template-section-title"><i class="fa-solid fa-puzzle-piece"></i> Individual Templates</div>');
    tplSection.append('<p class="ica--template-section-desc">Bundled trackers and helpers live here. Click any card to install it into your agent list.</p>');

    const grid = $('<div class="ica--template-grid"></div>');

    for (const tpl of templates) {
        const catInfo = AGENT_CATEGORIES[tpl.category] || AGENT_CATEGORIES.custom;
        const regexCount = getTemplateRegexCount(tpl);
        const trackerBadge = tpl.category === 'tracker'
            ? '<span class="ica--card-pill"><i class="fa-solid fa-chart-line fa-xs"></i> Bundled tracker</span>'
            : '';
        const card = $(`
            <div class="ica--template-card" data-id="${tpl.id}">
                <div class="ica--template-card-header">
                    <span class="ica--template-card-name">${escapeHtml(tpl.name)}</span>
                    <span class="ica--template-card-category"><i class="fa-solid ${catInfo.icon}"></i> ${catInfo.label}</span>
                </div>
                <div class="ica--template-card-description">${escapeHtml(tpl.description)}</div>
                ${(trackerBadge || regexCount > 0) ? `
                    <div class="ica--template-card-badges">
                        ${trackerBadge}
                        ${regexCount > 0 ? `<span class="ica--card-pill"><i class="fa-solid fa-wand-magic-sparkles fa-xs"></i> ${buildRegexTemplateLabel(regexCount)}</span>` : ''}
                    </div>
                ` : ''}
                <div class="ica--template-card-prompt">${escapeHtml((tpl.prompt || '').substring(0, 200))}</div>
            </div>
        `);

        card.on('click', async () => {
            const newAgent = buildAgentFromTemplate(tpl);
            await saveAgent(newAgent);
            renderAgentList();
            toastr.success(`Added "${tpl.name}" to your agents.`);
        });

        grid.append(card);
    }

    tplSection.append(grid);
    wrapper.append(tplSection);

    await new Popup(wrapper, POPUP_TYPE.TEXT, '', { wide: true, large: true }).show();
}

/**
 * Applies a group -- adds all its template agents that aren't already present.
 * @param {import('./agent-store.js').AgentGroup} group
 */
async function applyGroup(group) {
    let added = 0;

    for (const tplId of group.agentTemplateIds) {
        const tpl = findTemplateById(tplId);
        if (!tpl) continue;

        const newAgent = buildAgentFromTemplate(tpl);
        if (hasMatchingAgentSnapshot(newAgent)) continue;
        await saveAgent(newAgent);
        added++;
    }

    if (Array.isArray(group.customAgents)) {
        for (const customAgent of group.customAgents) {
            const newAgent = buildAgentFromSnapshot(customAgent);
            if (hasMatchingAgentSnapshot(newAgent)) continue;
            await saveAgent(newAgent);
            added++;
        }
    }

    if (!group.builtin && (!Array.isArray(group.customAgents) || group.customAgents.length === 0)) {
        for (const legacyAgentId of group.agentTemplateIds) {
            if (findTemplateById(legacyAgentId)) continue;
            const sourceAgent = getAgentById(legacyAgentId);
            if (!sourceAgent) continue;

            const snapshot = structuredClone(sourceAgent);
            delete snapshot.id;
            snapshot.enabled = false;

            if (hasMatchingAgentSnapshot(snapshot)) continue;
            await saveAgent(buildAgentFromSnapshot(snapshot));
            added++;
        }
    }

    renderAgentList();
    if (added > 0) {
        toastr.success(`Applied "${group.name}" -- added ${added} new agent(s).`);
    } else {
        toastr.info(`"${group.name}" is already applied.`);
    }
}

/**
 * Creates a custom group from the user's current agents.
 */
async function createCustomGroup() {
    const currentAgents = getAgents();
    if (currentAgents.length === 0) {
        toastr.info('No agents to group. Add some agents first.');
        return;
    }

    const html = $(`
        <div style="display:flex;flex-direction:column;gap:12px;">
            <label style="display:flex;flex-direction:column;gap:4px;">
                <strong>Group Name</strong>
                <input type="text" id="ica--grp-name" class="text_pole" placeholder="My Custom Group" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
                <strong>Description</strong>
                <input type="text" id="ica--grp-desc" class="text_pole" placeholder="What this group is for" />
            </label>
            <div>
                <strong>Select agents to include:</strong>
                <div id="ica--grp-agents" style="max-height:300px;overflow-y:auto;margin-top:6px;display:flex;flex-direction:column;gap:2px;"></div>
            </div>
        </div>
    `);

    const agentList = html.find('#ica--grp-agents');
    for (const agent of currentAgents) {
        agentList.append(`
            <label class="checkbox_label">
                <input type="checkbox" value="${agent.id}" checked />
                <span>${escapeHtml(agent.name)}</span>
            </label>
        `);
    }

    const result = await new Popup(html, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Create Group',
        cancelButton: 'Cancel',
        wide: true,
    }).show();

    if (result !== POPUP_RESULT.AFFIRMATIVE) return;

    const name = html.find('#ica--grp-name').val()?.toString().trim();
    if (!name) {
        toastr.warning('Please enter a group name.');
        return;
    }

    const selectedIds = [];
    html.find('#ica--grp-agents input:checked').each(function () {
        selectedIds.push($(this).val());
    });

    if (selectedIds.length === 0) {
        toastr.warning('Select at least one agent.');
        return;
    }

    const selectedAgents = selectedIds
        .map(id => getAgentById(String(id)))
        .filter(Boolean);

    const group = createDefaultGroup();
    group.name = name;
    group.description = html.find('#ica--grp-desc').val()?.toString().trim() || '';
    group.agentTemplateIds = [];
    group.customAgents = selectedAgents.map(agent => {
        const snapshot = structuredClone(agent);
        delete snapshot.id;
        snapshot.enabled = false;
        return snapshot;
    });
    group.builtin = false;

    if (group.agentTemplateIds.length === 0 && group.customAgents.length === 0) {
        toastr.warning('Unable to build a reusable group from the selected agents.');
        return;
    }

    await saveGroup(group);

    toastr.success(`Created group "${name}" with ${selectedIds.length} agent(s).`);
}

// ===================== Import / Export =====================

/**
 * Handles file import.
 * @param {Event} event
 */
async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        const imported = await importAgents(data);
        renderAgentList();
        toastr.success(`Imported ${imported.length} agent(s).`);
    } catch (e) {
        toastr.error('Failed to import: ' + e.message);
    }

    // Reset file input so the same file can be imported again
    event.target.value = '';
}

/**
 * Exports all agents to a JSON file.
 */
function handleExportAll() {
    const agents = getAgents();
    if (agents.length === 0) {
        toastr.info('No agents to export.');
        return;
    }
    const data = exportAllAgents();
    download(JSON.stringify(data, null, 2), 'in-chat-agents.json', 'application/json');
}

// ===================== Utilities =====================

/**
 * Simple HTML escape.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===================== Pathfinder Editor =====================

/**
 * Opens the Pathfinder-specific settings editor
 * @param {Object} agent - The Pathfinder agent
 */
async function openPathfinderEditor(agent) {
    const originalAgentState = JSON.stringify(agent);
    const template = findTemplateForAgent(agent);
    const settingsPanel = await openPathfinderSettings(agent, async (updatedAgent) => {
        await saveAgent(updatedAgent);
        renderAgentList();
    });

    if (!settingsPanel) return;

    const result = await new Popup(settingsPanel, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Save & Close',
        cancelButton: 'Cancel',
        wide: true,
        large: true,
    }).show();

    if (result === POPUP_RESULT.AFFIRMATIVE) {
        if (JSON.stringify(agent) !== originalAgentState || agent.phaseLocked) {
            lockBundledAgentCustomization(agent, template);
        }

        // Settings are already saved via the UI callbacks
        await saveAgent(agent);
        renderAgentList();
        syncToolAgentRegistrations();
        toastr.success('Pathfinder settings saved');
    }
}

// ===================== Connection Profiles =====================

/**
 * Populates the connection profile dropdown from CMRS.
 */
function populateProfileDropdown() {
    const select = document.getElementById('ica--connectionProfile');
    if (!select) return;

    populateConnectionProfileSelect(select, {
        emptyLabel: 'Use selected connection profile',
        selectedValue: getGlobalSettings().connectionProfile || '',
    });
}

function refreshConnectionProfileUi() {
    populateProfileDropdown();

    const editorSelect = document.getElementById('ica--editor-connectionProfile');
    if (editorSelect instanceof HTMLSelectElement) {
        const emptyLabel = editorSelect.options[0]?.textContent?.trim() || 'Use extension default';
        const selectedValue = editorSelect.value || '';
        populateConnectionProfileSelect(editorSelect, {
            emptyLabel,
            selectedValue,
        });
    }

    renderAgentList();
}

function populateGlobalNotificationToggle() {
    $('#ica--promptTransformShowNotifications').prop(
        'checked',
        Boolean(getGlobalSettings().promptTransformShowNotifications),
    );
}

function populateGlobalExecutionModeDropdown() {
    const mode = getGlobalSettings().appendAgentsExecutionMode || 'parallel';
    $('#ica--appendAgentsExecutionMode').val(mode);
}

function extractProfileResponseText(response) {
    if (typeof response === 'string') {
        return response;
    }

    return typeof response?.content === 'string'
        ? response.content
        : (response?.toString?.() || '');
}

function buildFallbackPromptText(messages) {
    return messages
        .map(message => `${String(message?.role ?? 'user').toUpperCase()}:\n${String(message?.content ?? '')}`)
        .join('\n\n');
}

/**
 * Makes an LLM call for prompt refinement, using CMRS if a profile is selected.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>}
 */
async function refineLLMCall(systemPrompt, userPrompt, connectionProfile = '') {
    const profileId = resolveConnectionProfile(connectionProfile);

    if (!profileId) {
        return await generateQuietPrompt({
            quietPrompt: systemPrompt + '\n\n' + userPrompt,
            skipWIAN: true,
        });
    }

    const CMRS = getConnectionManagerRequestService();

    if (!CMRS) {
        return await generateQuietPrompt({
            quietPrompt: systemPrompt + '\n\n' + userPrompt,
            skipWIAN: true,
        });
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];

    try {
        const response = await CMRS.sendRequest(profileId, messages, DEFAULT_AGENT_MAX_TOKENS, {
            extractData: true,
            includePreset: true,
            includeInstruct: true,
            stream: false,
        });
        const responseText = extractProfileResponseText(response);
        if (responseText.trim()) {
            return responseText;
        }
    } catch (error) {
        console.warn(`[InChatAgents] Prompt refinement via profile "${profileId}" failed, retrying with fallback prompt formatting.`, error);
    }

    let fallbackPrompt = '';
    if (typeof CMRS.constructPrompt === 'function') {
        try {
            fallbackPrompt = String(CMRS.constructPrompt(messages, profileId) ?? '');
        } catch (error) {
            console.warn(`[InChatAgents] Failed to construct fallback prompt for profile "${profileId}" during prompt refinement.`, error);
        }
    }
    const fallbackResponse = await CMRS.sendRequest(
        profileId,
        fallbackPrompt.trim() ? fallbackPrompt : buildFallbackPromptText(messages),
        DEFAULT_AGENT_MAX_TOKENS,
        {
            extractData: true,
            includePreset: true,
            includeInstruct: false,
            stream: false,
        },
    );
    return extractProfileResponseText(fallbackResponse);
}

/**
 * Opens a refinement mode picker and calls the LLM to refine the given prompt.
 * @param {string} currentPrompt - The current agent prompt text
 * @param {string} category - Agent category
 * @param {string} phase - Agent phase
 * @returns {Promise<string|null>} - Refined prompt or null if cancelled
 */
async function refinePromptWithAI(currentPrompt, category, phase, connectionProfile = '') {
    if (!currentPrompt.trim()) {
        toastr.warning('Write a prompt first before refining.');
        return null;
    }

    const modes = [
        { label: 'Improve clarity', instruction: 'Make this prompt clearer and more effective for an LLM. Preserve the original intent.' },
        { label: 'Make concise', instruction: 'Shorten this prompt while preserving all meaning. Every token counts in context.' },
        { label: 'Add specificity', instruction: 'Add more detailed, specific instructions to make this prompt more effective.' },
        { label: 'Fix anti-slop', instruction: 'Add guards against common AI writing tics (purple prose, cliches, repetitive body language) while preserving the original prompt.' },
    ];

    const modeHtml = modes.map((m, i) =>
        `<label class="checkbox_label"><input type="radio" name="ica-refine-mode" value="${i}" ${i === 0 ? 'checked' : ''} /><span>${m.label}</span></label>`,
    ).join('');

    const html = $(`
        <div>
            <p>Choose how to refine this prompt:</p>
            ${modeHtml}
            <label class="checkbox_label"><input type="radio" name="ica-refine-mode" value="custom" /><span>Custom instruction:</span></label>
            <input type="text" id="ica--refine-custom" class="text_pole" placeholder="Your custom refinement instruction..." />
        </div>
    `);

    const result = await new Popup(html, POPUP_TYPE.CONFIRM, '', {
        okButton: 'Refine',
        cancelButton: 'Cancel',
    }).show();

    if (result !== POPUP_RESULT.AFFIRMATIVE) return null;

    const selectedVal = html.find('input[name="ica-refine-mode"]:checked').val();
    let instruction;
    if (selectedVal === 'custom') {
        instruction = html.find('#ica--refine-custom').val()?.toString().trim();
        if (!instruction) {
            toastr.warning('Please enter a custom instruction.');
            return null;
        }
    } else {
        instruction = modes[Number(selectedVal)].instruction;
    }

    const systemPrompt = `You are a prompt engineering assistant for a roleplay chat application. The user has written a prompt module that will be injected into an LLM's context during roleplay generation. Improve it based on their request. Use {{char}} and {{user}} macros where appropriate. Be concise -- every token counts. Output ONLY the improved prompt text, nothing else.`;

    const userText = `Here is my current prompt:\n---\n${currentPrompt}\n---\nCategory: ${category}\nPhase: ${phase}\n\nRequest: ${instruction}`;

    toastr.info('Refining prompt...', '', { timeOut: 0, extendedTimeOut: 0 });

    try {
        const refined = await refineLLMCall(systemPrompt, userText, connectionProfile);
        toastr.clear();

        if (!refined || !refined.trim()) {
            toastr.error('AI returned an empty response.');
            return null;
        }

        // Show diff popup
        const diffHtml = $(`
            <div>
                <h4>Original</h4>
                <pre style="white-space:pre-wrap;max-height:200px;overflow-y:auto;padding:8px;border:1px solid var(--SmartThemeBorderColor);border-radius:4px;">${escapeHtml(currentPrompt)}</pre>
                <h4>Refined</h4>
                <pre style="white-space:pre-wrap;max-height:200px;overflow-y:auto;padding:8px;border:1px solid var(--SmartThemeBorderColor);border-radius:4px;">${escapeHtml(refined.trim())}</pre>
            </div>
        `);

        const acceptResult = await new Popup(diffHtml, POPUP_TYPE.CONFIRM, '', {
            okButton: 'Accept',
            cancelButton: 'Discard',
            wide: true,
        }).show();

        if (acceptResult === POPUP_RESULT.AFFIRMATIVE) {
            return refined.trim();
        }
        return null;
    } catch (e) {
        toastr.clear();
        toastr.error('Refinement failed: ' + e.message);
        return null;
    }
}

// ===================== Initialization =====================

(async function () {
    const settingsHtml = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
    if (!settingsHtml) {
        console.warn('[InChatAgents] Could not load the settings template.');
        return;
    }

    $('#in_chat_agents_container').append(settingsHtml);

    const savedState = extension_settings.inChatAgents;
    const legacyGroups = Array.isArray(savedState?.groups)
        ? savedState.groups.map(group => structuredClone(group))
        : [];
    if (savedState && typeof savedState === 'object') {
        if (savedState.globalSettings && typeof savedState.globalSettings === 'object') {
            setGlobalSettings(savedState.globalSettings);
        }
        restoreAutoSeededTemplateIds(savedState);
    }

    const initResults = await Promise.allSettled([
        loadTemplates(),
        loadCustomGroupsFromServer(),
        (async () => {
            const settingsResp = await fetch('/api/settings/get', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({}),
            });

            if (!settingsResp.ok) {
                return;
            }

            const settings = await settingsResp.json();
            if (settings.inChatAgents) {
                loadAgents(settings.inChatAgents);
            }
        })(),
    ]);

    for (const result of initResults) {
        if (result.status === 'rejected') {
            console.warn('[InChatAgents] Failed during initialization:', result.reason);
        }
    }

    if (legacyGroups.length > 0) {
        try {
            const migratedCount = await migrateLegacyGroups(legacyGroups);
            if (migratedCount > 0) {
                toastr.success(`Migrated ${migratedCount} custom group(s) to backend storage.`);
            }
        } catch (error) {
            console.warn('[InChatAgents] Failed to migrate legacy groups:', error);
        }
    }

    if (savedState && Object.hasOwn(savedState, 'groups')) {
        persistExtensionState();
    }

    await ensureDefaultBundledAgents();
    await migrateBundledRegexScriptsToSavedAgents();
    const migratedTemplateMetadataCount = await migrateBundledTemplateMetadataToSavedAgents();
    if (migratedTemplateMetadataCount > 0) {
        toastr.success(`Updated ${migratedTemplateMetadataCount} bundled agent credit${migratedTemplateMetadataCount !== 1 ? 's' : ''}.`);
    }

    const migratedTrackerPromptPassCount = await migrateBundledTrackerPromptPassesToSavedAgents();
    if (migratedTrackerPromptPassCount > 0) {
        toastr.success(`Updated ${migratedTrackerPromptPassCount} bundled tracker agent(s) to pre-generation defaults.`);
    }

    const migratedRegexPostDefaultsCount = await migrateBundledRegexPostDefaultsToSavedAgents();
    if (migratedRegexPostDefaultsCount > 0) {
        toastr.success(`Updated ${migratedRegexPostDefaultsCount} bundled regex agent(s) to post-generation defaults.`);
    }

    const migratedPromptTransformTokenCount = await migrateLegacyPromptTransformMaxTokens();
    if (migratedPromptTransformTokenCount > 0) {
        toastr.success(`Updated ${migratedPromptTransformTokenCount} agent(s) to the new 8192 prompt transform token default.`);
    }

    const removedBundledAgentCount = await purgeRemovedBundledAgents();
    if (removedBundledAgentCount > 0) {
        toastr.success(`Removed ${removedBundledAgentCount} bundled agent(s) from the default catalog.`);
    }

    const removedDuplicateCount = await removeRedundantBundledAgentDuplicates();
    if (removedDuplicateCount > 0) {
        toastr.success(`Removed ${removedDuplicateCount} redundant bundled agent duplicate(s).`);
    }

    // Initialize the pipeline runner
    try {
        initAgentRunner();
    } catch (err) {
        console.error('[InChatAgents] Agent runner initialization failed:', err);
    }

    // Initialize Pathfinder (tool agent core)
    try {
        initPathfinder(getContext());
    } catch (err) {
        console.warn('[InChatAgents] Pathfinder initialization failed:', err);
    }

    // Sync any existing tool agents' tools with ToolManager
    try {
        syncToolAgentRegistrations();
    } catch (err) {
        console.warn('[InChatAgents] Tool agent sync failed:', err);
    }

    // Render the panel
    renderAgentList();

    // Wire up toolbar
    $('#ica--addAgent').on('click', () => openEditor());
    $('#ica--importAgent').on('click', () => $('#ica--importFile').trigger('click'));
    $('#ica--importFile').on('change', handleImport);
    $('#ica--exportAll').on('click', handleExportAll);
    $('#ica--templates').on('click', openTemplateBrowser);
    $('#ica--templatesCallout').on('click', openTemplateBrowser);
    $('#ica--selectMode').on('click', () => {
        selectModeActive = !selectModeActive;
        if (!selectModeActive) {
            selectedAgentIds.clear();
        }
        updateBulkBar();
        renderAgentList();
    });
    $('#ica--bulkCancel').on('click', exitSelectMode);
    $('#ica--bulkSelectAll').on('click', () => {
        for (const agent of getAgents()) {
            selectedAgentIds.add(agent.id);
        }
        updateBulkBar();
        renderAgentList();
    });
    $('#ica--bulkEnable').on('click', async () => {
        for (const id of selectedAgentIds) {
            const agent = getAgentById(id);
            if (agent && !agent.enabled) {
                agent.enabled = true;
                await saveAgent(agent);
            }
        }
        exitSelectMode();
    });
    $('#ica--bulkDisable').on('click', async () => {
        for (const id of selectedAgentIds) {
            const agent = getAgentById(id);
            if (agent && agent.enabled) {
                agent.enabled = false;
                await saveAgent(agent);
            }
        }
        exitSelectMode();
    });
    $('#ica--bulkDelete').on('click', async () => {
        const count = selectedAgentIds.size;
        if (count === 0) return;
        const result = await new Popup(`Delete ${count} selected agent${count !== 1 ? 's' : ''}?`, POPUP_TYPE.CONFIRM).show();
        if (result === POPUP_RESULT.AFFIRMATIVE) {
            for (const id of [...selectedAgentIds]) {
                await deleteAgent(id);
            }
            exitSelectMode();
        }
    });
    $('#ica--bulkRoleSystem').on('click', async () => {
        if (selectedAgentIds.size === 0) return;
        for (const id of selectedAgentIds) {
            const agent = getAgentById(id);
            if (agent && agent.injection.role !== 0) {
                agent.injection.role = 0;
                lockBundledAgentCustomization(agent);
                await saveAgent(agent);
            }
        }
        toastr.success(`Set ${selectedAgentIds.size} agent(s) to System role.`);
        exitSelectMode();
    });
    $('#ica--bulkRoleUser').on('click', async () => {
        if (selectedAgentIds.size === 0) return;
        for (const id of selectedAgentIds) {
            const agent = getAgentById(id);
            if (agent && agent.injection.role !== 1) {
                agent.injection.role = 1;
                lockBundledAgentCustomization(agent);
                await saveAgent(agent);
            }
        }
        toastr.success(`Set ${selectedAgentIds.size} agent(s) to User role.`);
        exitSelectMode();
    });
    $('#ica--bulkEditProps').on('click', () => {
        if (selectedAgentIds.size === 0) return;
        openBulkEditPopup();
    });
    $('#ica--bulkEditApply').on('click', async () => {
        await applyBulkEdit();
    });
    $('#ica--bulkEditCancel').on('click', () => {
        closeBulkEditPopup();
    });

    // Wire up filter
    $('#ica--search').on('input', renderAgentList);
    $('#ica--categoryFilter').on('change', renderAgentList);

    // Wire up connection profile dropdown
    populateProfileDropdown();
    populateGlobalNotificationToggle();
    populateGlobalExecutionModeDropdown();
    $('#ica--connectionProfile').on('change', function () {
        setGlobalSettings({ connectionProfile: this.value });
        persistExtensionState();
        renderAgentList();
    });
    $('#ica--promptTransformShowNotifications').on('change', function () {
        setGlobalSettings({ promptTransformShowNotifications: $(this).prop('checked') });
        persistExtensionState();
    });
    $('#ica--appendAgentsExecutionMode').on('change', function () {
        setGlobalSettings({ appendAgentsExecutionMode: this.value });
        persistExtensionState();
    });
    $('#ica--resetDefaults').on('click', async () => {
        const agents = getAgents();
        const missingDefaultBundledTemplates = getDefaultBundledTemplates()
            .filter(template => !hasMatchingAgentSnapshot(buildAgentFromTemplate(template), agents));
        const bundledCount = agents.filter(a => findTemplateForAgent(a)).length + missingDefaultBundledTemplates.length;
        if (bundledCount === 0) {
            toastr.info('No bundled agents found to reset.');
            return;
        }
        const result = await new Popup(
            `Reset ${bundledCount} bundled agent${bundledCount !== 1 ? 's' : ''} to their original template defaults? Custom agents will not be affected. This cannot be undone.`,
            POPUP_TYPE.CONFIRM,
        ).show();
        if (result !== POPUP_RESULT.AFFIRMATIVE) return;
        let resetCount = 0;
        for (const agent of agents) {
            const template = findTemplateForAgent(agent);
            if (!template) continue;
            const fresh = mergeTemplateDefaults(template);
            agent.name = fresh.name ?? agent.name;
            agent.description = fresh.description ?? agent.description;
            agent.icon = fresh.icon ?? agent.icon;
            agent.category = fresh.category ?? agent.category;
            agent.tags = fresh.tags ?? agent.tags;
            agent.author = fresh.author ?? agent.author;
            agent.prompt = fresh.prompt ?? agent.prompt;
            agent.phase = fresh.phase ?? 'pre';
            agent.phaseLocked = false;
            agent.injection = { ...agent.injection, ...fresh.injection };
            agent.postProcess = { ...agent.postProcess, ...fresh.postProcess };
            agent.regexScripts = Array.isArray(fresh.regexScripts) ? structuredClone(fresh.regexScripts) : agent.regexScripts;
            agent.sourceTemplateId = template.id;
            await saveAgent(agent);
            resetCount++;
        }
        for (const template of missingDefaultBundledTemplates) {
            const freshAgent = buildAgentFromTemplate(template);
            await saveAgent(freshAgent);
            autoSeededTemplateIds.add(String(template.id ?? '').trim());
            resetCount++;
        }
        if (missingDefaultBundledTemplates.length > 0) {
            persistExtensionState();
        }
        toastr.success(`Reset ${resetCount} bundled agent${resetCount !== 1 ? 's' : ''} to defaults.`);
        renderAgentList();
    });
    // Refresh profiles when chat changes (profiles may have been added/removed)
    const refreshProfileUi = () => {
        refreshConnectionProfileUi();
        populateGlobalNotificationToggle();
        populateGlobalExecutionModeDropdown();
    };

    eventSource.on(event_types.CHAT_CHANGED, refreshProfileUi);

    const connectionProfileEvents = [
        event_types.CONNECTION_PROFILE_LOADED,
        event_types.CONNECTION_PROFILE_CREATED,
        event_types.CONNECTION_PROFILE_UPDATED,
        event_types.CONNECTION_PROFILE_DELETED,
    ].filter(Boolean);

    for (const eventName of connectionProfileEvents) {
        eventSource.on(eventName, refreshProfileUi);
    }

    // Listen for Prompt Manager "Send to Agents" events
    window.addEventListener('PromptManagerSendToAgents', async (event) => {
        const pm = event.detail.prompt;
        if (!pm) return;

        const agent = createDefaultAgent();
        agent.name = pm.name || 'Imported Prompt';
        agent.prompt = pm.content || '';
        agent.injection.role = pm.role === 'user' ? 1 : pm.role === 'assistant' ? 2 : 0;
        agent.injection.position = pm.injection_position === 1 ? 1 : 0;
        agent.injection.depth = pm.injection_depth || 0;
        agent.injection.order = pm.injection_order || 100;
        agent.enabled = false;
        agent.category = 'custom';

        // Map injection_trigger to generationTypes
        if (Array.isArray(pm.injection_trigger) && pm.injection_trigger.length > 0) {
            agent.conditions.generationTypes = pm.injection_trigger.filter(t =>
                ['normal', 'continue', 'impersonate', 'quiet'].includes(t),
            );
        }

        await saveAgent(agent);
        renderAgentList();
        toastr.success(`Created agent "${agent.name}" from prompt.`);
    });
    // Sync tool agents when API settings change
    const apiSettingsEvents = [
        event_types.MAIN_API_CHANGED,
        event_types.CHATCOMPLETION_SOURCE_CHANGED,
        event_types.CHATCOMPLETION_MODEL_CHANGED,
        event_types.OAI_PRESET_CHANGED_AFTER,
        event_types.SETTINGS_UPDATED,
    ].filter(Boolean);

    for (const eventName of apiSettingsEvents) {
        eventSource.on(eventName, syncToolAgentRegistrations);
    }

    // Sync tool agents when the agents panel is opened
    document.addEventListener('sb:shell-tab-activated', (event) => {
        if (event.detail?.tabId === 'agents') {
            syncToolAgentRegistrations();
        }
    });
})();
