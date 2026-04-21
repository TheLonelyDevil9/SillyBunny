const SB_STORAGE_KEYS = Object.freeze({
    leftTab: 'sb-left-tab',
    rightTab: 'sb-right-tab',
    leftShellSize: 'sb-left-shell-size',
    rightShellSize: 'sb-right-shell-size',
    theme: 'sb-theme',
    surfaceTransparency: 'sb-surface-transparency',
    topbarScaleDesktop: 'sb-topbar-scale-desktop',
    topbarScaleMobile: 'sb-topbar-scale-mobile',
    topbarLabelDesktopParts: 'sb-topbar-label-desktop-parts',
    topbarLabelMobilePart: 'sb-topbar-label-mobile-part',
    topbarLabelCustomText: 'sb-topbar-label-custom-text',
    chatbarVisible: 'sb-chatbar-visible',
    topbarOffset: 'sb-topbar-offset',
    settingsDrawerStatePrefix: 'sb-settings-inline-drawer',
    shortcutLeft: 'sb-shortcut-left',
    shortcutRight: 'sb-shortcut-right',
    bottomBarScale: 'sb-bottom-bar-scale',
    mobileButtonScale: 'sb-mobile-button-scale',
    settingsDrawerAutoClose: 'sb-settings-drawer-auto-close',
});

const SB_SHORTCUT_TARGETS = Object.freeze([
    { value: 'left:presets', label: 'Presets', icon: 'fa-sliders' },
    { value: 'left:api', label: 'API', icon: 'fa-plug' },
    { value: 'left:advanced-formatting', label: 'Adv. Formatting', icon: 'fa-font' },
    { value: 'left:world-info', label: 'World Info', icon: 'fa-book-atlas' },
    { value: 'left:agents', label: 'Agents', icon: 'fa-robot' },
    { value: 'right:settings', label: 'Settings', icon: 'fa-sliders' },
    { value: 'right:extensions', label: 'Extensions', icon: 'fa-cubes' },
    { value: 'right:persona', label: 'Persona', icon: 'fa-face-smile' },
    { value: 'right:background', label: 'Background', icon: 'fa-panorama' },
]);

const SB_SHORTCUT_DEFAULTS = Object.freeze({
    left: 'left:agents',
    right: 'right:persona',
});
const SB_ACCOUNT_STORAGE_READY_MARKER = '__migrated';
const SB_INLINE_DRAWER_CUSTOM_PERSISTENCE_SELECTOR = '.sb-openai-settings-drawer, .sb-openai-settings-subdrawer, [id$="prompt_manager_drawer"]';

let sbInlineDrawerPersistenceObserver = null;
let sbInlineDrawerPersistenceQueued = false;

function getShortcutTarget(side) {
    const stored = safeGetItem(side === 'left' ? SB_STORAGE_KEYS.shortcutLeft : SB_STORAGE_KEYS.shortcutRight);
    const valid = SB_SHORTCUT_TARGETS.some(t => t.value === stored);
    return valid ? stored : SB_SHORTCUT_DEFAULTS[side];
}

function getShortcutConfig(target) {
    return SB_SHORTCUT_TARGETS.find(t => t.value === target) || SB_SHORTCUT_TARGETS[0];
}

function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch {
        // Ignore storage write failures.
    }
}

function safeRemoveItem(key) {
    try { localStorage.removeItem(key); } catch {
        // Ignore storage removal failures.
    }
}

const SB_IDLE_BRAND_LABEL = 'SillyBunny';
const SB_MOBILE_MEDIA_QUERY = '(max-width: 768px)';
const SB_SURFACE_TRANSPARENCY = Object.freeze({
    min: 0,
    max: 55,
    step: 5,
    defaultValue: 0,
});
const SB_TOPBAR_SCALE = Object.freeze({
    min: 70,
    max: 150,
    step: 5,
    defaultValue: 100,
});
const SB_TOPBAR_LABEL_PARTS = Object.freeze([
    {
        id: 'ctx',
        label: 'Context Size',
        description: 'Show the current total Tokens value from the Prompt page.',
    },
    {
        id: 'char',
        label: 'Character Name',
        description: 'Show the active character name, or the group name while a group chat is open.',
    },
    {
        id: 'custom',
        label: 'Custom Text',
        description: 'Show your own short label in the center of the top bar.',
    },
]);
const SB_TOPBAR_LABEL_PART_ORDER = Object.freeze(SB_TOPBAR_LABEL_PARTS.map(part => part.id));
const SB_TOPBAR_LABEL_PART_IDS = new Set(SB_TOPBAR_LABEL_PART_ORDER);
const SB_TOPBAR_LABEL_CUSTOM_TEXT_MAX_LENGTH = 48;
const SB_TOPBAR_DRAG_X_RATIO = 0.36;
const SB_TOPBAR_DRAG_Y_RATIO = 0.24;
const SB_TOPBAR_CONTEXT_REFRESH_DEBOUNCE = 220;
const SB_CONSOLE_LOG_LIMIT = 260;
const SB_CONSOLE_LOG_REFRESH_MS = 2500;
const SB_CONSOLE_LOG_STICKY_THRESHOLD = 28;
const SB_CHATBAR_SEARCH_DEBOUNCE = 220;
const SB_CHAT_SEARCH_MARK_SELECTOR = 'mark[data-sb-chat-search="true"]';
const SB_DESKTOP_SHELL_RESIZE_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
const SB_DESKTOP_SHELL_LAYOUT = Object.freeze({
    minWidth: 600,
    maxWidth: 900,
    ratio: 0.55,
    compactMaxWidth: 900,
    compactViewportWidth: 1100,
    compactGap: 20,
    gutterMin: 20,
    gutterRatio: 0.04,
    gutterMax: 80,
    fullWidthMaxHeight: 860,
});
const SB_DESKTOP_SHELL_RESIZE = Object.freeze({
    minWidth: 420,
    minHeight: 320,
    bottomGap: 16,
});
const SB_SHELL_TOGGLE_GUARD_MS = 260;
const SB_INIT_RETRY_DELAY_MS = 150;
const SB_INIT_MAX_RETRIES = 30;

const SB_THEMES = Object.freeze([
    {
        id: 'modern-glass',
        label: 'Modern Glass',
        description: 'Premium glass panels, layered depth, and a more cinematic desktop feel.',
    },
    {
        id: 'clean-minimal',
        label: 'Clean Minimal',
        description: 'Softer surfaces, calmer contrast, and lower visual noise for long sessions.',
    },
    {
        id: 'bold-stylized',
        label: 'Bold Stylized',
        description: 'Sharper accents, stronger contrast, and more expressive active states.',
    },
]);

const SB_MESSAGE_STYLES = Object.freeze([
    { id: '0', label: 'Flat', icon: 'fa-grip-lines' },
    { id: '1', label: 'Bubbles', icon: 'fa-comment-dots' },
    { id: '2', label: 'Document', icon: 'fa-file-lines' },
]);

const SB_SHELLS = Object.freeze({
    left: {
        rootPanelId: 'left-nav-panel',
        hostDrawerId: 'ai-config-button',
        hostToggleSelector: '#ai-config-button > .drawer-toggle',
        hostIconSelector: '#leftNavDrawerIcon',
        proxyButtonId: 'sb-left-shell-toggle',
        proxyIcon: 'fa-bars',
        proxyLabel: 'Navigate',
        title: 'Workspace',
        subtitle: 'Model behavior, presets, lore, and formatting tools live here.',
        searchPlaceholder: 'Quick find presets, samplers, lorebooks...',
        storageKey: SB_STORAGE_KEYS.leftTab,
        defaultTabId: 'presets',
        baseTab: {
            id: 'presets',
            label: 'Presets',
            icon: 'fa-sliders',
            description: 'Swap presets, tune generation controls, and keep your most-used setups close.',
        },
        embeddedTabs: [
            {
                id: 'api',
                drawerId: 'sys-settings-button',
                label: 'API',
                icon: 'fa-plug',
                description: 'Connect providers, select models, and manage backend-specific options.',
            },
            {
                id: 'advanced-formatting',
                drawerId: 'advanced-formatting-button',
                label: 'Advanced Formatting',
                icon: 'fa-font',
                description: 'Fine-tune instruct templates, formatting rules, and prompt shaping.',
            },
            {
                id: 'world-info',
                drawerId: 'WI-SP-button',
                label: 'World Info',
                icon: 'fa-book-atlas',
                description: 'Edit lorebooks, world entries, and retrieval-friendly context.',
            },
        ],
        customTabs: [
            {
                id: 'agents',
                label: 'Agents',
                icon: 'fa-robot',
                description: 'Configure in-chat agent helpers.',
            },
        ],
    },
    right: {
        rootPanelId: 'user-settings-block',
        hostDrawerId: 'user-settings-button',
        hostToggleSelector: '#user-settings-button > .drawer-toggle',
        hostIconSelector: '#user-settings-button > .drawer-toggle .drawer-icon',
        proxyButtonId: 'sb-right-shell-toggle',
        proxyIcon: 'fa-gear',
        proxyLabel: 'Customize',
        title: 'Customize',
        subtitle: 'Personalize the workspace, extensions, persona flow, and atmosphere.',
        searchPlaceholder: 'Search themes, top bar, personas, backgrounds, or extensions',
        searchExamples: ['Moonlit', 'top bar', 'Appearance', 'notify extension updates', 'persona'],
        storageKey: SB_STORAGE_KEYS.rightTab,
        defaultTabId: 'settings',
        baseTab: {
            id: 'settings',
            label: 'Settings',
            icon: 'fa-sliders',
            searchPlaceholder: 'Search Appearance, top bar, chat style, blur, or update notices',
            searchExamples: ['Moonlit', 'top bar', 'Appearance', 'notify extension updates'],
        },
        embeddedTabs: [
            {
                id: 'extensions',
                drawerId: 'extensions-settings-button',
                label: 'Extensions',
                icon: 'fa-cubes',
                searchPlaceholder: 'Search Moonlit, Quick Reply, Dialogue Colors, or Image Gen',
                searchExamples: ['Moonlit', 'Quick Reply', 'Dialogue Colors', 'Image Gen'],
            },
            {
                id: 'persona',
                drawerId: 'persona-management-button',
                label: 'Persona',
                icon: 'fa-face-smile',
                searchPlaceholder: 'Search default persona, avatar, description, or lock',
                searchExamples: ['default persona', 'avatar', 'description', 'lock'],
            },
            {
                id: 'background',
                drawerId: 'backgrounds-button',
                label: 'Background',
                icon: 'fa-panorama',
                searchPlaceholder: 'Search background names, blur, fit, or vibe words',
                searchExamples: ['cozy', 'landscape', 'blur', 'fit'],
            },
        ],
        customTabs: [
            {
                id: 'server',
                label: 'Server',
                icon: 'fa-server',
                searchPlaceholder: 'Search update, restart, config.yaml, or branch',
                searchExamples: ['update', 'restart', 'config.yaml', 'branch'],
            },
            {
                id: 'console-logs',
                label: 'Console Logs',
                icon: 'fa-terminal',
                searchPlaceholder: 'Search error, warning, npm, bun, or extension logs',
                searchExamples: ['error', 'warning', 'npm', 'bun'],
            },
        ],
    },
});

const SB_DRAWER_ROUTES = Object.freeze({
    'user-settings-button': { shell: 'right', tab: 'settings' },
    'sys-settings-button': { shell: 'left', tab: 'api' },
    'advanced-formatting-button': { shell: 'left', tab: 'advanced-formatting' },
    'WI-SP-button': { shell: 'left', tab: 'world-info' },
    'extensions-settings-button': { shell: 'right', tab: 'extensions' },
    'persona-management-button': { shell: 'right', tab: 'persona' },
    'backgrounds-button': { shell: 'right', tab: 'background' },
});

const SB_SEARCH_TARGET_SELECTOR = [
    'label',
    '.checkbox_label',
    '.menu_button',
    '.inline-drawer-toggle',
    '.standoutHeader',
    '.range-block-title',
    '.range-block-header',
    '.extension_name',
    'h3',
    'h4',
    'h5',
    'strong',
    '.bg-header-row-1',
    '.bg-header-row-2',
    '.ch_name',
].join(', ');

const sbState = {
    initialized: false,
    initRetryTimer: 0,
    initRetryCount: 0,
    initObserver: null,
    landingPageObserver: null,
    landingPageSyncFrame: 0,
    inlineDrawerAutoClose: normalizeStoredBoolean(safeGetItem(SB_STORAGE_KEYS.settingsDrawerAutoClose), false),
    theme: normalizeTheme(safeGetItem(SB_STORAGE_KEYS.theme)),
    surfaceTransparency: normalizeSurfaceTransparency(safeGetItem(SB_STORAGE_KEYS.surfaceTransparency)),
    bottomBarScale: normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.bottomBarScale)),
    mobileButtonScale: normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.mobileButtonScale)),
    topbarScale: {
        desktop: normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.topbarScaleDesktop)),
        mobile: normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.topbarScaleMobile)),
    },
    topbarLabel: {
        desktopParts: safeGetItem(SB_STORAGE_KEYS.topbarLabelDesktopParts) === null
            ? ['char']
            : normalizeTopbarLabelParts(safeGetItem(SB_STORAGE_KEYS.topbarLabelDesktopParts), []),
        mobilePart: safeGetItem(SB_STORAGE_KEYS.topbarLabelMobilePart) === null
            ? 'char'
            : normalizeTopbarLabelPart(safeGetItem(SB_STORAGE_KEYS.topbarLabelMobilePart), ''),
        customText: normalizeTopbarCustomText(safeGetItem(SB_STORAGE_KEYS.topbarLabelCustomText)),
        contextTokens: null,
        refreshTimer: 0,
        refreshInFlight: false,
        refreshPending: false,
        refreshToken: 0,
        bindingRetryTimer: 0,
        boundEventSource: null,
        windowBindingsAttached: false,
    },
    shells: {},
    shellSizing: {
        overrides: {
            left: normalizeShellSize(safeGetItem(SB_STORAGE_KEYS.leftShellSize)),
            right: normalizeShellSize(safeGetItem(SB_STORAGE_KEYS.rightShellSize)),
        },
        activeResize: null,
    },
    chatbar: {
        desktop: null,
        sidebar: null,
        mobileTools: null,
        visible: normalizeStoredBoolean(safeGetItem(SB_STORAGE_KEYS.chatbarVisible), true),
        searchQuery: '',
        searchTimer: 0,
        refreshTimer: 0,
        refreshToken: 0,
        pendingSearchScroll: false,
        isApplyingSearch: false,
        chatObserver: null,
        sourceObserver: null,
        sourceSelectObserver: null,
        sourceObservedElement: null,
        sourceChangeHandler: null,
        connectionStripOpen: false,
        sidebarOpen: false,
        mobileToolsOpen: false,
        bindingRetryTimer: 0,
        boundEventSource: null,
        windowBindingsAttached: false,
        topbarOffset: normalizeTopbarOffset(safeGetItem(SB_STORAGE_KEYS.topbarOffset)),
        renderedTopbarOffset: { x: 0, y: 0 },
        dragging: null,
        dragListenersBound: false,
        chatbarToggleButton: null,
        dragHandleButton: null,
    },
    bottomChatBar: null,
    serverAdmin: {
        refs: null,
        originalConfig: '',
        lastModifiedMs: 0,
        lastStatusData: null,
        busy: false,
        restarting: false,
        configLoaded: false,
    },
    consoleLogs: {
        refs: null,
        entries: [],
        latestId: 0,
        captureStartedAt: 0,
        totalBuffered: 0,
        refreshTimer: 0,
        busy: false,
        paused: false,
        lastUpdatedAt: 0,
        lastError: '',
    },
    importer: {
        refs: null,
        busy: false,
        report: null,
    },
};

function normalizeTheme(themeId) {
    return SB_THEMES.some(theme => theme.id === themeId) ? themeId : 'clean-minimal';
}

function normalizeTopbarLabelPart(value, fallback = '') {
    const fallbackValue = SB_TOPBAR_LABEL_PART_IDS.has(fallback) ? fallback : '';
    const normalizedValue = normalizeText(value);
    return SB_TOPBAR_LABEL_PART_IDS.has(normalizedValue) ? normalizedValue : fallbackValue;
}

function normalizeTopbarLabelParts(value, fallback = []) {
    let source = value;

    if (typeof source === 'string') {
        const trimmedValue = source.trim();
        if (!trimmedValue) {
            source = [];
        } else {
            try {
                source = JSON.parse(trimmedValue);
            } catch {
                source = trimmedValue.split(',');
            }
        }
    }

    const rawParts = Array.isArray(source) ? source : [source];
    const normalizedParts = SB_TOPBAR_LABEL_PART_ORDER.filter(
        partId => rawParts.some(candidate => normalizeTopbarLabelPart(candidate) === partId),
    );
    const fallbackParts = Array.isArray(fallback)
        ? SB_TOPBAR_LABEL_PART_ORDER.filter(partId => fallback.includes(partId))
        : [];

    return normalizedParts.length ? normalizedParts : fallbackParts;
}

function normalizeTopbarCustomText(value) {
    const normalizedValue = String(value ?? '').replace(/\s+/g, ' ').trim();
    return normalizedValue.slice(0, SB_TOPBAR_LABEL_CUSTOM_TEXT_MAX_LENGTH).trim();
}

function normalizeStoredBoolean(value, fallback = false) {
    if (value === null || value === undefined) {
        return fallback;
    }

    if (typeof value === 'boolean') {
        return value;
    }

    const normalizedValue = String(value).trim().toLowerCase();

    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
        return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
        return false;
    }

    return fallback;
}

function normalizeShellSize(value) {
    let source = value;

    if (typeof source === 'string') {
        const trimmedValue = source.trim();

        if (!trimmedValue) {
            return null;
        }

        try {
            source = JSON.parse(trimmedValue);
        } catch {
            return null;
        }
    }

    const width = Number(source?.width);
    const height = Number(source?.height);

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
    }

    return {
        width: Math.max(0, Math.round(width)),
        height: Math.max(0, Math.round(height)),
    };
}

function normalizeSurfaceTransparency(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return SB_SURFACE_TRANSPARENCY.defaultValue;
    }

    const snappedValue = Math.round(numericValue / SB_SURFACE_TRANSPARENCY.step) * SB_SURFACE_TRANSPARENCY.step;
    return Math.min(SB_SURFACE_TRANSPARENCY.max, Math.max(SB_SURFACE_TRANSPARENCY.min, snappedValue));
}

function formatSurfaceTransparency(value) {
    return `${normalizeSurfaceTransparency(value)}%`;
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeTopbarOffset(value) {
    let source = value;

    if (typeof source === 'string' && source.trim()) {
        try {
            source = JSON.parse(source);
        } catch {
            source = null;
        }
    }

    const x = Number(source?.x);
    const y = Number(source?.y);

    return {
        x: Number.isFinite(x) ? Math.round(x) : 0,
        y: Number.isFinite(y) ? Math.round(y) : 0,
    };
}

function normalizeTopbarScale(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return SB_TOPBAR_SCALE.defaultValue;
    }

    const snappedValue = Math.round(numericValue / SB_TOPBAR_SCALE.step) * SB_TOPBAR_SCALE.step;
    return Math.min(SB_TOPBAR_SCALE.max, Math.max(SB_TOPBAR_SCALE.min, snappedValue));
}

function formatTopbarScale(value) {
    return `${normalizeTopbarScale(value)}%`;
}

function seedTopbarScaleDefaults() {
    if (safeGetItem(SB_STORAGE_KEYS.topbarScaleDesktop) === null) {
        safeSetItem(SB_STORAGE_KEYS.topbarScaleDesktop, String(SB_TOPBAR_SCALE.defaultValue));
    }

    if (safeGetItem(SB_STORAGE_KEYS.topbarScaleMobile) === null) {
        safeSetItem(SB_STORAGE_KEYS.topbarScaleMobile, String(SB_TOPBAR_SCALE.defaultValue));
    }

    if (safeGetItem(SB_STORAGE_KEYS.bottomBarScale) === null) {
        safeSetItem(SB_STORAGE_KEYS.bottomBarScale, String(SB_TOPBAR_SCALE.defaultValue));
    }

    if (safeGetItem(SB_STORAGE_KEYS.mobileButtonScale) === null) {
        safeSetItem(SB_STORAGE_KEYS.mobileButtonScale, String(SB_TOPBAR_SCALE.defaultValue));
    }
}

function restorePersistedTopbarState() {
    sbState.topbarScale.desktop = normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.topbarScaleDesktop));
    sbState.topbarScale.mobile = normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.topbarScaleMobile));
    sbState.bottomBarScale = normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.bottomBarScale));
    sbState.mobileButtonScale = normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.mobileButtonScale));
    sbState.topbarLabel.desktopParts = safeGetItem(SB_STORAGE_KEYS.topbarLabelDesktopParts) === null
        ? ['char']
        : normalizeTopbarLabelParts(safeGetItem(SB_STORAGE_KEYS.topbarLabelDesktopParts), []);
    sbState.topbarLabel.mobilePart = safeGetItem(SB_STORAGE_KEYS.topbarLabelMobilePart) === null
        ? 'char'
        : normalizeTopbarLabelPart(safeGetItem(SB_STORAGE_KEYS.topbarLabelMobilePart), '');
    sbState.topbarLabel.customText = normalizeTopbarCustomText(safeGetItem(SB_STORAGE_KEYS.topbarLabelCustomText));
    sbState.chatbar.visible = normalizeStoredBoolean(safeGetItem(SB_STORAGE_KEYS.chatbarVisible), sbState.chatbar.visible);
    sbState.chatbar.topbarOffset = normalizeTopbarOffset(safeGetItem(SB_STORAGE_KEYS.topbarOffset));
}

function clampTopbarOffset(offset) {
    const maxX = Math.max(0, Math.round(window.innerWidth * SB_TOPBAR_DRAG_X_RATIO));
    const maxY = Math.max(0, Math.round(window.innerHeight * SB_TOPBAR_DRAG_Y_RATIO));
    const normalizedOffset = normalizeTopbarOffset(offset);

    return {
        x: clampNumber(normalizedOffset.x, -maxX, maxX),
        y: clampNumber(normalizedOffset.y, 0, maxY),
    };
}

function getRenderedTopbarOffset() {
    return clampTopbarOffset(getChatbarState().topbarOffset);
}

function applyTopbarOffset() {
    const dragSurface = document.getElementById('sb-chatbar-layer');
    const renderedOffset = getRenderedTopbarOffset();

    getChatbarState().renderedTopbarOffset = renderedOffset;

    if (!(dragSurface instanceof HTMLElement)) {
        return;
    }

    dragSurface.style.setProperty('--sb-topbar-offset-x', `${renderedOffset.x}px`);
    dragSurface.style.setProperty('--sb-topbar-offset-y', `${renderedOffset.y}px`);
}

function setTopbarOffset(offset, { persist = true } = {}) {
    const nextOffset = normalizeTopbarOffset(offset);
    getChatbarState().topbarOffset = nextOffset;

    if (persist) {
        safeSetItem(SB_STORAGE_KEYS.topbarOffset, JSON.stringify(nextOffset));
    }

    applyTopbarOffset();
}

function setTopbarScale(mode, value, { persist = true } = {}) {
    const storageKey = mode === 'mobile'
        ? SB_STORAGE_KEYS.topbarScaleMobile
        : mode === 'desktop'
            ? SB_STORAGE_KEYS.topbarScaleDesktop
            : '';

    if (!storageKey) {
        return;
    }

    const nextScale = normalizeTopbarScale(value);
    const scaleFactor = Number((nextScale / 100).toFixed(2)).toString();

    sbState.topbarScale[mode] = nextScale;
    document.documentElement.style.setProperty(`--sb-topbar-scale-${mode}`, scaleFactor);

    if (persist) {
        safeSetItem(storageKey, String(nextScale));
    }

    if (getChatDesktopRefs()) {
        scheduleChatbarRefresh(0);
    }

    updateThemePickerUi();
}

function setBottomBarScale(value, { persist = true } = {}) {
    const nextScale = normalizeTopbarScale(value);
    const scaleFactor = Number((nextScale / 100).toFixed(2)).toString();

    sbState.bottomBarScale = nextScale;
    document.documentElement.style.setProperty('--sb-bottom-bar-scale', scaleFactor);

    // Apply scale to the bottom form via font-size scaling
    const formSheld = document.getElementById('form_sheld');
    if (formSheld) {
        formSheld.style.fontSize = `calc(var(--mainFontSize) * ${scaleFactor})`;
    }

    if (persist) {
        safeSetItem(SB_STORAGE_KEYS.bottomBarScale, String(nextScale));
    }

    updateThemePickerUi();
}

function setMobileButtonScale(value, { persist = true } = {}) {
    const nextScale = normalizeTopbarScale(value);
    const scaleFactor = Number((nextScale / 100).toFixed(2)).toString();

    sbState.mobileButtonScale = nextScale;
    document.documentElement.style.setProperty('--sb-mobile-button-scale', scaleFactor);

    if (persist) {
        safeSetItem(SB_STORAGE_KEYS.mobileButtonScale, String(nextScale));
    }

    updateThemePickerUi();
}

function createElement(tagName, { id = '', className = '', text = '', html = '', attrs = {} } = {}) {
    const element = document.createElement(tagName);

    if (id) {
        element.id = id;
    }

    if (className) {
        element.className = className;
    }

    if (text) {
        element.textContent = text;
    }

    if (html) {
        element.innerHTML = html;
    }

    for (const [key, value] of Object.entries(attrs)) {
        element.setAttribute(key, value);
    }

    return element;
}

