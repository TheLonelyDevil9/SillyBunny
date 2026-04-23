/**
 * Pathfinder Settings UI - Idiot-proof settings panel for Pathfinder
 */

import { renderExtensionTemplateAsync, getContext } from '../../extensions.js';
import { saveSettingsDebounced } from '../../../script.js';
import { world_names, loadWorldInfo } from '../../world-info.js';
import { saveAgent } from './agent-store.js';
import {
    getPathfinderSettings,
    setPathfinderSettings,
    runDiagnostics,
} from './pathfinder-init.js';
import {
    setLorebookEnabled,
    listConnectionProfiles,
} from './pathfinder/tree-store.js';
import { buildTreeFromMetadata } from './pathfinder/tree-builder.js';
import { syncToolAgentRegistrations } from './agent-runner.js';
import { getPrompt, savePrompt } from './pathfinder/prompts/prompt-store.js';
import { getDefaultPrompts } from './pathfinder/prompts/default-prompts.js';
import { clearFeed, getFeedItems } from './pathfinder/activity-feed.js';

const MODULE_NAME = 'in-chat-agents';
const PATHFINDER_LOG_PREFIX = '[Pathfinder]';

let settingsEl = null;
let currentAgent = null;

function logPathfinder(message, ...details) {
    console.log(`${PATHFINDER_LOG_PREFIX} ${message}`, ...details);
}

function ensureEnabledLorebooks(settings) {
    if (!Array.isArray(settings.enabledLorebooks)) {
        settings.enabledLorebooks = [];
    }

    return settings.enabledLorebooks;
}

function formatLorebookSourceLabel(sourceTypes) {
    const orderedTypes = ['character', 'chat', 'global'];
    const labels = orderedTypes.filter(type => sourceTypes.has(type));
    return labels.join(', ') || 'global';
}

function upsertLorebook(lorebooksByName, name, data = {}) {
    if (!name) {
        return;
    }

    const book = lorebooksByName.get(name) ?? {
        name,
        entries: '?',
        attached: false,
        sourceTypes: new Set(),
    };

    if (data.entries !== undefined) {
        book.entries = data.entries;
    }

    if (data.type) {
        book.sourceTypes.add(data.type);
        if (data.type === 'character' || data.type === 'chat') {
            book.attached = true;
        }
    }

    lorebooksByName.set(name, book);
}

async function ensureLorebookTree(bookName) {
    try {
        logPathfinder(`Building tree for lorebook "${bookName}".`);
        const bookData = await loadWorldInfo(bookName);
        if (!bookData?.entries) {
            console.warn(`${PATHFINDER_LOG_PREFIX} Lorebook "${bookName}" could not be loaded for tree building.`);
            return false;
        }

        const entryCount = Object.keys(bookData.entries).length;
        logPathfinder(`Loaded lorebook "${bookName}" for tree building.`, { entryCount });
        await buildTreeFromMetadata(bookName, bookData);
        logPathfinder(`Tree build completed for lorebook "${bookName}".`, { entryCount });
        return true;
    } catch (err) {
        console.warn(`${PATHFINDER_LOG_PREFIX} Failed to build tree for lorebook "${bookName}".`, err);
        return false;
    }
}

async function syncAutoAttachedLorebooks(lorebooks, settings) {
    if (!settings.autoUseAttachedLorebook) {
        return [];
    }

    const enabledLorebooks = ensureEnabledLorebooks(settings);
    const attachedLorebooks = lorebooks.filter(book => book.attached).map(book => book.name);
    const newLorebooks = attachedLorebooks.filter(name => !enabledLorebooks.includes(name));

    if (attachedLorebooks.length === 0) {
        logPathfinder('Auto-use attached lorebooks is enabled, but no attached lorebooks were found.');
        return [];
    }

    settings.enabledLorebooks = Array.from(new Set([...enabledLorebooks, ...attachedLorebooks]));
    attachedLorebooks.forEach(bookName => setLorebookEnabled(bookName, true));
    setPathfinderSettings(settings);

    if (newLorebooks.length > 0) {
        logPathfinder('Auto-enabled attached lorebooks.', { lorebooks: newLorebooks });
        for (const bookName of newLorebooks) {
            await ensureLorebookTree(bookName);
        }
    }

    return newLorebooks;
}

