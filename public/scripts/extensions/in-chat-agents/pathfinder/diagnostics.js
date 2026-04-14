import { getSettings, getTree, findNodeById, getAllEntryUids, isLorebookEnabled } from './tree-store.js';
import { ALL_TOOL_NAMES, getActiveTunnelVisionBooks } from './pathfinder-tool-bridge.js';

export async function runDiagnostics() {
    const results = {};
    const s = getSettings();

    // Check enabled lorebooks
    const books = (s.enabledLorebooks || []);
    results['Lorebooks'] = {
        ok: books.length > 0,
        message: books.length > 0
            ? `${books.length} lorebook(s) enabled: ${books.join(', ')}`
            : 'No lorebooks selected - select at least one above',
    };

    // Check pipeline mode
    results['Pipeline Mode'] = {
        ok: true,
        message: s.pipelineEnabled
            ? `Enabled (${s.pipelineId || 'default'} pipeline)`
            : 'Disabled - entries won\'t be auto-injected',
    };

    // Check sidecar/tool mode
    results['Tool Mode'] = {
        ok: true,
        message: s.sidecarEnabled
            ? 'Enabled - AI can use Pathfinder tools'
            : 'Disabled - AI cannot call Pathfinder tools',
    };

    // Check trees built
    const activeBooks = getActiveTunnelVisionBooks();
    let treesBuilt = 0;
    let totalEntries = 0;

    for (const bookName of activeBooks) {
        const tree = getTree(bookName);
        if (tree) {
            treesBuilt++;
            totalEntries += getAllEntryUids(tree).length;
        }
    }

    results['Waypoint Trees'] = {
        ok: treesBuilt === activeBooks.length || activeBooks.length === 0,
        message: activeBooks.length === 0
            ? 'No lorebooks enabled'
            : treesBuilt === activeBooks.length
                ? `${treesBuilt} tree(s) built with ${totalEntries} total entries`
                : `${treesBuilt}/${activeBooks.length} trees built - some lorebooks need tree building`,
    };

    // Check tool registration
    const ToolManager = window?.SillyTavern?.getContext?.()?.ToolManager;
    if (ToolManager && s.sidecarEnabled) {
        const registeredTools = ALL_TOOL_NAMES.filter(name =>
            ToolManager.tools?.find(t => t.name === name)
        );
        results['Tool Registration'] = {
            ok: registeredTools.length === ALL_TOOL_NAMES.length,
            message: registeredTools.length === ALL_TOOL_NAMES.length
                ? `All ${ALL_TOOL_NAMES.length} tools registered`
                : `${registeredTools.length}/${ALL_TOOL_NAMES.length} tools registered`,
        };
    } else {
        results['Tool Registration'] = {
            ok: true,
            message: s.sidecarEnabled
                ? 'ToolManager not available - tools may not work'
                : 'Tool mode disabled - skipped',
        };
    }

    // Check connection profile
    results['Connection Profile'] = {
        ok: true,
        message: s.connectionProfile
            ? `Using profile: ${s.connectionProfile}`
            : 'Using main model',
    };

    return results;
}