function wait(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function normalizeText(value) {
    return String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function clampText(value, maxLength = 120) {
    const normalizedValue = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (normalizedValue.length <= maxLength) {
        return normalizedValue;
    }

    return `${normalizedValue.slice(0, maxLength - 1).trimEnd()}…`;
}

function getSearchTextCandidates(element) {
    const extensionContainer = element.closest('.extension_container');
    const extensionName = extensionContainer?.querySelector('.extension_name')?.textContent ?? '';
    const candidates = [
        element.dataset.sbSearchLabel,
        element.matches('.extension_name') ? element.textContent : '',
        extensionName,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.placeholder : '',
        element instanceof HTMLSelectElement ? element.selectedOptions?.[0]?.textContent : '',
        element.matches('.range-block, .range-block-title, .range-block-header')
            ? element.closest('.range-block')?.querySelector('.range-block-title, .range-block-header, label, strong, h4, h5')?.textContent
            : '',
        element.matches('.extension_container, .extension_name')
            ? extensionContainer?.querySelector('.extension_name, .inline-drawer-header, .inline-drawer-toggle, h3, h4, strong')?.textContent
            : '',
        element.textContent,
    ];

    return candidates
        .map(candidate => String(candidate ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .filter((candidate, index, collection) => collection.indexOf(candidate) === index);
}

function getSearchDisplayText(element, fallback = '') {
    const candidates = getSearchTextCandidates(element);
    const normalizedFallback = normalizeText(fallback);
    const preferredCandidate = candidates.find(candidate => normalizeText(candidate) !== normalizedFallback);
    return clampText(preferredCandidate || candidates[0] || fallback, 110);
}

function getSearchText(element, sectionLabel = '') {
    return normalizeText([
        ...getSearchTextCandidates(element),
        sectionLabel,
    ].join(' '));
}

function getPersonaSearchAvatarId(element) {
    if (!(element instanceof HTMLElement)) {
        return '';
    }

    const directAvatarId = element.closest('.avatar-container[data-avatar-id], .avatar[data-avatar-id]')?.getAttribute('data-avatar-id');
    if (directAvatarId) {
        return directAvatarId;
    }

    if (!element.matches('.persona_name')) {
        return '';
    }

    return document.querySelector('#user_avatar_block .avatar-container.selected[data-avatar-id]')?.getAttribute('data-avatar-id')
        ?? '';
}

function getSearchEntryDedupeKey(tabState, sectionLabel, displayText, { element = null, avatarId = '' } = {}) {
    const personaAvatarId = tabState.id === 'persona'
        ? normalizeText(
            avatarId
            || getPersonaSearchAvatarId(element),
        )
        : '';

    if (personaAvatarId) {
        return `persona::${personaAvatarId}`;
    }

    return [
        tabState.id,
        normalizeText(sectionLabel),
        normalizeText(displayText),
    ].filter(Boolean).join('::');
}

function formatSearchExamples(examples) {
    const filteredExamples = Array.isArray(examples)
        ? examples.map(example => String(example ?? '').trim()).filter(Boolean)
        : [];

    if (!filteredExamples.length) {
        return '';
    }

    if (filteredExamples.length === 1) {
        return `"${filteredExamples[0]}"`;
    }

    if (filteredExamples.length === 2) {
        return `"${filteredExamples[0]}" or "${filteredExamples[1]}"`;
    }

    const leadingExamples = filteredExamples.slice(0, -1).map(example => `"${example}"`).join(', ');
    return `${leadingExamples}, or "${filteredExamples.at(-1)}"`;
}

function getSearchAssistCopy(shellKey, tabState = null) {
    const shellConfig = getShellConfig(shellKey);
    const activeTab = tabState ?? getShellState(shellKey)?.tabs.get(getShellState(shellKey)?.activeTabId) ?? null;
    const placeholder = activeTab?.searchPlaceholder || shellConfig?.searchPlaceholder || 'Search';
    const hintPrefix = activeTab?.searchHint || shellConfig?.searchHint || '';
    const exampleSource = Array.isArray(activeTab?.searchExamples) && activeTab.searchExamples.length
        ? activeTab.searchExamples
        : shellConfig?.searchExamples;
    const exampleText = formatSearchExamples(exampleSource);
    const hint = [hintPrefix, exampleText ? `Try ${exampleText}.` : '']
        .filter(Boolean)
        .join(' ')
        .trim();

    return {
        placeholder,
        hint,
        emptyHint: hint || 'Try a broader term.',
    };
}

function updateShellSearchAssist(shellKey) {
    const shellState = getShellState(shellKey);

    if (!shellState) {
        return;
    }

    const assistCopy = getSearchAssistCopy(shellKey, shellState.tabs.get(shellState.activeTabId));

    if (shellState.searchInput instanceof HTMLInputElement) {
        shellState.searchInput.placeholder = assistCopy.placeholder;
        shellState.searchInput.setAttribute('aria-label', assistCopy.placeholder);
    }

    if (shellState.searchHint instanceof HTMLElement) {
        shellState.searchHint.textContent = assistCopy.hint;
        shellState.searchHint.hidden = !assistCopy.hint;
    }
}

function isActuallyVisible(element) {
    return Boolean(element) && element.getClientRects().length > 0;
}

function getShellState(shellKey) {
    return sbState.shells[shellKey];
}

function getShellConfig(shellKey) {
    return SB_SHELLS[shellKey];
}

function isMobileViewport() {
    return window.matchMedia(SB_MOBILE_MEDIA_QUERY).matches;
}

function canResizeDesktopShells() {
    return !isMobileViewport() && window.matchMedia(SB_DESKTOP_SHELL_RESIZE_MEDIA_QUERY).matches;
}

function isDesktopResizableShell(shellKey) {
    return shellKey === 'left' || shellKey === 'right';
}

function getShellAccountStorage() {
    const storage = getSillyTavernContext()?.accountStorage;

    if (!storage || typeof storage.getState !== 'function') {
        return null;
    }

    try {
        const snapshot = storage.getState();
        return snapshot && Object.hasOwn(snapshot, SB_ACCOUNT_STORAGE_READY_MARKER) ? storage : null;
    } catch {
        return null;
    }
}

function getPersistentStorageItem(key) {
    if (!key) {
        return null;
    }

    const localValue = safeGetItem(key);
    const accountStorage = getShellAccountStorage();
    const accountValue = accountStorage ? accountStorage.getItem(key) : null;

    if (accountValue !== null) {
        if (accountValue !== localValue) {
            safeSetItem(key, accountValue);
        }

        return accountValue;
    }

    if (localValue !== null && accountStorage) {
        accountStorage.setItem(key, localValue);
    }

    return localValue;
}

function setPersistentStorageItem(key, value) {
    if (!key) {
        return;
    }

    safeSetItem(key, value);
    getShellAccountStorage()?.setItem(key, value);
}

function getPersistedShellSize(shellKey) {
    const storageKey = getShellSizeStorageKey(shellKey);

    if (!storageKey) {
        return null;
    }

    const localSize = normalizeShellSize(safeGetItem(storageKey));
    const accountStorage = getShellAccountStorage();
    const accountSize = accountStorage ? normalizeShellSize(accountStorage.getItem(storageKey)) : null;

    if (accountSize) {
        if (!areShellSizesEqual(localSize, accountSize)) {
            safeSetItem(storageKey, JSON.stringify(accountSize));
        }

        return accountSize;
    }

    if (localSize && accountStorage) {
        accountStorage.setItem(storageKey, JSON.stringify(localSize));
    }

    return localSize;
}

function hydratePersistedShellSizes() {
    for (const shellKey of ['left', 'right']) {
        const persistedSize = getPersistedShellSize(shellKey);

        if (persistedSize) {
            sbState.shellSizing.overrides[shellKey] = persistedSize;
        }
    }
}

function getShellSizeStorageKey(shellKey) {
    if (shellKey === 'left') {
        return SB_STORAGE_KEYS.leftShellSize;
    }

    if (shellKey === 'right') {
        return SB_STORAGE_KEYS.rightShellSize;
    }

    return '';
}

function getDesktopShellDimensions() {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (isMobileViewport() || viewportHeight <= SB_DESKTOP_SHELL_LAYOUT.fullWidthMaxHeight) {
        return {
            width: viewportWidth,
            maxWidth: viewportWidth,
        };
    }

    if (viewportWidth <= SB_DESKTOP_SHELL_LAYOUT.compactViewportWidth) {
        const compactWidth = Math.max(0, Math.min(SB_DESKTOP_SHELL_LAYOUT.compactMaxWidth, viewportWidth - SB_DESKTOP_SHELL_LAYOUT.compactGap));
        return {
            width: compactWidth,
            maxWidth: compactWidth,
        };
    }

    const desiredWidth = clampNumber(
        viewportWidth * SB_DESKTOP_SHELL_LAYOUT.ratio,
        SB_DESKTOP_SHELL_LAYOUT.minWidth,
        SB_DESKTOP_SHELL_LAYOUT.maxWidth,
    );
    const gutter = clampNumber(
        viewportWidth * SB_DESKTOP_SHELL_LAYOUT.gutterRatio,
        SB_DESKTOP_SHELL_LAYOUT.gutterMin,
        SB_DESKTOP_SHELL_LAYOUT.gutterMax,
    );
    const maxWidth = Math.max(0, viewportWidth - gutter);
    const resolvedWidth = Math.min(desiredWidth, maxWidth);

    return {
        width: resolvedWidth,
        maxWidth: resolvedWidth,
    };
}

function getDesktopShellResizeBounds() {
    const viewportWidth = Math.max(0, Math.round(window.innerWidth));
    const topbarOffset = Number.parseFloat(
        window.getComputedStyle(document.documentElement).getPropertyValue('--sb-topbar-layout-offset'),
    );
    const resolvedTopbarOffset = Number.isFinite(topbarOffset) ? topbarOffset : 0;
    const defaultDimensions = getDesktopShellDimensions();
    const maxHeight = Math.max(0, Math.round(window.innerHeight - resolvedTopbarOffset - SB_DESKTOP_SHELL_RESIZE.bottomGap));

    return {
        defaultWidth: Math.max(0, Math.round(defaultDimensions.width)),
        defaultHeight: maxHeight,
        minWidth: Math.min(SB_DESKTOP_SHELL_RESIZE.minWidth, viewportWidth),
        maxWidth: viewportWidth,
        minHeight: Math.min(SB_DESKTOP_SHELL_RESIZE.minHeight, maxHeight),
        maxHeight,
    };
}

function clampShellSize(size, bounds = getDesktopShellResizeBounds()) {
    const normalizedSize = normalizeShellSize(size);

    if (!normalizedSize) {
        return null;
    }

    return {
        width: clampNumber(normalizedSize.width, bounds.minWidth, bounds.maxWidth),
        height: clampNumber(normalizedSize.height, bounds.minHeight, bounds.maxHeight),
    };
}

function areShellSizesEqual(left, right) {
    return Boolean(left) && Boolean(right)
        && left.width === right.width
        && left.height === right.height;
}

function getShellSizeOverride(shellKey) {
    return isDesktopResizableShell(shellKey) ? sbState.shellSizing.overrides[shellKey] ?? null : null;
}

function setShellSizeOverride(shellKey, size, { persist = true } = {}) {
    if (!isDesktopResizableShell(shellKey)) {
        return null;
    }

    const storageKey = getShellSizeStorageKey(shellKey);
    const nextSize = clampShellSize(size);

    sbState.shellSizing.overrides[shellKey] = nextSize;

    if (!persist || !storageKey) {
        return nextSize;
    }

    const accountStorage = getShellAccountStorage();

    if (nextSize) {
        const serializedSize = JSON.stringify(nextSize);
        safeSetItem(storageKey, serializedSize);
        accountStorage?.setItem(storageKey, serializedSize);
    } else {
        safeRemoveItem(storageKey);
        accountStorage?.removeItem(storageKey);
    }

    return nextSize;
}

function applyDesktopShellSize(root, size) {
    root.style.setProperty('width', `${size.width}px`, 'important');
    root.style.setProperty('max-width', `${size.width}px`, 'important');
    root.style.setProperty('height', `${size.height}px`, 'important');
    root.style.setProperty('max-height', `${size.height}px`, 'important');
}

function syncDesktopShellSizing() {
    hydratePersistedShellSizes();

    const { width, maxWidth } = getDesktopShellDimensions();
    const bounds = getDesktopShellResizeBounds();
    const resizingEnabled = canResizeDesktopShells();

    for (const shellKey of ['left', 'right']) {
        const root = document.getElementById(getShellConfig(shellKey).rootPanelId);
        if (!(root instanceof HTMLElement)) {
            continue;
        }

        if (isMobileViewport()) {
            root.style.setProperty('width', `${width}px`, 'important');
            root.style.setProperty('max-width', `${maxWidth}px`, 'important');
            root.style.removeProperty('height');
            root.style.removeProperty('max-height');
            root.classList.remove('sb-shell-can-resize');
            continue;
        }

        let sizeToApply = {
            width,
            height: bounds.defaultHeight,
        };

        const storedOverride = getShellSizeOverride(shellKey);
        if (resizingEnabled && storedOverride) {
            const clampedOverride = clampShellSize(storedOverride, bounds);
            if (clampedOverride) {
                sizeToApply = clampedOverride;

                if (!areShellSizesEqual(storedOverride, clampedOverride)) {
                    setShellSizeOverride(shellKey, clampedOverride);
                } else {
                    sbState.shellSizing.overrides[shellKey] = clampedOverride;
                }
            }
        }

        applyDesktopShellSize(root, sizeToApply);
        root.classList.toggle('sb-shell-can-resize', resizingEnabled);
    }
}

function beginShellResize(shellKey, event) {
    if (!canResizeDesktopShells() || !isDesktopResizableShell(shellKey) || event.button !== 0) {
        return;
    }

    const root = document.getElementById(getShellConfig(shellKey).rootPanelId);
    if (!(root instanceof HTMLElement) || !root.classList.contains('openDrawer')) {
        return;
    }

    if (typeof sbState.shellSizing.activeResize?.cleanup === 'function') {
        sbState.shellSizing.activeResize.cleanup();
    }

    const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const bounds = getDesktopShellResizeBounds();
    const startRect = root.getBoundingClientRect();
    const startSize = clampShellSize({
        width: startRect.width || bounds.defaultWidth,
        height: startRect.height || bounds.defaultHeight,
    }, bounds);

    if (!startSize) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    document.body.classList.add('sb-shell-resizing');
    root.classList.add('sb-shell-resize-active');
    setShellSizeOverride(shellKey, startSize, { persist: false });

    const cleanup = () => {
        if (handle && typeof handle.releasePointerCapture === 'function') {
            try {
                handle.releasePointerCapture(event.pointerId);
            } catch {
                // Ignore pointer capture cleanup failures.
            }
        }

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        document.body.classList.remove('sb-shell-resizing');
        root.classList.remove('sb-shell-resize-active');

        if (sbState.shellSizing.activeResize?.pointerId === event.pointerId) {
            sbState.shellSizing.activeResize = null;
        }
    };

    const onPointerMove = moveEvent => {
        if (moveEvent.pointerId !== event.pointerId) {
            return;
        }

        moveEvent.preventDefault();
        const nextSize = clampShellSize({
            width: startSize.width + (moveEvent.clientX - event.clientX),
            height: startSize.height + (moveEvent.clientY - event.clientY),
        });

        if (!nextSize) {
            return;
        }

        sbState.shellSizing.overrides[shellKey] = nextSize;
        applyDesktopShellSize(root, nextSize);
    };

    const onPointerUp = endEvent => {
        if (endEvent.pointerId !== event.pointerId) {
            return;
        }

        const activeSize = getShellSizeOverride(shellKey) ?? startSize;
        cleanup();
        setShellSizeOverride(shellKey, activeSize);
        syncDesktopShellSizing();
    };

    sbState.shellSizing.activeResize = {
        shellKey,
        pointerId: event.pointerId,
        cleanup,
    };

    if (handle && typeof handle.setPointerCapture === 'function') {
        try {
            handle.setPointerCapture(event.pointerId);
        } catch {
            // Ignore pointer capture failures.
        }
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
}

function ensureShellReady(shellKey) {
    if (getShellState(shellKey)) {
        return true;
    }

    buildShell(shellKey);
    return Boolean(getShellState(shellKey));
}

function ensureMobileNavReady() {
    const existingOverlay = document.getElementById('sb-mobile-nav');
    if (existingOverlay instanceof HTMLElement) {
        return existingOverlay;
    }

    buildMobileNav();
    return document.getElementById('sb-mobile-nav');
}

function clearShellSearch(shellKey) {
    const shellState = getShellState(shellKey);
    if (!shellState) {
        return;
    }

    if (shellState.searchInput instanceof HTMLInputElement) {
        shellState.searchInput.value = '';
    }

    if (shellState.searchResults instanceof HTMLElement) {
        shellState.searchResults.replaceChildren();
        shellState.searchResults.classList.remove('is-visible');
    }
}

function getThemeOption(themeId) {
    return SB_THEMES.find(theme => theme.id === themeId) ?? SB_THEMES[0];
}

function normalizeMessageStyle(styleId) {
    const select = getMessageStyleSelect();
    const fallbackValue = select?.options?.[0]?.value ?? SB_MESSAGE_STYLES[0].id;
    const value = String(styleId ?? fallbackValue);

    if (!select) {
        return value;
    }

    return Array.from(select.options).some(option => option.value === value) ? value : fallbackValue;
}

function getMessageStyleSelect() {
    const select = document.getElementById('chat_display');
    return select instanceof HTMLSelectElement ? select : null;
}

function getCurrentMessageStyle() {
    return normalizeMessageStyle(getMessageStyleSelect()?.value);
}

function setMessageStyle(styleId) {
    const select = getMessageStyleSelect();
    if (!select) {
        return;
    }

    const nextStyle = normalizeMessageStyle(styleId);
    if (select.value !== nextStyle) {
        select.value = nextStyle;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    updateThemePickerUi();
}

function setShellTheme(themeId, { persist = true } = {}) {
    const nextTheme = normalizeTheme(themeId);

    sbState.theme = nextTheme;
    document.documentElement.dataset.sbTheme = nextTheme;

    if (persist) {
        safeSetItem(SB_STORAGE_KEYS.theme, nextTheme);
    }

    updateThemePickerUi();
    updateThemeBadge();
}

function setSurfaceTransparency(value, { persist = true } = {}) {
    const nextTransparency = normalizeSurfaceTransparency(value);
    const surfaceOpacity = Math.max(0.42, 1 - (nextTransparency / 100));
    const cardOpacity = Math.min(1, surfaceOpacity + 0.12);
    const controlOpacity = Math.min(1, surfaceOpacity + 0.22);
    const overlayOpacity = Math.min(1, surfaceOpacity + 0.08);

    sbState.surfaceTransparency = nextTransparency;

    document.documentElement.style.setProperty('--sb-shell-surface-opacity', '1');
    document.documentElement.style.setProperty('--sb-shell-card-opacity', '1');
    document.documentElement.style.setProperty('--sb-shell-control-opacity', '1');
    document.documentElement.style.setProperty('--sb-shell-overlay-opacity', '1');
    document.documentElement.style.setProperty('--sb-page-surface-opacity', surfaceOpacity.toFixed(2));
    document.documentElement.style.setProperty('--sb-page-card-opacity', cardOpacity.toFixed(2));
    document.documentElement.style.setProperty('--sb-page-control-opacity', controlOpacity.toFixed(2));
    document.documentElement.style.setProperty('--sb-page-overlay-opacity', overlayOpacity.toFixed(2));

    if (persist) {
        safeSetItem(SB_STORAGE_KEYS.surfaceTransparency, String(nextTransparency));
    }

    updateThemePickerUi();
}

function setDesktopTopbarLabelPart(partId, enabled) {
    const normalizedPart = normalizeTopbarLabelPart(partId);
    if (!normalizedPart) {
        return;
    }

    const nextParts = new Set(normalizeTopbarLabelParts(sbState.topbarLabel.desktopParts));
    if (enabled) {
        nextParts.add(normalizedPart);
    } else {
        nextParts.delete(normalizedPart);
    }

    sbState.topbarLabel.desktopParts = normalizeTopbarLabelParts(Array.from(nextParts), []);
    safeSetItem(SB_STORAGE_KEYS.topbarLabelDesktopParts, JSON.stringify(sbState.topbarLabel.desktopParts));
    updateThemePickerUi();
    updateTopBarBrand();
    scheduleTopbarContextRefresh(0);
}

function setMobileTopbarLabelPart(partId, enabled) {
    const normalizedPart = normalizeTopbarLabelPart(partId);
    const nextPart = enabled ? normalizedPart : '';

    if (sbState.topbarLabel.mobilePart === nextPart) {
        return;
    }

    sbState.topbarLabel.mobilePart = nextPart;
    safeSetItem(SB_STORAGE_KEYS.topbarLabelMobilePart, nextPart);
    updateThemePickerUi();
    updateTopBarBrand();
    scheduleTopbarContextRefresh(0);
}

function setTopbarCustomText(value) {
    const nextText = normalizeTopbarCustomText(value);
    if (sbState.topbarLabel.customText === nextText) {
        return;
    }

    sbState.topbarLabel.customText = nextText;
    safeSetItem(SB_STORAGE_KEYS.topbarLabelCustomText, nextText);
    updateThemePickerUi();
    updateTopBarBrand();
}

function updateThemeBadge() {
    const badge = document.getElementById('sb-theme-current-label');
    if (!badge) {
        return;
    }

    badge.textContent = getThemeOption(sbState.theme).label;
}

function getSillyTavernContext() {
    // SillyTavern.getContext() throws a TDZ ReferenceError on slow boots when
    // it is called before script.js finishes initializing its module-level
    // `chat` binding. Treat that the same as "context not ready yet".
    try {
        return globalThis.SillyTavern?.getContext?.() ?? null;
    } catch {
        return null;
    }
}

function hasActiveTopBarChat(context = getSillyTavernContext()) {
    return Boolean(context && (context.groupId || (context.characterId !== undefined && context.characterId !== null)));
}

function getTopBarCharacterLabel(context = getSillyTavernContext()) {
    if (!context) {
        return '';
    }

    if (context.groupId) {
        const activeGroup = context.groups?.find(group => String(group?.id) === String(context.groupId));
        return activeGroup?.name?.trim() || '';
    }

    if (context.characterId !== undefined && context.characterId !== null) {
        const activeCharacter = context.characters?.[context.characterId];
        return activeCharacter?.name?.trim() || context.name2?.trim() || '';
    }

    return '';
}

function getDefaultTopBarLabel(context = getSillyTavernContext()) {
    return getTopBarCharacterLabel(context) || SB_IDLE_BRAND_LABEL;
}

function formatTopbarContextTokens(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return '';
    }

    return Math.max(0, Math.round(numericValue)).toLocaleString();
}

function getPromptManagerTokenUsage(promptManager) {
    const directValue = Number(promptManager?.tokenUsage);
    if (Number.isFinite(directValue)) {
        return Math.max(0, Math.round(directValue));
    }

    const tokenHandler = promptManager?.getTokenHandler?.();
    const total = Number(tokenHandler?.getTotal?.());
    return Number.isFinite(total) ? Math.max(0, Math.round(total)) : null;
}

function setTopbarContextTokens(tokens) {
    const normalizedValue = Number.isFinite(Number(tokens)) ? Math.max(0, Math.round(Number(tokens))) : null;
    if (sbState.topbarLabel.contextTokens === normalizedValue) {
        return;
    }

    sbState.topbarLabel.contextTokens = normalizedValue;
    updateTopBarBrand();
}

function isTopbarContextLabelEnabled() {
    return sbState.topbarLabel.desktopParts.includes('ctx') || sbState.topbarLabel.mobilePart === 'ctx';
}

function syncTopbarContextTokensFromPromptManager() {
    const context = getSillyTavernContext();
    const promptManager = context?.promptManager;

    if (!hasActiveTopBarChat(context) || context?.mainApi !== 'openai') {
        setTopbarContextTokens(null);
        return;
    }

    setTopbarContextTokens(getPromptManagerTokenUsage(promptManager));
}

function scheduleTopbarContextRefresh(delay = SB_TOPBAR_CONTEXT_REFRESH_DEBOUNCE) {
    window.clearTimeout(sbState.topbarLabel.refreshTimer);

    if (!isTopbarContextLabelEnabled()) {
        syncTopbarContextTokensFromPromptManager();
        return;
    }

    sbState.topbarLabel.refreshTimer = window.setTimeout(() => {
        void refreshTopbarContextTokens();
    }, delay);
}

async function refreshTopbarContextTokens() {
    const context = getSillyTavernContext();
    const promptManager = context?.promptManager;

    if (!hasActiveTopBarChat(context) || context?.mainApi !== 'openai') {
        setTopbarContextTokens(null);
        return;
    }

    if (!promptManager || typeof promptManager.tryGenerate !== 'function') {
        syncTopbarContextTokensFromPromptManager();
        return;
    }

    if (sbState.topbarLabel.refreshInFlight) {
        sbState.topbarLabel.refreshPending = true;
        return;
    }

    sbState.topbarLabel.refreshInFlight = true;
    sbState.topbarLabel.refreshPending = false;
    const refreshToken = ++sbState.topbarLabel.refreshToken;
    syncTopbarContextTokensFromPromptManager();

    try {
        await promptManager.tryGenerate();
    } catch {
        // Ignore dry-run failures and keep the most recent known value.
    } finally {
        sbState.topbarLabel.refreshInFlight = false;
    }

    if (refreshToken !== sbState.topbarLabel.refreshToken) {
        return;
    }

    syncTopbarContextTokensFromPromptManager();

    if (sbState.topbarLabel.refreshPending) {
        sbState.topbarLabel.refreshPending = false;
        scheduleTopbarContextRefresh(80);
    }
}

function getConfiguredTopbarLabelParts() {
    if (isMobileViewport()) {
        return sbState.topbarLabel.mobilePart ? [sbState.topbarLabel.mobilePart] : [];
    }

    return normalizeTopbarLabelParts(sbState.topbarLabel.desktopParts);
}

function getTopBarLabelPartText(partId, context = getSillyTavernContext()) {
    switch (partId) {
        case 'ctx':
            if (!hasActiveTopBarChat(context) || context?.mainApi !== 'openai') {
                return '';
            }

            return formatTopbarContextTokens(sbState.topbarLabel.contextTokens) || '...';
        case 'char':
            return getTopBarCharacterLabel(context);
        case 'custom':
            return sbState.topbarLabel.customText;
        default:
            return '';
    }
}

function getTopBarLabel() {
    const context = getSillyTavernContext();
    const parts = getConfiguredTopbarLabelParts()
        .map(partId => normalizeTopbarLabelPart(partId))
        .filter(Boolean);
    const labelParts = SB_TOPBAR_LABEL_PART_ORDER
        .filter(partId => parts.includes(partId))
        .map(partId => getTopBarLabelPartText(partId, context))
        .filter(Boolean);

    return labelParts.length ? labelParts.join(' · ') : getDefaultTopBarLabel(context);
}

function updateTopBarBrand() {
    const title = document.getElementById('sb-topbar-title');
    const brand = document.querySelector('.sb-topbar-brand');

    if (!(title instanceof HTMLElement) || !(brand instanceof HTMLElement)) {
        return;
    }

    const context = getSillyTavernContext();
    const label = getTopBarLabel();
    const isActiveChat = hasActiveTopBarChat(context);

    title.textContent = label;
    title.title = label;
    title.classList.toggle('is-chat', isActiveChat);
    brand.dataset.brandState = isActiveChat ? 'chat' : 'idle';
}

function scheduleTopBarBrandBindingRetry(delay = 240) {
    window.clearTimeout(sbState.topbarLabel.bindingRetryTimer);
    sbState.topbarLabel.bindingRetryTimer = window.setTimeout(() => {
        bindTopBarBrand();
    }, delay);
}

function bindTopBarBrandWindowEvents() {
    if (sbState.topbarLabel.windowBindingsAttached) {
        return;
    }

    const refreshWithContext = () => {
        window.requestAnimationFrame(updateTopBarBrand);
        scheduleTopbarContextRefresh(0);
        bindTopBarBrand();
    };

    window.addEventListener('pageshow', refreshWithContext, { passive: true });
    window.addEventListener('focus', refreshWithContext, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            refreshWithContext();
        }
    });

    sbState.topbarLabel.windowBindingsAttached = true;
}

function bindTopBarBrand() {
    const context = getSillyTavernContext();
    const eventSource = context?.eventSource;
    const eventTypes = context?.eventTypes ?? context?.event_types;
    bindTopBarBrandWindowEvents();

    if (!eventSource || !eventTypes) {
        window.requestAnimationFrame(updateTopBarBrand);
        scheduleTopbarContextRefresh(0);
        scheduleTopBarBrandBindingRetry();
        return;
    }

    window.clearTimeout(sbState.topbarLabel.bindingRetryTimer);

    if (sbState.topbarLabel.boundEventSource === eventSource) {
        window.requestAnimationFrame(updateTopBarBrand);
        scheduleTopbarContextRefresh(0);
        return;
    }

    const refresh = () => window.requestAnimationFrame(updateTopBarBrand);
    const refreshWithContext = () => {
        refresh();
        scheduleTopbarContextRefresh();
    };
    const events = [
        eventTypes.APP_READY,
        eventTypes.CHAT_CHANGED,
        eventTypes.CHAT_CREATED,
        eventTypes.GROUP_CHAT_CREATED,
        eventTypes.MESSAGE_EDITED,
        eventTypes.MESSAGE_DELETED,
        eventTypes.CHARACTER_EDITED,
        eventTypes.CHARACTER_RENAMED,
        eventTypes.CHARACTER_DELETED,
        eventTypes.GROUP_UPDATED,
        eventTypes.PERSONA_CHANGED,
        eventTypes.MAIN_API_CHANGED,
        eventTypes.SETTINGS_UPDATED,
        eventTypes.WORLDINFO_SETTINGS_UPDATED,
    ].filter(Boolean);

    for (const eventName of new Set(events)) {
        eventSource.on(eventName, refreshWithContext);
    }

    if (eventTypes.CHAT_COMPLETION_PROMPT_READY) {
        eventSource.on(eventTypes.CHAT_COMPLETION_PROMPT_READY, () => {
            syncTopbarContextTokensFromPromptManager();
            refresh();
        });
    }

    sbState.topbarLabel.boundEventSource = eventSource;
    refresh();
    scheduleTopbarContextRefresh(0);
}

function stopProxyPointerPropagation(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    const stop = event => {
        event.stopPropagation();
    };

    element.addEventListener('mousedown', stop);
    element.addEventListener('pointerdown', stop);
    element.addEventListener('touchstart', stop);
}

function createProxyButton({ id, icon, label, title, className = '' }, onClick) {
    const button = createElement('button', {
        id,
        className: `sb-proxy-button ${className}`.trim(),
        attrs: {
            type: 'button',
            title,
            'aria-label': title,
            'aria-expanded': 'false',
            'data-sb-proxy-button': 'true',
        },
    });

    button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span>`;
    stopProxyPointerPropagation(button);
    button.addEventListener('click', onClick);

    return button;
}

function createTopBarIconButton({ id = '', icon, title, className = '', label = '' }, onClick) {
    const button = createElement('button', {
        id,
        className: `sb-chatbar-button ${className}`.trim(),
        attrs: {
            type: 'button',
            title,
            'aria-label': title,
        },
    });

    button.innerHTML = `
        <i class="fa-solid ${icon}" aria-hidden="true"></i>
        ${label ? `<span>${label}</span>` : ''}
    `;

    // Only stop mousedown/pointerdown propagation — stopping touchstart
    // interferes with mobile click synthesis and causes double-tap issues.
    const stop = event => event.stopPropagation();
    button.addEventListener('mousedown', stop);
    button.addEventListener('pointerdown', stop);
    button.addEventListener('click', onClick);

    return button;
}

function getChatbarState() {
    return sbState.chatbar;
}

function setTopbarUtilityButtonIcon(button, icon, title) {
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    button.title = title;
    button.setAttribute('aria-label', title);

    const iconElement = button.querySelector('i');
    if (iconElement instanceof HTMLElement) {
        iconElement.className = `fa-solid ${icon}`;
    }
}

function updateTopbarUtilityButtons() {
    const state = getChatbarState();
    const toggleButton = state.chatbarToggleButton;
    const dragHandleButton = state.dragHandleButton;
    const isVisible = state.visible;

    if (toggleButton instanceof HTMLButtonElement) {
        setTopbarUtilityButtonIcon(
            toggleButton,
            isVisible ? 'fa-eye-slash' : 'fa-eye',
            isVisible ? 'Hide top chat bar' : 'Show top chat bar',
        );
        setButtonPressed(toggleButton, isVisible);
    }

    if (dragHandleButton instanceof HTMLButtonElement) {
        const dragTitle = isMobileViewport()
            ? 'Drag to move the chat info bar on mobile.'
            : 'Drag to move the chat info bar. Double-click to reset.';
        setTopbarUtilityButtonIcon(dragHandleButton, 'fa-grip-lines', dragTitle);
        setButtonDisabled(dragHandleButton, false);
    }
}

function syncTopbarLayoutState() {
    const stack = document.getElementById('sb-topbar-stack');
    const hasVisibleChatbar = stack?.querySelector('#sb-chatbar-layer') instanceof HTMLElement
        && getChatbarState().visible;

    document.body.classList.toggle('sb-topbar-compact', !hasVisibleChatbar);
}

function setChatbarVisible(shouldShow, { persist = true } = {}) {
    const nextVisible = Boolean(shouldShow);
    const state = getChatbarState();
    state.visible = nextVisible;

    document.body.classList.toggle('sb-chatbar-hidden', !nextVisible);

    if (!nextVisible) {
        setConnectionStripOpenState(false);
    }

    if (persist) {
        safeSetItem(SB_STORAGE_KEYS.chatbarVisible, String(nextVisible));
    }

    updateTopbarUtilityButtons();
    syncTopbarLayoutState();
    scheduleChatbarRefresh(0);
}

function toggleChatbarVisibility() {
    setChatbarVisible(!getChatbarState().visible);
}

function syncChatbarVisibilityState() {
    setChatbarVisible(getChatbarState().visible, { persist: false });
}

function getTopbarDragKey(event) {
    if (!event) {
        return null;
    }

    if (event.changedTouches?.length) {
        return `touch:${event.changedTouches[0].identifier}`;
    }

    if (event.touches?.length) {
        return `touch:${event.touches[0].identifier}`;
    }

    if (typeof event.pointerType === 'string') {
        if (event.pointerType === 'mouse') {
            return 'mouse';
        }

        if (Number.isFinite(event.pointerId)) {
            return `pointer:${event.pointerId}`;
        }
    }

    if (Number.isFinite(event.pointerId)) {
        return `pointer:${event.pointerId}`;
    }

    if (event.type?.startsWith?.('mouse')) {
        return 'mouse';
    }

    return null;
}

function getTopbarDragPoint(event) {
    if (!event) {
        return null;
    }

    if (event.changedTouches?.length) {
        return event.changedTouches[0];
    }

    if (event.touches?.length) {
        return event.touches[0];
    }

    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        return event;
    }

    return null;
}

function updateTopbarDrag(event) {
    const state = getChatbarState();
    const point = getTopbarDragPoint(event);

    if (!state.dragging || !point || getTopbarDragKey(event) !== state.dragging.key) {
        return;
    }

    setTopbarOffset({
        x: state.dragging.startX + (point.clientX - state.dragging.originX),
        y: state.dragging.startY + (point.clientY - state.dragging.originY),
    }, { persist: false });

    if (event.cancelable) {
        event.preventDefault();
    }
}

function endTopbarDrag(event) {
    const state = getChatbarState();

    if (!state.dragging || getTopbarDragKey(event) !== state.dragging.key) {
        return;
    }

    document.getElementById('sb-chatbar-layer')?.classList.remove('is-dragging');
    document.body.classList.remove('sb-topbar-dragging');

    const finalOffset = clampTopbarOffset(getChatbarState().renderedTopbarOffset);
    state.dragging = null;
    setTopbarOffset(finalOffset, { persist: true });

    unbindTopbarDragEvents();
}

function unbindTopbarDragEvents() {
    const state = getChatbarState();

    if (!state.dragListenersBound) {
        return;
    }

    state.dragListenersBound = false;
    window.removeEventListener('pointermove', updateTopbarDrag);
    window.removeEventListener('pointerup', endTopbarDrag);
    window.removeEventListener('pointercancel', endTopbarDrag);
    window.removeEventListener('mousemove', updateTopbarDrag);
    window.removeEventListener('mouseup', endTopbarDrag);
    window.removeEventListener('touchmove', updateTopbarDrag);
    window.removeEventListener('touchend', endTopbarDrag);
    window.removeEventListener('touchcancel', endTopbarDrag);
}

function bindTopbarDragEvents() {
    const state = getChatbarState();

    if (state.dragListenersBound) {
        return;
    }

    state.dragListenersBound = true;
    window.addEventListener('pointermove', updateTopbarDrag);
    window.addEventListener('pointerup', endTopbarDrag);
    window.addEventListener('pointercancel', endTopbarDrag);
    window.addEventListener('mousemove', updateTopbarDrag);
    window.addEventListener('mouseup', endTopbarDrag);
    window.addEventListener('touchmove', updateTopbarDrag, { passive: false });
    window.addEventListener('touchend', endTopbarDrag);
    window.addEventListener('touchcancel', endTopbarDrag);
}

function getChatDesktopRefs() {
    return getChatbarState().desktop;
}

function getChatMobileRefs() {
    return getChatbarState().mobileTools;
}

function getChatSidebarRefs() {
    return getChatbarState().sidebar;
}

function escapeSelectorValue(value) {
    if (globalThis.CSS?.escape) {
        return globalThis.CSS.escape(String(value ?? ''));
    }

    return String(value ?? '').replace(/["\\]/g, '\\$&');
}

function escapeRegExp(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripDecoratedOptionText(value) {
    return String(value ?? '').replace(/[[(].*?[\])]/g, '').trim();
}

function getRequestHeadersFromContext(context = getSillyTavernContext()) {
    if (typeof context?.getRequestHeaders === 'function') {
        return context.getRequestHeaders();
    }

    return {
        'Content-Type': 'application/json',
    };
}

function getCsrfTokenFromHeaders(headers) {
    if (!headers || typeof headers !== 'object') {
        return '';
    }

    const rawToken = headers['X-CSRF-Token'] ?? headers['x-csrf-token'] ?? '';
    const token = String(rawToken ?? '').trim();

    if (!token || token === 'undefined' || token === 'null') {
        return '';
    }

    return token;
}

async function waitForAuthorizedRequestHeaders(timeoutMs = 15000, context = getSillyTavernContext()) {
    const timeoutAt = Date.now() + timeoutMs;

    while (Date.now() < timeoutAt) {
        const headers = getRequestHeadersFromContext(context);

        if (getCsrfTokenFromHeaders(headers)) {
            return headers;
        }

        await wait(50);
    }

    return getRequestHeadersFromContext(context);
}

async function getAuthorizedRequestHeadersOrNull(timeoutMs = 1500, context = getSillyTavernContext()) {
    const headers = await waitForAuthorizedRequestHeaders(timeoutMs, context);
    return getCsrfTokenFromHeaders(headers) ? headers : null;
}

function normalizeChatFileName(value) {
    return String(value ?? '').replace(/\.jsonl$/i, '').trim();
}

function getChatUiContext() {
    const context = getSillyTavernContext();

    if (!context) {
        return {
            context: null,
            chatId: '',
            group: null,
            character: null,
            hasChat: false,
            canBrowseChats: false,
            canStartNewChat: false,
            label: '',
        };
    }

    const group = context.groupId
        ? context.groups?.find(item => String(item?.id) === String(context.groupId)) ?? null
        : null;
    const character = context.characterId !== undefined && context.characterId !== null
        ? context.characters?.[context.characterId] ?? null
        : null;
    const chatId = normalizeChatFileName(context.getCurrentChatId?.() ?? context.chatId ?? '');
    const canBrowseChats = Boolean(group || character);

    return {
        context,
        chatId,
        group,
        character,
        hasChat: Boolean(chatId),
        canBrowseChats,
        canStartNewChat: canBrowseChats,
        label: String(group?.name ?? character?.name ?? '').trim(),
    };
}

function getChatSortTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 1e12 ? value : value * 1000;
    }

    if (typeof value === 'string') {
        const numericValue = Number(value);

        if (Number.isFinite(numericValue) && numericValue > 0) {
            return numericValue > 1e12 ? numericValue : numericValue * 1000;
        }

        const parsedValue = Date.parse(value);
        if (Number.isFinite(parsedValue)) {
            return parsedValue;
        }
    }

    return 0;
}

function formatChatTimestamp(value) {
    const timestamp = getChatSortTimestamp(value);
    if (!timestamp) {
        return '';
    }

    try {
        return new Date(timestamp).toLocaleDateString();
    } catch {
        return '';
    }
}

function formatChatPreview(value) {
    return clampText(String(value ?? '').replace(/\s+/g, ' ').trim() || 'No preview yet.', 120);
}

function normalizeChatInfo(chatInfo) {
    const rawFileName = chatInfo?.file_name ?? chatInfo?.id ?? chatInfo?.chat_id ?? chatInfo ?? '';
    const fileName = normalizeChatFileName(rawFileName);

    return {
        fileName,
        preview: formatChatPreview(chatInfo?.mes ?? chatInfo?.preview ?? chatInfo?.message ?? ''),
        lastMessage: chatInfo?.last_mes ?? chatInfo?.updated_at ?? chatInfo?.create_date ?? '',
        sortTimestamp: getChatSortTimestamp(chatInfo?.last_mes ?? chatInfo?.updated_at ?? chatInfo?.create_date ?? ''),
        chatItems: Number(chatInfo?.chat_items ?? chatInfo?.message_count ?? 0) || 0,
        fileSize: String(chatInfo?.file_size ?? '').trim(),
    };
}

function sortChatFiles(files) {
    return [...files].sort((left, right) => {
        if (right.sortTimestamp !== left.sortTimestamp) {
            return right.sortTimestamp - left.sortTimestamp;
        }

        return left.fileName.localeCompare(right.fileName);
    });
}

async function fetchCharacterChatFiles(chatContext) {
    const avatarUrl = chatContext.character?.avatar;

    if (!avatarUrl) {
        return [];
    }

    try {
        const headers = await getAuthorizedRequestHeadersOrNull(2000, chatContext.context);
        if (!headers) {
            return [];
        }

        const response = await fetch('/api/characters/chats', {
            method: 'POST',
            headers,
            body: JSON.stringify({ avatar_url: avatarUrl }),
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        if (typeof data === 'object' && data?.error === true) {
            return [];
        }

        const chats = Array.isArray(data) ? data : Object.values(data ?? {});
        return sortChatFiles(chats.map(normalizeChatInfo).filter(chat => chat.fileName));
    } catch (error) {
        console.error('Failed to fetch character chats', error);
        return [];
    }
}

async function fetchGroupChatFiles(chatContext) {
    const groupChats = Array.isArray(chatContext.group?.chats) ? chatContext.group.chats : [];

    if (!groupChats.length) {
        return [];
    }

    try {
        const headers = await getAuthorizedRequestHeadersOrNull(2000, chatContext.context);
        if (!headers) {
            return [];
        }

        const chats = await Promise.all(groupChats.map(async chatId => {
            try {
                const response = await fetch('/api/chats/group/info', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ id: chatId }),
                });

                if (!response.ok) {
                    if (response.status === 404) {
                        return null;
                    }

                    return normalizeChatInfo({ file_name: chatId });
                }

                return normalizeChatInfo(await response.json());
            } catch {
                return normalizeChatInfo({ file_name: chatId });
            }
        }));

        return sortChatFiles(chats.filter(chat => chat?.fileName));
    } catch (error) {
        console.error('Failed to fetch group chats', error);
        return [];
    }
}

async function getChatFilesForContext(chatContext = getChatUiContext()) {
    if (!chatContext.canBrowseChats) {
        return [];
    }

    return chatContext.group
        ? fetchGroupChatFiles(chatContext)
        : fetchCharacterChatFiles(chatContext);
}

async function openChatById(chatId, { closeMobileTools = false } = {}) {
    const nextChatId = normalizeChatFileName(chatId);
    const chatContext = getChatUiContext();

    if (!nextChatId || !chatContext.context) {
        return;
    }

    if (nextChatId === chatContext.chatId) {
        if (closeMobileTools) {
            closeMobileChatTools();
        }
        return;
    }

    try {
        if (chatContext.group?.id) {
            await chatContext.context.openGroupChat?.(chatContext.group.id, nextChatId);
        } else {
            await chatContext.context.openCharacterChat?.(nextChatId);
        }
    } finally {
        if (closeMobileTools) {
            closeMobileChatTools();
        }

        scheduleChatbarRefresh(80);
    }
}

async function handleRenameChat() {
    const chatContext = getChatUiContext();
    const currentChatId = chatContext.chatId;

    if (!currentChatId || typeof chatContext.context?.renameChat !== 'function') {
        return;
    }

    const newChatName = await chatContext.context.Popup?.show?.input?.('Rename chat', 'Enter a new chat name:', currentChatId);

    if (!newChatName || String(newChatName).trim() === currentChatId) {
        return;
    }

    await chatContext.context.renameChat(currentChatId, String(newChatName).trim());
    scheduleChatbarRefresh(120);
}

async function handleDeleteChat() {
    const chatContext = getChatUiContext();

    if (!chatContext.chatId) {
        return;
    }

    const confirmed = await chatContext.context?.Popup?.show?.confirm?.('Delete chat?', 'This action cannot be undone.');
    if (!confirmed) {
        return;
    }

    await chatContext.context?.executeSlashCommandsWithOptions?.('/delchat');
    scheduleChatbarRefresh(150);
}

async function handleCloseChat() {
    const chatContext = getChatUiContext();

    if (typeof chatContext.context?.closeCurrentChat === 'function') {
        await chatContext.context.closeCurrentChat();
    } else {
        document.getElementById('option_close_chat')?.click();
    }

    scheduleChatbarRefresh(80);
}

function handleNewChat() {
    document.getElementById('option_start_new_chat')?.click();
    scheduleChatbarRefresh(100);
}

function handleChatManagerClick() {
    document.getElementById('option_select_chat')?.click();
}

function createChatField({ id = '', icon, title, tagName = 'label', className = '' }) {
    const field = createElement(tagName, {
        id,
        className: `sb-chatbar-field ${className}`.trim(),
        attrs: {
            title,
        },
    });
    const fieldIcon = createElement('i', { className: `fa-solid ${icon}` });

    field.appendChild(fieldIcon);
    return field;
}

function setButtonDisabled(button, disabled) {
    if (!(button instanceof HTMLElement)) {
        return;
    }

    button.toggleAttribute('disabled', Boolean(disabled));
    button.classList.toggle('is-disabled', Boolean(disabled));
}

function setButtonPressed(button, pressed) {
    if (!(button instanceof HTMLElement)) {
        return;
    }

    button.classList.toggle('is-active', Boolean(pressed));
    button.setAttribute('aria-pressed', String(Boolean(pressed)));
}

function setSearchStatusText(statusText) {
    const normalizedText = String(statusText ?? '').trim();

    for (const refs of [getChatDesktopRefs(), getChatMobileRefs()]) {
        const status = refs?.searchStatus;
        if (!(status instanceof HTMLElement)) {
            continue;
        }

        status.textContent = normalizedText;
        status.hidden = !normalizedText;
    }
}

function populateChatSelector(select, chatNames, chatContext, placeholder) {
    if (!(select instanceof HTMLSelectElement)) {
        return;
    }

    const currentValue = String(chatContext.chatId ?? '').trim();
    const uniqueNames = Array.from(new Set(chatNames.map(name => String(name ?? '').trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));

    select.replaceChildren();

    if (!uniqueNames.length) {
        const option = createElement('option', { text: placeholder });
        option.value = '';
        option.selected = true;
        select.appendChild(option);
        select.disabled = true;
        return;
    }

    for (const chatName of uniqueNames) {
        const option = createElement('option', { text: chatName });
        option.value = chatName;
        option.selected = chatName === currentValue;
        select.appendChild(option);
    }

    if (currentValue && !uniqueNames.includes(currentValue)) {
        const option = createElement('option', { text: currentValue });
        option.value = currentValue;
        option.selected = true;
        select.appendChild(option);
    }

    select.disabled = false;
    select.value = currentValue || uniqueNames[0];
}

function createChatFileButton(chatFile, currentChatId, onSelect, { compact = false } = {}) {
    const button = createElement('button', {
        className: `sb-chat-file ${compact ? 'is-compact' : ''}`.trim(),
        attrs: {
            type: 'button',
        },
    });

    const dateLabel = formatChatTimestamp(chatFile.lastMessage);
    button.classList.toggle('is-current', chatFile.fileName === currentChatId);
    button.innerHTML = `
        <div class="sb-chat-file-head">
            <strong>${chatFile.fileName}</strong>
            <small>${dateLabel || ''}</small>
        </div>
        <span class="sb-chat-file-preview">${chatFile.preview}</span>
        <div class="sb-chat-file-meta">
            <small>${chatFile.chatItems ? `${chatFile.chatItems} msg` : ''}</small>
            <small>${chatFile.fileSize || ''}</small>
        </div>
    `;

    button.addEventListener('click', () => {
        void onSelect(chatFile.fileName);
    });

    return button;
}

function renderChatFiles(listRoot, files, currentChatId, { compact = false, emptyTitle = 'No chats yet.', emptyBody = 'Start a chat to see it here.', onSelect } = {}) {
    if (!(listRoot instanceof HTMLElement)) {
        return;
    }

    listRoot.replaceChildren();

    if (!files.length) {
        const empty = createElement('div', { className: `sb-chat-files-empty ${compact ? 'is-compact' : ''}`.trim() });
        empty.innerHTML = `<strong>${emptyTitle}</strong><p>${emptyBody}</p>`;
        listRoot.appendChild(empty);
        return;
    }

    for (const chatFile of files) {
        listRoot.appendChild(createChatFileButton(chatFile, currentChatId, onSelect, { compact }));
    }
}

function buildChatSidebar() {
    const existingSidebar = getChatSidebarRefs();
    if (existingSidebar) {
        return existingSidebar;
    }

    const template = document.getElementById('generic_draggable_template');
    const movingDivs = document.getElementById('movingDivs');

    if (!(template instanceof HTMLTemplateElement) || !(movingDivs instanceof HTMLElement)) {
        return null;
    }

    const fragment = template.content.cloneNode(true);
    const root = fragment.querySelector('.draggable');
    const title = fragment.querySelector('.dragTitle');
    const closeButton = fragment.querySelector('.dragClose');

    if (!(root instanceof HTMLElement) || !(title instanceof HTMLElement) || !(closeButton instanceof HTMLElement)) {
        return null;
    }

    root.id = 'sb-chat-sidebar';
    root.classList.add('sb-chat-sidebar');
    root.style.top = 'calc(var(--sb-topbar-layout-offset) + 18px)';
    root.style.right = '16px';
    root.style.left = 'auto';
    root.style.bottom = 'auto';

    title.textContent = 'Recent Chats';

    const body = createElement('div', { className: 'sb-chat-sidebar-body' });
    const list = createElement('div', { className: 'sb-chat-sidebar-list' });
    body.appendChild(list);
    root.appendChild(body);

    closeButton.addEventListener('click', () => setChatSidebarOpenState(false));

    movingDivs.appendChild(root);

    getChatbarState().sidebar = { root, title, list };
    return getChatbarState().sidebar;
}

function isChatSidebarOpen() {
    return Boolean(getChatbarState().sidebarOpen);
}

function setChatSidebarOpenState(shouldOpen) {
    const refs = buildChatSidebar();

    if (!refs?.root) {
        return;
    }

    const isOpen = Boolean(shouldOpen);
    getChatbarState().sidebarOpen = isOpen;
    refs.root.style.display = isOpen ? 'flex' : 'none';
    refs.root.classList.toggle('sb-chat-sidebar-visible', isOpen);
    setButtonPressed(getChatDesktopRefs()?.toggleSidebarButton, isOpen);

    if (isOpen) {
        scheduleChatbarRefresh(0);
    }
}

function toggleChatSidebar() {
    const chatContext = getChatUiContext();
    if (!chatContext.canBrowseChats) {
        return;
    }

    setConnectionStripOpenState(false);
    setChatSidebarOpenState(!isChatSidebarOpen());
}

function buildMobileChatTools() {
    const existingMobileTools = getChatMobileRefs();
    if (existingMobileTools) {
        return existingMobileTools;
    }

    const overlay = createElement('div', { id: 'sb-mobile-chat-tools' });
    const panel = createElement('div', { id: 'sb-mobile-chat-tools-panel' });
    const header = createElement('div', { className: 'sb-mobile-chat-header' });
    const dismissButton = createTopBarIconButton(
        {
            id: 'sb-mobile-chat-close',
            icon: 'fa-xmark',
            title: 'Close chat tools',
            className: 'sb-mobile-chat-close',
        },
        () => closeMobileChatTools(),
    );
    const chatSelectField = createChatField({
        id: 'sb-mobile-chat-select-field',
        icon: 'fa-comments',
        title: 'Switch chat',
        className: 'is-mobile',
    });
    const chatSelect = createElement('select', {
        id: 'sb-mobile-chat-select',
        className: 'text_pole',
        attrs: {
            'aria-label': 'Switch chat',
        },
    });
    const searchField = createChatField({
        id: 'sb-mobile-chat-search-field',
        icon: 'fa-magnifying-glass',
        title: 'Search current chat',
        className: 'is-mobile',
    });
    const searchInput = createElement('input', {
        id: 'sb-mobile-chat-search',
        className: 'text_pole',
        attrs: {
            type: 'search',
            placeholder: 'Search this chat...',
            'aria-label': 'Search this chat',
        },
    });
    const searchStatus = createElement('small', { className: 'sb-chatbar-search-status' });
    const actions = createElement('div', { className: 'sb-mobile-chat-actions' });
    const recentSection = createElement('section', { className: 'sb-mobile-chat-section' });
    const recentTitle = createElement('strong', { className: 'sb-mobile-chat-section-title', text: 'Recent Chats' });
    const recentList = createElement('div', { className: 'sb-mobile-chat-files' });
    const connectionSection = createElement('section', { className: 'sb-mobile-chat-section sb-mobile-chat-connection' });
    const connectionTitle = createElement('strong', { className: 'sb-mobile-chat-section-title', text: 'Connection Profile' });
    const connectionField = createChatField({
        id: 'sb-mobile-chat-connection-field',
        icon: 'fa-plug',
        title: 'Switch connection profile',
        className: 'is-mobile',
    });
    const connectionSelect = createElement('select', {
        id: 'sb-mobile-chat-connection-select',
        className: 'text_pole',
        attrs: {
            'aria-label': 'Switch connection profile',
        },
    });
    const connectionStatus = createElement('small', { className: 'sb-mobile-chat-connection-status' });

    searchStatus.hidden = true;
    connectionSection.hidden = true;

    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');

    if ('inert' in overlay) {
        overlay.inert = true;
    }

    chatSelectField.appendChild(chatSelect);
    searchField.append(searchInput, searchStatus);
    connectionField.appendChild(connectionSelect);
    connectionSection.append(connectionTitle, connectionField, connectionStatus);
    header.append(searchField, dismissButton);

    const buttons = {
        managerButton: createTopBarIconButton({ icon: 'fa-address-book', title: 'View chat files', className: 'is-mobile-compact' }, handleChatManagerClick),
        newButton: createTopBarIconButton({ icon: 'fa-comments', title: 'Start a new chat', className: 'is-mobile-compact' }, handleNewChat),
        renameButton: createTopBarIconButton({ icon: 'fa-pen', title: 'Rename this chat', className: 'is-mobile-compact' }, () => { void handleRenameChat(); }),
        deleteButton: createTopBarIconButton({ icon: 'fa-trash', title: 'Delete this chat', className: 'is-mobile-compact' }, () => { void handleDeleteChat(); }),
        closeButton: createTopBarIconButton({ icon: 'fa-xmark', title: 'Close this chat', className: 'is-mobile-compact' }, () => { void handleCloseChat(); }),
    };

    actions.append(
        buttons.managerButton,
        buttons.newButton,
        buttons.renameButton,
        buttons.deleteButton,
        buttons.closeButton,
    );

    recentSection.append(recentTitle, recentList);
    panel.append(header, chatSelectField, actions, connectionSection, recentSection);
    overlay.appendChild(panel);

    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            closeMobileChatTools();
        }
    });

    chatSelect.addEventListener('change', () => {
        void openChatById(chatSelect.value, { closeMobileTools: true });
    });
    searchInput.addEventListener('input', () => setChatSearchQuery(searchInput.value, { source: searchInput }));
    connectionSelect.addEventListener('change', () => {
        syncConnectionProfileSelection(connectionSelect.value);
    });

    document.body.appendChild(overlay);

    getChatbarState().mobileTools = {
        overlay,
        panel,
        chatSelect,
        searchInput,
        searchStatus,
        recentList,
        connectionSection,
        connectionSelect,
        connectionStatus,
        ...buttons,
    };

    return getChatbarState().mobileTools;
}

function setMobileChatToolsOpenState(shouldOpen) {
    const refs = buildMobileChatTools();
    const isOpen = Boolean(shouldOpen) && isMobileViewport();

    if (!refs?.overlay) {
        return;
    }

    getChatbarState().mobileToolsOpen = isOpen;
    refs.overlay.hidden = !isOpen;
    refs.overlay.classList.toggle('sb-chat-tools-open', isOpen);
    refs.overlay.setAttribute('aria-hidden', String(!isOpen));

    if ('inert' in refs.overlay) {
        refs.overlay.inert = !isOpen;
    }

    if (isOpen) {
        scheduleChatbarRefresh(0);
    }
}

function openMobileChatTools() {
    if (!isMobileViewport()) {
        return;
    }

    closeMobileNav();
    closeShell('left');
    closeShell('right');
    closeCharacterPanel();
    setConnectionStripOpenState(false);
    setMobileChatToolsOpenState(true);
}

function closeMobileChatTools() {
    setMobileChatToolsOpenState(false);
}

function toggleMobileChatTools() {
    setMobileChatToolsOpenState(!getChatbarState().mobileToolsOpen);
}

function syncConnectionProfileSelection(value) {
    const sourceSelect = document.getElementById('connection_profiles');

    if (!(sourceSelect instanceof HTMLSelectElement)) {
        return;
    }

    const nextValue = String(value ?? '').trim();
    if (!nextValue || sourceSelect.value === nextValue) {
        return;
    }

    sourceSelect.value = nextValue;
    sourceSelect.dispatchEvent(new Event('change', { bubbles: true }));
}

function isConnectionStripOpen() {
    return Boolean(getChatbarState().connectionStripOpen);
}

function setConnectionStripOpenState(shouldOpen) {
    const desktopRefs = getChatDesktopRefs();
    const nextState = Boolean(shouldOpen);

    if (!desktopRefs?.connectionStrip) {
        return;
    }

    getChatbarState().connectionStripOpen = nextState;
    desktopRefs.connectionStrip.classList.toggle('is-open', nextState);
    desktopRefs.connectionStrip.hidden = !nextState;
    setButtonPressed(desktopRefs.toggleConnectionButton, nextState);
}

function getCurrentMainApiValue() {
    const mainApiSelect = document.getElementById('main_api');

    if (mainApiSelect instanceof HTMLSelectElement && mainApiSelect.value) {
        return String(mainApiSelect.value).trim().toLowerCase();
    }

    const context = getSillyTavernContext();
    return String(context?.mainApi ?? '').trim().toLowerCase();
}

function resolveActiveApiConnectButton() {
    const selectorMap = {
        kobold: '#api_button',
        koboldhorde: '#api_button',
        horde: '#api_button',
        novel: '#api_button_novel',
        openai: '#api_button_openai',
        textgenerationwebui: '#api_button_textgenerationwebui',
    };
    const selector = selectorMap[getCurrentMainApiValue()];

    if (!selector) {
        return null;
    }

    const button = document.querySelector(selector);
    return button instanceof HTMLElement ? button : null;
}

function getSearchTerms(query = getChatbarState().searchQuery) {
    return String(query ?? '')
        .trim()
        .split(/\s+/)
        .map(term => term.trim())
        .filter(Boolean);
}

function clearChatSearchHighlights() {
    for (const mark of document.querySelectorAll(SB_CHAT_SEARCH_MARK_SELECTOR)) {
        if (!(mark instanceof HTMLElement) || !mark.parentNode) {
            continue;
        }

        mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
    }

    document.getElementById('chat')?.normalize();
    setSearchStatusText('');
}

function highlightMessageText(root, regex) {
    if (!(root instanceof HTMLElement)) {
        return { count: 0, firstMatch: null };
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue?.trim()) {
                return NodeFilter.FILTER_REJECT;
            }

            const parent = node.parentElement;
            if (!parent || parent.closest(SB_CHAT_SEARCH_MARK_SELECTOR)) {
                return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_ACCEPT;
        },
    });

    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
    }

    let count = 0;
    let firstMatch = null;

    for (const textNode of textNodes) {
        const textValue = textNode.nodeValue ?? '';
        regex.lastIndex = 0;

        if (!regex.test(textValue)) {
            continue;
        }

        regex.lastIndex = 0;
        const fragment = document.createDocumentFragment();
        let previousIndex = 0;

        for (const match of textValue.matchAll(regex)) {
            const matchValue = match[0];
            const matchIndex = match.index ?? 0;

            if (!matchValue) {
                continue;
            }

            fragment.append(textValue.slice(previousIndex, matchIndex));

            const mark = createElement('mark', {
                className: 'sb-chat-search-hit',
                text: matchValue,
                attrs: {
                    'data-sb-chat-search': 'true',
                },
            });

            if (!firstMatch) {
                firstMatch = mark;
            }

            fragment.appendChild(mark);
            previousIndex = matchIndex + matchValue.length;
            count += 1;
        }

        fragment.append(textValue.slice(previousIndex));
        textNode.parentNode?.replaceChild(fragment, textNode);
    }

    return { count, firstMatch };
}

function applyChatSearchHighlights({ scrollToFirst = false } = {}) {
    const chatbarState = getChatbarState();
    const terms = getSearchTerms();

    chatbarState.pendingSearchScroll = false;
    clearTimeout(chatbarState.searchTimer);
    chatbarState.isApplyingSearch = true;
    clearChatSearchHighlights();

    if (!terms.length || !getChatUiContext().hasChat) {
        chatbarState.isApplyingSearch = false;
        return;
    }

    const regex = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
    let totalMatches = 0;
    let firstMatch = null;

    try {
        for (const node of document.querySelectorAll('#chat .mes_text')) {
            const result = highlightMessageText(node, regex);
            totalMatches += result.count;
            firstMatch ??= result.firstMatch;
        }
    } finally {
        chatbarState.isApplyingSearch = false;
    }

    setSearchStatusText(totalMatches ? `${totalMatches} match${totalMatches === 1 ? '' : 'es'}` : 'No matches');

    if (scrollToFirst && firstMatch instanceof HTMLElement) {
        firstMatch.scrollIntoView({
            block: 'center',
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
    }
}

function scheduleChatSearchHighlight({ scrollToFirst = false } = {}) {
    const chatbarState = getChatbarState();
    chatbarState.pendingSearchScroll = chatbarState.pendingSearchScroll || scrollToFirst;

    clearTimeout(chatbarState.searchTimer);
    chatbarState.searchTimer = window.setTimeout(() => {
        const shouldScroll = chatbarState.pendingSearchScroll;
        chatbarState.pendingSearchScroll = false;
        applyChatSearchHighlights({ scrollToFirst: shouldScroll });
    }, SB_CHATBAR_SEARCH_DEBOUNCE);
}

function setChatSearchQuery(value, { source = null } = {}) {
    const nextValue = String(value ?? '');
    getChatbarState().searchQuery = nextValue;

    for (const input of [getChatDesktopRefs()?.searchInput, getChatMobileRefs()?.searchInput]) {
        if (!(input instanceof HTMLInputElement) || input === source) {
            continue;
        }

        input.value = nextValue;
    }

    if (!nextValue.trim()) {
        clearChatSearchHighlights();
        return;
    }

    scheduleChatSearchHighlight({ scrollToFirst: true });
}

function initChatSearchObserver() {
    const chatRoot = document.getElementById('chat');

    if (!(chatRoot instanceof HTMLElement) || getChatbarState().chatObserver) {
        return;
    }

    const observer = new MutationObserver(() => {
        if (getChatbarState().isApplyingSearch || !getSearchTerms().length) {
            return;
        }

        scheduleChatSearchHighlight({ scrollToFirst: false });
    });

    observer.observe(chatRoot, { childList: true, subtree: true });
    getChatbarState().chatObserver = observer;
}

async function getConnectionStatusText() {
    const context = getSillyTavernContext();

    if (!context) {
        return '';
    }

    if (context.onlineStatus === 'no_connection') {
        return 'No connection...';
    }

    let apiValue = String(context.mainApi ?? 'Connected').trim();
    let modelValue = String(context.onlineStatus ?? '').trim();

    try {
        const nextApiValue = await context.SlashCommandParser?.commands?.api?.callback?.({ quiet: 'true' }, '');
        if (nextApiValue) {
            apiValue = String(nextApiValue).trim();
        }
    } catch {
        // Ignore slash command lookup failures and use the current context values.
    }

    try {
        const nextModelValue = await context.SlashCommandParser?.commands?.model?.callback?.({ quiet: 'true' }, '');
        if (typeof nextModelValue === 'string' && nextModelValue.trim()) {
            modelValue = nextModelValue.trim();
        }
    } catch {
        // Ignore slash command lookup failures and use the current context values.
    }

    const apiBlock = document.getElementById('rm_api_block');

    if (apiBlock instanceof HTMLElement) {
        const apiOption = apiBlock.querySelector(`select:not(#main_api) option[value="${escapeSelectorValue(apiValue)}"]`)
            ?? apiBlock.querySelector(`select#main_api option[value="${escapeSelectorValue(apiValue)}"]`);
        const modelOption = apiBlock.querySelector(`option[value="${escapeSelectorValue(modelValue)}"]`);

        apiValue = stripDecoratedOptionText(apiOption?.textContent ?? apiValue);
        modelValue = stripDecoratedOptionText(modelOption?.textContent ?? modelValue);
    }

    return modelValue ? `${apiValue} - ${modelValue}` : apiValue;
}

function nodeTouchesConnectionProfilesSource(node) {
    if (!(node instanceof Element)) {
        return false;
    }

    return node.id === 'connection_profiles' || Boolean(node.querySelector('#connection_profiles'));
}

function mutationTouchesConnectionProfilesSource(mutation) {
    if (nodeTouchesConnectionProfilesSource(mutation.target)) {
        return true;
    }

    for (const node of mutation.addedNodes) {
        if (nodeTouchesConnectionProfilesSource(node)) {
            return true;
        }
    }

    for (const node of mutation.removedNodes) {
        if (nodeTouchesConnectionProfilesSource(node)) {
            return true;
        }
    }

    return false;
}

function bindConnectionProfileSourceElement(sourceElement) {
    const chatbarState = getChatbarState();
    const normalizedSource = sourceElement instanceof HTMLSelectElement ? sourceElement : null;

    if (chatbarState.sourceObservedElement === normalizedSource) {
        return;
    }

    if (chatbarState.sourceObservedElement instanceof HTMLSelectElement && typeof chatbarState.sourceChangeHandler === 'function') {
        chatbarState.sourceObservedElement.removeEventListener('change', chatbarState.sourceChangeHandler);
    }

    chatbarState.sourceSelectObserver?.disconnect();
    chatbarState.sourceObservedElement = normalizedSource;
    chatbarState.sourceChangeHandler = null;

    if (!(normalizedSource instanceof HTMLSelectElement)) {
        return;
    }

    if (!chatbarState.sourceSelectObserver) {
        chatbarState.sourceSelectObserver = new MutationObserver(() => {
            scheduleChatbarRefresh(60);
        });
    }

    const handleSourceChange = () => {
        scheduleChatbarRefresh(0);
    };

    chatbarState.sourceChangeHandler = handleSourceChange;
    normalizedSource.addEventListener('change', handleSourceChange);
    chatbarState.sourceSelectObserver.observe(normalizedSource, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled'],
    });
}

function bindConnectionProfileSourceObserver() {
    const chatbarState = getChatbarState();
    if (chatbarState.sourceObserver) {
        bindConnectionProfileSourceElement(document.getElementById('connection_profiles'));
        return;
    }

    const observer = new MutationObserver(mutations => {
        if (!mutations.some(mutationTouchesConnectionProfilesSource)) {
            return;
        }

        bindConnectionProfileSourceElement(document.getElementById('connection_profiles'));
        scheduleChatbarRefresh(60);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    chatbarState.sourceObserver = observer;
    bindConnectionProfileSourceElement(document.getElementById('connection_profiles'));
}

async function refreshChatbarState() {
    const chatbarState = getChatbarState();
    const refreshToken = ++chatbarState.refreshToken;
    const desktopRefs = getChatDesktopRefs();
    const mobileRefs = getChatMobileRefs();

    if (!desktopRefs && !mobileRefs) {
        return;
    }

    const chatContext = getChatUiContext();
    const files = await getChatFilesForContext(chatContext);
    const connectionStatusText = await getConnectionStatusText();

    if (refreshToken !== chatbarState.refreshToken) {
        return;
    }

    const chatNames = files.map(chat => chat.fileName);

    if (chatContext.chatId && !chatNames.includes(chatContext.chatId)) {
        chatNames.unshift(chatContext.chatId);
    }

    populateChatSelector(desktopRefs?.chatSelect, chatNames, chatContext, chatContext.canBrowseChats ? 'No saved chats yet' : 'No chat selected');
    populateChatSelector(mobileRefs?.chatSelect, chatNames, chatContext, chatContext.canBrowseChats ? 'No saved chats yet' : 'No chat selected');

    if (desktopRefs) {
        setButtonDisabled(desktopRefs.managerButton, !chatContext.canBrowseChats);
        setButtonDisabled(desktopRefs.toggleSidebarButton, !chatContext.canBrowseChats);
        setButtonDisabled(desktopRefs.newButton, !chatContext.canStartNewChat);
        setButtonDisabled(desktopRefs.renameButton, !chatContext.hasChat);
        setButtonDisabled(desktopRefs.deleteButton, !chatContext.hasChat);
        setButtonDisabled(desktopRefs.closeButton, !chatContext.hasChat);
        setButtonDisabled(desktopRefs.chatSelect, !chatContext.canBrowseChats);
        setButtonDisabled(desktopRefs.searchInput, !chatContext.hasChat);
    }

    if (mobileRefs) {
        setButtonDisabled(mobileRefs.managerButton, !chatContext.canBrowseChats);
        setButtonDisabled(mobileRefs.newButton, !chatContext.canStartNewChat);
        setButtonDisabled(mobileRefs.renameButton, !chatContext.hasChat);
        setButtonDisabled(mobileRefs.deleteButton, !chatContext.hasChat);
        setButtonDisabled(mobileRefs.closeButton, !chatContext.hasChat);
        setButtonDisabled(mobileRefs.chatSelect, !chatContext.canBrowseChats);
        setButtonDisabled(mobileRefs.searchInput, !chatContext.hasChat);
    }

    const connectionProfilesSource = document.getElementById('connection_profiles');
    const hasConnectionProfiles = connectionProfilesSource instanceof HTMLSelectElement;

    if (desktopRefs) {
        desktopRefs.toggleConnectionButton.hidden = !hasConnectionProfiles;
        desktopRefs.connectionStrip.hidden = !hasConnectionProfiles || !isConnectionStripOpen();
    }

    if (!hasConnectionProfiles) {
        setConnectionStripOpenState(false);
        if (desktopRefs) {
            desktopRefs.connectionSelect.replaceChildren();
            desktopRefs.connectionStatus.textContent = '';
            setButtonDisabled(desktopRefs.connectionConnectButton, true);
        }

        if (mobileRefs?.connectionSection instanceof HTMLElement) {
            mobileRefs.connectionSection.hidden = true;
            mobileRefs.connectionSelect.replaceChildren();
            mobileRefs.connectionStatus.textContent = '';
        }
    } else {
        const optionsMarkup = connectionProfilesSource.innerHTML;
        if (desktopRefs) {
            desktopRefs.connectionSelect.innerHTML = optionsMarkup;
            desktopRefs.connectionSelect.value = connectionProfilesSource.value;
            desktopRefs.connectionStatus.textContent = connectionStatusText;
            setButtonDisabled(desktopRefs.connectionConnectButton, !resolveActiveApiConnectButton());
        }

        if (mobileRefs?.connectionSection instanceof HTMLElement) {
            mobileRefs.connectionSection.hidden = false;
            mobileRefs.connectionSelect.innerHTML = optionsMarkup;
            mobileRefs.connectionSelect.value = connectionProfilesSource.value;
            mobileRefs.connectionStatus.textContent = connectionStatusText;
        }
    }

    renderChatFiles(getChatSidebarRefs()?.list, files, chatContext.chatId, {
        onSelect: chatId => openChatById(chatId),
    });
    renderChatFiles(mobileRefs?.recentList, files, chatContext.chatId, {
        compact: true,
        onSelect: chatId => openChatById(chatId, { closeMobileTools: true }),
    });

    if (desktopRefs) {
        setButtonPressed(desktopRefs.toggleSidebarButton, isChatSidebarOpen());
        setButtonPressed(desktopRefs.toggleConnectionButton, isConnectionStripOpen());
    }

    if (!chatContext.canBrowseChats) {
        setChatSidebarOpenState(false);
    }

    if (!chatContext.hasChat) {
        clearChatSearchHighlights();
    } else if (getSearchTerms().length) {
        scheduleChatSearchHighlight({ scrollToFirst: false });
    }
}

function scheduleChatbarRefresh(delay = 0) {
    const chatbarState = getChatbarState();
    const safeDelay = Math.max(0, Number(delay) || 0);

    window.clearTimeout(chatbarState.refreshTimer);
    chatbarState.refreshTimer = window.setTimeout(() => {
        chatbarState.refreshTimer = 0;
        void refreshChatbarState().catch(error => {
            console.warn('[SillyBunny] Failed to refresh chat tools state.', error);
        });
    }, safeDelay);
}

function scheduleChatbarBindingRetry(delay = 240) {
    const chatbarState = getChatbarState();

    window.clearTimeout(chatbarState.bindingRetryTimer);
    chatbarState.bindingRetryTimer = window.setTimeout(() => {
        bindChatbarEvents();
    }, delay);
}

function bindChatbarWindowEvents() {
    const chatbarState = getChatbarState();

    if (chatbarState.windowBindingsAttached) {
        return;
    }

    const refreshWithContext = () => {
        window.requestAnimationFrame(() => scheduleChatbarRefresh(0));
        bindChatbarEvents();
    };

    window.addEventListener('pageshow', refreshWithContext, { passive: true });
    window.addEventListener('focus', refreshWithContext, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            refreshWithContext();
        }
    });

    chatbarState.windowBindingsAttached = true;
}

function bindChatbarEvents() {
    const chatbarState = getChatbarState();
    const context = getSillyTavernContext();
    const eventSource = context?.eventSource;
    const eventTypes = context?.eventTypes ?? context?.event_types;

    bindChatbarWindowEvents();
    initChatSearchObserver();
    bindConnectionProfileSourceObserver();

    if (!eventSource || !eventTypes) {
        scheduleChatbarRefresh(0);
        scheduleChatbarBindingRetry();
        return;
    }

    window.clearTimeout(chatbarState.bindingRetryTimer);

    if (chatbarState.boundEventSource === eventSource) {
        scheduleChatbarRefresh(0);
        return;
    }

    const refresh = () => scheduleChatbarRefresh(0);
    const events = [
        eventTypes.APP_READY,
        eventTypes.CHAT_CHANGED,
        eventTypes.CHAT_LOADED,
        eventTypes.CHAT_CREATED,
        eventTypes.GROUP_CHAT_CREATED,
        eventTypes.CHAT_DELETED,
        eventTypes.GROUP_CHAT_DELETED,
        eventTypes.MESSAGE_RECEIVED,
        eventTypes.MESSAGE_UPDATED,
        eventTypes.MESSAGE_EDITED,
        eventTypes.MESSAGE_DELETED,
        eventTypes.MESSAGE_SWIPED,
        eventTypes.MESSAGE_SWIPE_DELETED,
        eventTypes.CONNECTION_PROFILE_LOADED,
        eventTypes.CONNECTION_PROFILE_CREATED,
        eventTypes.CONNECTION_PROFILE_UPDATED,
        eventTypes.CONNECTION_PROFILE_DELETED,
        eventTypes.MAIN_API_CHANGED,
        eventTypes.ONLINE_STATUS_CHANGED,
        eventTypes.SETTINGS_UPDATED,
    ].filter(Boolean);

    for (const eventName of new Set(events)) {
        eventSource.on(eventName, refresh);
    }

    chatbarState.boundEventSource = eventSource;
    scheduleChatbarRefresh(0);
}

function triggerDrawerToggle(selector) {
    const toggle = document.querySelector(selector);
    if (toggle instanceof HTMLElement) {
        toggle.click();
    }
}

function getDrawerRoot(drawerRootOrId) {
    return typeof drawerRootOrId === 'string'
        ? document.getElementById(drawerRootOrId)
        : drawerRootOrId;
}

function getDrawerIcon(drawerIconOrSelector) {
    if (typeof drawerIconOrSelector === 'string') {
        return document.querySelector(drawerIconOrSelector);
    }

    return drawerIconOrSelector;
}

function syncDrawerIconState(drawerIconOrSelector, shouldOpen) {
    const icon = getDrawerIcon(drawerIconOrSelector);

    if (!(icon instanceof HTMLElement)) {
        return;
    }

    icon.classList.toggle('openIcon', Boolean(shouldOpen));
    icon.classList.toggle('closedIcon', !shouldOpen);
}

function isDrawerActuallyOpen(drawerRootOrId) {
    const el = getDrawerRoot(drawerRootOrId);

    if (!(el instanceof HTMLElement) || !el.classList.contains('openDrawer')) {
        return false;
    }

    const styles = getComputedStyle(el);
    return styles.display !== 'none'
        && styles.visibility !== 'hidden'
        && styles.pointerEvents !== 'none'
        && el.getClientRects().length > 0;
}

function forceDrawerState(drawerRootOrId, shouldOpen, drawerIconOrSelector = null) {
    const el = typeof drawerRootOrId === 'string'
        ? document.getElementById(drawerRootOrId)
        : drawerRootOrId;
    if (!(el instanceof HTMLElement)) return;
    el.classList.toggle('openDrawer', Boolean(shouldOpen));
    el.classList.toggle('closedDrawer', !shouldOpen);
    syncDrawerIconState(drawerIconOrSelector, shouldOpen);
}

function isShellOpen(shellKey) {
    return isDrawerActuallyOpen(getShellConfig(shellKey).rootPanelId);
}

function isShellTabOpen(shellKey, tabId) {
    const shellState = getShellState(shellKey);
    return Boolean(shellState && isShellOpen(shellKey) && shellState.activeTabId === tabId);
}

function isCharacterPanelOpen() {
    return isDrawerActuallyOpen('right-nav-panel');
}

function getCharacterPanelMenuType() {
    const panel = document.getElementById('right-nav-panel');
    return panel instanceof HTMLElement ? panel.dataset.menuType ?? '' : '';
}

function hasActiveCharacterChat(context = getSillyTavernContext()) {
    return Boolean(
        context
        && !context.groupId
        && context.characterId !== undefined
        && context.characterId !== null
        && context.characters?.[context.characterId],
    );
}

function showCharacterListView() {
    const backButton = document.getElementById('rm_button_back');

    if (backButton instanceof HTMLElement) {
        backButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
    }

    resetCharacterPanelView();
    return true;
}

function showActiveCharacterEditor() {
    if (!hasActiveCharacterChat()) {
        return false;
    }

    const selectedCharacterButton = document.getElementById('rm_button_selected_ch');
    if (!(selectedCharacterButton instanceof HTMLElement)) {
        return false;
    }

    selectedCharacterButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
}

function resetCharacterPanelView() {
    const panel = document.getElementById('right-nav-panel');
    const listButton = document.getElementById('rm_button_characters');
    const selectedTitle = document.querySelector('#rm_button_selected_ch h2');

    if (selectedTitle instanceof HTMLElement) {
        selectedTitle.textContent = '';
    }

    if (listButton instanceof HTMLElement) {
        listButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return;
    }

    if (panel instanceof HTMLElement) {
        panel.dataset.menuType = 'characters';
    }

    const infoPanel = document.getElementById('result_info');
    const characterEditor = document.getElementById('rm_ch_create_block');
    const characterList = document.getElementById('rm_characters_block');

    if (infoPanel instanceof HTMLElement) {
        infoPanel.style.display = 'none';
    }

    if (characterEditor instanceof HTMLElement) {
        characterEditor.style.display = 'none';
        characterEditor.style.visibility = 'hidden';
        characterEditor.style.pointerEvents = 'none';
    }

    if (characterList instanceof HTMLElement) {
        characterList.style.display = 'flex';
        characterList.style.visibility = 'visible';
        characterList.style.pointerEvents = 'auto';
    }
}

function closeCharacterPanel() {
    const panel = document.getElementById('right-nav-panel');

    if (panel instanceof HTMLElement && panel.classList.contains('openDrawer')) {
        forceDrawerState(panel, false, '#rightNavDrawerIcon');

        // Restore overflow:hidden on parent after closing (iOS Safari fix)
        const host = document.getElementById('rightNavHolder');
        if (host) host.style.overflow = '';
    }

    syncChatbarVisibilityState();
}

function toggleCharacterPanel() {
    injectCharacterCloseButton();
    const shouldOpenActiveCharacterEditor = hasActiveCharacterChat();

    if (isCharacterPanelOpen()) {
        closeCharacterPanel();
        return;
    }

    closeAllDropdowns({ except: 'characters' });

    if (shouldOpenActiveCharacterEditor) {
        showActiveCharacterEditor();
    } else {
        resetCharacterPanelView();
    }

    closeShell('left');
    closeShell('right');

    // iOS Safari clips position:fixed inside overflow:hidden ancestors.
    // Temporarily allow overflow on the parent so the panel renders.
    const host = document.getElementById('rightNavHolder');
    if (host) host.style.overflow = 'visible';

    triggerDrawerToggle('#rightNavHolder > .drawer-toggle');

    // Fallback: if the jQuery drawer-toggle handler didn't fire, force-open
    window.requestAnimationFrame(() => {
        if (!isCharacterPanelOpen()) {
            forceDrawerState('right-nav-panel', true, '#rightNavDrawerIcon');
        }

        if (shouldOpenActiveCharacterEditor) {
            showActiveCharacterEditor();
        }

        syncChatbarVisibilityState();
    });
}

function closeAllDropdowns({ except = '' } = {}) {
    if (except !== 'left') closeShell('left');
    if (except !== 'right') closeShell('right');
    if (except !== 'characters') closeCharacterPanel();
    closeMobileNav();
    closeMobileChatTools();
    setConnectionStripOpenState(false);

    // Close persona picker
    document.getElementById('sb-persona-picker')?.remove();
}

function toggleShellPanel(shellKey, tabId = null) {
    if (!ensureShellReady(shellKey)) {
        return;
    }

    if (tabId ? isShellTabOpen(shellKey, tabId) : isShellOpen(shellKey)) {
        if (wasShellJustOpened(shellKey)) {
            return;
        }

        closeShell(shellKey);
        return;
    }

    closeAllDropdowns({ except: shellKey });
    openShell(shellKey, tabId);
}

function isLandingPageVisible() {
    return isActuallyVisible(document.querySelector('.welcomePanel'));
}

function syncHomeButtonState() {
    const homeButton = document.getElementById('sb-home-toggle');
    if (!(homeButton instanceof HTMLButtonElement)) {
        return;
    }

    const isHomeVisible = isLandingPageVisible();
    setButtonPressed(homeButton, isHomeVisible);
    homeButton.classList.toggle('is-current', isHomeVisible);

    if (isHomeVisible) {
        homeButton.setAttribute('aria-current', 'page');
    } else {
        homeButton.removeAttribute('aria-current');
    }
}

function queueLandingPageStateSync() {
    if (sbState.landingPageSyncFrame) {
        return;
    }

    sbState.landingPageSyncFrame = window.requestAnimationFrame(() => {
        sbState.landingPageSyncFrame = 0;
        syncHomeButtonState();
    });
}

function bindLandingPageObserver() {
    const chatRoot = document.getElementById('chat');
    if (!(chatRoot instanceof HTMLElement)) {
        return;
    }

    sbState.landingPageObserver?.disconnect();

    const observer = new MutationObserver(() => {
        queueLandingPageStateSync();
    });

    observer.observe(chatRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden'],
    });

    sbState.landingPageObserver = observer;
    queueLandingPageStateSync();
}

async function returnToLandingPage() {
    closeShell('left');
    closeShell('right');
    closeCharacterPanel();
    closeMobileNav();
    closeMobileChatTools();
    setConnectionStripOpenState(false);

    if (isLandingPageVisible()) {
        queueLandingPageStateSync();
        document.getElementById('chat')?.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
        return;
    }

    const context = getSillyTavernContext();

    if (typeof context?.closeCurrentChat === 'function') {
        await context.closeCurrentChat();
        queueLandingPageStateSync();
        return;
    }

    document.getElementById('option_close_chat')?.click();
    queueLandingPageStateSync();
}

function syncProxyButtonState(proxyButton, sourceIcon) {
    if (!(proxyButton instanceof HTMLElement) || !(sourceIcon instanceof HTMLElement)) {
        return;
    }

    const isOpen = sourceIcon.classList.contains('openIcon');
    const isPinned = sourceIcon.classList.contains('drawerPinnedOpen');

    proxyButton.classList.toggle('is-open', isOpen);
    proxyButton.classList.toggle('is-pinned', isPinned);
    proxyButton.setAttribute('aria-expanded', String(isOpen));
}

function observeProxyButton(buttonId, iconSelector) {
    const proxyButton = document.getElementById(buttonId);
    const sourceIcon = document.querySelector(iconSelector);

    if (!(proxyButton instanceof HTMLElement) || !(sourceIcon instanceof HTMLElement)) {
        return;
    }

    syncProxyButtonState(proxyButton, sourceIcon);

    const observer = new MutationObserver(() => {
        syncProxyButtonState(proxyButton, sourceIcon);
    });

    observer.observe(sourceIcon, { attributes: true, attributeFilter: ['class'] });
}

function wasShellJustOpened(shellKey) {
    const shellState = getShellState(shellKey);
    if (!shellState) {
        return false;
    }

    return (performance.now() - Number(shellState.lastOpenedAt || 0)) < SB_SHELL_TOGGLE_GUARD_MS;
}

function buildTopBar() {
    const topBar = document.getElementById('top-bar');
    if (!(topBar instanceof HTMLElement)) {
        return;
    }

    topBar.replaceChildren();

    const stack = createElement('div', { id: 'sb-topbar-stack' });
    const primaryRow = createElement('div', { id: 'sb-topbar-primary' });
    const topBarInner = createElement('div', { id: 'sb-topbar-inner' });
    const leftGroup = createElement('div', { className: 'sb-topbar-group sb-topbar-group-left' });
    const centerGroup = createElement('div', { className: 'sb-topbar-brand' });
    const rightGroup = createElement('div', { className: 'sb-topbar-group sb-topbar-group-right' });

    const mobileButton = createElement('button', {
        id: 'sb-hamburger',
        className: 'sb-proxy-button sb-mobile-toggle',
        attrs: {
            type: 'button',
            title: 'Open navigation',
            'aria-label': 'Open navigation',
            'aria-expanded': 'false',
        },
    });
    mobileButton.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    stopProxyPointerPropagation(mobileButton);
    mobileButton.addEventListener('click', toggleMobileNav);

    const leftButton = createProxyButton(
        {
            id: 'sb-left-shell-toggle',
            icon: getShellConfig('left').proxyIcon,
            label: getShellConfig('left').proxyLabel,
            title: 'Open workspace tools',
        },
        () => toggleShellPanel('left'),
    );

    const homeButton = createProxyButton(
        {
            id: 'sb-home-toggle',
            icon: 'fa-house',
            label: 'Home',
            title: 'Return to the landing page',
        },
        () => {
            closeMobileNav();
            void returnToLandingPage();
        },
    );

    const rightButton = createProxyButton(
        {
            id: 'sb-right-shell-toggle',
            icon: getShellConfig('right').proxyIcon,
            label: getShellConfig('right').proxyLabel,
            title: 'Open customization tools',
        },
        () => toggleShellPanel('right'),
    );

    const charactersButton = createProxyButton(
        {
            id: 'sb-character-toggle',
            icon: 'fa-address-card',
            label: 'Characters',
            title: 'Open character management',
        },
        () => toggleCharacterPanel(),
    );

    const leftShortcutConfig = getShortcutConfig(getShortcutTarget('left'));
    const leftShortcut = createProxyButton(
        {
            id: 'sb-shortcut-left',
            icon: leftShortcutConfig.icon,
            label: leftShortcutConfig.label,
            title: `Quick access: ${leftShortcutConfig.label}`,
            className: 'sb-proxy-button-icon-only',
        },
        () => {
            const target = getShortcutTarget('left');
            const [shell, tab] = target.split(':');
            toggleShellPanel(shell, tab);
        },
    );

    const rightShortcutConfig = getShortcutConfig(getShortcutTarget('right'));
    const rightShortcut = createProxyButton(
        {
            id: 'sb-shortcut-right',
            icon: rightShortcutConfig.icon,
            label: rightShortcutConfig.label,
            title: `Quick access: ${rightShortcutConfig.label}`,
            className: 'sb-proxy-button-icon-only',
        },
        () => {
            const target = getShortcutTarget('right');
            const [shell, tab] = target.split(':');
            toggleShellPanel(shell, tab);
        },
    );

    centerGroup.innerHTML = `
        <div id="sb-topbar-title" class="sb-brand-title">${SB_IDLE_BRAND_LABEL}</div>
    `;

    leftGroup.append(mobileButton, leftButton, rightButton, leftShortcut);
    rightGroup.append(rightShortcut, homeButton, charactersButton);
    topBarInner.append(leftGroup, centerGroup, rightGroup);
    primaryRow.appendChild(topBarInner);

    stack.append(primaryRow);
    topBar.append(stack);

    observeProxyButton('sb-left-shell-toggle', getShellConfig('left').hostIconSelector);
    observeProxyButton('sb-right-shell-toggle', getShellConfig('right').hostIconSelector);
    observeProxyButton('sb-character-toggle', '#rightNavDrawerIcon');
    bindTopBarBrand();
    updateTopBarBrand();
    updateTopbarUtilityButtons();
    syncTopbarLayoutState();
    queueLandingPageStateSync();
}

function hideHostToggles() {
    for (const shellConfig of Object.values(SB_SHELLS)) {
        const hostDrawer = document.getElementById(shellConfig.hostDrawerId);
        const hostToggle = hostDrawer?.querySelector(':scope > .drawer-toggle');

        hostDrawer?.classList.add('sb-drawer-host');
        hostToggle?.classList.add('sb-hidden-toggle');
    }

    const characterDrawer = document.getElementById('rightNavHolder');
    characterDrawer?.classList.add('sb-drawer-host');
    characterDrawer?.querySelector(':scope > .drawer-toggle')?.classList.add('sb-hidden-toggle');
}

function createShellPanel(tabConfig) {
    const panel = createElement('section', {
        className: 'sb-shell-panel',
        attrs: {
            role: 'tabpanel',
            'data-sb-panel': tabConfig.id,
            'aria-hidden': 'true',
        },
    });

    const scroller = createElement('div', { className: 'sb-shell-panel-scroller' });
    panel.appendChild(scroller);

    return { panel, scroller };
}

function moveChildrenIntoContainer(sourceElement, targetElement) {
    const nodes = Array.from(sourceElement.childNodes);

    for (const node of nodes) {
        targetElement.appendChild(node);
    }
}

function prepareEmbeddedDrawer(drawerId) {
    const drawer = document.getElementById(drawerId);
    if (!(drawer instanceof HTMLElement)) {
        return null;
    }

    const drawerToggle = drawer.querySelector(':scope > .drawer-toggle');
    const drawerContent = drawer.querySelector(':scope > .drawer-content');

    if (!(drawerContent instanceof HTMLElement)) {
        return null;
    }

    drawer.classList.add('sb-embedded-drawer');
    drawerToggle?.classList.add('sb-hidden-toggle');
    drawerContent.classList.remove('drawer-content');
    drawerContent.classList.remove('openDrawer', 'closedDrawer', 'fillLeft', 'fillRight', 'pinnedOpen');
    drawerContent.classList.add('sb-managed', 'sb-shell-embedded-content');

    // Clean up any persistent inline styles or state
    drawerContent.removeAttribute('style');
    drawer.style.display = '';
    drawer.style.visibility = '';
    drawer.style.opacity = '';

    if (drawerId === 'WI-SP-button') {
        drawer.querySelector('#WI_panel_pin_div')?.classList.add('sb-shell-hidden-control');
    }

    return { drawer, drawerContent };
}

function buildInChatAgentsPanel() {
    const { panel, scroller } = createShellPanel({
        id: 'agents',
    });

    const column = createElement('div', { className: 'sb-shell-column' });
    const callout = createElement('div', { className: 'sb-shell-callout' });
    callout.innerHTML = `
        <strong>In-Chat Agents</strong>
        <p>Lightweight helpers that run alongside your conversation. Configure them per-chat for modular functionality.</p>
    `;

    const inChatAgentsContainer = createElement('div', { id: 'in_chat_agents_container' });

    column.append(callout, inChatAgentsContainer);
    scroller.appendChild(column);

    return {
        id: 'agents',
        panel,
        button: null,
        searchRoot: column,
    };
}

function getServerAdminState() {
    return sbState.serverAdmin;
}

function getServerAdminRefs() {
    return getServerAdminState().refs;
}

function getConsoleLogsState() {
    return sbState.consoleLogs;
}

function getConsoleLogsRefs() {
    return getConsoleLogsState().refs;
}

function isConsoleLogsTabActive() {
    return isShellTabOpen('right', 'console-logs');
}

function formatConsoleLogTime(timestamp) {
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) {
        return '00:00:00';
    }

    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function formatConsoleLogDateTime(timestamp) {
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }

    return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function formatConsoleLogEntry(entry) {
    const stream = String(entry?.stream ?? 'stdout').toUpperCase().padEnd(6);
    const message = String(entry?.message ?? '');
    return `[${formatConsoleLogTime(entry?.timestamp)}] ${stream} ${message}`;
}

function isScrolledNearBottom(element, threshold = SB_CONSOLE_LOG_STICKY_THRESHOLD) {
    if (!(element instanceof HTMLElement)) {
        return true;
    }

    return (element.scrollHeight - element.scrollTop - element.clientHeight) <= threshold;
}

function updateConsoleLogsInteractivity() {
    const state = getConsoleLogsState();
    const refs = getConsoleLogsRefs();

    if (!refs) {
        return;
    }

    refs.pauseButton.textContent = state.paused ? 'Resume Live' : 'Pause Live';
    setButtonDisabled(refs.refreshButton, state.busy);
}

function renderConsoleLogsStatus() {
    const state = getConsoleLogsState();
    const refs = getConsoleLogsRefs();

    if (!refs) {
        return;
    }

    if (state.lastError) {
        setServerAdminPill(refs.statusPill, 'Unavailable', 'danger');
        setServerAdminMessage(refs.statusNote, state.lastError, 'danger');
        return;
    }

    const linesShown = state.entries.length;
    const totalBuffered = state.totalBuffered || linesShown;
    const noteParts = [`Showing ${linesShown} of ${totalBuffered} recent console line${totalBuffered === 1 ? '' : 's'}.`];

    if (state.captureStartedAt) {
        noteParts.push(`Capture started ${formatConsoleLogDateTime(state.captureStartedAt)}.`);
    }

    if (state.lastUpdatedAt) {
        noteParts.push(`Last updated ${formatConsoleLogTime(state.lastUpdatedAt)}.`);
    }

    noteParts.push(state.paused
        ? 'Live polling is paused.'
        : `Refreshes every ${(SB_CONSOLE_LOG_REFRESH_MS / 1000).toFixed(1).replace(/\.0$/, '')} seconds while this tab is open.`);

    setServerAdminPill(refs.statusPill, state.busy ? 'Loading…' : state.paused ? 'Paused' : 'Live', state.paused ? 'warn' : 'good');
    setServerAdminMessage(refs.statusNote, noteParts.join(' '), state.paused ? 'warn' : 'neutral');
}

function renderConsoleLogsOutput({ preserveScroll = true } = {}) {
    const state = getConsoleLogsState();
    const refs = getConsoleLogsRefs();
    const output = refs?.output;

    if (!(output instanceof HTMLElement)) {
        return;
    }

    const shouldStickToBottom = !preserveScroll || isScrolledNearBottom(output);
    output.textContent = state.entries.length
        ? state.entries.map(formatConsoleLogEntry).join('\n')
        : 'No console output has been captured yet for this server process.';
    output.classList.toggle('is-empty', state.entries.length === 0);

    if (shouldStickToBottom) {
        output.scrollTop = output.scrollHeight;
    }

    renderConsoleLogsStatus();
}

function scheduleConsoleLogsRefresh(delay = SB_CONSOLE_LOG_REFRESH_MS) {
    const state = getConsoleLogsState();
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = 0;

    if (state.paused || !isConsoleLogsTabActive()) {
        return;
    }

    state.refreshTimer = window.setTimeout(() => {
        void refreshConsoleLogs();
    }, delay);
}

async function refreshConsoleLogs({ forceFull = false } = {}) {
    const state = getConsoleLogsState();
    const refs = getConsoleLogsRefs();

    if (!refs) {
        return;
    }

    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = 0;

    if (state.busy) {
        scheduleConsoleLogsRefresh();
        return;
    }

    state.busy = true;
    updateConsoleLogsInteractivity();
    renderConsoleLogsStatus();

    const requestBody = {
        limit: SB_CONSOLE_LOG_LIMIT,
    };

    if (!forceFull && state.latestId > 0) {
        requestBody.afterId = state.latestId;
    }

    try {
        const data = await requestServerAdmin('/api/server-admin/logs', requestBody);
        const nextEntries = Array.isArray(data?.entries)
            ? data.entries.map(entry => ({
                id: Number(entry?.id ?? 0) || 0,
                timestamp: Number(entry?.timestamp ?? 0) || 0,
                stream: String(entry?.stream ?? 'stdout'),
                message: String(entry?.message ?? ''),
            })).filter(entry => entry.id > 0)
            : [];

        if (forceFull || !requestBody.afterId || data?.truncated) {
            state.entries = nextEntries.slice(-SB_CONSOLE_LOG_LIMIT);
        } else if (nextEntries.length > 0) {
            const mergedEntries = new Map(state.entries.map(entry => [entry.id, entry]));

            for (const entry of nextEntries) {
                mergedEntries.set(entry.id, entry);
            }

            state.entries = Array.from(mergedEntries.values())
                .sort((left, right) => left.id - right.id)
                .slice(-SB_CONSOLE_LOG_LIMIT);
        }

        state.latestId = Number(data?.latestId ?? state.latestId) || state.latestId;
        state.captureStartedAt = Number(data?.captureStartedAt ?? state.captureStartedAt) || state.captureStartedAt;
        state.totalBuffered = Number(data?.totalBuffered ?? state.totalBuffered) || state.totalBuffered;
        state.lastUpdatedAt = Date.now();
        state.lastError = '';
        renderConsoleLogsOutput();
    } catch (error) {
        console.error('Failed to refresh console logs panel.', error);
        state.lastError = error.message || 'Failed to read console logs.';
        renderConsoleLogsStatus();
    } finally {
        state.busy = false;
        updateConsoleLogsInteractivity();
        renderConsoleLogsStatus();
        scheduleConsoleLogsRefresh();
    }
}

function toggleConsoleLogsPolling() {
    const state = getConsoleLogsState();
    state.paused = !state.paused;

    if (state.paused) {
        window.clearTimeout(state.refreshTimer);
        state.refreshTimer = 0;
    }

    updateConsoleLogsInteractivity();
    renderConsoleLogsStatus();

    if (!state.paused) {
        void refreshConsoleLogs({ forceFull: state.latestId === 0 });
    }
}

function getImporterState() {
    return sbState.importer;
}

function getImporterRefs() {
    return getImporterState().refs;
}

async function requestServerAdmin(endpoint, body = {}) {
    const headers = await waitForAuthorizedRequestHeaders();
    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    const text = await response.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { message: text };
    }

    if (!response.ok) {
        const message = response.status === 403
            ? 'Server tools are only available after an admin session is ready.'
            : data?.error || data?.message || text || `Request failed with status ${response.status}.`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return data;
}

async function requestUserPrivateAction(endpoint, { body = {}, useFormData = false } = {}) {
    const requestHeaders = await waitForAuthorizedRequestHeaders();
    const headers = useFormData
        ? (() => {
            const multipartHeaders = { ...requestHeaders };
            delete multipartHeaders['Content-Type'];
            delete multipartHeaders['content-type'];
            return multipartHeaders;
        })()
        : requestHeaders;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: useFormData ? body : JSON.stringify(body),
    });

    const text = await response.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { message: text };
    }

    if (!response.ok) {
        throw new Error(data?.error || data?.message || text || `Request failed with status ${response.status}.`);
    }

    return data;
}