/**
 * Opens the Pathfinder settings panel
 * @param {Object} agent - The Pathfinder agent object
 */
export async function openPathfinderSettings(agent) {
    currentAgent = agent;
    const existingSettings = getPathfinderSettings();
    setPathfinderSettings({
        pipelinePrompts: existingSettings.pipelinePrompts,
        pipelines: existingSettings.pipelines,
        ...(agent?.settings || {}),
    });
    logPathfinder(`Settings opened for agent "${agent?.name || 'Pathfinder'}".`, {
        lorebooks: getPathfinderSettings().enabledLorebooks || [],
        toolMode: Boolean(getPathfinderSettings().sidecarEnabled),
        pipelineMode: Boolean(getPathfinderSettings().pipelineEnabled),
    });

    const html = await renderExtensionTemplateAsync(MODULE_NAME, 'pathfinder-settings');
    if (!html) {
        toastr.error('Could not load Pathfinder settings.');
        return null;
    }

    settingsEl = $(html);

    // Initialize UI
    await refreshLorebookList();
    loadSettingsIntoUI();
    bindEvents();
    updateStatusBanner();
    updateModeCardStates();
    renderRetrievalLog();

    return settingsEl;
}

/**
 * Get available lorebooks from current context
 */
async function getAvailableLorebooks() {
    const ctx = getContext();
    if (!ctx) {
        console.warn(`${PATHFINDER_LOG_PREFIX} Could not resolve the current context while gathering lorebooks.`);
        return [];
    }

    const lorebooksByName = new Map();

    // Use the global world_names array from world-info.js
    if (Array.isArray(world_names) && world_names.length > 0) {
        for (const name of world_names) {
            try {
                // Try to load the world info to get entry count
                const bookData = await loadWorldInfo(name);
                const entryCount = bookData?.entries ? Object.keys(bookData.entries).length : '?';
                upsertLorebook(lorebooksByName, name, {
                    entries: entryCount,
                    type: 'global',
                });
            } catch (err) {
                // If we can't load it, just add with unknown count
                console.warn(`${PATHFINDER_LOG_PREFIX} Failed to load lorebook metadata for "${name}".`, err);
                upsertLorebook(lorebooksByName, name, {
                    entries: '?',
                    type: 'global',
                });
            }
        }
    }

    // Get character lorebook if available
    if (ctx.characters && ctx.characterId !== undefined) {
        const char = ctx.characters[ctx.characterId];
        if (char?.data?.extensions?.world) {
            const charBook = char.data.extensions.world;
            upsertLorebook(lorebooksByName, charBook, { type: 'character' });
        }
    }

    // Also check chat-attached lorebooks
    if (ctx.chat_metadata?.world_info) {
        const chatBook = ctx.chat_metadata.world_info;
        upsertLorebook(lorebooksByName, chatBook, { type: 'chat' });
    }

    const lorebooks = Array.from(lorebooksByName.values()).map(book => ({
        ...book,
        type: formatLorebookSourceLabel(book.sourceTypes),
    }));
    logPathfinder('Available lorebooks refreshed.', {
        lorebooks: lorebooks.map(book => ({
            name: book.name,
            entries: book.entries,
            type: book.type,
            attached: book.attached,
        })),
    });

    return lorebooks;
}

/**
 * Refresh the lorebook list in the UI
 */
