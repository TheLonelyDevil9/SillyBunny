/**
 * Pathfinder Settings UI - Idiot-proof settings panel for Pathfinder
 */

import { renderExtensionTemplateAsync, getContext } from '../../extensions.js';
import { saveSettingsDebounced, getRequestHeaders } from '../../../script.js';
import { world_names, loadWorldInfo } from '../../world-info.js';
import {
    getPathfinderSettings,
    setPathfinderSettings,
    runDiagnostics,
} from './pathfinder-init.js';
import {
    getTree,
    saveTree,
    setLorebookEnabled,
    isLorebookEnabled,
    listConnectionProfiles,
} from './pathfinder/tree-store.js';
import { buildTreeFromMetadata } from './pathfinder/tree-builder.js';
import { syncToolAgentRegistrations } from './agent-runner.js';
import { getPrompt, savePrompt, getAllPrompts } from './pathfinder/prompts/prompt-store.js';
import { getDefaultPrompts } from './pathfinder/prompts/default-prompts.js';

const MODULE_NAME = 'in-chat-agents';

let settingsEl = null;
let currentAgent = null;

/**
 * Opens the Pathfinder settings panel
 * @param {Object} agent - The Pathfinder agent object
 * @param {Function} onSave - Callback when settings are saved
 */
export async function openPathfinderSettings(agent, onSave) {
    currentAgent = agent;

    const html = await renderExtensionTemplateAsync(MODULE_NAME, 'pathfinder-settings');
    if (!html) {
        toastr.error('Could not load Pathfinder settings.');
        return null;
    }

    settingsEl = $(html);

    // Initialize UI
    await refreshLorebookList();
    loadSettingsIntoUI();
    bindEvents(onSave);
    updateStatusBanner();
    updateModeCardStates();

    return settingsEl;
}

/**
 * Get available lorebooks from current context
 */