function setServerAdminPill(element, label, tone = 'neutral') {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.textContent = label;
    element.dataset.tone = tone;
}

function setServerAdminMessage(element, message, tone = 'neutral') {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.textContent = String(message ?? '').trim();
    element.dataset.tone = tone;
    element.hidden = !element.textContent;
}

function setServerAdminButtonLabel(button, isBusy, busyLabel) {
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    if (!button.dataset.idleLabel) {
        button.dataset.idleLabel = button.textContent || '';
    }

    button.textContent = isBusy ? busyLabel : button.dataset.idleLabel;
}

function appendServerAdminStat(target, label, value) {
    if (!(target instanceof HTMLElement)) {
        return;
    }

    const item = createElement('div', { className: 'sb-server-stat' });
    const title = createElement('small', { className: 'sb-server-stat-label', text: label });
    const content = createElement('strong', { className: 'sb-server-stat-value', text: value || '—' });
    item.append(title, content);
    target.appendChild(item);
}

function updateServerConfigDirtyState() {
    const state = getServerAdminState();
    const refs = getServerAdminRefs();

    if (!refs?.configEditor || !refs.configState) {
        return false;
    }

    const isDirty = refs.configEditor.value !== state.originalConfig;
    refs.configState.textContent = isDirty ? 'Unsaved changes' : 'Saved';
    refs.configState.dataset.state = isDirty ? 'dirty' : 'saved';
    return isDirty;
}

