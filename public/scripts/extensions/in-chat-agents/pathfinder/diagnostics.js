import { getSettings, getTree, findNodeById, getAllEntryUids, isLorebookEnabled } from './tree-store.js';
import { ALL_TOOL_NAMES, getActiveTunnelVisionBooks } from './pathfinder-tool-bridge.js';
import { getEnabledToolAgents } from '../agent-store.js';

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
    const isToolCallingSupported = ToolManager?.isToolCallingSupported?.() ?? false;

    if (s.sidecarEnabled) {
        const enabledAgents = getEnabledToolAgents();
        const registeredTools = ALL_TOOL_NAMES.filter(name =>
            ToolManager?.tools?.find(t => t.name === name)
        );

        if (registeredTools.length === ALL_TOOL_NAMES.length) {
            if (isToolCallingSupported) {
                results['Tool Registration'] = {
                    ok: true,
                    message: `All ${ALL_TOOL_NAMES.length} tools registered and active`,
                };
            } else {
                results['Tool Registration'] = {
                    ok: false,
                    message: `${registeredTools.length} tools registered, but tool calling is not supported for the current API/settings. Enable "Function Calling" in OpenAI settings and ensure the current model supports tools.`,
                };
            }
        } else if (enabledAgents.length === 0) {
            results['Tool Registration'] = {
                ok: false,
                message: 'No tool agents are enabled. Enable at least one agent in the Agents section.',
            };
        } else if (registeredTools.length === 0) {
            results['Tool Registration'] = {
                ok: false,
                message: isToolCallingSupported
                    ? 'Tools are configured but not registered with ToolManager. Try reloading the extension or switching API sources.'
                    : 'Tool calling is not supported for the current API/settings. Enable "Function Calling" in OpenAI settings and ensure the current model supports tools.',
            };
        } else {
            results['Tool Registration'] = {
                ok: false,
                message: `Partial: ${registeredTools.length}/${ALL_TOOL_NAMES.length} tools registered. Some tool agents may be disabled.`,
            };
        }
    } else {
        results['Tool Registration'] = {
            ok: true,
            message: 'Tool mode disabled - skipped',
        };
    }

    // Check tool calling support
    if (s.sidecarEnabled && ToolManager) {
        results['Tool Calling'] = {
            ok: isToolCallingSupported,
            message: isToolCallingSupported
                ? 'Tool calling is supported for the current API/settings'
                : 'Tool calling is NOT supported. Enable "Function Calling" in OpenAI settings and ensure the current model supports tools.',
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