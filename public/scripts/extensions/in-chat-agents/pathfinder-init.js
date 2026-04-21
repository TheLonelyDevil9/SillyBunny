import { getSettings, setSettings, isLorebookEnabled, setLorebookEnabled } from './pathfinder/tree-store.js';
import { initEntryManagerAPIs } from './pathfinder/entry-manager.js';
import { initActivityFeed } from './pathfinder/activity-feed.js';
import { initAutoSummary } from './pathfinder/auto-summary.js';
import { initCommands } from './pathfinder/commands.js';

import { getDefinition as getSearchDef, registerActions as registerSearchActions } from './pathfinder/tools/search.js';
import { getDefinition as getRememberDef, registerActions as registerRememberActions } from './pathfinder/tools/remember.js';
import { getDefinition as getUpdateDef, registerActions as registerUpdateActions } from './pathfinder/tools/update.js';
import { getDefinition as getForgetDef, registerActions as registerForgetActions } from './pathfinder/tools/forget.js';
import { getDefinition as getSummarizeDef, registerActions as registerSummarizeActions } from './pathfinder/tools/summarize.js';
import { getDefinition as getReorganizeDef, registerActions as registerReorganizeActions } from './pathfinder/tools/reorganize.js';
import { getDefinition as getMergeSplitDef, registerActions as registerMergeSplitActions } from './pathfinder/tools/merge-split.js';
import { getDefinition as getNotebookDef, registerActions as registerNotebookActions } from './pathfinder/tools/notebook.js';

import { buildTreeFromMetadata, buildTreeWithLLM } from './pathfinder/tree-builder.js';
import { runDiagnostics } from './pathfinder/diagnostics.js';

// Pipeline system imports
import { initializePromptStore } from './pathfinder/prompts/prompt-store.js';
import { getDefaultPrompts, getDefaultPipelines } from './pathfinder/prompts/default-prompts.js';

let initialized = false;

export function getPathfinderToolDefinitions() {
    return [
        getSearchDef(),
        getRememberDef(),
        getUpdateDef(),
        getForgetDef(),
        getSummarizeDef(),
        getReorganizeDef(),
        getMergeSplitDef(),
        getNotebookDef(),
    ];
}

export function initPathfinder(context) {
    if (initialized) return;
    initialized = true;

    registerSearchActions();
    registerRememberActions();
    registerUpdateActions();
    registerForgetActions();
    registerSummarizeActions();
    registerReorganizeActions();
    registerMergeSplitActions();
    registerNotebookActions();

    initActivityFeed();

    // Initialize pipeline prompt store with defaults
    initializePromptStore(getDefaultPrompts(), getDefaultPipelines());

    if (context?.loadWorldInfo && context?.createWorldInfoEntry && context?.saveWorldInfo) {
        initEntryManagerAPIs(context.loadWorldInfo, context.createWorldInfoEntry, context.saveWorldInfo);
    }

    if (context?.eventSource && context?.eventTypes) {
        initAutoSummary(context.eventSource, context.eventTypes);
    }

    if (context?.registerSlashCommand) {
        initCommands(context.registerSlashCommand);
    }

    console.info('[Pathfinder] Initialized with 8 tools and predictive pipeline system.');
}

export async function buildPathfinderTree(bookName, bookData, useLLM = false, llmGenerate = null) {
    if (useLLM && llmGenerate) {
        return await buildTreeWithLLM(bookName, bookData, llmGenerate);
    }
    return await buildTreeFromMetadata(bookName, bookData);
}

export { runDiagnostics };
export { getSettings as getPathfinderSettings, setSettings as setPathfinderSettings };
export { isLorebookEnabled, setLorebookEnabled };

// Export pipeline-related functions for external use
export { initPromptEditorUI, refreshPromptEditorUI } from './pathfinder/prompts/prompt-editor-ui.js';
export { runPipeline } from './pathfinder/prompts/pipeline-runner.js';
export { getAllPrompts, getPrompt, savePrompt } from './pathfinder/prompts/prompt-store.js';