function updateServerAdminInteractivity() {
    const state = getServerAdminState();
    const refs = getServerAdminRefs();

    if (!refs) {
        return;
    }

    const locked = state.busy || state.restarting;
    const canUpdate = refs.updateButton?.dataset.sbCanUpdate === 'true';
    const hasConfigContent = Boolean(refs.configEditor?.value.trim());

    setButtonDisabled(refs.refreshButton, locked);
    setButtonDisabled(refs.reloadConfigButton, locked);
    setButtonDisabled(refs.updateButton, locked || !canUpdate);
    setButtonDisabled(refs.restartButton, locked);
    setButtonDisabled(refs.saveConfigButton, locked || !hasConfigContent);
    setButtonDisabled(refs.saveConfigRestartButton, locked || !hasConfigContent);

    if (refs.configEditor instanceof HTMLTextAreaElement) {
        refs.configEditor.disabled = locked;
    }
}

function renderServerAdminStatus(data) {
    const state = getServerAdminState();
    const refs = getServerAdminRefs();

    if (!refs) {
        return;
    }

    const repository = data?.repository ?? {};
    const version = data?.version ?? {};
    const statusGrid = refs.statusGrid;
    statusGrid.replaceChildren();

    appendServerAdminStat(statusGrid, 'Runtime', data?.runtime || 'Unknown');
    appendServerAdminStat(statusGrid, 'Version', version?.pkgVersion ? `v${version.pkgVersion}` : 'Unknown');

    // Branch selector instead of static text
    const branchContainer = createElement('div', { className: 'sb-server-stat' });
    const branchLabel = createElement('div', { className: 'sb-server-stat-label' });
    branchLabel.textContent = 'Branch';
    const branchValue = createElement('div', { className: 'sb-server-stat-value' });
    const branchSelect = createElement('select', {
        id: 'sb-branch-select',
        className: 'text_pole',
        attrs: { style: 'width: 100%; max-width: 200px;' }
    });
    const currentBranch = repository?.branch || version?.gitBranch || 'Unknown';
    const currentOption = createElement('option', { attrs: { value: currentBranch, selected: 'selected' } });
    currentOption.textContent = currentBranch;
    branchSelect.appendChild(currentOption);
    branchValue.appendChild(branchSelect);
    branchContainer.append(branchLabel, branchValue);
    statusGrid.appendChild(branchContainer);

    // Load available branches
    if (repository?.supported && repository?.isRepo) {
        loadServerAdminBranches(branchSelect, currentBranch);
    }

    appendServerAdminStat(statusGrid, 'Commit', repository?.currentCommit || version?.gitRevision || 'Unknown');
    appendServerAdminStat(statusGrid, 'Tracking', repository?.trackingBranch || 'Not set');
    appendServerAdminStat(statusGrid, 'Ahead', String(repository?.ahead ?? 0));
    appendServerAdminStat(statusGrid, 'Behind', String(repository?.behind ?? 0));
    appendServerAdminStat(statusGrid, 'Config', data?.configPath || 'Unknown');

    state.lastStatusData = {
        runtime: data?.runtime || '',
        configPath: data?.configPath || '',
        version,
        repository,
    };

    let pillLabel = 'Unavailable';
    let pillTone = 'neutral';

    if (repository?.supported && repository?.isRepo) {
        if (repository?.hasLocalChanges && !repository?.autoStash) {
            pillLabel = 'Update Blocked';
            pillTone = 'danger';
        } else if (repository?.hasLocalChanges && repository?.autoStash) {
            pillLabel = (repository?.behind ?? 0) > 0 ? 'Update Ready (Auto-stash)' : 'Auto-stash Enabled';
            pillTone = 'warn';
        } else if ((repository?.behind ?? 0) > 0) {
            pillLabel = 'Update Ready';
            pillTone = 'warn';
        } else if ((repository?.ahead ?? 0) > 0) {
            pillLabel = 'Patched Local';
            pillTone = 'neutral';
        } else {
            pillLabel = 'Up To Date';
            pillTone = 'good';
        }
    }

    setServerAdminPill(refs.statusPill, pillLabel, pillTone);
    refs.updateButton.dataset.sbCanUpdate = String(Boolean(repository?.canUpdate));

    const noteParts = [String(repository?.message ?? '').trim()].filter(Boolean);

    if ((repository?.changedFilesCount ?? 0) > 0) {
        const changedPreview = Array.isArray(repository?.changedFiles)
            ? repository.changedFiles.map(file => file?.path).filter(Boolean).join(', ')
            : '';
        noteParts.push(`Changed files: ${repository.changedFilesCount}${changedPreview ? ` (${changedPreview})` : ''}`);
    }

    setServerAdminMessage(refs.statusNote, noteParts.join('\n'), pillTone);

    if (refs.autoStashCheckbox) {
        refs.autoStashCheckbox.checked = Boolean(repository?.autoStash);
    }
    updateServerAdminInteractivity();
}

