import { renderExtensionTemplateAsync } from '../../extensions.js';
import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../popup.js';
import { download } from '../../utils.js';
import { getRequestHeaders, generateQuietPrompt } from '../../../script.js';
import { eventSource, event_types } from '../../events.js';
import {
    getAgents,
    getAgentById,
    loadAgents,
    saveAgent,
    deleteAgent,
    createDefaultAgent,
    importAgents,
    exportAllAgents,
    exportAgent,
    AGENT_CATEGORIES,
    getGlobalSettings,
    setGlobalSettings,
    getGroups,
    loadGroups,
    saveGroup,
    deleteGroup,
    createDefaultGroup,
} from './agent-store.js';
import { initAgentRunner } from './agent-runner.js';

const MODULE_NAME = 'in-chat-agents';

/** Built-in templates loaded from JSON files. */
let templates = [];

// ===================== Panel Rendering =====================

/**
 * Re-renders the agent list panel.
 */
function renderAgentList() {
    const container = $('#ica--agentList');
    container.empty();

    const searchTerm = ($('#ica--search').val() || '').toString().toLowerCase();
    const categoryFilter = ($('#ica--categoryFilter').val() || '').toString();

    let agents = getAgents();

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
        return;
    }

    const phaseLabels = { pre: 'pre', post: 'post', both: 'pre + post' };

    for (const [cat, catAgents] of Object.entries(grouped)) {
        const catInfo = AGENT_CATEGORIES[cat];
        const group = $('<div class="ica--category-group"></div>');

        const header = $(`
            <div class="ica--category-header">
                <i class="fa-solid fa-chevron-down ica--chevron"></i>
                <i class="fa-solid ${catInfo.icon}"></i>
                ${catInfo.label}
                <span class="ica--category-count">${catAgents.length}</span>
            </div>
        `);
        header.on('click', function () { $(this).toggleClass('collapsed'); });
        group.append(header);

        const items = $('<div class="ica--category-items"></div>');

        for (const agent of catAgents) {
            const enabledClass = agent.enabled ? 'is-enabled' : '';
            const toggleClass = agent.enabled ? 'is-on' : '';
            const desc = agent.description || agent.prompt.substring(0, 80).replace(/\n/g, ' ') + (agent.prompt.length > 80 ? '...' : '');

            const card = $(`
                <div class="ica--agent-card ${enabledClass}">
                    <div class="ica--card-header">
                        <button class="ica--card-toggle ${toggleClass}" title="${agent.enabled ? 'Disable' : 'Enable'}"></button>
                        <span class="ica--card-name">${escapeHtml(agent.name)}</span>
                        <span class="ica--card-phase">${phaseLabels[agent.phase] || agent.phase}</span>
                    </div>
                    <div class="ica--card-desc">${escapeHtml(desc)}</div>
                    <div class="ica--card-meta">
                        ${agent.conditions.triggerProbability < 100 ? `<span class="ica--card-pill"><i class="fa-solid fa-dice fa-xs"></i> ${agent.conditions.triggerProbability}%</span>` : ''}
                        ${agent.injection.position === 1 ? `<span class="ica--card-pill">depth ${agent.injection.depth}</span>` : ''}
                    </div>
                    <div class="ica--card-actions">
                        <button class="ica--card-btn ica--btn-edit"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                        <button class="ica--card-btn ica--btn-export"><i class="fa-solid fa-download"></i> Export</button>
                        <button class="ica--card-btn ica--btn-delete caution"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `);

            // Toggle
            card.find('.ica--card-toggle').on('click', async function () {
                agent.enabled = !agent.enabled;
                await saveAgent(agent);
                renderAgentList();
            });

            // Edit
            card.find('.ica--btn-edit').on('click', () => openEditor(agent.id));

            // Export
            card.find('.ica--btn-export').on('click', () => {
                const data = exportAgent(agent.id);
                if (data) download(JSON.stringify(data, null, 2), `${agent.name}.json`, 'application/json');
            });

            // Delete
            card.find('.ica--btn-delete').on('click', async () => {
                const result = await new Popup('Delete agent "' + escapeHtml(agent.name) + '"?', POPUP_TYPE.CONFIRM).show();
                if (result === POPUP_RESULT.AFFIRMATIVE) {
                    await deleteAgent(agent.id);
                    renderAgentList();
                }
            });

            items.append(card);
        }

        group.append(items);
        container.append(group);
    }
}