async function refreshLorebookList() {
    const listEl = settingsEl.find('#pf--lorebook-list');
    listEl.empty();

    const lorebooks = await getAvailableLorebooks();
    const settings = getPathfinderSettings();
    ensureEnabledLorebooks(settings);

    settingsEl.find('#pf--auto-use-attached').prop('checked', Boolean(settings.autoUseAttachedLorebook));
    const autoEnabledLorebooks = await syncAutoAttachedLorebooks(lorebooks, settings);
    if (autoEnabledLorebooks.length > 0) {
        updateAgentSettings();
        updateStatusBanner();
    }
    const enabledBooks = ensureEnabledLorebooks(getPathfinderSettings());

    if (lorebooks.length === 0) {
        logPathfinder('No lorebooks were available for the current character/chat context.');
        listEl.html(`
            <div class="pf--empty-state">
                <i class="fa-solid fa-book-open"></i>
                <span>No lorebooks found. Create a lorebook in World Info first.</span>
            </div>
        `);
        return;
    }

    for (const book of lorebooks) {
        const isEnabled = enabledBooks.includes(book.name);
        const item = $(`
            <div class="pf--lorebook-item ${isEnabled ? 'selected' : ''}" data-book="${escapeHtml(book.name)}">
                <input type="checkbox" ${isEnabled ? 'checked' : ''} />
                <div class="pf--lorebook-info">
                    <span class="pf--lorebook-name">${escapeHtml(book.name)}</span>
                    <span class="pf--lorebook-meta">${book.entries} entries · ${book.type}</span>
                </div>
            </div>
        `);

        item.on('click', async function (e) {
            if (e.target.tagName === 'INPUT') return;
            const checkbox = $(this).find('input[type="checkbox"]');
            checkbox.prop('checked', !checkbox.prop('checked')).trigger('change');
        });

        item.find('input').on('change', async function () {
            const bookName = item.data('book');
            const checked = $(this).prop('checked');

            item.toggleClass('selected', checked);

            // Update settings
            const s = getPathfinderSettings();
            ensureEnabledLorebooks(s);

            if (checked && !s.enabledLorebooks.includes(bookName)) {
                s.enabledLorebooks.push(bookName);
                setLorebookEnabled(bookName, true);
                logPathfinder(`Lorebook "${bookName}" enabled.`, {
                    source: book.type,
                    attached: book.attached,
                });
                await ensureLorebookTree(bookName);
            } else if (!checked) {
                s.enabledLorebooks = s.enabledLorebooks.filter(b => b !== bookName);
                setLorebookEnabled(bookName, false);
                logPathfinder(`Lorebook "${bookName}" disabled.`, {
                    source: book.type,
                    attached: book.attached,
                });
            }

            setPathfinderSettings(s);
            updateAgentSettings();
            updateStatusBanner();
        });

        listEl.append(item);
    }
}

/**
 * Load current settings into UI elements
 */
function loadSettingsIntoUI() {
    const s = getPathfinderSettings();

    // Pipeline settings
    settingsEl.find('#pf--enable-pipeline').prop('checked', s.pipelineEnabled || false);
    settingsEl.find('#pf--pipeline-type').val(s.pipelineId || 'default');
    settingsEl.find('#pf--content-mode').val(s.entryContentMode || 'full');
    settingsEl.find('#pf--truncate-length').val(s.truncateLength || 500);
    settingsEl.find('#pf--max-candidates').val(s.maxCandidates || 20);

    // Tool settings
    settingsEl.find('#pf--enable-tools').prop('checked', s.sidecarEnabled || false);
    settingsEl.find('#pf--mandatory-tools').prop('checked', s.mandatoryTools || false);
    settingsEl.find('#pf--auto-use-attached').prop('checked', s.autoUseAttachedLorebook || false);

    // Populate connection profiles
    populateConnectionProfiles();

    // Load tool states from agent
    if (currentAgent?.tools) {
        for (const tool of currentAgent.tools) {
            const checkbox = settingsEl.find(`input[data-tool="${tool.name}"]`);
            checkbox.prop('checked', tool.enabled !== false);
        }
    }
}

/**
 * Populate connection profile dropdowns
 */
function populateConnectionProfiles() {
    const profiles = listConnectionProfiles();
    const select = settingsEl.find('#pf--pipeline-profile');

    select.find('option:not(:first)').remove();

    for (const profile of profiles) {
        select.append(`<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.name || profile.id)}</option>`);
    }

    const s = getPathfinderSettings();
    if (s.connectionProfile) {
        select.val(s.connectionProfile);
    }

    logPathfinder('Connection profiles populated for Pathfinder.', {
        count: profiles.length,
        selectedProfile: s.connectionProfile || 'main-model',
    });
}

/**
 * Bind all event handlers
 */
