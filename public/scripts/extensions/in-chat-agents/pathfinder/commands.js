import { getSettings, getTree, findNodeById } from './tree-store.js';
import { createEntry } from './entry-manager.js';
import { getActiveTunnelVisionBooks, getReadableBooks } from './pathfinder-tool-bridge.js';

const COMMAND_PREFIX = '/tv';

export function initCommands(registerSlashCommand) {
    if (typeof registerSlashCommand !== 'function') return;

    registerSlashCommand({
        name: 'pf-remember',
        description: 'Force Pathfinder to save something to memory.',
        args: [{ name: 'content', type: 'string', description: 'Content to remember', required: true }],
        callback: async (args) => {
            const content = String(args.content || '').trim();
            if (!content) return 'Nothing to remember.';
            const books = getActiveTunnelVisionBooks();
            if (books.length === 0) return 'No Pathfinder-enabled lorebooks.';
            const bookName = books[0];
            try {
                await createEntry(bookName, content.slice(0, 50), content);
                return `Remembered in "${bookName}".`;
            } catch (err) {
                return `Error: ${err.message}`;
            }
        },
    });

    registerSlashCommand({
        name: 'pf-search',
        description: 'Force Pathfinder to search the waypoint map.',
        args: [{ name: 'query', type: 'string', description: 'Search query', required: true }],
        callback: async (args) => {
            const query = String(args.query || '').trim();
            if (!query) return 'No search query.';
            const results = [];
            for (const bookName of getActiveTunnelVisionBooks()) {
                const tree = getTree(bookName);
                if (!tree) continue;
                const found = findNodeById(tree, query);
                if (found) results.push(`${bookName}: ${found.name} (${(found.entries || []).length} entries)`);
            }
            return results.length > 0 ? results.join('\n') : 'No waypoints found matching query.';
        },
    });
}