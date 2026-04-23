import { getTree, findNodeById, getAllEntryUids, getSettings } from './tree-store.js';
import { getReadableBooks, getEntryContent } from './pathfinder-tool-bridge.js';
import { sidecarGenerate } from './llm-sidecar.js';
import { logPathfinderRetrievalDetail, logSidecarRetrieval, logPipelineStart, logPipelineComplete, setSidecarActive } from './activity-feed.js';
import { buildTreeFromMetadata } from './tree-builder.js';
import { runPipeline } from './prompts/pipeline-runner.js';

const RETRIEVAL_PROMPT_KEY = 'pathfinder_sidecar_retrieval';
const PIPELINE_RETRIEVAL_KEY = 'pathfinder_pipeline_retrieval';
export const PATHFINDER_RETRIEVAL_PROMPT_KEYS = Object.freeze([
    RETRIEVAL_PROMPT_KEY,
    PIPELINE_RETRIEVAL_KEY,
]);

function formatCollapsedGuide(tree, bookName) {
    if (!tree) return '';
    const lines = [];
    function walk(node, depth = 0) {
        const indent = '  '.repeat(depth);
        const entries = (node.entries || []).length;
        const subWaypoints = (node.children || []).length;
        let line = `${indent}${node.name}`;
        if (entries) line += ` (${entries} entries)`;
        if (subWaypoints) line += ` [${subWaypoints} sub-waypoints]`;
        lines.push(line);
        for (const child of node.children || []) walk(child, depth + 1);
    }
    walk(tree);
    return lines.join('\n');
}

async function ensureLorebookTree(bookName) {
    if (getTree(bookName)) {
        return true;
    }

    const ctx = window?.SillyTavern?.getContext?.();
    if (typeof ctx?.loadWorldInfo !== 'function') {
        console.warn(`[Pathfinder] Could not build a tree for "${bookName}" because loadWorldInfo is unavailable.`);
        return false;
    }

    try {
        const bookData = await ctx.loadWorldInfo(bookName);
        if (!bookData?.entries) {
            console.warn(`[Pathfinder] Could not build a tree for "${bookName}" because no lorebook entries were found.`);
            return false;
        }

        await buildTreeFromMetadata(bookName, bookData);
        return true;
    } catch (err) {
        console.warn(`[Pathfinder] Failed to build a tree for "${bookName}".`, err);
        return false;
    }
}

async function ensureReadableBookTrees(bookNames) {
    const readableBooks = Array.from(new Set((bookNames ?? []).filter(Boolean)));

    for (const bookName of readableBooks) {
        await ensureLorebookTree(bookName);
    }

    return readableBooks.filter(bookName => getTree(bookName));
}

/**
 * Run predictive pipeline retrieval
 * @param {Function} setExtensionPrompt
 * @param {Object} extensionPromptTypes
 * @param {Object} extensionPromptRoles
 * @returns {Promise<void>}
 */
async function runPipelineRetrieval(setExtensionPrompt, extensionPromptTypes, extensionPromptRoles) {
    const s = getSettings();
    const pipelineId = s.pipelineId || 'default';
    const books = await ensureReadableBookTrees(getReadableBooks());

    // Get chat messages from context
    const ctx = window?.SillyTavern?.getContext?.();
    const chatMessages = ctx?.chat ?? [];

    if (books.length === 0) {
        console.log('[Pathfinder] No readable lorebooks with built trees for pipeline retrieval');
        return;
    }

    if (chatMessages.length === 0) {
        console.log('[Pathfinder] No chat messages for pipeline retrieval');
        return;
    }

    logPipelineStart(pipelineId, 2); // Assuming 2-stage pipeline

    const result = await runPipeline(pipelineId, chatMessages, 10);

    logPipelineComplete(pipelineId, result.selectedEntries?.length ?? 0, result.stageResults);

    if (!result.success) {
        console.warn('[Pathfinder] Pipeline retrieval failed:', result.error);
        return;
    }

    if (result.selectedEntries.length === 0) {
        console.log('[Pathfinder] Pipeline returned no entries');
        return;
    }

    // Build content for injection - fetch actual entry content
    const entryContents = [];

    for (const entryName of result.selectedEntries) {
        for (const bookName of books) {
            const tree = getTree(bookName);
            if (!tree) continue;

            const uids = getAllEntryUids(tree);
            for (const uid of uids) {
                const entry = await getEntryContent(bookName, uid);
                if (entry && entry.comment === entryName) {
                    entryContents.push({
                        name: entry.comment,
                        bookName,
                        uid,
                        content: entry.content,
                    });
                    break;
                }
            }
        }
    }

    if (entryContents.length > 0) {
        const formattedContent = entryContents
            .map(e => `[${e.name}]\n${e.content}`)
            .join('\n\n');

        const content = `<pathfinder_context>\n${formattedContent}\n</pathfinder_context>`;
        logPathfinderRetrievalDetail({
            mode: 'pipeline',
            books,
            selectedEntries: entryContents.map(entry => ({
                name: entry.name,
                bookName: entry.bookName || '',
                uid: entry.uid ?? null,
                preview: entry.content ? String(entry.content).slice(0, 240) : '',
            })),
            stageResults: result.stageResults,
            injectedPrompt: content,
            metadata: {
                pipelineId,
                selectedEntryCount: entryContents.length,
                candidateCount: result.selectedEntries?.length ?? 0,
            },
        });
        setExtensionPrompt(
            PIPELINE_RETRIEVAL_KEY,
            content,
            extensionPromptTypes?.IN_PROMPT ?? 0,
            4,
            false,
            extensionPromptRoles?.SYSTEM ?? 0,
        );

        console.log(`[Pathfinder] Pipeline injected ${entryContents.length} entries`);
    } else {
        logPathfinderRetrievalDetail({
            mode: 'pipeline',
            books,
            selectedEntries: [],
            stageResults: result.stageResults,
            injectedPrompt: '',
            metadata: {
                pipelineId,
                selectedEntryCount: 0,
                candidateCount: result.selectedEntries?.length ?? 0,
            },
        });
    }
}