function bindEvents() {
    // Refresh lorebooks
    settingsEl.find('#pf--refresh-lorebooks').on('click', async () => {
        logPathfinder('Manual lorebook refresh requested from Pathfinder settings.');
        await refreshLorebookList();
        toastr.info('Lorebook list refreshed');
    });

    settingsEl.find('#pf--auto-use-attached').on('change', async function () {
        const enabled = $(this).prop('checked');
        const s = getPathfinderSettings();
        s.autoUseAttachedLorebook = enabled;
        setPathfinderSettings(s);
        logPathfinder(`Auto-use attached lorebooks ${enabled ? 'enabled' : 'disabled'}.`);

        if (enabled) {
            await refreshLorebookList();
        }

        updateAgentSettings();
        updateStatusBanner();
    });

    // Mode toggles
    settingsEl.find('#pf--enable-tools').on('change', function () {
        const enabled = $(this).prop('checked');
        const s = getPathfinderSettings();
        s.sidecarEnabled = enabled;
        setPathfinderSettings(s);
        logPathfinder(`Tool Mode ${enabled ? 'enabled' : 'disabled'}.`);
        updateModeCardStates();
        updateDualModeWarning();
        updateAgentSettings();
        syncToolAgentRegistrations();
    });

    settingsEl.find('#pf--enable-pipeline').on('change', function () {
        const enabled = $(this).prop('checked');
        const s = getPathfinderSettings();
        s.pipelineEnabled = enabled;
        // Don't force sidecarEnabled - let user choose both independently
        setPathfinderSettings(s);
        logPathfinder(`Predictive Pipeline ${enabled ? 'enabled' : 'disabled'}.`);
        updateModeCardStates();
        updateAgentSettings();
    });

    // Pipeline settings
    settingsEl.find('#pf--pipeline-type').on('change', function () {
        const s = getPathfinderSettings();
        s.pipelineId = $(this).val();
        setPathfinderSettings(s);
        logPathfinder('Pipeline type changed.', { pipelineId: s.pipelineId });
        updateAgentSettings();
    });

    settingsEl.find('#pf--content-mode').on('change', function () {
        const s = getPathfinderSettings();
        s.entryContentMode = $(this).val();
        setPathfinderSettings(s);
        logPathfinder('Pipeline entry content mode changed.', { entryContentMode: s.entryContentMode });
        updateAgentSettings();
    });

    settingsEl.find('#pf--truncate-length').on('change', function () {
        const s = getPathfinderSettings();
        s.truncateLength = parseInt($(this).val()) || 500;
        setPathfinderSettings(s);
        logPathfinder('Pipeline truncate length changed.', { truncateLength: s.truncateLength });
        updateAgentSettings();
    });

    settingsEl.find('#pf--max-candidates').on('change', function () {
        const s = getPathfinderSettings();
        s.maxCandidates = parseInt($(this).val()) || 20;
        setPathfinderSettings(s);
        logPathfinder('Pipeline max candidates changed.', { maxCandidates: s.maxCandidates });
        updateAgentSettings();
    });

    settingsEl.find('#pf--pipeline-profile').on('change', function () {
        const s = getPathfinderSettings();
        s.connectionProfile = $(this).val();
        setPathfinderSettings(s);
        logPathfinder('Pipeline connection profile changed.', { connectionProfile: s.connectionProfile || 'main-model' });
        updateAgentSettings();
    });

    // Tool settings
    settingsEl.find('#pf--mandatory-tools').on('change', function () {
        const s = getPathfinderSettings();
        s.mandatoryTools = $(this).prop('checked');
        setPathfinderSettings(s);
        logPathfinder('Mandatory tool usage changed.', { mandatoryTools: s.mandatoryTools });
        updateAgentSettings();
    });

    settingsEl.find('.pf--tool-list input[data-tool]').on('change', async function () {
        const toolName = $(this).data('tool');
        const enabled = $(this).prop('checked');

        if (currentAgent?.tools) {
            const tool = currentAgent.tools.find(t => t.name === toolName);
            if (tool) {
                tool.enabled = enabled;
            }
        }

        logPathfinder('Tool availability changed.', { toolName, enabled });
        await updateAgentSettings();
        syncToolAgentRegistrations();
    });

    // Collapsible sections
    settingsEl.find('.pf--collapsible-header').on('click', function () {
        const section = $(this).closest('.pf--section-collapsible');
        const body = section.find('.pf--section-body');
        const chevron = $(this).find('.pf--chevron');
        const sectionTitle = $(this).find('strong').text().trim() || 'Unnamed section';
        const willOpen = !body.is(':visible');

        body.slideToggle(200);
        chevron.toggleClass('fa-chevron-down fa-chevron-right');
        logPathfinder(`${willOpen ? 'Opened' : 'Collapsed'} Pathfinder section "${sectionTitle}".`);
    });

    // Prompt editor
    settingsEl.find('#pf--prompt-selector').on('change', function () {
        const promptId = $(this).val();
        logPathfinder('Prompt editor selection changed.', { promptId: promptId || 'none' });
        if (promptId) {
            loadPromptIntoEditor(promptId);
            settingsEl.find('#pf--prompt-fields').show();
        } else {
            settingsEl.find('#pf--prompt-fields').hide();
        }
    });

    settingsEl.find('#pf--prompt-save').on('click', saveCurrentPrompt);
    settingsEl.find('#pf--prompt-reset').on('click', resetCurrentPrompt);

    // Diagnostics
    settingsEl.find('#pf--run-diagnostics').on('click', async () => {
        const output = settingsEl.find('#pf--diagnostics-output');
        output.text('Running diagnostics...');
        logPathfinder('Pathfinder diagnostics started.');

        try {
            const results = await runDiagnostics();
            let text = '';

            for (const [key, value] of Object.entries(results)) {
                const icon = value.ok ? '✓' : '✗';
                text += `${icon} ${key}: ${value.message}\n`;
            }

            output.text(text || 'All checks passed!');
            logPathfinder('Pathfinder diagnostics completed.', results);
        } catch (err) {
            output.text('Error running diagnostics: ' + err.message);
            console.warn(`${PATHFINDER_LOG_PREFIX} Pathfinder diagnostics failed.`, err);
        }
    });

    settingsEl.find('#pf--refresh-log').on('click', () => {
        renderRetrievalLog();
        logPathfinder('Pathfinder retrieval log refreshed.');
    });

    settingsEl.find('#pf--clear-log').on('click', () => {
        clearFeed();
        renderRetrievalLog();
        logPathfinder('Pathfinder retrieval log cleared.');
    });
}

