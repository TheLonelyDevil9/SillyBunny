import { getSettings, getTree, isLorebookEnabled, canReadBook, canWriteBook } from './tree-store.js';

export const TOOL_NAMES = {
    SEARCH: 'Pathfinder_Search',
    REMEMBER: 'Pathfinder_Remember',
    UPDATE: 'Pathfinder_Update',
    FORGET: 'Pathfinder_Forget',
    SUMMARIZE: 'Pathfinder_Summarize',
    REORGANIZE: 'Pathfinder_Reorganize',
    MERGE_SPLIT: 'Pathfinder_MergeSplit',
    NOTEBOOK: 'Pathfinder_Notebook',
};

export const ALL_TOOL_NAMES = Object.values(TOOL_NAMES);

export const CONFIRMABLE_TOOLS = new Set([
    TOOL_NAMES.REMEMBER,
    TOOL_NAMES.UPDATE,
    TOOL_NAMES.FORGET,
    TOOL_NAMES.SUMMARIZE,
    TOOL_NAMES.REORGANIZE,
    TOOL_NAMES.MERGE_SPLIT,
]);

export function getActiveTunnelVisionBooks() {
    const s = getSettings();
    if (!Array.isArray(s.enabledLorebooks)) return [];
    return s.enabledLorebooks.filter(b => isLorebookEnabled(b));
}

export function getReadableBooks() {
    return getActiveTunnelVisionBooks().filter(b => canReadBook(b));
}

export function getWritableBooks() {
    return getActiveTunnelVisionBooks().filter(b => canWriteBook(b));
}

export function resolveTargetBook(requestedBook, writableBooks = null) {
    const books = writableBooks ?? getWritableBooks();
    if (books.length === 0) return null;
    if (requestedBook && books.includes(requestedBook)) return requestedBook;
    return books[0];
}

export function getBookListWithDescriptions() {
    const books = getActiveTunnelVisionBooks();
    return books.map(b => {
        const tree = getTree(b);
        const entryCount = tree ? countAllEntries(tree) : 0;
        return `📚 ${b} (${entryCount} entries)`;
    }).join('\n');
}

function countAllEntries(tree) {
    if (!tree) return 0;
    let count = (tree.entries || []).length;
    for (const child of tree.children || []) {
        count += countAllEntries(child);
    }
    return count;
}

export function preflightToolRuntimeState() {
    const books = getActiveTunnelVisionBooks();
    return {
        hasBooks: books.length > 0,
        bookCount: books.length,
        books,
    };
}

/**
 * Get entry content by UID from a lorebook
 * @param {string} bookName - Lorebook name
 * @param {number} uid - Entry UID
 * @returns {Promise<Object|null>} Entry object with uid, comment, content, etc.
 */
export async function getEntryContent(bookName, uid) {
    const ctx = window?.SillyTavern?.getContext?.();
    if (!ctx?.loadWorldInfo) return null;

    try {
        const bookData = await ctx.loadWorldInfo(bookName);
        if (!bookData?.entries) return null;

        for (const entry of Object.values(bookData.entries)) {
            if (entry && entry.uid === uid) {
                return {
                    uid: entry.uid,
                    comment: entry.comment || entry.key?.[0] || '',
                    content: entry.content || '',
                    key: entry.key || [],
                    disable: entry.disable ?? false,
                };
            }
        }
    } catch (err) {
        console.warn(`[Pathfinder] Failed to get entry ${uid} from ${bookName}:`, err);
    }

    return null;
}

/**
 * Get all entries from a lorebook with their content
 * @param {string} bookName - Lorebook name
 * @returns {Promise<Object[]>} Array of entry objects
 */
export async function getAllEntriesWithContent(bookName) {
    const ctx = window?.SillyTavern?.getContext?.();
    if (!ctx?.loadWorldInfo) return [];

    try {
        const bookData = await ctx.loadWorldInfo(bookName);
        if (!bookData?.entries) return [];

        return Object.values(bookData.entries)
            .filter(entry => entry && !entry.disable)
            .map(entry => ({
                uid: entry.uid,
                comment: entry.comment || entry.key?.[0] || '',
                content: entry.content || '',
                key: entry.key || [],
            }));
    } catch (err) {
        console.warn(`[Pathfinder] Failed to get entries from ${bookName}:`, err);
        return [];
    }
}