function renderServerAdminConfig(data, { overwrite = true } = {}) {
    const state = getServerAdminState();
    const refs = getServerAdminRefs();

    if (!refs) {
        return;
    }

    refs.configPath.textContent = data?.path || 'config.yaml';
    state.configLoaded = true;

    if (overwrite && refs.configEditor instanceof HTMLTextAreaElement) {
        refs.configEditor.value = String(data?.content ?? '');
        state.originalConfig = refs.configEditor.value;
        state.lastModifiedMs = Number(data?.lastModifiedMs ?? 0) || 0;
        updateServerConfigDirtyState();
    }
}

async function waitForServerReturn(expectedRevision = '') {
    let sawOffline = false;
    const timeoutAt = Date.now() + 180000;

    while (Date.now() < timeoutAt) {
        try {
            const response = await fetch('/version', { cache: 'no-store' });

            if (!response.ok) {
                throw new Error('Server is not ready yet.');
            }

            const version = await response.json().catch(() => ({}));
            const revision = String(version?.gitRevision ?? '').trim();

            if (expectedRevision && revision === expectedRevision) {
                location.reload();
                return true;
            }

            if (sawOffline) {
                location.reload();
                return true;
            }
        } catch {
            sawOffline = true;
        }

        await wait(1500);
    }

    return false;
}

async function refreshServerAdminPanel({ includeConfig = false, forceConfig = false } = {}) {
    const state = getServerAdminState();
    const refs = getServerAdminRefs();
    const shouldLoadConfig = includeConfig || forceConfig || !state.configLoaded;

    if (!refs || state.busy || state.restarting) {
        return;
    }

    state.busy = true;
    updateServerAdminInteractivity();
    setServerAdminMessage(refs.statusNote, 'Loading server status…');
    if (shouldLoadConfig) {
        refs.configState.textContent = state.configLoaded ? 'Refreshing…' : 'Loading…';
        refs.configState.dataset.state = 'loading';
    }

    const statusPromise = requestServerAdmin('/api/server-admin/status');
    const configPromise = shouldLoadConfig ? requestServerAdmin('/api/server-admin/config/get') : null;

    if (configPromise) {
        try {
            const configData = await configPromise;
            const configIsDirty = refs.configEditor.value !== state.originalConfig;

            if (forceConfig || !configIsDirty) {
                renderServerAdminConfig(configData, { overwrite: true });
            } else {
                renderServerAdminConfig(configData, { overwrite: false });
                state.lastModifiedMs = Number(configData?.lastModifiedMs ?? 0) || state.lastModifiedMs;
                refs.configPath.textContent = configData?.path || refs.configPath.textContent;
                setServerAdminMessage(refs.configNote, 'The file was refreshed on disk, but your unsaved draft was kept locally.', 'warn');
            }
        } catch (error) {
            state.configLoaded = false;
            const tone = error?.status === 403 ? 'warn' : 'danger';
            refs.configState.textContent = error?.status === 403 ? 'Admin Only' : 'Unavailable';
            refs.configState.dataset.state = tone;
            setServerAdminMessage(refs.configNote, error.message || 'Failed to load config.yaml.', tone);
            if (error?.status !== 403) {
                console.error('Failed to load config.yaml.', error);
            }
        }
    }

    try {
        const statusData = await statusPromise;
        renderServerAdminStatus(statusData);
    } catch (error) {
        const tone = error?.status === 403 ? 'warn' : 'danger';
        if (error?.status !== 403) {
            console.error('Failed to refresh server admin panel.', error);
        }
        getServerAdminRefs()?.statusGrid.replaceChildren();
        setServerAdminPill(getServerAdminRefs()?.statusPill, error?.status === 403 ? 'Admin Only' : 'Unavailable', tone);
        setServerAdminMessage(getServerAdminRefs()?.statusNote, error.message || 'Failed to load server tools.', tone);
    } finally {
        state.busy = false;
        updateServerAdminInteractivity();
    }
}

async function handleServerAdminReloadConfig() {
    const refs = getServerAdminRefs();

    if (!refs) {
        return;
    }

    if (updateServerConfigDirtyState() && !window.confirm('Discard your unsaved config edits and reload config.yaml from disk?')) {
        return;
    }

    await refreshServerAdminPanel({ includeConfig: true, forceConfig: true });
}

async function handleServerAdminSaveConfig({ restart = false } = {}) {
    const state = getServerAdminState();
    const refs = getServerAdminRefs();

    if (!refs || state.busy || state.restarting) {
        return;
    }

    state.busy = true;
    updateServerAdminInteractivity();
    setServerAdminMessage(refs.configNote, restart ? 'Saving config and preparing restart…' : 'Saving config…');

    try {
        const normalizedContent = refs.configEditor.value.endsWith('\n')
            ? refs.configEditor.value
            : `${refs.configEditor.value}\n`;
        const result = await requestServerAdmin('/api/server-admin/config/save', {
            content: normalizedContent,
            expectedLastModifiedMs: state.lastModifiedMs,
            restart,
        });

        refs.configEditor.value = normalizedContent;
        state.originalConfig = normalizedContent;
        state.lastModifiedMs = Number(result?.lastModifiedMs ?? 0) || state.lastModifiedMs;
        updateServerConfigDirtyState();
        setServerAdminMessage(refs.configNote, result?.message || 'Config saved.', restart ? 'warn' : 'good');
        toastr.success(result?.message || 'Config saved.', 'Server config');

        if (restart) {
            state.busy = false;
            state.restarting = true;
            updateServerAdminInteractivity();
            const restarted = await waitForServerReturn();

            if (!restarted) {
                state.restarting = false;
                setServerAdminMessage(refs.configNote, 'Restart is taking longer than expected. Refresh the page once the server is back.', 'warn');
                toastr.warning('Restart is taking longer than expected. Refresh manually once the server is back.', 'Restart pending');
            }
        }
    } catch (error) {
        console.error('Failed to save config.yaml.', error);
        setServerAdminMessage(refs.configNote, error.message || 'Failed to save config.yaml.', 'danger');
        toastr.error(error.message || 'Failed to save config.yaml.', 'Server config');
    } finally {
        if (!state.restarting) {
            state.busy = false;
            updateServerAdminInteractivity();
        }
    }
}

async function handleServerAdminRestart() {
    const state = getServerAdminState();
    const refs = getServerAdminRefs();

    if (!refs || state.busy || state.restarting) {
        return;
    }

    state.busy = true;
    updateServerAdminInteractivity();
    setServerAdminMessage(refs.updateNote, 'Restarting SillyBunny…');

    try {
        const result = await requestServerAdmin('/api/server-admin/restart');
        state.busy = false;
        state.restarting = true;
        updateServerAdminInteractivity();
        setServerAdminMessage(refs.updateNote, result?.message || 'Restarting SillyBunny…', 'warn');
        toastr.info(result?.message || 'Restarting SillyBunny…', 'Server');

        const restarted = await waitForServerReturn();
        if (!restarted) {
            state.restarting = false;
            setServerAdminMessage(refs.updateNote, 'Restart is taking longer than expected. Refresh the page once the server is back.', 'warn');
            toastr.warning('Restart is taking longer than expected. Refresh manually once the server is back.', 'Restart pending');
        }
    } catch (error) {
        console.error('Failed to restart SillyBunny.', error);
        state.busy = false;
        updateServerAdminInteractivity();
        setServerAdminMessage(refs.updateNote, error.message || 'Failed to restart SillyBunny.', 'danger');
        toastr.error(error.message || 'Failed to restart SillyBunny.', 'Server');
    }
}

async function handleServerAdminUpdate() {
    const state = getServerAdminState();
    const refs = getServerAdminRefs();

    if (!refs || state.busy || state.restarting) {
        return;
    }

    state.busy = true;
    updateServerAdminInteractivity();
    setServerAdminButtonLabel(refs.updateButton, true, 'Updating…');
    setServerAdminMessage(refs.updateNote, 'Checking Git status and applying the latest update…');
    refs.updateOutput.hidden = true;
    refs.updateOutput.textContent = '';

    try {
        const result = await requestServerAdmin('/api/server-admin/update');
        const nextStatus = {
            ...(state.lastStatusData ?? {}),
            configPath: refs.configPath?.textContent || state.lastStatusData?.configPath || '',
            version: result?.version ?? state.lastStatusData?.version ?? {},
            repository: result?.repository ?? state.lastStatusData?.repository ?? {},
        };

        if (!result?.updated) {
            renderServerAdminStatus(nextStatus);
            setServerAdminMessage(refs.updateNote, result?.message || 'Already up to date.', 'good');
            toastr.success(result?.message || 'Already up to date.', 'Server update');
            return;
        }

        renderServerAdminStatus(nextStatus);

        if (result?.stashPopWarning) {
            toastr.warning(result.stashPopWarning, 'Auto-stash warning', { timeOut: 10000 });
        }

        if (result?.install?.stdout || result?.install?.stderr) {
            refs.updateOutput.hidden = false;
            refs.updateOutput.textContent = [result.install.command, result.install.stdout, result.install.stderr]
                .filter(Boolean)
                .join('\n\n');
        }

        state.busy = false;
        state.restarting = true;
        updateServerAdminInteractivity();
        setServerAdminMessage(refs.updateNote, result?.message || 'Update applied. Restarting SillyBunny…', 'warn');
        toastr.info(result?.message || 'Update applied. Restarting SillyBunny…', 'Server update');

        const expectedRevision = String(result?.version?.gitRevision ?? result?.repository?.currentCommit ?? '').trim();
        const restarted = await waitForServerReturn(expectedRevision);

        if (!restarted) {
            state.restarting = false;
            setServerAdminMessage(refs.updateNote, 'Update completed, but restart is taking longer than expected. Refresh manually once the server is back.', 'warn');
            toastr.warning('Update finished, but restart is taking longer than expected. Refresh manually once the server is back.', 'Restart pending');
        }
    } catch (error) {
        console.error('Failed to update SillyBunny.', error);
        state.busy = false;
        setServerAdminMessage(refs.updateNote, error.message || 'Failed to update SillyBunny.', 'danger');
        toastr.error(error.message || 'Failed to update SillyBunny.', 'Server update');
    } finally {
        setServerAdminButtonLabel(refs.updateButton, false, 'Updating…');

        if (!state.restarting) {
            state.busy = false;
            updateServerAdminInteractivity();
        }
    }
}

async function loadServerAdminBranches(selectElement, currentBranch) {
    try {
        const result = await requestServerAdmin('/api/server-admin/branches');
        const branches = result?.branches || [];

        selectElement.replaceChildren();

        for (const branch of branches) {
            const option = createElement('option', { attrs: { value: branch } });
            option.textContent = branch;
            if (branch === currentBranch) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        }

        // Add change handler
        selectElement.addEventListener('change', () => handleServerAdminBranchSwitch(selectElement));
    } catch (error) {
        console.error('Failed to load branches.', error);
        // Keep the current branch option if loading fails
    }
}

async function handleServerAdminBranchSwitch(selectElement) {
    const state = getServerAdminState();
    const refs = getServerAdminRefs();

    if (!refs || state.busy || state.restarting) {
        return;
    }

    const targetBranch = selectElement.value;
    const currentBranch = state.lastStatusData?.repository?.branch || '';

    if (targetBranch === currentBranch) {
        return;
    }

    // Show confirmation dialog
    const hasLocalChanges = state.lastStatusData?.repository?.hasLocalChanges || false;
    const changedFiles = state.lastStatusData?.repository?.changedFiles || [];
    const changedFilesText = changedFiles.length > 0
        ? `\n\nChanged files: ${changedFiles.map(f => f.path).join(', ')}`
        : '';

    const confirmMessage = hasLocalChanges
        ? `You have local changes.${changedFilesText}\n\nDo you want to auto-stash your changes and switch to "${targetBranch}"?\n\nThe server will restart after switching.`
        : `Switch to branch "${targetBranch}"?\n\nThe server will restart after switching.`;

    const confirmed = confirm(confirmMessage);

    if (!confirmed) {
        // Reset select to current branch
        selectElement.value = currentBranch;
        return;
    }

    state.busy = true;
    updateServerAdminInteractivity();
    setServerAdminMessage(refs.updateNote, `Switching to branch "${targetBranch}"…`);

    try {
        const result = await requestServerAdmin('/api/server-admin/switch-branch', {
            branch: targetBranch,
            autoStash: hasLocalChanges,
        });

        state.busy = false;
        state.restarting = true;
        updateServerAdminInteractivity();

        const message = result?.message || `Switched to branch "${targetBranch}". Restarting…`;
        setServerAdminMessage(refs.updateNote, message, 'warn');
        toastr.info(message, 'Branch Switch');

        if (result?.stashed && !result?.stashRestored) {
            toastr.warning('Your changes were stashed but could not be automatically restored. Use "git stash pop" after restart.', 'Stash Warning', { timeOut: 10000 });
        }

        const restarted = await waitForServerReturn();
        if (!restarted) {
            state.restarting = false;
            setServerAdminMessage(refs.updateNote, 'Branch switched, but restart is taking longer than expected. Refresh manually once the server is back.', 'warn');
            toastr.warning('Branch switched, but restart is taking longer than expected. Refresh manually once the server is back.', 'Restart pending');
        }
    } catch (error) {
        console.error('Failed to switch branch.', error);
        state.busy = false;
        updateServerAdminInteractivity();

        // Reset select to current branch
        selectElement.value = currentBranch;

        const errorMessage = error.message || 'Failed to switch branch.';
        setServerAdminMessage(refs.updateNote, errorMessage, 'danger');
        toastr.error(errorMessage, 'Branch Switch');
    }
}

function buildServerAdminPanel() {
    const { panel, scroller } = createShellPanel({
        id: 'server',
    });

    const column = createElement('div', { className: 'sb-shell-column sb-server-column' });
    const callout = createElement('div', { className: 'sb-shell-callout' });
    callout.innerHTML = `
        <strong>Server Tools</strong>
        <p>Edit <code>config.yaml</code>, check for Git updates, and restart the app from inside Customize. Auto-update only runs when the repository can fast-forward cleanly.</p>
    `;

    const statusCard = createElement('section', { className: 'sb-admin-card sb-server-card' });
    const statusHeader = createElement('div', { className: 'sb-admin-card-header' });
    const statusCopy = createElement('div', { className: 'sb-admin-card-copy' });
    const statusTitle = createElement('strong', { text: 'App Status' });
    const statusDescription = createElement('p', { text: 'Review the current runtime, branch, commit, and whether this workspace can update safely.' });
    const statusPill = createElement('span', { className: 'sb-server-pill', text: 'Checking…' });
    const statusGrid = createElement('div', { className: 'sb-server-grid' });
    const statusNote = createElement('div', { className: 'sb-server-note' });
    statusCopy.append(statusTitle, statusDescription);
    statusHeader.append(statusCopy, statusPill);
    statusCard.append(statusHeader, statusGrid, statusNote);

    const updateCard = createElement('section', { className: 'sb-admin-card sb-server-card' });
    const updateHeader = createElement('div', { className: 'sb-admin-card-header' });
    const updateCopy = createElement('div', { className: 'sb-admin-card-copy' });
    const updateTitle = createElement('strong', { text: 'Updates & Restart' });
    const updateDescription = createElement('p', { text: 'Check upstream status, update the app, and relaunch automatically when it is safe to do so.' });
    const updateActions = createElement('div', { className: 'sb-server-actions' });
    const refreshButton = createElement('button', { className: 'menu_button menu_button_icon sb-server-action', text: 'Check for updates', attrs: { type: 'button' } });
    const updateButton = createElement('button', { className: 'menu_button menu_button_icon sb-server-action menu_button_primary', text: 'Update & Restart', attrs: { type: 'button' } });
    const restartButton = createElement('button', { className: 'menu_button menu_button_icon sb-server-action', text: 'Restart server', attrs: { type: 'button' } });
    const updateNote = createElement('div', { className: 'sb-server-note', text: 'Fast-forward updates restart automatically after the pull finishes.' });
    const autoStashLabel = createElement('label', { className: 'checkbox_label' });
    const autoStashCheckbox = createElement('input', { attrs: { type: 'checkbox', id: 'auto_stash_before_pull' } });
    const autoStashText = createElement('small', { text: 'Auto-stash local changes before pulling' });
    autoStashLabel.append(autoStashCheckbox, autoStashText);
    const updateOutput = createElement('pre', { className: 'sb-server-output' });
    updateOutput.hidden = true;
    updateCopy.append(updateTitle, updateDescription);
    updateActions.append(refreshButton, updateButton, restartButton);
    updateHeader.append(updateCopy);
    updateCard.append(updateHeader, updateActions, autoStashLabel, updateNote, updateOutput);

    const configCard = createElement('section', { className: 'sb-admin-card sb-server-card' });
    const configHeader = createElement('div', { className: 'sb-admin-card-header' });
    const configCopy = createElement('div', { className: 'sb-admin-card-copy' });
    const configTitle = createElement('strong', { text: 'config.yaml Editor' });
    const configDescription = createElement('p', { text: 'Edit the live config file directly here. Saves validate YAML before writing anything to disk.' });
    const configState = createElement('span', { className: 'sb-server-inline-state', text: 'Loading…' });
    const configPath = createElement('code', { className: 'sb-server-config-path', text: 'config.yaml' });
    const configMeta = createElement('div', { className: 'sb-server-config-meta' });
    const configEditor = createElement('textarea', {
        className: 'text_pole sb-server-config-editor',
        attrs: {
            spellcheck: 'false',
            rows: '22',
            'aria-label': 'config.yaml editor',
        },
    });
    const configActions = createElement('div', { className: 'sb-server-actions' });
    const reloadConfigButton = createElement('button', { className: 'menu_button menu_button_icon sb-server-action', text: 'Reload file', attrs: { type: 'button' } });
    const saveConfigButton = createElement('button', { className: 'menu_button menu_button_icon sb-server-action', text: 'Save config', attrs: { type: 'button' } });
    const saveConfigRestartButton = createElement('button', { className: 'menu_button menu_button_icon sb-server-action menu_button_primary', text: 'Save & Restart', attrs: { type: 'button' } });
    const configNote = createElement('div', { className: 'sb-server-note', text: 'Most config changes only take effect after a restart.' });
    configCopy.append(configTitle, configDescription);
    configHeader.append(configCopy, configState);
    configMeta.append(configPath);
    configActions.append(reloadConfigButton, saveConfigButton, saveConfigRestartButton);
    configCard.append(configHeader, configMeta, configEditor, configActions, configNote);

    column.append(callout, statusCard, updateCard, configCard);
    scroller.appendChild(column);

    const state = getServerAdminState();
    state.refs = {
        statusPill,
        statusGrid,
        statusNote,
        refreshButton,
        updateButton,
        restartButton,
        updateNote,
        updateOutput,
        autoStashCheckbox,
        configPath,
        configState,
        configEditor,
        reloadConfigButton,
        saveConfigButton,
        saveConfigRestartButton,
        configNote,
    };
    setServerAdminPill(statusPill, 'Idle', 'neutral');
    setServerAdminMessage(statusNote, 'Open this tab to load server status and update controls.', 'neutral');
    configState.textContent = 'Not loaded';
    configState.dataset.state = 'neutral';

    refreshButton.addEventListener('click', () => refreshServerAdminPanel({ includeConfig: false }));
    updateButton.addEventListener('click', handleServerAdminUpdate);
    restartButton.addEventListener('click', handleServerAdminRestart);
    reloadConfigButton.addEventListener('click', handleServerAdminReloadConfig);
    saveConfigButton.addEventListener('click', () => handleServerAdminSaveConfig({ restart: false }));
    saveConfigRestartButton.addEventListener('click', () => handleServerAdminSaveConfig({ restart: true }));
    configEditor.addEventListener('input', () => {
        updateServerConfigDirtyState();
        updateServerAdminInteractivity();
    });
    autoStashCheckbox.addEventListener('change', function () {
        const refs = getServerAdminRefs();
        if (!refs?.configEditor) return;
        const yaml = refs.configEditor.value;
        const newValue = this.checked ? 'true' : 'false';
        if (/^autoStashBeforePull:\s*(true|false)/m.test(yaml)) {
            refs.configEditor.value = yaml.replace(/^(autoStashBeforePull:\s*)(true|false)/m, `$1${newValue}`);
        } else {
            refs.configEditor.value = yaml + `\nautoStashBeforePull: ${newValue}\n`;
        }
        refs.configEditor.dispatchEvent(new Event('input'));
    });
    updateServerAdminInteractivity();

    return {
        id: 'server',
        panel,
        button: null,
        searchRoot: column,
        onActivate: () => {
            if (!isShellOpen('right')) {
                return;
            }

            void refreshServerAdminPanel({ includeConfig: !getServerAdminState().configLoaded });
        },
    };
}

/**
 * Creates a collapsible inline-drawer for Advanced Formatting sections.
 * @param {string} id Drawer element ID
 * @param {string} title Drawer title
 * @param {string} description Short description
 * @returns {HTMLElement} The drawer element
 */
function createAdvFormattingDrawer(id, title, description) {
    const drawer = createElement('div', {
        id,
        className: 'inline-drawer wide100p flexFlowColumn sb-af-settings-drawer',
    });
    const header = createElement('div', { className: 'inline-drawer-toggle inline-drawer-header' });
    const label = createElement('div', { className: 'flex-container flexFlowColumn' });
    const titleEl = createElement('b');
    titleEl.textContent = title;
    label.appendChild(titleEl);
    if (description) {
        const desc = createElement('small', { className: 'sb-group-meta' });
        desc.textContent = description;
        label.appendChild(desc);
    }
    header.appendChild(label);
    const icon = createElement('div', { className: 'fa-solid fa-circle-chevron-down inline-drawer-icon down' });
    header.appendChild(icon);
    drawer.appendChild(header);
    const content = createElement('div', { className: 'inline-drawer-content' });
    content.style.display = 'none';
    drawer.appendChild(content);
    return drawer;
}

/**
 * Wraps Advanced Formatting columns (Context Template, Instruct Template,
 * System Prompt, Reasoning) into collapsible drawers for better UX.
 */
function groupAdvancedFormattingIntoDrawers() {
    const $af = $('#AdvancedFormatting');
    if ($af.length === 0 || $af.data('sb-grouped')) {
        return;
    }

    // The three-column container
    const $columnsContainer = $af.find('.flex-container.spaceEvenly').first();
    if ($columnsContainer.length === 0) {
        return;
    }

    const sections = [
        {
            id: 'sb-af-context',
            title: 'Context Template',
            description: 'Story string, separators, and context formatting options',
            selector: '#ContextSettings',
        },
        {
            id: 'sb-af-instruct',
            title: 'Instruct Template',
            description: 'Instruct mode sequences, wrapping, and activation',
            selector: '#InstructSettingsColumn',
        },
        {
            id: 'sb-af-sysprompt',
            title: 'System Prompt',
            description: 'System prompt, post-history instructions, stopping strings, tokenizer',
            selector: '#SystemPromptColumn',
        },
    ];

    const $drawersContainer = $('<div>', { class: 'sb-af-drawers flex-container flexFlowColumn gap10' });

    sections.forEach(section => {
        const $col = $(section.selector).first();
        if ($col.length === 0) return;

        $col.detach();

        const drawer = createAdvFormattingDrawer(section.id, section.title, section.description);
        const content = drawer.querySelector('.inline-drawer-content');

        // Remove the flex1 class so it fills the full width in stacked layout
        $col.removeClass('flex1');
        $col.addClass('wide100p');

        content.appendChild($col[0]);
        $drawersContainer.append(drawer);
    });

    // Also check if Reasoning section exists after the columns container
    const $reasoning = $columnsContainer.nextAll().filter(function () {
        return $(this).find('#reasoning_auto_parse').length > 0 || $(this).find('.sb-reasoning-toggle-grid').length > 0;
    }).first();

    if ($reasoning.length > 0) {
        $reasoning.detach();
        const drawer = createAdvFormattingDrawer('sb-af-reasoning', 'Reasoning', 'Auto-parse, formatting, and reasoning block settings');
        const content = drawer.querySelector('.inline-drawer-content');
        content.appendChild($reasoning[0]);
        $drawersContainer.append(drawer);
    }

    // Replace the columns container with the stacked drawers
    $columnsContainer.replaceWith($drawersContainer);

    $af.data('sb-grouped', true);
}