/**
 * Update status banner based on current configuration
 */
function updateStatusBanner() {
    const banner = settingsEl.find('#pf--status-banner');
    const s = getPathfinderSettings();
    const hasBooks = (s.enabledLorebooks || []).length > 0;
    const hasMode = s.sidecarEnabled || s.pipelineEnabled;

    if (hasBooks && hasMode) {
        banner.removeClass('pf--status-disabled').addClass('pf--status-ready');
        banner.find('.pf--status-icon i').removeClass('fa-circle-xmark').addClass('fa-circle-check');
        banner.find('.pf--status-text strong').text('Pathfinder is ready');
        banner.find('.pf--status-text span').text(`${s.enabledLorebooks.length} lorebook(s) enabled`);
    } else if (hasBooks) {
        banner.removeClass('pf--status-disabled').addClass('pf--status-ready');
        banner.find('.pf--status-icon i').removeClass('fa-circle-xmark').addClass('fa-circle-check');
        banner.find('.pf--status-text strong').text('Lorebooks selected');
        banner.find('.pf--status-text span').text('Enable Tool Mode or Pipeline Mode above');
    } else {
        banner.removeClass('pf--status-ready').addClass('pf--status-disabled');
        banner.find('.pf--status-icon i').removeClass('fa-circle-check').addClass('fa-circle-xmark');
        banner.find('.pf--status-text strong').text('Pathfinder is not configured');
        banner.find('.pf--status-text span').text('Select at least one lorebook below to get started');
    }
}