async function getAvailableLorebooks() {
    const ctx = getContext();
    if (!ctx) return [];

    const lorebooks = [];

    // Use the global world_names array from world-info.js
    if (Array.isArray(world_names) && world_names.length > 0) {
        for (const name of world_names) {
            try {
                // Try to load the world info to get entry count
                const bookData = await loadWorldInfo(name);
                const entryCount = bookData?.entries ? Object.keys(bookData.entries).length : '?';
                lorebooks.push({
                    name: name,
                    entries: entryCount,
                    type: 'global',
                });
            } catch (err) {
                // If we can't load it, just add with unknown count
                lorebooks.push({
                    name: name,
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
            if (!lorebooks.some(b => b.name === charBook)) {
                lorebooks.push({
                    name: charBook,
                    entries: '?',
                    type: 'character',
                });
            }
        }
    }

    // Also check chat-attached lorebooks
    if (ctx.chat_metadata?.world_info) {
        const chatBook = ctx.chat_metadata.world_info;
        if (!lorebooks.some(b => b.name === chatBook)) {
            lorebooks.push({
                name: chatBook,
                entries: '?',
                type: 'chat',
            });
        }
    }

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
    const enabledBooks = settings.enabledLorebooks || [];

    if (lorebooks.length === 0) {
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
            if (!Array.isArray(s.enabledLorebooks)) s.enabledLorebooks = [];

            if (checked && !s.enabledLorebooks.includes(bookName)) {
                s.enabledLorebooks.push(bookName);
                setLorebookEnabled(bookName, true);

                // Build tree for this book
                try {
                    const bookData = await loadWorldInfo(bookName);
                    if (bookData) {
                        const tree = await buildTreeFromMetadata(bookName, bookData);
                        saveTree(bookName, tree);
                    }
                } catch (err) {
                    console.warn('[Pathfinder] Failed to build tree for', bookName, err);
                }
            } else if (!checked) {
                s.enabledLorebooks = s.enabledLorebooks.filter(b => b !== bookName);
                setLorebookEnabled(bookName, false);
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
    settingsEl.find('#pf--skip-filter').prop('checked', s.skipSecondPass || false);
    settingsEl.find('#pf--content-mode').val(s.entryContentMode || 'full');
    settingsEl.find('#pf--truncate-length').val(s.truncateLength || 500);
    settingsEl.find('#pf--max-candidates').val(s.maxCandidates || 20);

    // Tool settings
    settingsEl.find('#pf--enable-tools').prop('checked', s.sidecarEnabled || false);
    settingsEl.find('#pf--mandatory-tools').prop('checked', s.mandatoryTools || false);

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
}

/**
 * Bind all event handlers
 */
function bindEvents(onSave) {
    // Refresh lorebooks
    settingsEl.find('#pf--refresh-lorebooks').on('click', async () => {
        await refreshLorebookList();
        toastr.info('Lorebook list refreshed');
    });

    // Mode toggles
    settingsEl.find('#pf--enable-tools').on('change', function () {
        const enabled = $(this).prop('checked');
        const s = getPathfinderSettings();
        s.sidecarEnabled = enabled;
        setPathfinderSettings(s);
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
        updateModeCardStates();
        updateAgentSettings();
    });

    // Pipeline settings
    settingsEl.find('#pf--pipeline-type').on('change', function () {
        const s = getPathfinderSettings();
        s.pipelineId = $(this).val();
        setPathfinderSettings(s);
        updateAgentSettings();
    });

    settingsEl.find('#pf--skip-filter').on('change', function () {
        const s = getPathfinderSettings();
        s.skipSecondPass = $(this).prop('checked');
        setPathfinderSettings(s);
        updateAgentSettings();
    });

    settingsEl.find('#pf--content-mode').on('change', function () {
        const s = getPathfinderSettings();
        s.entryContentMode = $(this).val();
        setPathfinderSettings(s);
        updateAgentSettings();
    });

    settingsEl.find('#pf--truncate-length').on('change', function () {
        const s = getPathfinderSettings();
        s.truncateLength = parseInt($(this).val()) || 500;
        setPathfinderSettings(s);
        updateAgentSettings();
    });

    settingsEl.find('#pf--max-candidates').on('change', function () {
        const s = getPathfinderSettings();
        s.maxCandidates = parseInt($(this).val()) || 20;
        setPathfinderSettings(s);
        updateAgentSettings();
    });

    settingsEl.find('#pf--pipeline-profile').on('change', function () {
        const s = getPathfinderSettings();
        s.connectionProfile = $(this).val();
        setPathfinderSettings(s);
        updateAgentSettings();
    });

    // Tool settings
    settingsEl.find('#pf--mandatory-tools').on('change', function () {
        const s = getPathfinderSettings();
        s.mandatoryTools = $(this).prop('checked');
        setPathfinderSettings(s);
        updateAgentSettings();
    });

    settingsEl.find('.pf--tool-list input[data-tool]').on('change', function () {
        const toolName = $(this).data('tool');
        const enabled = $(this).prop('checked');

        if (currentAgent?.tools) {
            const tool = currentAgent.tools.find(t => t.name === toolName);
            if (tool) {
                tool.enabled = enabled;
            }
        }

        updateAgentSettings();
        syncToolAgentRegistrations();
    });

    // Collapsible sections
    settingsEl.find('.pf--collapsible-header').on('click', function () {
        const section = $(this).closest('.pf--section-collapsible');
        const body = section.find('.pf--section-body');
        const chevron = $(this).find('.pf--chevron');

        body.slideToggle(200);
        chevron.toggleClass('fa-chevron-down fa-chevron-right');
    });

    // Prompt editor
    settingsEl.find('#pf--prompt-selector').on('change', function () {
        const promptId = $(this).val();
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

        try {
            const results = await runDiagnostics();
            let text = '';

            for (const [key, value] of Object.entries(results)) {
                const icon = value.ok ? '✓' : '✗';
                text += `${icon} ${key}: ${value.message}\n`;
            }

            output.text(text || 'All checks passed!');
        } catch (err) {
            output.text('Error running diagnostics: ' + err.message);
        }
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
function updateAgentSettings() {
    if (!currentAgent) return;

    const s = getPathfinderSettings();
    currentAgent.settings = { ...s };
    currentAgent.enabled = (s.enabledLorebooks || []).length > 0 && (s.sidecarEnabled || s.pipelineEnabled);

    saveSettingsDebounced();
}

/**
 * Load a prompt into the editor
 */
function loadPromptIntoEditor(promptId) {
    const prompt = getPrompt(promptId);
    if (!prompt) return;

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