function buildConsoleLogsPanel() {
    const { panel, scroller } = createShellPanel({
        id: 'console-logs',
    });

    const column = createElement('div', { className: 'sb-shell-column sb-console-log-column' });
    const callout = createElement('div', { className: 'sb-shell-callout' });
    callout.innerHTML = `
        <strong>Console Logs</strong>
        <p>Watch the recent terminal output from the running SillyBunny process here, without keeping a terminal window open on the side.</p>
    `;

    const card = createElement('section', { className: 'sb-admin-card sb-server-card sb-console-log-card' });
    const header = createElement('div', { className: 'sb-admin-card-header' });
    const copy = createElement('div', { className: 'sb-admin-card-copy' });
    const title = createElement('strong', { text: 'Live Server Console' });
    const description = createElement('p', { text: 'This mirrors the current process output captured from stdout and stderr. Only logs from the current SillyBunny session are available here.' });
    const statusPill = createElement('span', { className: 'sb-server-pill', text: 'Loading…' });
    const actions = createElement('div', { className: 'sb-server-actions sb-console-log-actions' });
    const refreshButton = createElement('button', { className: 'menu_button menu_button_icon sb-server-action', text: 'Refresh Now', attrs: { type: 'button' } });
    const pauseButton = createElement('button', { className: 'menu_button menu_button_icon sb-server-action', text: 'Pause Live', attrs: { type: 'button' } });
    const statusNote = createElement('div', { className: 'sb-server-note' });
    const output = createElement('pre', { className: 'sb-server-output sb-console-log-output' });

    copy.append(title, description);
    header.append(copy, statusPill);
    actions.append(refreshButton, pauseButton);
    card.append(header, actions, statusNote, output);
    column.append(callout, card);
    scroller.appendChild(column);

    const state = getConsoleLogsState();
    state.refs = {
        statusPill,
        refreshButton,
        pauseButton,
        statusNote,
        output,
    };

    refreshButton.addEventListener('click', () => {
        void refreshConsoleLogs({ forceFull: state.latestId === 0 });
    });
    pauseButton.addEventListener('click', toggleConsoleLogsPolling);

    renderConsoleLogsOutput({ preserveScroll: false });
    updateConsoleLogsInteractivity();

    return {
        id: 'console-logs',
        panel,
        button: null,
        searchRoot: column,
        onActivate: () => {
            void refreshConsoleLogs({ forceFull: getConsoleLogsState().latestId === 0 });
            scheduleConsoleLogsRefresh(0);
        },
        onDeactivate: () => {
            const state = getConsoleLogsState();
            window.clearTimeout(state.refreshTimer);
            state.refreshTimer = 0;
        },
    };
}

function updateSillyTavernImportInteractivity() {
    const state = getImporterState();
    const refs = getImporterRefs();

    if (!refs) {
        return;
    }

    setButtonDisabled(refs.folderButton, state.busy);
    setButtonDisabled(refs.syncButton, state.busy);
    setButtonDisabled(refs.zipButton, state.busy);

    if (refs.pathInput instanceof HTMLInputElement) {
        refs.pathInput.disabled = state.busy;
    }
}

function setSillyTavernImportBusy(isBusy) {
    getImporterState().busy = Boolean(isBusy);
    updateSillyTavernImportInteractivity();
}

function getExtensionSyncStatusTone(status) {
    if (status === 'failed') {
        return 'danger';
    }

    if (status === 'warning') {
        return 'warn';
    }

    return 'good';
}

function getExtensionSyncStatusLabel(status) {
    if (status === 'failed') {
        return 'Failed';
    }

    if (status === 'warning') {
        return 'Needs Attention';
    }

    return 'Ready';
}

function getExtensionSyncCheckSummary(result) {
    const checks = [];
    const manifestFound = result?.checks?.manifestFound === true;
    const manifestValid = result?.checks?.manifestValid === true;
    const jsEntry = typeof result?.checks?.jsEntry === 'string' ? result.checks.jsEntry.trim() : '';
    const jsEntryExists = result?.checks?.jsEntryExists === true;
    const gitMetadataSkipped = result?.checks?.gitMetadataSkipped === true;

    checks.push(!manifestFound
        ? 'manifest missing'
        : manifestValid
            ? 'manifest OK'
            : 'manifest invalid');
    checks.push(jsEntry
        ? jsEntryExists
            ? `JS entry: ${jsEntry}`
            : `JS missing: ${jsEntry}`
        : 'no JS entry');

    if (gitMetadataSkipped) {
        checks.push('git metadata skipped');
    }

    return checks.join(' · ');
}

function renderSillyTavernExtensionSyncReport(reportData = null) {
    const refs = getImporterRefs();
    const report = refs?.report;
    const summary = refs?.reportSummary;
    const help = refs?.reportHelp;
    const list = refs?.reportList;
    const state = getImporterState();

    state.report = reportData;

    if (!(report instanceof HTMLElement) || !(summary instanceof HTMLElement) || !(help instanceof HTMLElement) || !(list instanceof HTMLElement)) {
        return;
    }

    if (!reportData || !Array.isArray(reportData.results) || reportData.results.length === 0) {
        report.hidden = true;
        summary.textContent = '';
        help.textContent = '';
        list.replaceChildren();
        return;
    }

    const results = reportData.results;
    const readyCount = Number(reportData.readyCount ?? 0) || 0;
    const warningCount = Number(reportData.warningCount ?? 0) || 0;
    const failedCount = Number(reportData.failedCount ?? 0) || 0;
    const syncedCount = readyCount + warningCount;
    const needsAttention = warningCount + failedCount > 0;
    const gitMetadataSkippedCount = Number(reportData.gitMetadataSkippedCount ?? 0)
        || results.filter(result => result?.checks?.gitMetadataSkipped === true).length;

    summary.textContent = reportData.message
        || `Synced ${syncedCount} of ${results.length} third-party extensions.`;
    help.textContent = needsAttention
        ? `If an extension still misbehaves after a reload, contact purachina with the extension name and the report below.${gitMetadataSkippedCount > 0 ? ` Git metadata was skipped on ${gitMetadataSkippedCount} extension${gitMetadataSkippedCount === 1 ? '' : 's'} to avoid permission issues, so built-in update tooling may need a reinstall later.` : ''}`
        : gitMetadataSkippedCount > 0
            ? `Reload when you are ready to activate the synced extensions. Git metadata was skipped on ${gitMetadataSkippedCount} extension${gitMetadataSkippedCount === 1 ? '' : 's'} to avoid permission issues, so built-in update tooling may need a reinstall later.`
            : 'Reload when you are ready to activate the synced extensions.';

    const items = results.map(result => {
        const card = createElement('article', { className: `sb-import-report-item is-${result?.status || 'warning'}` });
        const header = createElement('div', { className: 'sb-import-report-item-header' });
        const titleGroup = createElement('div', { className: 'sb-import-report-item-title' });
        const title = createElement('strong', { text: result?.displayName || result?.name || 'Unknown extension' });
        const metaParts = [];

        if (result?.version) {
            metaParts.push(`v${result.version}`);
        }

        if (result?.author) {
            metaParts.push(result.author);
        }

        const meta = createElement('small', {
            className: 'sb-import-report-item-meta',
            text: metaParts.join(' • '),
        });
        const pill = createElement('span', { className: 'sb-server-pill' });

        setServerAdminPill(pill, getExtensionSyncStatusLabel(result?.status), getExtensionSyncStatusTone(result?.status));
        titleGroup.append(title);

        if (metaParts.length > 0) {
            titleGroup.append(meta);
        }

        header.append(titleGroup, pill);

        const body = createElement('div', { className: 'sb-import-report-item-body' });
        const copiedFiles = Number(result?.copiedFiles ?? 0) || 0;
        const statusLine = createElement('p', {
            className: 'sb-import-report-item-copy',
            text: result?.status === 'failed'
                ? (result?.error || 'This extension could not be synced.')
                : `Copied ${copiedFiles} file${copiedFiles === 1 ? '' : 's'} into ${result?.name || 'extension'}.`,
        });
        const checksLine = createElement('p', {
            className: 'sb-import-report-item-checks',
            text: getExtensionSyncCheckSummary(result),
        });

        body.append(statusLine, checksLine);

        if (Array.isArray(result?.warnings) && result.warnings.length > 0) {
            const warningList = createElement('ul', { className: 'sb-import-report-warnings' });

            for (const warning of result.warnings) {
                warningList.appendChild(createElement('li', { text: warning }));
            }

            body.appendChild(warningList);
        }

        card.append(header, body);
        return card;
    });

    list.replaceChildren(...items);
    report.hidden = false;
}

function logSillyTavernExtensionSyncReport(reportData) {
    if (!reportData || !Array.isArray(reportData.results)) {
        return;
    }

    console.groupCollapsed(`[SillyBunny] Third-party extension sync report (${reportData.results.length})`);
    console.table(reportData.results.map(result => ({
        name: result?.name || '',
        displayName: result?.displayName || '',
        status: result?.status || '',
        copiedFiles: Number(result?.copiedFiles ?? 0) || 0,
        manifestFound: result?.checks?.manifestFound === true,
        manifestValid: result?.checks?.manifestValid === true,
        jsEntry: result?.checks?.jsEntry || '',
        jsEntryExists: result?.checks?.jsEntryExists === true,
        gitMetadataSkipped: result?.checks?.gitMetadataSkipped === true,
        warningCount: Array.isArray(result?.warnings) ? result.warnings.length : 0,
        error: result?.error || '',
    })));
    console.log(reportData);
    console.groupEnd();
}

async function handleSillyTavernFolderImport() {
    const refs = getImporterRefs();

    if (!refs?.pathInput || getImporterState().busy) {
        return;
    }

    const sourcePath = refs.pathInput.value.trim();

    if (!sourcePath) {
        setServerAdminMessage(refs.note, 'Paste the path to your SillyTavern folder or user data folder first.', 'warn');
        toastr.warning('Paste a SillyTavern folder path first.', 'Import SillyTavern');
        refs.pathInput.focus();
        return;
    }

    const confirmed = window.confirm(`Import data from this folder into the current SillyBunny account?\n\n${sourcePath}\n\nFiles with the same name will be replaced, and the page will reload when the import finishes.`);
    if (!confirmed) {
        return;
    }

    setSillyTavernImportBusy(true);
    renderSillyTavernExtensionSyncReport(null);
    setServerAdminMessage(refs.note, 'Importing folder data… This may take a moment for larger libraries.');

    try {
        const result = await requestUserPrivateAction('/api/users/import-sillytavern/folder', {
            body: { sourcePath },
        });

        setServerAdminMessage(refs.note, result?.message || 'Folder import finished. Reloading…', 'good');
        toastr.success(result?.message || 'Folder import finished. Reloading…', 'Import SillyTavern');
        await wait(700);
        location.reload();
    } catch (error) {
        console.error('Failed to import SillyTavern folder.', error);
        setServerAdminMessage(refs.note, error.message || 'Failed to import from that folder path.', 'danger');
        toastr.error(error.message || 'Failed to import from that folder path.', 'Import SillyTavern');
    } finally {
        setSillyTavernImportBusy(false);
    }
}

async function handleSillyTavernExtensionSync() {
    const refs = getImporterRefs();

    if (!refs?.pathInput || getImporterState().busy) {
        return;
    }

    const sourcePath = refs.pathInput.value.trim();

    if (!sourcePath) {
        setServerAdminMessage(refs.note, 'Paste the path to your existing SillyTavern folder before syncing extensions.', 'warn');
        toastr.warning('Paste a SillyTavern folder path first.', 'Sync Extensions');
        refs.pathInput.focus();
        return;
    }

    const confirmed = window.confirm(`Sync third-party extensions from this SillyTavern folder into the current SillyBunny account?\n\n${sourcePath}\n\nMatching extension folders will be replaced. SillyBunny will show a detailed report instead of reloading immediately.`);
    if (!confirmed) {
        return;
    }

    setSillyTavernImportBusy(true);
    renderSillyTavernExtensionSyncReport(null);
    setServerAdminMessage(refs.note, 'Syncing third-party extensions… SillyBunny will validate each one and show a report when it finishes.');

    try {
        const result = await requestUserPrivateAction('/api/users/import-sillytavern/extensions', {
            body: { sourcePath },
        });
        const warningCount = Number(result?.warningCount ?? 0) || 0;
        const failedCount = Number(result?.failedCount ?? 0) || 0;
        const needsAttention = warningCount + failedCount > 0;
        const gitMetadataSkippedCount = Number(result?.gitMetadataSkippedCount ?? 0) || 0;
        const message = needsAttention
            ? `${result?.message || 'Extension sync finished with warnings.'} If something still looks broken after a reload, contact purachina with the report below.`
            : `${result?.message || 'Extension sync finished.'} Reload when you are ready to activate the synced extensions.${gitMetadataSkippedCount > 0 ? ` Git metadata was skipped on ${gitMetadataSkippedCount} extension${gitMetadataSkippedCount === 1 ? '' : 's'} to avoid permission issues, so built-in update tooling may need a reinstall later.` : ''}`;
        const tone = failedCount > 0 ? 'danger' : warningCount > 0 ? 'warn' : 'good';

        renderSillyTavernExtensionSyncReport(result);
        logSillyTavernExtensionSyncReport(result);
        setServerAdminMessage(refs.note, message, tone);

        if (failedCount > 0) {
            toastr.error(result?.message || 'Some extensions could not be synced.', 'Sync Extensions');
        } else if (warningCount > 0) {
            toastr.warning(result?.message || 'Extension sync finished with warnings.', 'Sync Extensions');
        } else {
            toastr.success(result?.message || 'Extension sync finished.', 'Sync Extensions');
        }
    } catch (error) {
        console.error('Failed to sync SillyTavern third-party extensions.', error);
        setServerAdminMessage(refs.note, error.message || 'Failed to sync third-party extensions from that folder.', 'danger');
        toastr.error(error.message || 'Failed to sync third-party extensions from that folder.', 'Sync Extensions');
    } finally {
        setSillyTavernImportBusy(false);
    }
}

async function handleSillyTavernZipImport(file) {
    const refs = getImporterRefs();

    if (!(file instanceof File) || getImporterState().busy || !refs) {
        return;
    }

    const confirmed = window.confirm(`Import this SillyTavern backup ZIP into the current SillyBunny account?\n\n${file.name}\n\nFiles with the same name will be replaced, and the page will reload when the import finishes.`);
    if (!confirmed) {
        if (refs.zipFileInput instanceof HTMLInputElement) {
            refs.zipFileInput.value = '';
        }

        return;
    }

    const formData = new FormData();
    formData.append('avatar', file, file.name);

    setSillyTavernImportBusy(true);
    renderSillyTavernExtensionSyncReport(null);
    setServerAdminMessage(refs.note, 'Importing backup ZIP… This may take a moment for larger libraries.');

    try {
        const result = await requestUserPrivateAction('/api/users/import-sillytavern/zip', {
            body: formData,
            useFormData: true,
        });

        setServerAdminMessage(refs.note, result?.message || 'Backup ZIP imported. Reloading…', 'good');
        toastr.success(result?.message || 'Backup ZIP imported. Reloading…', 'Import SillyTavern');
        await wait(700);
        location.reload();
    } catch (error) {
        console.error('Failed to import SillyTavern backup ZIP.', error);
        setServerAdminMessage(refs.note, error.message || 'Failed to import that backup ZIP.', 'danger');
        toastr.error(error.message || 'Failed to import that backup ZIP.', 'Import SillyTavern');
    } finally {
        if (refs.zipFileInput instanceof HTMLInputElement) {
            refs.zipFileInput.value = '';
        }

        setSillyTavernImportBusy(false);
    }
}

function injectSillyTavernImportCard() {
    const importOutlet = document.getElementById('sb-import-tools-outlet');
    const themeBlock = document.getElementById('UI-presets-block');
    const cardHost = importOutlet instanceof HTMLElement
        ? importOutlet
        : themeBlock;
    if (!(cardHost instanceof HTMLElement)) {
        return;
    }

    const existingCard = document.getElementById('sb-import-card');
    if (existingCard instanceof HTMLElement) {
        if (cardHost.firstElementChild !== existingCard) {
            cardHost.prepend(existingCard);
        }

        return;
    }

    const card = createElement('section', { id: 'sb-import-card', className: 'sb-admin-card sb-import-card' });
    const header = createElement('div', { className: 'sb-admin-card-header' });
    const copy = createElement('div', { className: 'sb-admin-card-copy' });
    const title = createElement('strong', { text: 'Import Your SillyTavern Setup' });
    const description = createElement('p', { text: 'Bring over characters, chats, presets, themes, extensions, and account settings from an existing SillyTavern folder or backup ZIP without touching the filesystem manually.' });
    const badge = createElement('span', { className: 'sb-server-pill', text: 'Easy Import' });
    copy.append(title, description);
    header.append(copy, badge);

    const hintRow = createElement('div', { className: 'sb-import-hints' });
    for (const label of ['Characters', 'Chats', 'Presets', 'Themes', 'Extensions']) {
        hintRow.appendChild(createElement('span', { className: 'sb-import-chip', text: label }));
    }

    const grid = createElement('div', { className: 'sb-import-grid' });
    const folderPane = createElement('div', { className: 'sb-import-pane' });
    const folderTitle = createElement('strong', { text: 'Import From Folder Path' });
    const folderBody = createElement('p', { text: 'Paste the path to your SillyTavern install, its `data` folder, or the specific user folder you want to import. Use the full import for everything, or sync just your third-party extensions with a detailed report.' });
    const pathRow = createElement('div', { className: 'sb-import-path-row' });
    const actionRow = createElement('div', { className: 'sb-import-action-row' });
    const pathInput = createElement('input', {
        id: 'sb-import-path-input',
        className: 'text_pole sb-import-path-input',
        attrs: {
            type: 'text',
            placeholder: '/path/to/SillyTavern',
            'aria-label': 'SillyTavern folder path',
            autocomplete: 'off',
            spellcheck: 'false',
            title: 'You can paste a full SillyTavern install path, its data folder, or a specific user folder.',
        },
    });
    const folderButton = createElement('button', {
        className: 'menu_button menu_button_icon sb-server-action menu_button_primary',
        attrs: { type: 'button' },
        html: '<i class="fa-solid fa-folder-open" aria-hidden="true"></i><span>Import Folder</span>',
    });
    const syncButton = createElement('button', {
        className: 'menu_button menu_button_icon sb-server-action',
        attrs: { type: 'button' },
        html: '<i class="fa-solid fa-puzzle-piece" aria-hidden="true"></i><span>Sync Extensions</span>',
    });
    pathRow.append(pathInput);
    actionRow.append(folderButton, syncButton);
    folderPane.append(folderTitle, folderBody, pathRow, actionRow);

    const zipPane = createElement('div', { className: 'sb-import-pane' });
    const zipTitle = createElement('strong', { text: 'Import From Backup ZIP' });
    const zipBody = createElement('p', { text: 'Use the backup ZIP that SillyTavern exports. Pick the file here and SillyBunny will import it into this account.' });
    const zipButton = createElement('button', {
        className: 'menu_button menu_button_icon sb-server-action menu_button_primary',
        attrs: { type: 'button' },
        html: '<i class="fa-solid fa-file-zipper" aria-hidden="true"></i><span>Import Backup ZIP</span>',
    });
    const zipFileInput = createElement('input', {
        id: 'sb-import-zip-input',
        className: 'sb-import-file-input',
        attrs: {
            type: 'file',
            accept: '.zip,application/zip,application/x-zip-compressed',
            'aria-label': 'Choose a SillyTavern backup ZIP',
        },
    });
    const zipFileName = createElement('small', { className: 'sb-import-file-name', text: 'No ZIP selected yet.' });
    zipPane.append(zipTitle, zipBody, zipButton, zipFileInput, zipFileName);

    const note = createElement('div', {
        className: 'sb-server-note sb-import-note',
        text: 'Full imports replace matching files and reload automatically. Extension sync replaces matching third-party extension folders, then shows a report so you can review it before reloading.',
    });
    const report = createElement('section', {
        className: 'sb-import-report',
        attrs: { 'aria-live': 'polite' },
    });
    const reportHeader = createElement('div', { className: 'sb-import-report-header' });
    const reportTitle = createElement('strong', { text: 'Third-Party Extension Sync Report' });
    const reportSummary = createElement('p', { className: 'sb-import-report-summary' });
    const reportHelp = createElement('p', { className: 'sb-import-report-help' });
    const reportList = createElement('div', { className: 'sb-import-report-list' });

    reportHeader.append(reportTitle);
    report.append(reportHeader, reportSummary, reportHelp, reportList);
    report.hidden = true;

    grid.append(folderPane, zipPane);
    card.append(header, hintRow, grid, note, report);
    cardHost.prepend(card);

    getImporterState().refs = {
        card,
        pathInput,
        folderButton,
        syncButton,
        zipButton,
        zipFileInput,
        zipFileName,
        note,
        report,
        reportSummary,
        reportHelp,
        reportList,
    };

    folderButton.addEventListener('click', handleSillyTavernFolderImport);
    syncButton.addEventListener('click', handleSillyTavernExtensionSync);
    pathInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            void handleSillyTavernFolderImport();
        }
    });

    zipButton.addEventListener('click', () => zipFileInput.click());
    zipFileInput.addEventListener('change', () => {
        const [file] = Array.from(zipFileInput.files ?? []);
        zipFileName.textContent = file?.name || 'No ZIP selected yet.';

        if (file) {
            void handleSillyTavernZipImport(file);
        }
    });

    updateSillyTavernImportInteractivity();
}

function createThemeSliderGroup({ title, valueId, inputId, value, min, max, step, ariaLabel, caption, onInput }) {
    const sliderGroup = createElement('div', { className: 'sb-theme-slider-group' });
    const sliderHeader = createElement('div', { className: 'sb-theme-slider-header' });
    const sliderTitle = createElement('strong', { text: title });
    const sliderValue = createElement('span', { id: valueId, className: 'sb-theme-slider-value' });
    const sliderInput = createElement('input', {
        id: inputId,
        className: 'sb-theme-slider-input',
        attrs: {
            type: 'range',
            min: String(min),
            max: String(max),
            step: String(step),
            value: String(value),
            'aria-label': ariaLabel,
        },
    });
    const sliderCaption = createElement('p', {
        className: 'sb-theme-slider-caption',
        text: caption,
    });

    sliderHeader.append(sliderTitle, sliderValue);
    sliderGroup.append(sliderHeader, sliderInput, sliderCaption);
    sliderInput.addEventListener('input', event => onInput(event.currentTarget?.value));

    return sliderGroup;
}

function createTopbarLabelOption(mode, part) {
    const inputId = `sb-topbar-label-${mode}-${part.id}`;
    const option = createElement('label', {
        className: 'sb-topbar-label-option',
        attrs: {
            for: inputId,
        },
    });
    const checkbox = createElement('input', {
        id: inputId,
        className: 'sb-topbar-label-checkbox',
        attrs: {
            type: 'checkbox',
            'data-sb-topbar-label-mode': mode,
            'data-sb-topbar-label-part': part.id,
        },
    });
    const copy = createElement('span', { className: 'sb-topbar-label-option-copy' });
    const title = createElement('strong', { text: part.label });
    const description = createElement('small', { text: part.description });

    checkbox.addEventListener('change', event => {
        const input = event.currentTarget;
        const isChecked = input instanceof HTMLInputElement ? input.checked : false;

        if (mode === 'mobile') {
            setMobileTopbarLabelPart(part.id, isChecked);
        } else {
            setDesktopTopbarLabelPart(part.id, isChecked);
        }
    });

    copy.append(title, description);
    option.append(checkbox, copy);
    return option;
}

function createShortcutSettingsGroup() {
    const group = createElement('section', {
        className: 'sb-theme-slider-group',
    });

    const heading = createElement('div', { className: 'sb-theme-slider-label' });
    heading.innerHTML = '<strong>Quick Access Shortcuts</strong><br><small>Assign a shell tab to each shortcut button in the top bar.</small>';
    group.appendChild(heading);

    const rows = createElement('div', {
        className: 'sb-shortcut-rows',
    });

    for (const side of ['left', 'right']) {
        const selectId = `sb-shortcut-${side}-select`;
        const row = createElement('div', { className: 'sb-shortcut-row' });

        const label = createElement('label', {
            className: 'sb-shortcut-label',
            attrs: {
                for: selectId,
            },
        });
        label.textContent = side === 'left' ? 'Left' : 'Right';

        const select = createElement('select', {
            id: selectId,
            className: 'sb-shortcut-select',
        });

        const currentTarget = getShortcutTarget(side);
        for (const target of SB_SHORTCUT_TARGETS) {
            const option = createElement('option', {
                attrs: { value: target.value },
            });
            option.textContent = target.label;
            option.selected = target.value === currentTarget;
            select.appendChild(option);
        }

        select.addEventListener('change', () => {
            const key = side === 'left' ? SB_STORAGE_KEYS.shortcutLeft : SB_STORAGE_KEYS.shortcutRight;
            safeSetItem(key, select.value);
            updateShortcutButton(side);
        });

        row.append(label, select);
        rows.appendChild(row);
    }

    group.appendChild(rows);
    return group;
}

function updateShortcutButton(side) {
    const buttonId = side === 'left' ? 'sb-shortcut-left' : 'sb-shortcut-right';
    const button = document.getElementById(buttonId);
    if (!(button instanceof HTMLElement)) return;

    const config = getShortcutConfig(getShortcutTarget(side));
    const icon = button.querySelector('i');
    const span = button.querySelector('span');

    if (icon) {
        icon.className = `fa-solid ${config.icon}`;
    }
    if (span) {
        span.textContent = config.label;
    }
    button.title = `Quick access: ${config.label}`;
    button.setAttribute('aria-label', `Quick access: ${config.label}`);
}

function createTopbarLabelSettingsGroup() {
    const group = createElement('section', {
        className: 'sb-theme-slider-group sb-topbar-label-group',
    });
    const header = createElement('div', { className: 'sb-topbar-label-header' });
    const title = createElement('strong', { text: 'Top Bar Label' });
    const description = createElement('p', {
        className: 'sb-theme-slider-caption',
        text: 'Choose what the center label shows. Desktop can mix multiple parts with a middle dot, while mobile keeps one selection at a time.',
    });
    const desktopSection = createElement('div', { className: 'sb-topbar-label-section sb-desktop-setting' });
    const desktopHeading = createElement('div', { className: 'sb-topbar-label-section-heading' });
    const desktopTitle = createElement('strong', { text: 'Desktop' });
    const desktopDescription = createElement('small', { text: 'Pick any combination you want.' });
    const desktopGrid = createElement('div', { className: 'sb-topbar-label-option-grid' });
    const mobileSection = createElement('div', { className: 'sb-topbar-label-section sb-mobile-setting' });
    const mobileHeading = createElement('div', { className: 'sb-topbar-label-section-heading' });
    const mobileTitle = createElement('strong', { text: 'Mobile' });
    const mobileDescription = createElement('small', { text: 'Pick one option at a time.' });
    const mobileGrid = createElement('div', { className: 'sb-topbar-label-option-grid' });
    const customTextField = createElement('label', {
        className: 'sb-topbar-custom-text-field',
        attrs: {
            for: 'sb-topbar-custom-text-input',
        },
    });
    const customTextHeading = createElement('div', { className: 'sb-topbar-label-section-heading' });
    const customTextTitle = createElement('strong', { text: 'Custom Text Value' });
    const customTextDescription = createElement('small', { text: 'This only appears in the top bar when the Custom Text checkbox is enabled above.' });
    const customTextInput = createElement('input', {
        id: 'sb-topbar-custom-text-input',
        className: 'text_pole sb-topbar-custom-text-input',
        attrs: {
            type: 'text',
            maxlength: String(SB_TOPBAR_LABEL_CUSTOM_TEXT_MAX_LENGTH),
            placeholder: 'SillyBunny',
            'aria-label': 'Top bar custom text',
        },
    });

    customTextInput.addEventListener('input', event => {
        const input = event.currentTarget;
        setTopbarCustomText(input instanceof HTMLInputElement ? input.value : '');
    });

    header.append(title, description);
    desktopHeading.append(desktopTitle, desktopDescription);
    mobileHeading.append(mobileTitle, mobileDescription);
    customTextHeading.append(customTextTitle, customTextDescription);

    for (const part of SB_TOPBAR_LABEL_PARTS) {
        desktopGrid.appendChild(createTopbarLabelOption('desktop', part));
        mobileGrid.appendChild(createTopbarLabelOption('mobile', part));
    }

    desktopSection.append(desktopHeading, desktopGrid);
    mobileSection.append(mobileHeading, mobileGrid);
    customTextField.append(customTextHeading, customTextInput);
    group.append(header, desktopSection, mobileSection, customTextField);

    return group;
}

function injectThemePicker() {
    if (document.getElementById('sb-theme-card')) {
        updateThemePickerUi();
        return;
    }

    const themeBlock = document.getElementById('UI-presets-block');
    if (!(themeBlock instanceof HTMLElement)) {
        return;
    }

    const card = createElement('div', { id: 'sb-theme-card', className: 'sb-theme-card' });
    const header = createElement('div', { className: 'sb-theme-card-header' });
    const title = createElement('strong', { text: 'Shell Style' });
    const description = createElement('p', { text: 'Switch the navigation shell between three built-in visual directions.' });
    const optionRow = createElement('div', { className: 'sb-theme-option-row' });
    const surfaceSliderGroup = createThemeSliderGroup({
        title: 'Background Visibility',
        valueId: 'sb-surface-transparency-value',
        inputId: 'sb-surface-transparency-input',
        value: sbState.surfaceTransparency,
        min: SB_SURFACE_TRANSPARENCY.min,
        max: SB_SURFACE_TRANSPARENCY.max,
        step: SB_SURFACE_TRANSPARENCY.step,
        ariaLabel: 'Background visibility',
        caption: 'Higher values make the home and chat surfaces more transparent so your selected background picture shows through.',
        onInput: nextValue => setSurfaceTransparency(nextValue),
    });
    const bottomBarSliderGroup = createThemeSliderGroup({
        title: 'Bottom Bar Size',
        valueId: 'sb-bottom-bar-scale-value',
        inputId: 'sb-bottom-bar-scale-input',
        value: sbState.bottomBarScale,
        min: SB_TOPBAR_SCALE.min,
        max: SB_TOPBAR_SCALE.max,
        step: SB_TOPBAR_SCALE.step,
        ariaLabel: 'Bottom bar size',
        caption: 'Resize the bottom chat bar, send form, and action buttons without editing CSS.',
        onInput: nextValue => setBottomBarScale(nextValue),
    });
    const mobileButtonSliderGroup = createThemeSliderGroup({
        title: 'Mobile Button Size',
        valueId: 'sb-mobile-button-scale-value',
        inputId: 'sb-mobile-button-scale-input',
        value: sbState.mobileButtonScale,
        min: SB_TOPBAR_SCALE.min,
        max: SB_TOPBAR_SCALE.max,
        step: SB_TOPBAR_SCALE.step,
        ariaLabel: 'Mobile button size',
        caption: 'Increase or decrease the mobile nav and mobile chat tool buttons without changing desktop controls.',
        onInput: nextValue => setMobileButtonScale(nextValue),
    });
    const topbarLabelSettingsGroup = createTopbarLabelSettingsGroup();
    const shortcutSettingsGroup = createShortcutSettingsGroup();
    header.append(title, description);

    for (const theme of SB_THEMES) {
        const button = createElement('button', {
            className: 'sb-theme-option',
            attrs: {
                type: 'button',
                'data-sb-theme-option': theme.id,
            },
        });

        button.innerHTML = `
            <span class="sb-theme-option-label">${theme.label}</span>
            <span class="sb-theme-option-meta">${theme.description}</span>
        `;

        button.addEventListener('click', () => setShellTheme(theme.id));
        optionRow.appendChild(button);
    }

    getMessageStyleSelect()?.addEventListener('change', updateThemePickerUi);
    document.addEventListener('sb:chat-style-updated', updateThemePickerUi);

    card.append(header, optionRow, surfaceSliderGroup, bottomBarSliderGroup, mobileButtonSliderGroup, topbarLabelSettingsGroup, shortcutSettingsGroup);
    themeBlock.prepend(card);
    updateThemePickerUi();
}