function renderRetrievalLog() {
    const output = settingsEl.find('#pf--retrieval-log-output');
    if (!output.length) {
        return;
    }

    const items = getFeedItems().filter(item =>
        item.type === 'pathfinder_retrieval_detail'
        || item.type === 'pipeline_start'
        || item.type === 'pipeline_stage_start'
        || item.type === 'pipeline_stage_complete'
        || item.type === 'pipeline_complete'
        || item.type === 'pipeline_error'
        || item.type === 'sidecar_retrieval'
        || item.type === 'tool_call_started'
        || item.type === 'tool_call_completed'
        || item.type === 'tool_call_error',
    );

    if (items.length === 0) {
        output.text('No Pathfinder retrieval activity recorded yet.');
        return;
    }

    const text = items.map(formatRetrievalLogItem).filter(Boolean).join('\n\n');
    output.text(text || 'No Pathfinder retrieval activity recorded yet.');
}

function formatRetrievalLogItem(item) {
    const timestamp = item?.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '--:--:--';

    switch (item.type) {
        case 'pathfinder_retrieval_detail': {
            const selectedEntries = Array.isArray(item.selectedEntries) ? item.selectedEntries : [];
            const stageResults = Array.isArray(item.stageResults) ? item.stageResults : [];
            const lines = [
                `[${timestamp}] Retrieval (${item.mode || 'unknown'})`,
                `Books: ${(item.books || []).join(', ') || 'None'}`,
                `Selected entries: ${selectedEntries.length}`,
            ];

            if (selectedEntries.length > 0) {
                lines.push('Entries:');
                for (const entry of selectedEntries) {
                    const label = entry.bookName ? `${entry.name || 'Untitled'} (${entry.bookName})` : (entry.name || 'Untitled');
                    lines.push(`- ${label}${entry.uid !== null && entry.uid !== undefined ? ` [uid ${entry.uid}]` : ''}`);
                    if (entry.preview) {
                        lines.push(`  ${String(entry.preview).replace(/\s+/g, ' ').trim()}`);
                    }
                }
            }

            if (stageResults.length > 0) {
                lines.push('Stages:');
                for (const stage of stageResults) {
                    const stageLabel = stage.promptId || stage.stageName || `Stage ${Number(stage.stageIndex) + 1}`;
                    const stageStatus = stage.success === false ? 'error' : (stage.skipped ? 'skipped' : 'ok');
                    const count = stage.entriesFound ?? stage.selectedEntries ?? 0;
                    lines.push(`- ${stageLabel}: ${stageStatus}${count ? ` (${count})` : ''}`);
                    if (stage.reasoning) {
                        lines.push(`  Reasoning: ${String(stage.reasoning).replace(/\s+/g, ' ').trim()}`);
                    }
                    if (stage.error) {
                        lines.push(`  Error: ${stage.error}`);
                    }
                }
            }

            if (item.injectedPrompt) {
                lines.push('Injected prompt:');
                lines.push(item.injectedPrompt);
            }

            return lines.join('\n');
        }
        case 'pipeline_start':
            return `[${timestamp}] Pipeline start: ${item.pipelineName} (${item.stageCount} stage(s))`;
        case 'pipeline_stage_start':
            return `[${timestamp}] Pipeline stage start: ${item.stageName} (${item.stageIndex}/${item.totalStages})`;
        case 'pipeline_stage_complete':
            return `[${timestamp}] Pipeline stage complete: ${item.stageName} (${item.entriesFound} entries)`;
        case 'pipeline_complete':
            return `[${timestamp}] Pipeline complete: ${item.pipelineName} (${item.totalEntries} entries, ${item.stageResults} stage results)`;
        case 'pipeline_error':
            return `[${timestamp}] Pipeline error: ${item.pipelineName} / ${item.stageName} - ${item.error}`;
        case 'sidecar_retrieval':
            return `[${timestamp}] Legacy retrieval selected ${item.entryCount} entries from node IDs: ${(item.nodeIds || []).join(', ') || 'none'}`;
        case 'tool_call_started':
            return `[${timestamp}] Tool started: ${item.toolName}`;
        case 'tool_call_completed':
            return `[${timestamp}] Tool completed: ${item.toolName} - ${item.result}`;
        case 'tool_call_error':
            return `[${timestamp}] Tool error: ${item.toolName} - ${item.error}`;
        default:
            return '';
    }
}

/**
 * Update mode card visual states
 */
