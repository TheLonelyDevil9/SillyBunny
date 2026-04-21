import { getTree, getSettings } from './tree-store.js';
import { getActiveTunnelVisionBooks } from './pathfinder-tool-bridge.js';
import { sidecarGenerate } from './llm-sidecar.js';
import { logSidecarWrite } from './activity-feed.js';

export async function runSidecarWriter() {
    const s = getSettings();
    if (!s.sidecarEnabled) return;

    const books = getActiveTunnelVisionBooks();
    if (books.length === 0) return;

    const contextTrees = [];
    for (const bookName of books) {
        const tree = getTree(bookName);
        if (!tree) continue;
        contextTrees.push(`Lorebook: ${bookName}\n${formatTreeBrief(tree)}`);
    }

    if (contextTrees.length === 0) return;

    const lastMessages = getLastMessages(10);
    const prompt = `Analyze the recent conversation and determine if any lorebook entries need to be remembered, updated, or created. Respond with a JSON array of actions:\n\n[{ "action": "remember|update|forget", "title": "...", "content": "...", "bookName": "..." }]\n\nIf nothing needs to change, respond with: []\n\nRecent conversation:\n${lastMessages}\n\nAvailable lorebooks:\n${contextTrees.join('\n\n')}`;

    try {
        const response = await sidecarGenerate(prompt, 'You are a lorebook management assistant. Analyze conversations and identify information that should be stored, updated, or removed from the lorebook. Respond only with a JSON array of actions.');
        const actions = parseActions(response);
        logSidecarWrite('sidecar', `${actions.length} actions proposed`);
        return actions;
    } catch (err) {
        console.warn('[Pathfinder] Sidecar writer failed:', err);
        return [];
    }
}

function formatTreeBrief(tree, depth = 0) {
    if (!tree) return '';
    const indent = '  '.repeat(depth);
    let result = `${indent}${tree.name} (${(tree.entries || []).length} entries)\n`;
    for (const child of tree.children || []) {
        result += formatTreeBrief(child, depth + 1);
    }
    return result;
}

function getLastMessages(count) {
    const context = window?.SillyTavern?.getContext?.();
    if (!context?.chat) return '';
    const messages = context.chat.slice(-count);
    return messages.map(m => `${m.is_user ? 'User' : m.name || 'AI'}: ${m.mes || ''}`).join('\n');
}

function parseActions(response) {
    try {
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        return JSON.parse(jsonMatch[0]);
    } catch {
        return [];
    }
}