// ===================== Editor Modal =====================

/**
 * Opens the agent editor for the given agent ID (or creates a new one).
 * @param {string|null} agentId
 */
async function openEditor(agentId = null) {
    const agent = agentId ? { ...getAgentById(agentId) } : createDefaultAgent();
    if (!agent) return;

    // Deep clone mutable nested objects
    agent.injection = { ...agent.injection };
    agent.postProcess = { ...agent.postProcess };
    agent.conditions = { ...agent.conditions };

    const html = await renderExtensionTemplateAsync(MODULE_NAME, 'editor');
    const editorEl = $(html);

    // Populate fields
    editorEl.find('#ica--editor-name').val(agent.name);
    editorEl.find('#ica--editor-category').val(agent.category);
    editorEl.find('#ica--editor-phase').val(agent.phase);
    editorEl.find('#ica--editor-description').val(agent.description);
    editorEl.find('#ica--editor-prompt').val(agent.prompt);

    // Injection
    editorEl.find('#ica--editor-position').val(agent.injection.position);
    editorEl.find('#ica--editor-depth').val(agent.injection.depth);
    editorEl.find('#ica--editor-role').val(agent.injection.role);
    editorEl.find('#ica--editor-order').val(agent.injection.order);
    editorEl.find('#ica--editor-scan').prop('checked', agent.injection.scan);

    // Post-process
    editorEl.find('#ica--editor-pp-enabled').prop('checked', agent.postProcess.enabled);
    editorEl.find('#ica--editor-pp-type').val(agent.postProcess.type);
    editorEl.find('#ica--editor-pp-regexFind').val(agent.postProcess.regexFind);
    editorEl.find('#ica--editor-pp-regexReplace').val(agent.postProcess.regexReplace);
    editorEl.find('#ica--editor-pp-regexFlags').val(agent.postProcess.regexFlags);
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
        const enabled = editorEl.find('#ica--editor-pp-enabled').prop('checked');
        editorEl.find('#ica--pp-options').toggle(enabled);

        const type = editorEl.find('#ica--editor-pp-type').val();
        editorEl.find('#ica--pp-regex').toggle(type === 'regex');
        editorEl.find('#ica--pp-extract').toggle(type === 'extract');
        editorEl.find('#ica--pp-append').toggle(type === 'append');
    }
    editorEl.find('#ica--editor-pp-enabled, #ica--editor-pp-type').on('change', updatePPVisibility);
    updatePPVisibility();

    // Refine with AI button
    editorEl.find('#ica--editor-refine').on('click', async () => {
        const currentPrompt = editorEl.find('#ica--editor-prompt').val()?.toString() || '';
        const category = editorEl.find('#ica--editor-category').val()?.toString() || 'custom';
        const phase = editorEl.find('#ica--editor-phase').val()?.toString() || 'pre';
        const refined = await refinePromptWithAI(currentPrompt, category, phase);
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
    agent.prompt = editorEl.find('#ica--editor-prompt').val().toString();

    agent.injection.position = Number(editorEl.find('#ica--editor-position').val());
    agent.injection.depth = Number(editorEl.find('#ica--editor-depth').val());
    agent.injection.role = Number(editorEl.find('#ica--editor-role').val());
    agent.injection.order = Number(editorEl.find('#ica--editor-order').val());
    agent.injection.scan = editorEl.find('#ica--editor-scan').prop('checked');

    agent.postProcess.enabled = editorEl.find('#ica--editor-pp-enabled').prop('checked');
    agent.postProcess.type = editorEl.find('#ica--editor-pp-type').val().toString();
    agent.postProcess.regexFind = editorEl.find('#ica--editor-pp-regexFind').val().toString();
    agent.postProcess.regexReplace = editorEl.find('#ica--editor-pp-regexReplace').val().toString();
    agent.postProcess.regexFlags = editorEl.find('#ica--editor-pp-regexFlags').val().toString();
    agent.postProcess.extractPattern = editorEl.find('#ica--editor-pp-extractPattern').val().toString();
    agent.postProcess.extractVariable = editorEl.find('#ica--editor-pp-extractVariable').val().toString();
    agent.postProcess.appendText = editorEl.find('#ica--editor-pp-appendText').val().toString();

    agent.conditions.triggerProbability = Number(editorEl.find('#ica--editor-probability').val());
    const kwText = editorEl.find('#ica--editor-keywords').val().toString();
    agent.conditions.triggerKeywords = kwText ? kwText.split(',').map(s => s.trim()).filter(Boolean) : [];

    const genTypes = [];
    if (editorEl.find('#ica--editor-type-normal').prop('checked')) genTypes.push('normal');
    if (editorEl.find('#ica--editor-type-continue').prop('checked')) genTypes.push('continue');
    if (editorEl.find('#ica--editor-type-impersonate').prop('checked')) genTypes.push('impersonate');
    if (editorEl.find('#ica--editor-type-quiet').prop('checked')) genTypes.push('quiet');
    agent.conditions.generationTypes = genTypes;

    await saveAgent(agent);
    renderAgentList();
}

// ===================== Template Browser =====================

/**
 * Loads built-in template agents from the templates directory.
 */
async function loadTemplates() {
    if (templates.length > 0) return;
    try {
        const resp = await fetch('/scripts/extensions/in-chat-agents/templates/index.json');
        if (resp.ok) {
            templates = await resp.json();
        }
    } catch (e) {
        console.warn('[InChatAgents] Failed to load templates:', e);
    }
    // Load builtin groups
    try {
        const resp = await fetch('/scripts/extensions/in-chat-agents/templates/groups.json');
        if (resp.ok) {
            const builtinGroups = await resp.json();
            const existing = getGroups();
            for (const bg of builtinGroups) {
                if (!existing.find(g => g.id === bg.id)) {
                    saveGroup(bg);
                }
            }
        }
    } catch { /* ok */ }
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
            const count = group.agentTemplateIds.length;
            const card = $(`
                <div class="ica--group-card">
                    <div class="ica--group-card-header">
                        <strong>${escapeHtml(group.name)}</strong>
                        <span class="ica--card-pill">${count} agents</span>
                    </div>
                    <div class="ica--group-card-desc">${escapeHtml(group.description)}</div>
                    <div class="ica--group-card-actions">
                        <button class="ica--card-btn ica--grp-apply"><i class="fa-solid fa-download"></i> Apply Group</button>
                        ${!group.builtin ? '<button class="ica--card-btn ica--grp-delete caution"><i class="fa-solid fa-trash"></i></button>' : ''}
                    </div>
                </div>
            `);

            card.find('.ica--grp-apply').on('click', async () => {
                await applyGroup(group);
            });

            card.find('.ica--grp-delete').on('click', async () => {
                const r = await new Popup(`Delete group "${escapeHtml(group.name)}"?`, POPUP_TYPE.CONFIRM).show();
                if (r === POPUP_RESULT.AFFIRMATIVE) {
                    deleteGroup(group.id);
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

    const grid = $('<div class="ica--template-grid"></div>');

    for (const tpl of templates) {
        const catInfo = AGENT_CATEGORIES[tpl.category] || AGENT_CATEGORIES.custom;
        const card = $(`
            <div class="ica--template-card" data-id="${tpl.id}">
                <div class="ica--template-card-header">
                    <span class="ica--template-card-name">${escapeHtml(tpl.name)}</span>
                    <span class="ica--template-card-category"><i class="fa-solid ${catInfo.icon}"></i> ${catInfo.label}</span>
                </div>
                <div class="ica--template-card-description">${escapeHtml(tpl.description)}</div>
                <div class="ica--template-card-prompt">${escapeHtml(tpl.prompt.substring(0, 200))}</div>
            </div>
        `);

        card.on('click', async () => {
            const newAgent = { ...createDefaultAgent(), ...tpl, id: crypto.randomUUID(), enabled: false };
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
    const existing = getAgents();
    let added = 0;

    for (const tplId of group.agentTemplateIds) {
        // Skip if an agent from this template already exists (match by original template id)
        const alreadyHas = existing.find(a => a.id === tplId || a.name === templates.find(t => t.id === tplId)?.name);
        if (alreadyHas) continue;

        const tpl = templates.find(t => t.id === tplId);
        if (!tpl) continue;

        const newAgent = { ...createDefaultAgent(), ...tpl, id: crypto.randomUUID(), enabled: false };
        await saveAgent(newAgent);
        added++;
    }

    renderAgentList();
    toastr.success(`Applied "${group.name}" -- added ${added} new agent(s).`);
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

    // Map agent IDs to template-style IDs (use agent name for matching since custom agents don't have template IDs)
    const agentNames = selectedIds.map(id => getAgentById(id)?.name).filter(Boolean);

    const group = createDefaultGroup();
    group.name = name;
    group.description = html.find('#ica--grp-desc').val()?.toString().trim() || '';
    // Store agent names as identifiers for custom groups (matched by name on apply)
    group.agentTemplateIds = selectedIds;
    group.builtin = false;
    saveGroup(group);

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

// ===================== Connection Profiles =====================

/**
 * Populates the connection profile dropdown from CMRS.
 */
function populateProfileDropdown() {
    const select = document.getElementById('ica--connectionProfile');
    if (!select) return;

    while (select.options.length > 1) select.remove(1);

    try {
        const CMRS = SillyTavern.getContext().ConnectionManagerRequestService;
        if (!CMRS) return;
        const profiles = CMRS.getSupportedProfiles();
        for (const p of profiles) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name || p.id;
            select.appendChild(opt);
        }
    } catch {
        // CMRS not available (pre-1.15.0 or connection-manager not loaded)
    }

    select.value = getGlobalSettings().connectionProfile || '';
}

/**
 * Makes an LLM call for prompt refinement, using CMRS if a profile is selected.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {Promise<string>}
 */
async function refineLLMCall(systemPrompt, userPrompt) {
    const profileId = getGlobalSettings().connectionProfile;

    if (!profileId) {
        return await generateQuietPrompt({
            quietPrompt: systemPrompt + '\n\n' + userPrompt,
            skipWIAN: true,
        });
    }

    let CMRS = null;
    try {
        CMRS = SillyTavern.getContext().ConnectionManagerRequestService;
    } catch { /* not available */ }

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
    const response = await CMRS.sendRequest(profileId, messages, 2000, {
        extractData: true,
        includePreset: true,
        stream: false,
    });
    if (typeof response === 'string') return response;
    return response?.content || response?.toString() || '';
}

/**
 * Opens a refinement mode picker and calls the LLM to refine the given prompt.
 * @param {string} currentPrompt - The current agent prompt text
 * @param {string} category - Agent category
 * @param {string} phase - Agent phase
 * @returns {Promise<string|null>} - Refined prompt or null if cancelled
 */
async function refinePromptWithAI(currentPrompt, category, phase) {
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
        const refined = await refineLLMCall(systemPrompt, userText);
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
    $('#in_chat_agents_container').append(settingsHtml);

    // Load agents from server settings
    const settingsResp = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (settingsResp.ok) {
        const settings = await settingsResp.json();
        if (settings.inChatAgents) {
            loadAgents(settings.inChatAgents);
        }
    }

    // Initialize the pipeline runner
    initAgentRunner();

    // Render the panel
    renderAgentList();

    // Wire up toolbar
    $('#ica--addAgent').on('click', () => openEditor());
    $('#ica--importAgent').on('click', () => $('#ica--importFile').trigger('click'));
    $('#ica--importFile').on('change', handleImport);
    $('#ica--exportAll').on('click', handleExportAll);
    $('#ica--templates').on('click', openTemplateBrowser);

    // Wire up filter
    $('#ica--search').on('input', renderAgentList);
    $('#ica--categoryFilter').on('change', renderAgentList);

    // Wire up connection profile dropdown
    populateProfileDropdown();
    $('#ica--connectionProfile').on('change', function () {
        setGlobalSettings({ connectionProfile: this.value });
    });
    // Refresh profiles when chat changes (profiles may have been added/removed)
    eventSource.on(event_types.CHAT_CHANGED, populateProfileDropdown);

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
})();