/**
 * Run legacy waypoint-based sidecar retrieval
 * @param {Function} setExtensionPrompt
 * @param {Object} extensionPromptTypes
 * @param {Object} extensionPromptRoles
 * @returns {Promise<void>}
 */
async function runLegacySidecarRetrieval(setExtensionPrompt, extensionPromptTypes, extensionPromptRoles) {
    const books = await ensureReadableBookTrees(getReadableBooks());
    if (books.length === 0) return;

    let contextText = '';

    for (const bookName of books) {
        const tree = getTree(bookName);
        if (!tree) continue;
        contextText += `\n### ${bookName}\n${formatCollapsedGuide(tree, bookName)}\n`;
    }

    if (!contextText.trim()) return;

    const prompt = `Given the current conversation context, which of these lorebook waypoints contain information relevant to what's happening right now? List the waypoint/node IDs you'd retrieve.\n\n${contextText}`;

    try {
        const response = await sidecarGenerate(prompt, 'You are a lorebook retrieval assistant. Analyze the conversation and identify which waypoints are relevant. Respond with waypoint/node IDs, one per line.');
        const nodeIds = response.split('\n').map(l => l.trim()).filter(Boolean);
        const allEntries = [];

        for (const bookName of books) {
            const tree = getTree(bookName);
            if (!tree) continue;
            for (const nodeId of nodeIds) {
                const node = findNodeById(tree, nodeId);
                if (node && node.entries?.length) {
                    allEntries.push(...node.entries);
                }
            }
        }

        logSidecarRetrieval(nodeIds, allEntries.length);
        logPathfinderRetrievalDetail({
            mode: 'tool-retrieval',
            books,
            selectedEntries: allEntries.map(entry => ({
                uid: entry?.uid ?? null,
                name: entry?.comment || entry?.key?.[0] || '',
                preview: entry?.content ? String(entry.content).slice(0, 240) : '',
            })),
            stageResults: [{
                stageIndex: 0,
                promptId: 'legacy-sidecar',
                success: true,
                entriesFound: allEntries.length,
                nodeIds,
            }],
            injectedPrompt: allEntries.length > 0 ? `**Pathfinder Auto-Retrieval** (${allEntries.length} entries relevant)` : '',
            metadata: {
                nodeIds,
                selectedEntryCount: allEntries.length,
            },
        });

        if (allEntries.length > 0) {
            const content = `**Pathfinder Auto-Retrieval** (${allEntries.length} entries relevant)`;
            setExtensionPrompt(RETRIEVAL_PROMPT_KEY, content, extensionPromptTypes?.IN_PROMPT ?? 0, 4, false, extensionPromptRoles?.SYSTEM ?? 0);
        }
    } catch (err) {
        console.warn('[Pathfinder] Sidecar retrieval failed:', err);
    }
}

export async function runSidecarRetrieval(setExtensionPrompt, extensionPromptTypes, extensionPromptRoles) {
    const s = getSettings();
    if (!(s.sidecarEnabled || s.pipelineEnabled)) return;

    const books = getReadableBooks();
    if (books.length === 0) return;

    setSidecarActive(true);

    try {
        // Use pipeline if enabled, otherwise fall back to legacy
        if (s.pipelineEnabled) {
            await runPipelineRetrieval(setExtensionPrompt, extensionPromptTypes, extensionPromptRoles);
        } else {
            await runLegacySidecarRetrieval(setExtensionPrompt, extensionPromptTypes, extensionPromptRoles);
        }
    } catch (err) {
        console.warn('[Pathfinder] Retrieval failed:', err);
    } finally {
        setSidecarActive(false);
    }
}