function updateThemePickerUi() {
    const sliderInput = document.getElementById('sb-surface-transparency-input');
    const sliderValue = document.getElementById('sb-surface-transparency-value');
    const desktopTopbarScaleInput = document.getElementById('sb-topbar-scale-desktop-input');
    const desktopTopbarScaleValue = document.getElementById('sb-topbar-scale-desktop-value');
    const bottomBarScaleInput = document.getElementById('sb-bottom-bar-scale-input');
    const bottomBarScaleValue = document.getElementById('sb-bottom-bar-scale-value');
    const mobileButtonScaleInput = document.getElementById('sb-mobile-button-scale-input');
    const mobileButtonScaleValue = document.getElementById('sb-mobile-button-scale-value');
    const customTextInput = document.getElementById('sb-topbar-custom-text-input');

    for (const button of document.querySelectorAll('[data-sb-theme-option]')) {
        const themeId = button.getAttribute('data-sb-theme-option');
        const isActive = themeId === sbState.theme;
        button.classList.toggle('is-selected', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    }

    if (sliderInput instanceof HTMLInputElement) {
        sliderInput.value = String(sbState.surfaceTransparency);
    }

    if (sliderValue instanceof HTMLElement) {
        sliderValue.textContent = formatSurfaceTransparency(sbState.surfaceTransparency);
    }

    if (desktopTopbarScaleInput instanceof HTMLInputElement) {
        desktopTopbarScaleInput.value = String(sbState.topbarScale.desktop);
    }

    if (desktopTopbarScaleValue instanceof HTMLElement) {
        desktopTopbarScaleValue.textContent = formatTopbarScale(sbState.topbarScale.desktop);
    }

    if (bottomBarScaleInput instanceof HTMLInputElement) {
        bottomBarScaleInput.value = String(sbState.bottomBarScale);
    }

    if (bottomBarScaleValue instanceof HTMLElement) {
        bottomBarScaleValue.textContent = formatTopbarScale(sbState.bottomBarScale);
    }

    if (mobileButtonScaleInput instanceof HTMLInputElement) {
        mobileButtonScaleInput.value = String(sbState.mobileButtonScale);
    }

    if (mobileButtonScaleValue instanceof HTMLElement) {
        mobileButtonScaleValue.textContent = formatTopbarScale(sbState.mobileButtonScale);
    }

    for (const input of document.querySelectorAll('[data-sb-topbar-label-mode][data-sb-topbar-label-part]')) {
        if (!(input instanceof HTMLInputElement)) {
            continue;
        }

        const mode = input.getAttribute('data-sb-topbar-label-mode');
        const partId = normalizeTopbarLabelPart(input.getAttribute('data-sb-topbar-label-part'));
        const isChecked = mode === 'mobile'
            ? sbState.topbarLabel.mobilePart === partId
            : sbState.topbarLabel.desktopParts.includes(partId);

        input.checked = isChecked;
        input.closest('.sb-topbar-label-option')?.classList.toggle('is-selected', isChecked);
    }

    if (customTextInput instanceof HTMLInputElement && customTextInput.value !== sbState.topbarLabel.customText) {
        customTextInput.value = sbState.topbarLabel.customText;
    }

    for (const button of document.querySelectorAll('[data-sb-message-style]')) {
        const isActive = button.getAttribute('data-sb-message-style') === getCurrentMessageStyle();
        button.classList.toggle('is-selected', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    }
}

function createSearchIndex(tabState) {
    const searchRoot = tabState.searchRoot;
    if (!(searchRoot instanceof HTMLElement)) {
        return [];
    }

    const entries = [];
    const seen = new Set();

    for (const element of searchRoot.querySelectorAll(SB_SEARCH_TARGET_SELECTOR)) {
        if (!(element instanceof HTMLElement)) {
            continue;
        }

        if (element.closest('.sb-search-result, .sb-theme-card, #settingsSearch')) {
            continue;
        }

        const sectionLabel = getSearchSectionLabel(element, tabState.label);
        const searchText = getSearchText(element, sectionLabel);
        const displayText = getSearchDisplayText(element, sectionLabel);
        const dedupeKey = getSearchEntryDedupeKey(tabState, sectionLabel, displayText, { element });

        if (searchText.length < 3 || seen.has(dedupeKey)) {
            continue;
        }

        seen.add(dedupeKey);
        entries.push({
            element,
            searchText,
            displayText,
            sectionLabel,
            tabId: tabState.id,
            tabLabel: tabState.label,
            dedupeKey,
        });
    }

    return entries;
}

/**
 * Returns synthetic search entries for all personas from power_user.personas.
 * These are not in the DOM in a searchable form (paginated list), so we read
 * the data directly and provide an action that navigates to the persona.
 */
function getPersonaSearchEntries(tabState) {
    const context = getSillyTavernContext();
    const personas = context?.powerUserSettings?.personas ?? {};
    const personaDescriptions = context?.powerUserSettings?.persona_descriptions ?? {};
    const defaultPersona = context?.powerUserSettings?.default_persona ?? '';
    const entries = [];

    for (const [avatarId, name] of Object.entries(personas)) {
        if (!name || name === '[Unnamed Persona]') continue;
        const personaDescription = personaDescriptions[avatarId]?.description ?? '';
        const personaTitle = personaDescriptions[avatarId]?.title ?? '';
        const searchText = normalizeText([
            name,
            avatarId,
            personaTitle,
            personaDescription,
            avatarId === defaultPersona ? 'default persona' : '',
        ].join(' '));

        if (searchText.length < 2) continue;

        entries.push({
            element: null,
            searchText,
            displayText: name,
            sectionLabel: 'Persona',
            tabId: tabState.id,
            tabLabel: tabState.label,
            dedupeKey: getSearchEntryDedupeKey(tabState, 'Persona', name, { avatarId }),
            action: () => {
                // Activate the persona tab and trigger ST's own persona search
                openShell('right', 'persona');
                window.setTimeout(() => {
                    const searchInput = document.getElementById('persona_search_bar');
                    if (searchInput instanceof HTMLInputElement) {
                        searchInput.value = name;
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, 80);
            },
        });
    }

    return entries;
}

function getSearchSectionLabel(element, fallback) {
    // For extension containers: use the extension's own name/header, not the parent tab label
    const extContainer = element.closest('.extension_container, [id$="-container"]');
    if (extContainer instanceof HTMLElement) {
        const extName = extContainer.querySelector('.extension_name')
            ?? extContainer.querySelector(':scope > .inline-drawer > .inline-drawer-toggle b, :scope > .inline-drawer > .inline-drawer-header b')
            ?? extContainer.querySelector(':scope > .inline-drawer > .inline-drawer-toggle, :scope > .inline-drawer > .inline-drawer-header')
            ?? extContainer.querySelector('h3, h4, strong');
        if (extName) {
            const text = String(extName.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (text) return text;
        }
    }

    // Walk up to the nearest inline-drawer and use its toggle header as the section
    const inlineDrawer = element.closest('.inline-drawer');
    if (inlineDrawer instanceof HTMLElement) {
        const toggle = inlineDrawer.querySelector(':scope > .inline-drawer-toggle');
        if (toggle) {
            const text = String(toggle.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (text && text !== fallback) return text;
        }
    }

    const preferred = element.closest('.persona_management_global_settings')
        ?? element.closest('.bg-header-row-1')
        ?? element.closest('.bg-header-row-2')
        ?? element.closest('label, h3, h4, h5, strong');

    const text = String(preferred?.textContent ?? fallback).replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function renderSearchResults(shellKey, query) {
    const shellState = getShellState(shellKey);
    if (!shellState) {
        return;
    }

    const normalizedQuery = normalizeText(query);
    const assistCopy = getSearchAssistCopy(shellKey, shellState.tabs.get(shellState.activeTabId));
    shellState.searchResults.replaceChildren();

    if (!(shellState.root instanceof HTMLElement) || !shellState.root.classList.contains('openDrawer')) {
        shellState.searchResults.classList.remove('is-visible');
        return;
    }

    if (!normalizedQuery) {
        shellState.searchResults.classList.remove('is-visible');
        return;
    }

    const searchTerms = normalizedQuery.split(' ').filter(Boolean);
    const matches = new Map();

    for (const tabState of shellState.tabs.values()) {
        // Build index once; it's invalidated when the tab activates (content may have changed)
        if (!tabState.searchIndex) {
            tabState.searchIndex = createSearchIndex(tabState);
        }

        // Supplement with persona data entries for the persona tab
        const extraEntries = tabState.id === 'persona' ? getPersonaSearchEntries(tabState) : [];

        for (const entry of [...tabState.searchIndex, ...extraEntries]) {
            if (!searchTerms.every(term => entry.searchText.includes(term))) {
                continue;
            }

            const startsWithQuery = entry.searchText.startsWith(normalizedQuery);
            const exactMatch = entry.searchText === normalizedQuery;
            const match = {
                ...entry,
                score: Number(exactMatch) * 100 + Number(startsWithQuery) * 10 - entry.displayText.length / 1000,
            };
            const matchKey = entry.dedupeKey || [
                entry.tabId,
                normalizeText(entry.sectionLabel),
                normalizeText(entry.displayText),
            ].filter(Boolean).join('::');
            const existingMatch = matches.get(matchKey);
            const shouldReplaceMatch = !existingMatch
                || match.score > existingMatch.score
                || (match.score === existingMatch.score
                    && typeof match.action === 'function'
                    && typeof existingMatch.action !== 'function');

            if (shouldReplaceMatch) {
                matches.set(matchKey, match);
            }
        }
    }

    Array.from(matches.values())
        .sort((left, right) => right.score - left.score)
        .slice(0, 10)
        .forEach(match => {
            const button = createElement('button', {
                className: 'sb-search-result',
                attrs: {
                    type: 'button',
                },
            });
            const detailText = normalizeText(match.displayText) === normalizeText(match.sectionLabel)
                ? `Jump straight to this item in ${match.tabLabel}.`
                : match.displayText;

            // When section label is the same as tab label, show the matched text as primary
            const sectionDisplay = match.sectionLabel === match.tabLabel
                ? match.displayText || match.tabLabel
                : match.sectionLabel;

            button.innerHTML = `
                <strong>${sectionDisplay}</strong>
                ${sectionDisplay !== match.displayText ? `<span>${detailText}</span>` : ''}
                <small>${match.tabLabel}</small>
            `;

            button.addEventListener('click', () => {
                shellState.searchInput.value = '';
                shellState.searchResults.classList.remove('is-visible');
                revealSearchMatch(shellKey, match);
            });

            shellState.searchResults.appendChild(button);
        });

    if (!shellState.searchResults.childElementCount) {
        const empty = createElement('div', { className: 'sb-search-empty' });
        const emptyTitle = createElement('strong', {
            text: query.trim() ? `No matches for "${query.trim()}" yet.` : 'No matches yet.',
        });
        const emptyCopy = createElement('span', {
            text: assistCopy.emptyHint,
        });
        empty.append(emptyTitle, emptyCopy);
        shellState.searchResults.appendChild(empty);
    }

    shellState.searchResults.classList.add('is-visible');
}

function expandHiddenAccordions(target) {
    const hiddenContents = [];
    let current = target.parentElement;

    while (current) {
        if (current.classList.contains('inline-drawer-content') && getComputedStyle(current).display === 'none') {
            hiddenContents.push(current);
        }

        current = current.parentElement;
    }

    for (const content of hiddenContents.reverse()) {
        const toggle = content.previousElementSibling?.classList.contains('inline-drawer-toggle')
            ? content.previousElementSibling
            : content.parentElement?.querySelector(':scope > .inline-drawer-toggle');

        if (toggle instanceof HTMLElement) {
            toggle.click();
        }
    }
}

function pulseSearchTarget(target) {
    document.querySelectorAll('.sb-search-hit').forEach(element => {
        element.classList.remove('sb-search-hit');
    });

    if (!(target instanceof HTMLElement)) {
        return;
    }

    target.classList.add('sb-search-hit');
    window.setTimeout(() => target.classList.remove('sb-search-hit'), 2200);
}

function revealSearchMatch(shellKey, match) {
    // Entries with a custom action (e.g. persona results) bypass DOM scrolling
    if (typeof match.action === 'function') {
        match.action();
        return;
    }

    openShell(shellKey, match.tabId);

    window.setTimeout(() => {
        expandHiddenAccordions(match.element);
        match.element.scrollIntoView({
            block: 'center',
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
        pulseSearchTarget(match.element);
    }, 40);
}

function setActiveTab(shellKey, tabId, { focusButton = false } = {}) {
    const shellState = getShellState(shellKey);
    const shellConfig = getShellConfig(shellKey);

    if (!shellState || !shellState.tabs.has(tabId)) {
        return;
    }

    const previousTab = shellState.tabs.get(shellState.activeTabId);
    shellState.activeTabId = tabId;
    safeSetItem(shellConfig.storageKey, tabId);

    for (const [currentTabId, tabState] of shellState.tabs.entries()) {
        const isActive = currentTabId === tabId;
        tabState.button?.classList.toggle('is-active', isActive);
        tabState.button?.setAttribute('aria-selected', String(isActive));
        tabState.button?.setAttribute('tabindex', isActive ? '0' : '-1');
        tabState.panel.classList.toggle('sb-shell-panel-active', isActive);
        tabState.panel.setAttribute('aria-hidden', String(!isActive));
        // Invalidate search index when switching to a tab so stale DOM isn't searched
        if (isActive) tabState.searchIndex = null;
    }

    const activeTab = shellState.tabs.get(tabId);
    shellState.headerTitle.textContent = activeTab.label;
    shellState.headerSubtitle.textContent = activeTab.description;
    updateShellSearchAssist(shellKey);
    activeTab.button?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: focusButton ? 'smooth' : 'auto',
    });
    shellState.updateNavScrollIndicators?.();

    if (focusButton) {
        activeTab.button?.focus();
    }

    if (previousTab && previousTab.id !== activeTab.id) {
        previousTab.onDeactivate?.();
    }

    activeTab.onActivate?.();
    const shellRoot = document.getElementById(shellConfig.rootPanelId);
    if (shellRoot instanceof HTMLElement && shellRoot.classList.contains('openDrawer')) {
        dispatchShellTabActivated(shellKey, activeTab);
    }

    if (shellState.searchInput instanceof HTMLInputElement && shellState.searchInput.value.trim()) {
        renderSearchResults(shellKey, shellState.searchInput.value);
    }
}

function openShell(shellKey, tabId = null) {
    const shellConfig = getShellConfig(shellKey);
    const shellState = getShellState(shellKey);
    const shellRoot = document.getElementById(shellConfig.rootPanelId);

    if (!shellState || !(shellRoot instanceof HTMLElement)) {
        return;
    }

    closeMobileNav();

    if (tabId) {
        setActiveTab(shellKey, tabId);
    }

    shellState.lastOpenedAt = performance.now();

    if (isDrawerActuallyOpen(shellRoot)) {
        return;
    }

    if (shellRoot.classList.contains('openDrawer')) {
        forceDrawerState(shellRoot, true, shellConfig.hostIconSelector);
        return;
    }

    if (!shellRoot.classList.contains('openDrawer')) {
        triggerDrawerToggle(shellConfig.hostToggleSelector);
        window.requestAnimationFrame(() => {
            if (!isDrawerActuallyOpen(shellRoot)) {
                forceDrawerState(shellRoot, true, shellConfig.hostIconSelector);
            }
        });
    }
}

function closeShell(shellKey) {
    const shellConfig = getShellConfig(shellKey);
    const shellState = getShellState(shellKey);
    const shellRoot = document.getElementById(shellConfig.rootPanelId);

    if (!(shellRoot instanceof HTMLElement) || !shellRoot.classList.contains('openDrawer')) {
        return;
    }

    shellState?.tabs.get(shellState.activeTabId)?.onDeactivate?.();
    clearShellSearch(shellKey);

    if (!isDrawerActuallyOpen(shellRoot)) {
        forceDrawerState(shellRoot, false, shellConfig.hostIconSelector);
        return;
    }

    if (document.activeElement instanceof HTMLElement && shellRoot.contains(document.activeElement)) {
        document.activeElement.blur();
    }

    // Managed shells do not need the legacy drawer toggle close animation.
    forceDrawerState(shellRoot, false, shellConfig.hostIconSelector);
}

function buildShell(shellKey) {
    const shellConfig = getShellConfig(shellKey);
    const shellRoot = document.getElementById(shellConfig.rootPanelId);

    if (!(shellRoot instanceof HTMLElement) || shellRoot.dataset.sbShellReady === 'true') {
        return;
    }

    shellRoot.dataset.sbShellReady = 'true';
    shellRoot.dataset.sbShellKey = shellKey;
    shellRoot.classList.add('sb-shell-root', `sb-shell-root-${shellKey}`);

    if (shellKey === 'right') {
        shellRoot.classList.add('fillRight');
    }

    const originalContent = createElement('div', { className: 'sb-shell-column' });
    moveChildrenIntoContainer(shellRoot, originalContent);
    originalContent.querySelector('#settingsSearch')?.classList.add('sb-legacy-search-hidden');

    const frame = createElement('div', { className: 'sb-shell-frame' });
    const navWrapper = createElement('div', { className: 'sb-shell-nav-wrapper' });
    const navScrollLeft = createElement('button', {
        className: 'sb-shell-nav-scroll sb-shell-nav-scroll-left',
        attrs: {
            type: 'button',
            'aria-label': `Scroll ${shellConfig.title} sections left`,
        },
    });
    const nav = createElement('nav', {
        className: 'sb-shell-nav',
        attrs: {
            role: 'tablist',
            'aria-label': `${shellConfig.title} sections`,
            'aria-orientation': 'horizontal',
        },
    });
    const navScrollRight = createElement('button', {
        className: 'sb-shell-nav-scroll sb-shell-nav-scroll-right',
        attrs: {
            type: 'button',
            'aria-label': `Scroll ${shellConfig.title} sections right`,
        },
    });
    navScrollLeft.innerHTML = '<i class="fa-solid fa-chevron-left" aria-hidden="true"></i>';
    navScrollRight.innerHTML = '<i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';
    navWrapper.append(navScrollLeft, nav, navScrollRight);

    const scrollNavByPage = direction => {
        nav.scrollBy({
            left: direction * Math.max(nav.clientWidth * 0.72, 160),
            behavior: 'smooth',
        });
    };

    const updateNavScrollIndicators = () => {
        const canScrollLeft = nav.scrollLeft > 0;
        const canScrollRight = Math.ceil(nav.scrollLeft + nav.clientWidth) < nav.scrollWidth;
        navWrapper.classList.toggle('sb-can-scroll-left', canScrollLeft);
        navWrapper.classList.toggle('sb-can-scroll-right', canScrollRight);
        navScrollLeft.disabled = !canScrollLeft;
        navScrollRight.disabled = !canScrollRight;
    };

    nav.addEventListener('scroll', updateNavScrollIndicators, { passive: true });
    window.addEventListener('resize', updateNavScrollIndicators, { passive: true });
    navScrollLeft.addEventListener('click', () => scrollNavByPage(-1));
    navScrollRight.addEventListener('click', () => scrollNavByPage(1));

    setTimeout(updateNavScrollIndicators, 100);

    const main = createElement('div', { className: 'sb-shell-main' });
    const header = createElement('div', { className: 'sb-shell-header' });
    const closeButton = createElement('button', {
        className: 'sb-shell-close',
        attrs: {
            type: 'button',
            title: `Close ${shellConfig.title}`,
            'aria-label': `Close ${shellConfig.title}`,
        },
    });
    const eyebrow = createElement('div', { className: 'sb-shell-kicker', text: shellConfig.title });
    const title = createElement('h2', { className: 'sb-shell-title', text: shellConfig.baseTab.label });
    const subtitle = createElement('p', { className: 'sb-shell-subtitle', text: shellConfig.baseTab.description });
    const shellDescription = createElement('p', { className: 'sb-shell-description', text: shellConfig.subtitle });
    const searchWrap = createElement('label', { className: 'sb-shell-search' });
    const searchIcon = createElement('i', { className: 'fa-solid fa-magnifying-glass' });
    const searchInput = createElement('input', {
        className: 'text_pole',
        attrs: {
            type: 'search',
            placeholder: shellConfig.searchPlaceholder,
            'aria-label': shellConfig.searchPlaceholder,
        },
    });
    const searchHint = createElement('p', { className: 'sb-shell-search-note' });
    const searchResults = createElement('div', { className: 'sb-search-results' });
    const panelBody = createElement('div', { className: 'sb-shell-body' });
    const resizeHandle = createElement('div', {
        className: 'sb-shell-resize-handle',
        attrs: {
            'aria-hidden': 'true',
            title: `Resize ${shellConfig.title}`,
        },
    });

    closeButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    closeButton.addEventListener('click', () => closeShell(shellKey));
    stopProxyPointerPropagation(resizeHandle);
    resizeHandle.addEventListener('pointerdown', event => beginShellResize(shellKey, event));

    searchWrap.append(searchIcon, searchInput);
    searchHint.hidden = true;
    header.append(closeButton, eyebrow, title, subtitle, shellDescription, searchWrap, searchHint, searchResults);
    main.append(header, panelBody);
    frame.append(navWrapper, main, resizeHandle);
    shellRoot.appendChild(frame);

    const shellState = {
        activeTabId: shellConfig.defaultTabId,
        lastOpenedAt: 0,
        tabs: new Map(),
        nav,
        headerTitle: title,
        headerSubtitle: subtitle,
        searchInput,
        searchHint,
        searchResults,
        root: shellRoot,
        resizeHandle,
        updateNavScrollIndicators,
    };

    sbState.shells[shellKey] = shellState;

    let wasOpen = shellRoot.classList.contains('openDrawer');
    new MutationObserver(() => {
        const isOpen = shellRoot.classList.contains('openDrawer');

        if (isOpen === wasOpen) {
            return;
        }

        wasOpen = isOpen;

        if (isOpen) {
            shellState.lastOpenedAt = performance.now();
            closeMobileNav();
            const activeTab = shellState.tabs.get(shellState.activeTabId);
            activeTab?.onActivate?.();
            dispatchShellTabActivated(shellKey, activeTab);
            updateNavScrollIndicators();
            return;
        }

        shellState.tabs.get(shellState.activeTabId)?.onDeactivate?.();
        clearShellSearch(shellKey);
    }).observe(shellRoot, { attributes: true, attributeFilter: ['class'] });

    const basePanel = createShellPanel(shellConfig.baseTab);
    basePanel.scroller.appendChild(originalContent);
    registerShellTab(shellKey, shellConfig.baseTab, basePanel);

    for (const embeddedTab of shellConfig.embeddedTabs) {
        const prepared = prepareEmbeddedDrawer(embeddedTab.drawerId);
        if (!prepared) {
            continue;
        }

        const embeddedPanel = createShellPanel(embeddedTab);
        embeddedPanel.scroller.appendChild(prepared.drawer);
        registerShellTab(shellKey, embeddedTab, embeddedPanel, prepared.drawerContent);
    }

    for (const customTab of shellConfig.customTabs) {
        if (customTab.id === 'agents') {
            const agentPanel = buildInChatAgentsPanel();
            registerShellTab(shellKey, customTab, agentPanel, agentPanel.searchRoot);
            continue;
        }

        if (customTab.id === 'server') {
            const serverPanel = buildServerAdminPanel();
            registerShellTab(shellKey, customTab, serverPanel, serverPanel.searchRoot);
            continue;
        }

        if (customTab.id === 'console-logs') {
            const consoleLogsPanel = buildConsoleLogsPanel();
            registerShellTab(shellKey, customTab, consoleLogsPanel, consoleLogsPanel.searchRoot);
        }
    }

    panelBody.append(...Array.from(shellState.tabs.values()).map(tabState => tabState.panel));

    const storedTabId = safeGetItem(shellConfig.storageKey);
    const nextActiveTab = shellState.tabs.has(storedTabId) ? storedTabId : shellConfig.defaultTabId;
    setActiveTab(shellKey, nextActiveTab);

    searchInput.addEventListener('input', () => renderSearchResults(shellKey, searchInput.value));
    searchInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            const firstMatch = searchResults.querySelector('.sb-search-result');
            if (firstMatch instanceof HTMLElement) {
                event.preventDefault();
                firstMatch.click();
            }
        }

        if (event.key === 'Escape') {
            searchInput.value = '';
            searchResults.classList.remove('is-visible');
        }
    });

    if (shellKey === 'right') {
        injectThemePicker();
        injectSillyTavernImportCard();
    }
}

function registerShellTab(shellKey, tabConfig, panelBundle, explicitSearchRoot = null) {
    const shellState = getShellState(shellKey);

    if (!shellState) {
        return;
    }

    const button = createElement('button', {
        className: 'sb-shell-tab',
        attrs: {
            type: 'button',
            role: 'tab',
            tabindex: '-1',
            'aria-selected': 'false',
            'data-sb-tab': tabConfig.id,
        },
    });

    button.innerHTML = `
        <i class="fa-solid ${tabConfig.icon}" aria-hidden="true"></i>
        <span class="sb-shell-tab-copy">
            <strong>${tabConfig.label}</strong>
        </span>
    `;

    button.addEventListener('click', () => {
        setActiveTab(shellKey, tabConfig.id, { focusButton: false });
        openShell(shellKey);
    });

    button.addEventListener('keydown', event => {
        const buttons = Array.from(shellState.nav.querySelectorAll('.sb-shell-tab'));
        const currentIndex = buttons.indexOf(button);

        if (currentIndex === -1) {
            return;
        }

        const lastIndex = buttons.length - 1;
        let nextIndex = currentIndex;

        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
        } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = lastIndex;
        } else {
            return;
        }

        event.preventDefault();
        const nextButton = buttons[nextIndex];
        const nextTabId = nextButton?.getAttribute('data-sb-tab');

        if (nextTabId) {
            setActiveTab(shellKey, nextTabId, { focusButton: true });
        }
    });

    shellState.nav.appendChild(button);
    shellState.updateNavScrollIndicators?.();
    shellState.tabs.set(tabConfig.id, {
        ...tabConfig,
        button,
        panel: panelBundle.panel,
        searchRoot: explicitSearchRoot ?? panelBundle.searchRoot ?? panelBundle.scroller,
        searchIndex: null,
        onActivate: panelBundle.onActivate ?? tabConfig.onActivate ?? null,
        onDeactivate: panelBundle.onDeactivate ?? tabConfig.onDeactivate ?? null,
    });
}

function routeDrawerTarget(targetId) {
    const route = SB_DRAWER_ROUTES[targetId];
    if (!route) {
        return false;
    }

    openShell(route.shell, route.tab);
    return true;
}

function dispatchShellTabActivated(shellKey, tabState) {
    if (!tabState) {
        return;
    }

    document.dispatchEvent(new CustomEvent('sb:shell-tab-activated', {
        detail: {
            shellKey,
            tabId: tabState.id,
            label: tabState.label,
        },
    }));
}

function interceptDrawerOpeners() {
    document.addEventListener('click', event => {
        const opener = event.target instanceof Element ? event.target.closest('.drawer-opener') : null;
        const targetId = opener?.getAttribute('data-target');

        if (!targetId || !routeDrawerTarget(targetId)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
    }, true);

    // Collapse sibling inline-drawers when one is opened — prevents nested
    // dropdown clutter by keeping only one drawer open per container at a time.
    document.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;
        const toggle = event.target.closest('.inline-drawer-toggle');
        if (!toggle) return;
        if (!sbState.inlineDrawerAutoClose) return;

        const thisDrawer = toggle.closest('.inline-drawer');
        if (!thisDrawer) return;

        // Only collapse if this toggle is about to OPEN (icon currently points down = closed)
        const icon = thisDrawer.querySelector(':scope > .inline-drawer-header .inline-drawer-icon');
        const isCurrentlyClosed = icon?.classList.contains('fa-circle-chevron-down');
        if (!isCurrentlyClosed) return;

        // Find sibling inline-drawers in the same parent and close any that are open
        const parent = thisDrawer.parentElement;
        if (!parent) return;

        parent.querySelectorAll(':scope > .inline-drawer').forEach(sibling => {
            if (sibling === thisDrawer) return;
            const siblingIcon = sibling.querySelector(':scope > .inline-drawer-header .inline-drawer-icon');
            const siblingContent = sibling.querySelector(':scope > .inline-drawer-content');
            if (!siblingIcon?.classList.contains('fa-circle-chevron-up')) return;

            // Close it — mirror what ST's handler does
            siblingIcon.classList.replace('fa-circle-chevron-up', 'fa-circle-chevron-down');
            siblingIcon.classList.replace('up', 'down');
            if (window.jQuery && siblingContent) {
                window.jQuery(siblingContent).stop().slideUp();
            } else {
                siblingContent?.style.setProperty('display', 'none');
            }
        });
    }, true);
}

function bindInlineDrawerAutoCloseToggle() {
    const checkbox = document.getElementById('sb_auto_close_inline_drawers');
    if (!(checkbox instanceof HTMLInputElement)) {
        return;
    }

    checkbox.checked = sbState.inlineDrawerAutoClose;

    if (checkbox.dataset.sbBound === 'true') {
        return;
    }

    checkbox.addEventListener('change', () => {
        sbState.inlineDrawerAutoClose = checkbox.checked;
        safeSetItem(SB_STORAGE_KEYS.settingsDrawerAutoClose, String(sbState.inlineDrawerAutoClose));
    });

    checkbox.dataset.sbBound = 'true';
}

function bindWorldInfoRoute() {
    if (!window.jQuery) {
        return;
    }

    window.jQuery('#WIDrawerIcon').on('click.sbShellRoute', function (event) {
        const leftShell = getShellState('left');
        const leftRoot = document.getElementById(getShellConfig('left').rootPanelId);
        const worldInfoPanel = document.getElementById('WorldInfo');

        if (!leftShell || !(leftRoot instanceof HTMLElement)) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        const worldInfoVisible = leftRoot.classList.contains('openDrawer')
            && leftShell.activeTabId === 'world-info'
            && isActuallyVisible(worldInfoPanel);

        if (worldInfoVisible) {
            closeShell('left');
        } else {
            openShell('left', 'world-info');
        }

        return false;
    });
}

function buildMobileNav() {
    if (document.getElementById('sb-mobile-nav')) {
        return;
    }

    const overlay = createElement('div', { id: 'sb-mobile-nav' });
    const content = createElement('div', { id: 'sb-mobile-nav-content' });
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');

    if ('inert' in overlay) {
        overlay.inert = true;
    }

    const sections = [
        {
            label: 'Quick Actions',
            items: [
                { shell: 'left', tab: 'presets', icon: 'fa-sliders', label: 'Presets' },
                { shell: 'left', tab: 'api', icon: 'fa-plug', label: 'API' },
                { shell: 'left', tab: 'advanced-formatting', icon: 'fa-font', label: 'Advanced Formatting' },
                { shell: 'left', tab: 'world-info', icon: 'fa-book-atlas', label: 'World Info' },
                { shell: 'left', tab: 'agents', icon: 'fa-robot', label: 'Agents' },
            ],
        },
    ];

    for (const section of sections) {
        const sectionBlock = createElement('section', { className: 'sb-mobile-section' });
        const heading = createElement('strong', { className: 'sb-mobile-section-title', text: section.label });
        const list = createElement('div', { className: 'sb-mobile-section-list' });

        for (const item of section.items) {
            const button = createElement('button', {
                className: 'sb-nav-item',
                attrs: {
                    type: 'button',
                },
            });

            button.innerHTML = `<i class="fa-solid ${item.icon}" aria-hidden="true"></i><span>${item.label}</span>`;

            button.addEventListener('click', () => {
                closeMobileNav();

                if (item.action === 'home') {
                    void returnToLandingPage();
                } else if (item.action === 'chat-tools') {
                    openMobileChatTools();
                } else if (item.action === 'characters') {
                    toggleCharacterPanel();
                } else {
                    toggleShellPanel(item.shell, item.tab);
                }
            });

            list.appendChild(button);
        }

        sectionBlock.append(heading, list);
        content.appendChild(sectionBlock);
    }

    overlay.appendChild(content);
    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            closeMobileNav();
        }
    });

    document.body.appendChild(overlay);

    // Auto-close mobile nav when clicking on main content areas
    const autoCloseSelectors = [
        '#send_textarea',
        '#send_but',
        '.mes',
        '#chat',
        '.drawer-content',
    ];

    document.addEventListener('click', event => {
        if (!overlay.classList.contains('sb-nav-open')) {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        // Don't close if clicking the hamburger button itself
        if (target.closest('#sb-hamburger')) {
            return;
        }

        // Don't close if clicking inside the mobile nav
        if (target.closest('#sb-mobile-nav')) {
            return;
        }

        // Close if clicking any of the auto-close areas
        for (const selector of autoCloseSelectors) {
            if (target.matches(selector) || target.closest(selector)) {
                closeMobileNav();
                return;
            }
        }
    }, { passive: false });
}

