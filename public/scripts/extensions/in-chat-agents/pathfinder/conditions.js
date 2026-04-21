export const EVALUABLE_TYPES = new Set([
    'mood', 'location', 'status', 'alive', 'present', 'aware', 'freeform',
]);

export const CONDITION_DESCRIPTIONS = {
    mood: 'Character emotional state',
    location: 'Character physical location',
    status: 'Character status (injured, healthy, etc)',
    alive: 'Character is alive or dead',
    present: 'Character is present in scene',
    freeform: 'Free-form natural language condition',
};

export const CONDITION_LABELS = {
    mood: 'Mood',
    location: 'Location',
    status: 'Status',
    alive: 'Alive',
    present: 'Present',
    freeform: 'Custom',
};

export function isEvaluableCondition(type) {
    return EVALUABLE_TYPES.has(type);
}

export function parseCondition(keyStr) {
    const match = /^\[([\w]+):([^\]]*)\]$/.exec(String(keyStr || '').trim());
    if (!match) return null;
    const type = match[1].toLowerCase();
    const value = match[2].trim();
    return { type, value, negated: value.startsWith('!') };
}

export function formatCondition(type, value) {
    return `[${type}:${value}]`;
}

export function separateConditions(keys = []) {
    const conditions = [];
    const normalKeys = [];
    for (const key of keys) {
        const parsed = parseCondition(key);
        if (parsed && isEvaluableCondition(parsed.type)) {
            conditions.push(parsed);
        } else {
            normalKeys.push(key);
        }
    }
    return { conditions, normalKeys };
}

export function hasEvaluableConditions(keys = []) {
    return keys.some(k => {
        const parsed = parseCondition(k);
        return parsed && isEvaluableCondition(parsed.type);
    });
}

export function mapSelectiveLogic(logic) {
    switch (String(logic || 0)) {
        case '0': return 'ANY (OR)';
        case '1': return 'NOT';
        case '2': return 'ALL (AND)';
        case '3': return 'NOT ALL (NOR)';
        case '4': return 'XOR';
        default: return 'ANY (OR)';
    }
}

export function getKeywordProbability(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return entry._pf_probability ?? null;
}

export function setKeywordProbability(entry, prob) {
    if (!entry) return;
    entry._pf_probability = prob;
}

export function removeKeywordProbability(entry) {
    if (!entry) return;
    delete entry._pf_probability;
}

export function rollKeywordProbability(entry) {
    const prob = getKeywordProbability(entry);
    if (prob === null || prob === undefined) return true;
    return Math.random() * 100 < prob;
}

export function filterByProbability(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.filter(e => rollKeywordProbability(e));
}
