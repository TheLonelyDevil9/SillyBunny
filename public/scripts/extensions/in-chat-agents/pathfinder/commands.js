import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';

import { getTree, findNodeById } from './tree-store.js';
import { createEntry } from './entry-manager.js';
import { getActiveTunnelVisionBooks } from './pathfinder-tool-bridge.js';

function buildCommand(props) {
    return SlashCommand.fromProps({
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: props.argumentDescription,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        ...props,
    });
}

export function initCommands(registerSlashCommand) {
    const registerCommand = (command) => {
        if (typeof SlashCommandParser?.addCommandObject === 'function') {
            SlashCommandParser.addCommandObject(command);
            return;
        }

        if (typeof registerSlashCommand === 'function') {
            registerSlashCommand(command.name, command.callback, command.aliases, command.helpString);
        }
    };

    registerCommand(buildCommand({
        name: 'pf-remember',
        helpString: 'Force Pathfinder to save something to memory.',
        argumentDescription: 'Content to remember',
        callback: async (_, content) => {
            content = String(content || '').trim();
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
    }));

    registerCommand(buildCommand({
        name: 'pf-search',
        helpString: 'Force Pathfinder to search the waypoint map.',
        argumentDescription: 'Search query',
        callback: async (_, query) => {
            query = String(query || '').trim();
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
    }));
}