function setMobileNavOpenState(isOpen) {
    const overlay = ensureMobileNavReady();
    const button = document.getElementById('sb-hamburger');
    const shouldOpen = Boolean(isOpen) && isMobileViewport();

    if (!(overlay instanceof HTMLElement) || !(button instanceof HTMLElement)) {
        return;
    }

    overlay.hidden = !shouldOpen;
    overlay.classList.toggle('sb-nav-open', shouldOpen);
    overlay.setAttribute('aria-hidden', String(!shouldOpen));

    if ('inert' in overlay) {
        overlay.inert = !shouldOpen;
    }

    button.classList.toggle('is-open', shouldOpen);
    button.setAttribute('aria-expanded', String(shouldOpen));
    button.innerHTML = shouldOpen
        ? '<i class="fa-solid fa-xmark" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
}

function toggleMobileNav() {
    const overlay = ensureMobileNavReady();

    if (!(overlay instanceof HTMLElement)) {
        return;
    }

    const isOpen = !overlay.hidden && overlay.getAttribute('aria-hidden') === 'false';

    // If opening mobile nav, close any open shells first
    if (!isOpen) {
        closeShell('left');
        closeShell('right');
        closeCharacterPanel();
        closeMobileChatTools();
        setConnectionStripOpenState(false);
    }

    setMobileNavOpenState(!isOpen);
}

function closeMobileNav() {
    setMobileNavOpenState(false);
}

function injectCharacterCloseButton() {
    const target = document.getElementById('CharListButtonAndHotSwaps');
    if (!(target instanceof HTMLElement) || target.querySelector('#sb-character-mobile-close')) {
        return;
    }

    const button = createElement('button', {
        id: 'sb-character-mobile-close',
        className: 'sb-character-close menu_button menu_button_icon',
        attrs: {
            type: 'button',
            title: 'Close Characters',
            'aria-label': 'Close Characters',
        },
    });

    button.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    button.addEventListener('click', () => {
        if (['character_edit', 'create'].includes(getCharacterPanelMenuType())) {
            showCharacterListView();
            syncChatbarVisibilityState();
            return;
        }

        closeCharacterPanel();
    });
    target.appendChild(button);
}

function bindCharacterEditorExitButton() {
    const button = document.getElementById('sb_character_editor_exit');
    if (!(button instanceof HTMLButtonElement) || button.dataset.sbBound === 'true') {
        return;
    }

    button.dataset.sbBound = 'true';
    button.addEventListener('click', () => {
        showCharacterListView();
        syncChatbarVisibilityState();
    });
}

function setInlineDrawerExpanded(drawer, expand) {
    if (!(drawer instanceof HTMLElement)) {
        return;
    }

    const icon = drawer.querySelector(':scope > .inline-drawer-header .inline-drawer-icon');
    const content = drawer.querySelector(':scope > .inline-drawer-content');

    if (!(icon instanceof HTMLElement) || !(content instanceof HTMLElement)) {
        return;
    }

    icon.classList.toggle('down', !expand);
    icon.classList.toggle('fa-circle-chevron-down', !expand);
    icon.classList.toggle('up', expand);
    icon.classList.toggle('fa-circle-chevron-up', expand);
    content.style.display = expand ? 'block' : 'none';
}

function getLegacySettingsDrawerStorageKey(drawer) {
    const root = document.getElementById('user-settings-block-content');
    if (!(root instanceof HTMLElement) || !(drawer instanceof HTMLElement) || !root.contains(drawer)) {
        return null;
    }

    if (drawer.id) {
        return `${SB_STORAGE_KEYS.settingsDrawerStatePrefix}:${drawer.id}`;
    }

    const drawers = Array.from(root.querySelectorAll('.inline-drawer'));
    const index = drawers.indexOf(drawer);
    return index === -1 ? null : `${SB_STORAGE_KEYS.settingsDrawerStatePrefix}:${index}`;
}

function sanitizeInlineDrawerStorageSegment(value, fallback = 'drawer') {
    const normalizedValue = normalizeText(value)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64);

    return normalizedValue || fallback;
}

function getInlineDrawerHeaderText(drawer) {
    if (!(drawer instanceof HTMLElement)) {
        return '';
    }

    return drawer.querySelector(':scope > .inline-drawer-header b, :scope > .inline-drawer-header strong, :scope > .inline-drawer-header')
        ?.textContent
        ?? '';
}

function getInlineDrawerContextSegment(element) {
    if (!(element instanceof HTMLElement)) {
        return '';
    }

    const elementId = String(element.id || '').trim();
    if (elementId && !elementId.startsWith('select2-') && !/^ui-id-\d+$/i.test(elementId)) {
        return `id:${sanitizeInlineDrawerStorageSegment(elementId, 'scope')}`;
    }

    const worldEntryUid = element.classList.contains('world_entry')
        ? String(element.getAttribute('uid') || element.dataset.uid || '').trim()
        : '';
    if (worldEntryUid) {
        return `world-entry:${sanitizeInlineDrawerStorageSegment(worldEntryUid, 'entry')}`;
    }

    const promptIdentifier = String(element.dataset.pmIdentifier || '').trim();
    if (promptIdentifier) {
        return `prompt:${sanitizeInlineDrawerStorageSegment(promptIdentifier, 'prompt')}`;
    }

    if (element.classList.contains('extension_container')) {
        const extensionName = element.querySelector(':scope > .extension_name, .extension_name')?.textContent ?? '';
        if (extensionName) {
            return `extension:${sanitizeInlineDrawerStorageSegment(extensionName, 'extension')}`;
        }
    }

    return '';
}

function shouldPersistInlineDrawer(drawer) {
    return drawer instanceof HTMLElement
        && !drawer.matches(SB_INLINE_DRAWER_CUSTOM_PERSISTENCE_SELECTOR)
        && !drawer.closest('[data-sb-drawer-persistence="off"]');
}

function getInlineDrawerStorageKey(drawer) {
    if (!shouldPersistInlineDrawer(drawer)) {
        return null;
    }

    const contextSegments = [];
    for (let current = drawer.parentElement; current && current !== document.body; current = current.parentElement) {
        const segment = getInlineDrawerContextSegment(current);
        if (segment) {
            contextSegments.unshift(segment);
        }
    }

    if (!contextSegments.length) {
        return null;
    }

    if (drawer.id) {
        return `${SB_STORAGE_KEYS.settingsDrawerStatePrefix}:${contextSegments.join('/')}:drawer-id:${sanitizeInlineDrawerStorageSegment(drawer.id)}`;
    }

    const siblingInlineDrawers = drawer.parentElement
        ? Array.from(drawer.parentElement.children).filter(element => element instanceof HTMLElement && element.classList.contains('inline-drawer'))
        : [];
    const drawerIndex = Math.max(0, siblingInlineDrawers.indexOf(drawer));
    const drawerLabel = sanitizeInlineDrawerStorageSegment(getInlineDrawerHeaderText(drawer));

    return `${SB_STORAGE_KEYS.settingsDrawerStatePrefix}:${contextSegments.join('/')}:drawer:${drawerLabel}:${drawerIndex}`;
}

function getStoredInlineDrawerExpanded(drawer) {
    const storageKey = getInlineDrawerStorageKey(drawer);
    const storedValue = storageKey ? getPersistentStorageItem(storageKey) : null;

    if (storedValue !== null) {
        return normalizeStoredBoolean(storedValue, false);
    }

    const legacyStorageKey = getLegacySettingsDrawerStorageKey(drawer);
    if (!legacyStorageKey || legacyStorageKey === storageKey) {
        return null;
    }

    const legacyStoredValue = getPersistentStorageItem(legacyStorageKey);
    if (legacyStoredValue === null) {
        return null;
    }

    if (storageKey) {
        setPersistentStorageItem(storageKey, legacyStoredValue);
    }

    return normalizeStoredBoolean(legacyStoredValue, false);
}

function getInlineDrawers(root = document) {
    const drawers = [];

    if (root instanceof HTMLElement && root.classList.contains('inline-drawer')) {
        drawers.push(root);
    }

    if ('querySelectorAll' in root) {
        drawers.push(...root.querySelectorAll('.inline-drawer'));
    }

    return drawers;
}

function bindInlineDrawerPersistence(root = document) {
    for (const drawer of getInlineDrawers(root)) {
        if (!(drawer instanceof HTMLElement) || !shouldPersistInlineDrawer(drawer)) {
            continue;
        }

        const storedExpanded = getStoredInlineDrawerExpanded(drawer);
        if (storedExpanded !== null) {
            setInlineDrawerExpanded(drawer, storedExpanded);
        }

        if (drawer.dataset.sbDrawerPersistenceBound === 'true') {
            continue;
        }

        drawer.addEventListener('inline-drawer-toggle', () => {
            const icon = drawer.querySelector(':scope > .inline-drawer-header .inline-drawer-icon');
            const storageKey = getInlineDrawerStorageKey(drawer);
            if (!(icon instanceof HTMLElement) || !storageKey) {
                return;
            }

            setPersistentStorageItem(storageKey, String(icon.classList.contains('up')));
        });

        drawer.dataset.sbDrawerPersistenceBound = 'true';
    }
}

function queueInlineDrawerPersistenceBind() {
    if (sbInlineDrawerPersistenceQueued) {
        return;
    }

    sbInlineDrawerPersistenceQueued = true;
    window.requestAnimationFrame(() => {
        sbInlineDrawerPersistenceQueued = false;
        bindInlineDrawerPersistence(document.body);
    });
}

function getInlineDrawerPersistenceRoots() {
    return [
        document.getElementById('left-nav-panel'),
        document.getElementById('user-settings-block-content'),
        document.getElementById('WorldInfo'),
        document.getElementById('right-nav-panel'),
    ].filter(element => element instanceof HTMLElement);
}

function ensureInlineDrawerPersistenceObserver() {
    if (sbInlineDrawerPersistenceObserver) {
        return;
    }

    const roots = getInlineDrawerPersistenceRoots();
    if (!roots.length) {
        return;
    }

    sbInlineDrawerPersistenceObserver = new MutationObserver(() => queueInlineDrawerPersistenceBind());
    for (const root of roots) {
        sbInlineDrawerPersistenceObserver.observe(root, { childList: true, subtree: true });
    }
}

function applyDefaultDrawerStates() {
    bindInlineDrawerPersistence(document.body);

    for (const drawerId of ['AppearanceSection', 'ChatCharactersSection']) {
        const drawer = document.getElementById(drawerId);
        if (drawer instanceof HTMLElement && getStoredInlineDrawerExpanded(drawer) === null) {
            setInlineDrawerExpanded(drawer, false);
        }
    }

    ensureInlineDrawerPersistenceObserver();
}

function syncMobileViewportState() {
    if (!isMobileViewport()) {
        closeMobileNav();
        closeMobileChatTools();
    }

    syncDesktopShellSizing();
    applyTopbarOffset();
    syncChatbarVisibilityState();
    updateTopBarBrand();
    scheduleTopbarContextRefresh(0);
}

function reinitSelect2AfterShell() {
    const modelSelectors = [
        '#mancer_model',
        '#model_togetherai_select',
        '#ollama_model',
        '#tabby_model',
        '#llamacpp_model',
        '#model_infermaticai_select',
        '#model_dreamgen_select',
        '#openrouter_model',
        '#vllm_model',
        '#aphrodite_model',
    ];

    if (isMobileViewport()) {
        // On mobile, destroy Select2 (doesn't work on iOS Safari) and add native filter inputs
        for (const selector of modelSelectors) {
            const $el = $(selector);
            if ($el.length && $el.data('select2')) {
                try {
                    $el.select2('destroy');
                } catch {
                    // Ignore
                }
            }
            injectModelFilterInput($el);
        }
    } else {
        // On desktop, reinitialize Select2 after DOM reparenting
        const select2Defaults = { dropdownParent: $(document.body), minimumResultsForSearch: 0 };
        const allSelectors = [...modelSelectors, '.openrouter_quantizations', '.openrouter_providers'];
        for (const selector of allSelectors) {
            const $el = $(selector);
            if ($el.length && $el.data('select2')) {
                try {
                    const config = $el.data('select2').options.options;
                    $el.select2('destroy');
                    $el.select2({ ...select2Defaults, ...config });
                } catch {
                    // Element may not have been initialized yet
                }
            }
        }
    }
}

function injectModelFilterInput($select) {
    if (!$select.length || $select.prev('.sb-model-filter').length) {
        return;
    }

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'sb-model-filter text_pole';
    input.placeholder = 'Filter models...';

    // Store all options for filtering
    const allOptions = Array.from($select[0].options).map(opt => ({
        value: opt.value,
        text: opt.textContent,
        selected: opt.selected,
    }));

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        const select = $select[0];
        const currentValue = select.value;

        // Rebuild options filtered by query
        select.innerHTML = '';
        for (const opt of allOptions) {
            if (!query || opt.text.toLowerCase().includes(query) || opt.value.toLowerCase().includes(query)) {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                option.selected = opt.value === currentValue;
                select.appendChild(option);
            }
        }
    });

    $select.before(input);
}

function buildBottomChatBar() {
    const container = document.getElementById('sb-bottom-chat-bar');
    if (!(container instanceof HTMLElement)) {
        return;
    }

    container.replaceChildren();

    // Persona bubble
    const personaBubble = createElement('button', {
        id: 'sb-persona-bubble',
        attrs: { type: 'button', title: 'Switch persona' },
    });
    personaBubble.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePersonaPicker();
    });
    updatePersonaBubble(personaBubble);

    const chatSelect = createElement('select', {
        id: 'sb-bottom-chat-select',
        attrs: { title: 'Switch chat' },
    });
    chatSelect.addEventListener('change', () => {
        void openChatById(chatSelect.value);
    });

    const newBtn = createElement('button', {
        className: 'sb-bottom-chat-btn',
        attrs: { type: 'button', title: 'New chat' },
    });
    newBtn.innerHTML = '<i class="fa-solid fa-plus" aria-hidden="true"></i>';
    newBtn.addEventListener('click', () => handleNewChat());

    const renameBtn = createElement('button', {
        className: 'sb-bottom-chat-btn',
        attrs: { type: 'button', title: 'Rename chat' },
    });
    renameBtn.innerHTML = '<i class="fa-solid fa-pencil" aria-hidden="true"></i>';
    renameBtn.addEventListener('click', () => handleRenameChat());

    const deleteBtn = createElement('button', {
        className: 'sb-bottom-chat-btn',
        attrs: { type: 'button', title: 'Delete chat' },
    });
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
    deleteBtn.addEventListener('click', () => handleDeleteChat());

    container.append(personaBubble, chatSelect, newBtn, renameBtn, deleteBtn);

    // Store reference for refresh
    sbState.bottomChatBar = { chatSelect, personaBubble };

    // Bind events to refresh the chat select when chats change
    const context = getSillyTavernContext();
    const eventSource = context?.eventSource;
    const eventTypes = context?.eventTypes ?? context?.event_types;

    if (eventSource && eventTypes) {
        const refresh = () => refreshBottomChatSelect();
        const events = [
            eventTypes.APP_READY,
            eventTypes.CHAT_CHANGED,
            eventTypes.CHAT_CREATED,
            eventTypes.GROUP_CHAT_CREATED,
            eventTypes.CHAT_DELETED,
            eventTypes.GROUP_CHAT_DELETED,
        ].filter(Boolean);

        // Check if APP_READY already fired before registering listener
        if (context.appReady || window.SillyTavern?.appReady) {
            // Already ready, trigger refresh immediately
            refresh();
        }

        for (const eventName of new Set(events)) {
            eventSource.on(eventName, refresh);
        }

        // Update persona bubble on persona change, chat change, and app init
        const refreshPersona = () => updatePersonaBubble(personaBubble);
        const personaEvents = [
            eventTypes.PERSONA_CHANGED,
            eventTypes.APP_READY,
            eventTypes.CHAT_CHANGED,
            eventTypes.CHAT_LOADED,
        ].filter(Boolean);

        // Check if APP_READY already fired for persona bubble too
        if (context.appReady || window.SillyTavern?.appReady) {
            refreshPersona();
        }

        for (const eventName of new Set(personaEvents)) {
            eventSource.on(eventName, refreshPersona);
        }
    }

    // Defer initial persona bubble update in case user_avatar isn't ready yet
    setTimeout(() => updatePersonaBubble(personaBubble), 100);

    // Close persona picker when clicking outside
    document.addEventListener('click', (e) => {
        const picker = document.getElementById('sb-persona-picker');
        if (picker && !picker.contains(e.target) && e.target !== personaBubble) {
            picker.remove();
        }
    });

    scheduleBottomChatBarRefresh(0);
}

function scheduleBottomChatBarRefresh(delay = 0) {
    window.clearTimeout(sbState.bottomChatBarRefreshTimer || 0);
    sbState.bottomChatBarRefreshTimer = window.setTimeout(() => {
        sbState.bottomChatBarRefreshTimer = 0;
        void refreshBottomChatSelect();
    }, delay);
}

async function refreshBottomChatSelect() {
    const chatSelect = sbState.bottomChatBar?.chatSelect;
    if (!(chatSelect instanceof HTMLSelectElement)) {
        return;
    }

    const chatContext = getChatUiContext();
    if (!chatContext.context) {
        return;
    }

    const currentChatName = chatContext.chatId;
    chatSelect.replaceChildren();

    // Add placeholder option showing the current chat
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = currentChatName || 'No chat selected';
    placeholder.selected = true;
    chatSelect.appendChild(placeholder);

    if (!chatContext.canBrowseChats) {
        return;
    }

    try {
        const chats = (await getChatFilesForContext(chatContext)).map(chat => chat.fileName);

        chatSelect.replaceChildren();

        for (const chatName of chats) {
            if (!chatName) continue;
            const option = document.createElement('option');
            option.value = chatName;
            option.textContent = chatName;
            option.selected = chatName === currentChatName;
            chatSelect.appendChild(option);
        }

        if (!chats.includes(currentChatName)) {
            const fallback = document.createElement('option');
            fallback.value = '';
            fallback.textContent = currentChatName || 'No chat selected';
            fallback.selected = true;
            chatSelect.prepend(fallback);
        }

        if (chatContext.canBrowseChats && chats.length === 0) {
            const attempts = Number(sbState.bottomChatBarRefreshAttempts ?? 0);
            if (attempts < 30) {
                sbState.bottomChatBarRefreshAttempts = attempts + 1;
                scheduleBottomChatBarRefresh(200 + Math.random() * 50);
            }
        } else {
            sbState.bottomChatBarRefreshAttempts = 0;
        }
    } catch {
        const attempts = Number(sbState.bottomChatBarRefreshAttempts ?? 0);
        if (attempts < 30) {
            sbState.bottomChatBarRefreshAttempts = attempts + 1;
            scheduleBottomChatBarRefresh(250 + Math.random() * 50);
        }
    }
}

function updatePersonaBubble(bubble) {
    if (!(bubble instanceof HTMLElement)) {
        bubble = document.getElementById('sb-persona-bubble');
    }
    if (!bubble) {
        return;
    }

    const { context, currentAvatarId, currentName } = getCurrentPersonaSelection();
    const avatarUrl = currentAvatarId
        ? (context?.getThumbnailUrl?.('persona', currentAvatarId) || `/User Avatars/${currentAvatarId}`)
        : '';

    if (avatarUrl) {
        bubble.style.backgroundImage = `url("${avatarUrl}")`;
    } else {
        bubble.style.backgroundImage = 'none';
    }
    bubble.setAttribute('title', `Persona: ${currentName}`);
}

function quoteSlashCommandArgument(value) {
    return `"${String(value ?? '').replace(/(["\\])/g, '\\$1')}"`;
}

function getCurrentPersonaSelection(context = getSillyTavernContext()) {
    const personas = context?.powerUserSettings?.personas ?? {};
    const selectedAvatarId = document.querySelector('#user_avatar_block .avatar-container.selected[data-avatar-id]')?.getAttribute('data-avatar-id')
        ?? '';
    const currentAvatarId = String(context?.userAvatar ?? '').trim()
        || String(selectedAvatarId).trim()
        || '';
    const currentName = personas[currentAvatarId] || context?.name1 || 'You';

    return {
        context,
        personas,
        currentAvatarId,
        currentName,
    };
}

function togglePersonaPicker() {
    const existing = document.getElementById('sb-persona-picker');
    if (existing) {
        existing.remove();
        return;
    }

    const context = getSillyTavernContext();
    if (!context) return;

    const { personas, currentAvatarId } = getCurrentPersonaSelection(context);
    const personaDescriptions = context?.powerUserSettings?.persona_descriptions ?? {};
    const picker = createElement('div', { id: 'sb-persona-picker' });

    const keys = Object.keys(personas).filter(avatarId => {
        const name = personas[avatarId];
        // Skip auto-created unnamed entries; always show the active persona
        const isActive = avatarId === currentAvatarId;
        return isActive || (name && name !== '[Unnamed Persona]');
    });

    if (!keys.length) {
        const empty = createElement('div', { className: 'sb-persona-option' });
        empty.textContent = 'No personas defined';
        picker.appendChild(empty);
    } else {
        for (const avatarId of keys) {
            const name = personas[avatarId] || avatarId;
            const title = personaDescriptions[avatarId]?.title || '';
            const isActive = avatarId === currentAvatarId;
            addPersonaOption(picker, avatarId, name, title, isActive, context);
        }
    }

    // Position relative to the bubble
    const bubble = document.getElementById('sb-persona-bubble');
    if (bubble) {
        bubble.parentElement.style.position = 'relative';
        bubble.parentElement.appendChild(picker);
    }
}

function addPersonaOption(picker, avatarId, name, title, isActive, context) {
    const option = createElement('div', {
        className: `sb-persona-option${isActive ? ' is-active' : ''}`,
    });

    const img = createElement('img', {
        className: 'sb-persona-option-avatar',
        attrs: {
            src: `/User Avatars/${avatarId}`,
            alt: name,
            loading: 'lazy',
        },
    });
    img.addEventListener('error', () => { img.style.display = 'none'; });

    const label = createElement('span', { className: 'sb-persona-option-name' });
    label.textContent = name;

    if (title) {
        const desc = createElement('span', { className: 'sb-persona-option-description' });
        desc.textContent = title;
        const info = createElement('div', { className: 'sb-persona-option-info' });
        info.append(label, desc);
        option.append(img, info);
    } else {
        option.append(img, label);
    }

    option.addEventListener('click', async () => {
        picker.remove();
        const execSlash = context?.executeSlashCommandsWithOptions;
        let switched = false;
        if (typeof execSlash === 'function') {
            try {
                await execSlash(`/persona-set ${quoteSlashCommandArgument(avatarId)}`);
                switched = true;
            } catch (error) {
                console.warn('[SillyBunny] Persona switch via slash command failed, falling back to DOM selection.', error);
            }
        }

        if (!switched) {
            // Fallback: try clicking the DOM avatar
            const avatarBlock = document.getElementById('user_avatar_block');
            const domAvatar = avatarBlock?.querySelector(`.avatar-container[title="${CSS.escape(avatarId)}"]`);
            if (domAvatar instanceof HTMLElement) {
                domAvatar.click();
            } else {
                openShell('right', 'persona');
            }
        }
        updatePersonaBubble();
    });

    picker.appendChild(option);
}

function initAll() {
    if (sbState.initialized) {
        return;
    }

    const leftShellRoot = document.getElementById(getShellConfig('left').rootPanelId);
    const rightShellRoot = document.getElementById(getShellConfig('right').rootPanelId);
    const topBarRoot = document.getElementById('top-bar');
    const bottomChatBarRoot = document.getElementById('sb-bottom-chat-bar');

    if (!(leftShellRoot instanceof HTMLElement)
        || !(rightShellRoot instanceof HTMLElement)
        || !(topBarRoot instanceof HTMLElement)
        || !(bottomChatBarRoot instanceof HTMLElement)) {
        if (!sbState.initObserver && document.body instanceof HTMLElement) {
            sbState.initObserver = new MutationObserver(() => {
                if (!sbState.initialized) {
                    initAll();
                }
            });
            sbState.initObserver.observe(document.body, { childList: true, subtree: true });
        }

        if (!sbState.initRetryTimer && sbState.initRetryCount < SB_INIT_MAX_RETRIES) {
            sbState.initRetryTimer = window.setTimeout(() => {
                sbState.initRetryTimer = 0;
                sbState.initRetryCount += 1;
                initAll();
            }, SB_INIT_RETRY_DELAY_MS);
        }
        return;
    }

    window.clearTimeout(sbState.initRetryTimer);
    sbState.initRetryTimer = 0;
    sbState.initRetryCount = 0;
    sbState.initObserver?.disconnect();
    sbState.initObserver = null;
    sbState.initialized = true;

    restorePersistedTopbarState();
    seedTopbarScaleDefaults();
    hideHostToggles();
    forceDrawerState(leftShellRoot, false, getShellConfig('left').hostIconSelector);
    forceDrawerState(rightShellRoot, false, getShellConfig('right').hostIconSelector);
    buildShell('left');
    buildShell('right');
    buildMobileNav();
    buildMobileChatTools();
    injectCharacterCloseButton();
    bindCharacterEditorExitButton();
    setShellTheme(sbState.theme, { persist: false });
    setSurfaceTransparency(sbState.surfaceTransparency, { persist: false });
    setTopbarScale('desktop', sbState.topbarScale.desktop, { persist: false });
    setTopbarScale('mobile', sbState.topbarScale.mobile, { persist: false });
    setBottomBarScale(sbState.bottomBarScale, { persist: false });
    setMobileButtonScale(sbState.mobileButtonScale, { persist: false });
    syncDesktopShellSizing();
    buildTopBar();
    bindLandingPageObserver();
    buildBottomChatBar();
    // Refresh again after the current JS task — APP_READY may have already
    // fired before this listener was registered, so the initial call in
    // buildBottomChatBar() may have found no active chat yet.
    scheduleBottomChatBarRefresh(0);
    bindTopbarDragEvents();
    bindChatbarEvents();
    scheduleChatbarRefresh(0);
    interceptDrawerOpeners();
    bindWorldInfoRoute();
    applyDefaultDrawerStates();
    bindInlineDrawerAutoCloseToggle();
    syncMobileViewportState();

    window.addEventListener('resize', syncMobileViewportState, { passive: true });
    window.addEventListener('orientationchange', syncMobileViewportState);

    // Reinitialize Select2 widgets after shell reparents DOM elements.
    // Select2 bindings break when elements are moved in the DOM.
    reinitSelect2AfterShell();

    // Group Advanced Formatting sections into collapsible drawers
    groupAdvancedFormattingIntoDrawers();

    window.SillyBunnyShell = {
        openTab(shellKey, tabId) {
            if (SB_SHELLS[shellKey]) {
                openShell(shellKey, tabId);
            }
        },
        applyTheme(themeId) {
            setShellTheme(themeId);
        },
        setSurfaceTransparency(value) {
            setSurfaceTransparency(value);
        },
        setTopbarScale(mode, value) {
            setTopbarScale(mode, value);
        },
        setMobileButtonScale(value) {
            setMobileButtonScale(value);
        },
        setMessageStyle,
        openChatTools() {
            if (isMobileViewport()) {
                openMobileChatTools();
                return;
            }

            setChatSidebarOpenState(true);
        },
        toggleChatSidebar() {
            toggleChatSidebar();
        },
        toggleMobileChatTools,
        toggleChatbarVisibility() {
            toggleChatbarVisibility();
        },
        resetTopbarPosition() {
            setTopbarOffset({ x: 0, y: 0 });
        },
        getTheme() {
            return sbState.theme;
        },
        getSurfaceTransparency() {
            return sbState.surfaceTransparency;
        },
        getTopbarScale(mode) {
            return mode === 'mobile'
                ? sbState.topbarScale.mobile
                : sbState.topbarScale.desktop;
        },
        getMobileButtonScale() {
            return sbState.mobileButtonScale;
        },
    };
}

// Init shell UI as soon as DOM is ready.
// Also re-trigger on APP_READY as a safety net for slow-loading environments.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    window.setTimeout(initAll, 120);
}

// Safety net: ensure init runs after the full app is ready (covers slow VPS /
// slow networks where DOMContentLoaded fires but scripts haven't set up UI).
const ctx = getSillyTavernContext();
if (ctx?.eventSource && ctx?.event_types) {
    ctx.eventSource.on(ctx.event_types.APP_READY, () => {
        if (!sbState.initialized) {
            initAll();
        }
    });
}