function updateModeCardStates() {
    const s = getPathfinderSettings();

    const toolCard = settingsEl.find('.pf--mode-card[data-mode="tools"]');
    const pipelineCard = settingsEl.find('.pf--mode-card[data-mode="pipeline"]');

    toolCard.toggleClass('active', s.sidecarEnabled || false);
    pipelineCard.toggleClass('active', s.pipelineEnabled || false);

    // Show/hide settings sections
    settingsEl.find('#pf--tool-settings').toggle(s.sidecarEnabled || false);
    settingsEl.find('#pf--pipeline-settings').toggle(s.pipelineEnabled || false);
    settingsEl.find('#pf--prompt-editor-section').toggle(s.pipelineEnabled || false);

    // Update dual-mode warning
    updateDualModeWarning();
}

/**
 * Show/hide warning when both modes are enabled
 */
function updateDualModeWarning() {
    const s = getPathfinderSettings();
    const bothEnabled = s.sidecarEnabled && s.pipelineEnabled;
    settingsEl.find('#pf--dual-mode-warning').toggle(bothEnabled);
}

/**
 * Update agent settings object and trigger save
 */
async function updateAgentSettings() {
    if (!currentAgent) return;

    const s = getPathfinderSettings();
    const agentSettings = { ...s };
    delete agentSettings.pipelinePrompts;
    delete agentSettings.pipelines;
    currentAgent.settings = { ...agentSettings };
    currentAgent.enabled = (s.enabledLorebooks || []).length > 0 && (s.sidecarEnabled || s.pipelineEnabled);
    logPathfinder('Agent settings synchronized.', {
        enabled: currentAgent.enabled,
        lorebooks: s.enabledLorebooks || [],
        toolMode: Boolean(s.sidecarEnabled),
        pipelineMode: Boolean(s.pipelineEnabled),
        autoUseAttachedLorebook: Boolean(s.autoUseAttachedLorebook),
    });

    await saveAgent(currentAgent);
    saveSettingsDebounced();
}

/**
 * Load a prompt into the editor
 */
function loadPromptIntoEditor(promptId) {
    const prompt = getPrompt(promptId);
    if (!prompt) return;

    logPathfinder('Loaded Pathfinder prompt into editor.', { promptId, promptName: prompt.name || promptId });
    settingsEl.find('#pf--prompt-system').val(prompt.systemPrompt || '');
    settingsEl.find('#pf--prompt-user').val(prompt.userPromptTemplate || '');
    clearPromptStatus();
}

/**
 * Save the current prompt
 */
function saveCurrentPrompt() {
    const promptId = settingsEl.find('#pf--prompt-selector').val();
    if (!promptId) return;

    const prompt = getPrompt(promptId);
    if (!prompt) return;

    prompt.systemPrompt = settingsEl.find('#pf--prompt-system').val();
    prompt.userPromptTemplate = settingsEl.find('#pf--prompt-user').val();

    savePrompt(prompt);
    logPathfinder('Saved Pathfinder prompt changes.', { promptId, promptName: prompt.name || promptId });
    showPromptStatus('Saved!', 'success');
}

/**
 * Reset the current prompt to default
 */
function resetCurrentPrompt() {
    const promptId = settingsEl.find('#pf--prompt-selector').val();
    if (!promptId) return;

    const defaults = getDefaultPrompts();
    const defaultPrompt = defaults[promptId];

    if (!defaultPrompt) {
        showPromptStatus('No default available', 'error');
        return;
    }

    savePrompt({ ...defaultPrompt, isDefault: true });
    logPathfinder('Reset Pathfinder prompt to defaults.', { promptId, promptName: defaultPrompt.name || promptId });
    loadPromptIntoEditor(promptId);
    showPromptStatus('Reset to default', 'success');
}

function showPromptStatus(message, type) {
    const status = settingsEl.find('#pf--prompt-status');
    status.text(message).removeClass('success error').addClass(type);
    setTimeout(() => status.text(''), 3000);
}

function clearPromptStatus() {
    settingsEl.find('#pf--prompt-status').text('');
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Check if an agent is Pathfinder
 */
export function isPathfinderAgent(agent) {
    return agent?.sourceTemplateId === 'tpl-pathfinder' ||
           agent?.name === 'Pathfinder' ||
           (agent?.category === 'tool' && agent?.tools?.some(t => t.name?.startsWith('Pathfinder_')));
}
