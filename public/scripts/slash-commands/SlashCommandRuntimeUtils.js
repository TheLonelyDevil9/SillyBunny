function isSlashCommandClosureLike(value) {
    return Boolean(value)
        && typeof value === 'object'
        && value.constructor?.name === 'SlashCommandClosure'
        && Array.isArray(value.executorList)
    ;
}

export function isTrueBoolean(arg) {
    return ['on', 'true', '1'].includes(arg?.trim?.()?.toLowerCase?.() ?? '');
}

export function uuidv4() {
    if ('randomUUID' in crypto) {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function escapeRegex(string) {
    return String(string).replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function convertValueType(value, type) {
    if (isSlashCommandClosureLike(value) || typeof type !== 'string') {
        return value;
    }

    switch (type.trim().toLowerCase()) {
        case 'string':
        case 'str':
            return String(value);

        case 'null':
            return null;

        case 'undefined':
        case 'none':
            return undefined;

        case 'number':
            return Number(value);

        case 'int':
            return parseInt(value, 10);

        case 'float':
            return parseFloat(value);

        case 'boolean':
        case 'bool':
            return isTrueBoolean(value);

        case 'list':
        case 'array':
            try {
                const parsedArray = JSON.parse(value);
                return Array.isArray(parsedArray) ? parsedArray : [];
            } catch {
                return [];
            }

        case 'object':
        case 'dict':
        case 'dictionary':
            try {
                const parsedObject = JSON.parse(value);
                return typeof parsedObject === 'object' ? parsedObject : {};
            } catch {
                return {};
            }

        default:
            return value;
    }
}
