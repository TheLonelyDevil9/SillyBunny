const SB_STORAGE_KEYS = Object.freeze({
    leftTab: 'sb-left-tab',
    rightTab: 'sb-right-tab',
    theme: 'sb-theme',
    surfaceTransparency: 'sb-surface-transparency',
    topbarScaleDesktop: 'sb-topbar-scale-desktop',
    topbarScaleMobile: 'sb-topbar-scale-mobile',
});

function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch { }
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
const SB_CHATBAR_SEARCH_DEBOUNCE = 220;
const SB_CHAT_SEARCH_MARK_SELECTOR = 'mark[data-sb-chat-search="true"]';

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
        subtitle: 'Model behavior, presets, lore, and agent tools live here.',
        searchPlaceholder: 'Quick find presets, samplers, lorebooks, agents...',
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
                description: 'Configure retrieval, memory, and lorebook helpers in one place.',
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
        searchPlaceholder: 'Quick find themes, personas, backgrounds, extensions...',
        storageKey: SB_STORAGE_KEYS.rightTab,
        defaultTabId: 'settings',
        baseTab: {
            id: 'settings',
            label: 'Settings',
            icon: 'fa-sliders',
            description: 'App behavior, appearance, and quality-of-life controls start here.',
        },
        embeddedTabs: [
            {
                id: 'extensions',
                drawerId: 'extensions-settings-button',
                label: 'Extensions',
                icon: 'fa-cubes',
                description: 'Manage installed tools, optional features, and extension-specific settings.',
            },
            {
                id: 'persona',
                drawerId: 'persona-management-button',
                label: 'Persona',
                icon: 'fa-face-smile',
                description: 'Edit personas, switch identities faster, and manage persona connections.',
            },
            {
                id: 'background',
                drawerId: 'backgrounds-button',
                label: 'Background',
                icon: 'fa-panorama',
                description: 'Set the mood with backgrounds, fitting modes, and quick filtering.',
            },
        ],
        customTabs: [],
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
].join(', ');

const sbState = {
    initialized: false,
    theme: normalizeTheme(safeGetItem(SB_STORAGE_KEYS.theme)),
    surfaceTransparency: normalizeSurfaceTransparency(safeGetItem(SB_STORAGE_KEYS.surfaceTransparency)),
    topbarScale: {
        desktop: normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.topbarScaleDesktop)),
        mobile: normalizeTopbarScale(safeGetItem(SB_STORAGE_KEYS.topbarScaleMobile)),
    },
    shells: {},
    chatbar: {
        desktop: null,
        sidebar: null,
        mobileTools: null,
        searchQuery: '',
        searchTimer: 0,
        refreshTimer: 0,
        refreshToken: 0,
        pendingSearchScroll: false,
        isApplyingSearch: false,
        chatObserver: null,
        sourceObserver: null,
        connectionStripOpen: false,
        sidebarOpen: false,
        mobileToolsOpen: false,
    },
};

function normalizeTheme(themeId) {
    return SB_THEMES.some(theme => theme.id === themeId) ? themeId : 'modern-glass';
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
    const candidates = [
        element.dataset.sbSearchLabel,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.placeholder : '',
        element instanceof HTMLSelectElement ? element.selectedOptions?.[0]?.textContent : '',
        element.matches('.range-block, .range-block-title, .range-block-header')
            ? element.closest('.range-block')?.querySelector('.range-block-title, .range-block-header, label, strong, h4, h5')?.textContent
            : '',
        element.matches('.extension_container, .extension_name')
            ? element.closest('.extension_container')?.querySelector('.inline-drawer-toggle, .inline-drawer-header, .extension_name, h3, h4, strong')?.textContent
            : '',
        element.textContent,
    ];

    return candidates
        .map(candidate => String(candidate ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .filter((candidate, index, collection) => collection.indexOf(candidate) === index);
}

function getSearchDisplayText(element, fallback = '') {
    return clampText(getSearchTextCandidates(element)[0] || fallback, 110);
}

function getSearchText(element, sectionLabel = '') {
    return normalizeText([
        ...getSearchTextCandidates(element),
        sectionLabel,
    ].join(' '));
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

function updateThemeBadge() {
    const badge = document.getElementById('sb-theme-current-label');
    if (!badge) {
        return;
    }

    badge.textContent = getThemeOption(sbState.theme).label;
}

function getSillyTavernContext() {
    return globalThis.SillyTavern?.getContext?.() ?? null;
}

function getTopBarLabel() {
    const context = getSillyTavernContext();
    if (!context) {
        return SB_IDLE_BRAND_LABEL;
    }

    if (context.groupId) {
        const activeGroup = context.groups?.find(group => String(group?.id) === String(context.groupId));
        return activeGroup?.name?.trim() || SB_IDLE_BRAND_LABEL;
    }

    if (context.characterId !== undefined && context.characterId !== null) {
        const activeCharacter = context.characters?.[context.characterId];
        return activeCharacter?.name?.trim() || context.name2?.trim() || SB_IDLE_BRAND_LABEL;
    }

    return SB_IDLE_BRAND_LABEL;
}

function updateTopBarBrand() {
    const title = document.getElementById('sb-topbar-title');
    const brand = document.querySelector('.sb-topbar-brand');

    if (!(title instanceof HTMLElement) || !(brand instanceof HTMLElement)) {
        return;
    }

    const label = getTopBarLabel();
    const isActiveChat = label !== SB_IDLE_BRAND_LABEL;

    title.textContent = label;
    title.title = label;
    title.classList.toggle('is-chat', isActiveChat);
    brand.dataset.brandState = isActiveChat ? 'chat' : 'idle';
}

function bindTopBarBrand() {
    const context = getSillyTavernContext();
    const eventSource = context?.eventSource;
    const eventTypes = context?.eventTypes ?? context?.event_types;

    if (!eventSource || !eventTypes) {
        window.setTimeout(updateTopBarBrand, 180);
        return;
    }

    const refresh = () => window.requestAnimationFrame(updateTopBarBrand);
    const events = [
        eventTypes.APP_READY,
        eventTypes.CHAT_CHANGED,
        eventTypes.CHAT_CREATED,
        eventTypes.GROUP_CHAT_CREATED,
        eventTypes.CHARACTER_EDITED,
        eventTypes.CHARACTER_RENAMED,
        eventTypes.CHARACTER_DELETED,
        eventTypes.GROUP_UPDATED,
        eventTypes.PERSONA_CHANGED,
    ].filter(Boolean);

    for (const eventName of new Set(events)) {
        eventSource.on(eventName, refresh);
    }

    refresh();
}

function stopProxyPointerPropagation(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    const stop = event => {
        event.stopPropagation();
    };

    element.addEventListener('mousedown', stop);
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

    stopProxyPointerPropagation(button);
    button.addEventListener('click', onClick);

    return button;
}

function getChatbarState() {
    return sbState.chatbar;
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
    const chatId = String(context.getCurrentChatId?.() ?? '').trim();
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
    const fileName = String(rawFileName).replace(/\.jsonl$/i, '').trim();

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
        const response = await fetch('/api/characters/chats', {
            method: 'POST',
            headers: getRequestHeadersFromContext(chatContext.context),
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

    const headers = getRequestHeadersFromContext(chatContext.context);

    try {
        const chats = await Promise.all(groupChats.map(async chatId => {
            try {
                const response = await fetch('/api/chats/group/info', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ id: chatId }),
                });

                if (!response.ok) {
                    return normalizeChatInfo({ file_name: chatId });
                }

                return normalizeChatInfo(await response.json());
            } catch {
                return normalizeChatInfo({ file_name: chatId });
            }
        }));

        return sortChatFiles(chats.filter(chat => chat.fileName));
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
    const nextChatId = String(chatId ?? '').trim();
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
    root.style.top = 'calc(var(--sb-topbar-stack-height) + 18px)';
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

function handleRecentChatsToggle() {
    const chatContext = getChatUiContext();

    if (!chatContext.canBrowseChats) {
        return;
    }

    if (isMobileViewport()) {
        openMobileChatTools();
        return;
    }

    toggleChatSidebar();
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

function buildConnectionStrip() {
    const strip = createElement('div', { id: 'sb-connection-strip' });
    const selectField = createChatField({
        id: 'sb-connection-strip-field',
        icon: 'fa-plug',
        title: 'Switch connection profile',
        className: 'is-connection',
    });
    const select = createElement('select', {
        id: 'sb-connection-strip-select',
        className: 'text_pole',
        attrs: {
            'aria-label': 'Switch connection profile',
        },
    });
    const status = createElement('div', { id: 'sb-connection-strip-status', className: 'sb-connection-strip-status' });

    selectField.appendChild(select);
    strip.append(selectField, status);

    select.addEventListener('change', () => {
        syncConnectionProfileSelection(select.value);
    });

    return { strip, select, status };
}

function buildChatBar() {
    const row = createElement('div', { id: 'sb-chatbar' });
    const leading = createElement('div', { className: 'sb-chatbar-cluster sb-chatbar-leading' });
    const chatSelectField = createChatField({
        id: 'sb-chatbar-select-field',
        icon: 'fa-comments',
        title: 'Switch chat',
    });
    const chatSelect = createElement('select', {
        id: 'sb-chatbar-select',
        className: 'text_pole',
        attrs: {
            'aria-label': 'Switch chat',
        },
    });
    const searchField = createChatField({
        id: 'sb-chatbar-search-field',
        icon: 'fa-magnifying-glass',
        title: 'Search current chat',
    });
    const searchInput = createElement('input', {
        id: 'sb-chatbar-search',
        className: 'text_pole',
        attrs: {
            type: 'search',
            placeholder: 'Search this chat...',
            'aria-label': 'Search this chat',
        },
    });
    const searchStatus = createElement('small', { className: 'sb-chatbar-search-status' });

    searchStatus.hidden = true;
    const trailing = createElement('div', { className: 'sb-chatbar-cluster sb-chatbar-actions' });

    const toggleSidebarButton = createTopBarIconButton(
        {
            id: 'sb-chatbar-sidebar-toggle',
            icon: 'fa-box-archive',
            title: 'Toggle recent chats sidebar',
        },
        handleRecentChatsToggle,
    );
    const toggleConnectionButton = createTopBarIconButton(
        {
            id: 'sb-chatbar-connection-toggle',
            icon: 'fa-plug',
            title: 'Show connection profiles',
        },
        handleConnectionProfilesToggle,
    );
    const managerButton = createTopBarIconButton(
        {
            id: 'sb-chatbar-files',
            icon: 'fa-address-book',
            title: 'View chat files',
        },
        handleChatManagerClick,
    );
    const newButton = createTopBarIconButton(
        {
            id: 'sb-chatbar-new',
            icon: 'fa-comments',
            title: 'Start a new chat',
        },
        handleNewChat,
    );
    const renameButton = createTopBarIconButton(
        {
            id: 'sb-chatbar-rename',
            icon: 'fa-pen',
            title: 'Rename this chat',
        },
        () => { void handleRenameChat(); },
    );
    const deleteButton = createTopBarIconButton(
        {
            id: 'sb-chatbar-delete',
            icon: 'fa-trash',
            title: 'Delete this chat',
        },
        () => { void handleDeleteChat(); },
    );
    const closeButton = createTopBarIconButton(
        {
            id: 'sb-chatbar-close',
            icon: 'fa-xmark',
            title: 'Close this chat',
        },
        () => { void handleCloseChat(); },
    );

    chatSelectField.appendChild(chatSelect);
    searchField.append(searchInput, searchStatus);
    leading.append(toggleSidebarButton, toggleConnectionButton);
    trailing.append(managerButton, newButton, renameButton, deleteButton, closeButton);
    row.append(leading, chatSelectField, searchField, trailing);

    const connectionStrip = buildConnectionStrip();

    chatSelect.addEventListener('change', () => {
        void openChatById(chatSelect.value);
    });
    searchInput.addEventListener('input', () => setChatSearchQuery(searchInput.value, { source: searchInput }));

    getChatbarState().desktop = {
        root: row,
        chatSelect,
        searchInput,
        searchStatus,
        toggleSidebarButton,
        toggleConnectionButton,
        managerButton,
        newButton,
        renameButton,
        deleteButton,
        closeButton,
        connectionStrip: connectionStrip.strip,
        connectionSelect: connectionStrip.select,
        connectionStatus: connectionStrip.status,
    };

    return {
        row,
        connectionStrip: connectionStrip.strip,
    };
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

function toggleConnectionStrip() {
    const desktopRefs = getChatDesktopRefs();

    if (!(desktopRefs?.toggleConnectionButton instanceof HTMLElement) || desktopRefs.toggleConnectionButton.hidden) {
        return;
    }

    setChatSidebarOpenState(false);
    setConnectionStripOpenState(!isConnectionStripOpen());
}

function handleConnectionProfilesToggle() {
    const connectionProfilesSource = document.getElementById('connection_profiles');

    if (!(connectionProfilesSource instanceof HTMLSelectElement)) {
        return;
    }

    if (isMobileViewport()) {
        openMobileChatTools();
        return;
    }

    toggleConnectionStrip();
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

function bindConnectionProfileSourceObserver() {
    if (getChatbarState().sourceObserver) {
        return;
    }

    const observer = new MutationObserver(() => {
        scheduleChatbarRefresh(60);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    getChatbarState().sourceObserver = observer;
}

async function refreshChatbarState() {
    const chatbarState = getChatbarState();
    const refreshToken = ++chatbarState.refreshToken;
    const desktopRefs = getChatDesktopRefs();
    const mobileRefs = getChatMobileRefs();

    if (!desktopRefs) {
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

    populateChatSelector(desktopRefs.chatSelect, chatNames, chatContext, chatContext.canBrowseChats ? 'No saved chats yet' : 'No chat selected');
    populateChatSelector(mobileRefs?.chatSelect, chatNames, chatContext, chatContext.canBrowseChats ? 'No saved chats yet' : 'No chat selected');

    setButtonDisabled(desktopRefs.managerButton, !chatContext.canBrowseChats);
    setButtonDisabled(desktopRefs.toggleSidebarButton, !chatContext.canBrowseChats);
    setButtonDisabled(desktopRefs.newButton, !chatContext.canStartNewChat);
    setButtonDisabled(desktopRefs.renameButton, !chatContext.hasChat);
    setButtonDisabled(desktopRefs.deleteButton, !chatContext.hasChat);
    setButtonDisabled(desktopRefs.closeButton, !chatContext.hasChat);
    setButtonDisabled(desktopRefs.chatSelect, !chatContext.canBrowseChats);
    setButtonDisabled(desktopRefs.searchInput, !chatContext.hasChat);

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

    desktopRefs.toggleConnectionButton.hidden = !hasConnectionProfiles;
    desktopRefs.connectionStrip.hidden = !hasConnectionProfiles || !isConnectionStripOpen();

    if (!hasConnectionProfiles) {
        setConnectionStripOpenState(false);
        desktopRefs.connectionSelect.replaceChildren();
        desktopRefs.connectionStatus.textContent = '';

        if (mobileRefs?.connectionSection instanceof HTMLElement) {
            mobileRefs.connectionSection.hidden = true;
            mobileRefs.connectionSelect.replaceChildren();
            mobileRefs.connectionStatus.textContent = '';
        }
    } else {
        const optionsMarkup = connectionProfilesSource.innerHTML;
        desktopRefs.connectionSelect.innerHTML = optionsMarkup;
        desktopRefs.connectionSelect.value = connectionProfilesSource.value;
        desktopRefs.connectionStatus.textContent = connectionStatusText;

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

    setButtonPressed(desktopRefs.toggleSidebarButton, isChatSidebarOpen());
    setButtonPressed(desktopRefs.toggleConnectionButton, isConnectionStripOpen());

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
    clearTimeout(getChatbarState().refreshTimer);
    getChatbarState().refreshTimer = window.setTimeout(() => {
        void refreshChatbarState();
    }, delay);
}

function bindChatbarEvents() {
    const context = getSillyTavernContext();
    const eventSource = context?.eventSource;
    const eventTypes = context?.eventTypes ?? context?.event_types;

    bindConnectionProfileSourceObserver();
    initChatSearchObserver();

    if (!eventSource || !eventTypes) {
        window.setTimeout(bindChatbarEvents, 180);
        scheduleChatbarRefresh(180);
        return;
    }

    const refresh = () => scheduleChatbarRefresh(80);
    const events = [
        eventTypes.APP_READY,
        eventTypes.CHAT_CHANGED,
        eventTypes.CHAT_CREATED,
        eventTypes.GROUP_CHAT_CREATED,
        eventTypes.CHAT_DELETED,
        eventTypes.GROUP_CHAT_DELETED,
        eventTypes.CHARACTER_DELETED,
        eventTypes.CHARACTER_RENAMED,
        eventTypes.GROUP_UPDATED,
        eventTypes.ONLINE_STATUS_CHANGED,
    ].filter(Boolean);

    for (const eventName of new Set(events)) {
        eventSource.on(eventName, refresh);
    }

    scheduleChatbarRefresh(80);

    document.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        if (isConnectionStripOpen()
            && !target.closest('#sb-connection-strip')
            && !target.closest('#sb-chatbar-connection-toggle')) {
            setConnectionStripOpenState(false);
        }
    });
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
        triggerDrawerToggle('#rightNavHolder > .drawer-toggle');
        window.requestAnimationFrame(() => {
            if (panel.classList.contains('openDrawer')) {
                forceDrawerState(panel, false, '#rightNavDrawerIcon');
            }
        });

        // Restore overflow:hidden on parent after closing (iOS Safari fix)
        const host = document.getElementById('rightNavHolder');
        if (host) host.style.overflow = '';
    }
}

function toggleCharacterPanel() {
    closeMobileNav();
    closeMobileChatTools();
    setConnectionStripOpenState(false);
    injectCharacterCloseButton();

    if (isCharacterPanelOpen()) {
        closeCharacterPanel();
        return;
    }

    resetCharacterPanelView();
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
    });
}

function toggleShellPanel(shellKey, tabId = null) {
    if (!ensureShellReady(shellKey)) {
        return;
    }

    closeMobileChatTools();
    setConnectionStripOpenState(false);

    if (tabId ? isShellTabOpen(shellKey, tabId) : isShellOpen(shellKey)) {
        closeShell(shellKey);
        return;
    }

    if (shellKey === 'left') {
        closeShell('right');
    } else {
        closeShell('left');
    }

    closeCharacterPanel();
    openShell(shellKey, tabId);
}

function isLandingPageVisible() {
    return isActuallyVisible(document.querySelector('.welcomePanel'));
}

async function returnToLandingPage() {
    closeShell('left');
    closeShell('right');
    closeCharacterPanel();
    closeMobileNav();
    closeMobileChatTools();
    setConnectionStripOpenState(false);

    if (isLandingPageVisible()) {
        document.getElementById('chat')?.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        });
        return;
    }

    const context = getSillyTavernContext();

    if (typeof context?.closeCurrentChat === 'function') {
        await context.closeCurrentChat();
        return;
    }

    document.getElementById('option_close_chat')?.click();
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

    centerGroup.innerHTML = `
        <div id="sb-topbar-title" class="sb-brand-title">${SB_IDLE_BRAND_LABEL}</div>
    `;

    leftGroup.append(mobileButton, leftButton, homeButton);
    rightGroup.append(charactersButton, rightButton);
    topBarInner.append(leftGroup, centerGroup, rightGroup);
    primaryRow.appendChild(topBarInner);

    const chatBar = buildChatBar();
    stack.append(primaryRow, chatBar.row);
    topBar.append(stack, chatBar.connectionStrip);

    observeProxyButton('sb-left-shell-toggle', getShellConfig('left').hostIconSelector);
    observeProxyButton('sb-right-shell-toggle', getShellConfig('right').hostIconSelector);
    observeProxyButton('sb-character-toggle', '#rightNavDrawerIcon');
    bindTopBarBrand();
    updateTopBarBrand();
    scheduleChatbarRefresh(80);
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

function buildAgentsPanel() {
    const { panel, scroller } = createShellPanel({
        id: 'agents',
    });

    const column = createElement('div', { className: 'sb-shell-column' });
    const callout = createElement('div', { className: 'sb-shell-callout' });
    callout.innerHTML = `
        <strong>Agent Workspace</strong>
        <p>Retrieval helps before generation, while memory and lorebook helpers clean up afterward.</p>
    `;

    const overview = createElement('div', { id: 'sb-agent-overview', className: 'sb-agent-overview' });
    const agentPanel = document.getElementById('agent_mode_panel');

    if (agentPanel instanceof HTMLElement) {
        column.append(callout, overview, agentPanel);
    } else {
        const fallback = createElement('div', { className: 'sb-shell-empty-state' });
        fallback.innerHTML = '<strong>Agents are unavailable.</strong><p>The agent controls did not render in time, so this tab is temporarily empty.</p>';
        column.append(callout, fallback);
    }

    scroller.appendChild(column);

    return {
        id: 'agents',
        panel,
        button: null,
        searchRoot: column,
    };
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
    const desktopTopbarSliderGroup = createThemeSliderGroup({
        title: 'Desktop Top Bar Size',
        valueId: 'sb-topbar-scale-desktop-value',
        inputId: 'sb-topbar-scale-desktop-input',
        value: sbState.topbarScale.desktop,
        min: SB_TOPBAR_SCALE.min,
        max: SB_TOPBAR_SCALE.max,
        step: SB_TOPBAR_SCALE.step,
        ariaLabel: 'Desktop top bar size',
        caption: 'Resize the desktop navigation row, search bar, and header controls without editing CSS.',
        onInput: nextValue => setTopbarScale('desktop', nextValue),
    });
    const mobileTopbarSliderGroup = createThemeSliderGroup({
        title: 'Mobile Top Bar Size',
        valueId: 'sb-topbar-scale-mobile-value',
        inputId: 'sb-topbar-scale-mobile-input',
        value: sbState.topbarScale.mobile,
        min: SB_TOPBAR_SCALE.min,
        max: SB_TOPBAR_SCALE.max,
        step: SB_TOPBAR_SCALE.step,
        ariaLabel: 'Mobile top bar size',
        caption: 'Resize the mobile one-line header and compact chat-tools panel for phones and narrow screens.',
        onInput: nextValue => setTopbarScale('mobile', nextValue),
    });
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

    card.append(header, optionRow, surfaceSliderGroup, desktopTopbarSliderGroup, mobileTopbarSliderGroup);
    themeBlock.prepend(card);
    updateThemePickerUi();
}

function updateThemePickerUi() {
    const sliderInput = document.getElementById('sb-surface-transparency-input');
    const sliderValue = document.getElementById('sb-surface-transparency-value');
    const desktopTopbarScaleInput = document.getElementById('sb-topbar-scale-desktop-input');
    const desktopTopbarScaleValue = document.getElementById('sb-topbar-scale-desktop-value');
    const mobileTopbarScaleInput = document.getElementById('sb-topbar-scale-mobile-input');
    const mobileTopbarScaleValue = document.getElementById('sb-topbar-scale-mobile-value');

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

    if (mobileTopbarScaleInput instanceof HTMLInputElement) {
        mobileTopbarScaleInput.value = String(sbState.topbarScale.mobile);
    }

    if (mobileTopbarScaleValue instanceof HTMLElement) {
        mobileTopbarScaleValue.textContent = formatTopbarScale(sbState.topbarScale.mobile);
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
        const dedupeKey = `${sectionLabel}::${displayText}`;

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
        });
    }

    return entries;
}

function getSearchSectionLabel(element, fallback) {
    const preferred = element.closest('.inline-drawer')?.querySelector(':scope > .inline-drawer-toggle')
        ?? element.closest('.extension_container')?.querySelector('.inline-drawer-toggle')
        ?? element.closest('.persona_management_global_settings')
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
    const matches = [];

    for (const tabState of shellState.tabs.values()) {
        tabState.searchIndex = createSearchIndex(tabState);

        for (const entry of tabState.searchIndex) {
            if (!searchTerms.every(term => entry.searchText.includes(term))) {
                continue;
            }

            const startsWithQuery = entry.searchText.startsWith(normalizedQuery);
            const exactMatch = entry.searchText === normalizedQuery;

            matches.push({
                ...entry,
                score: Number(exactMatch) * 100 + Number(startsWithQuery) * 10 - entry.displayText.length / 1000,
            });
        }
    }

    matches
        .sort((left, right) => right.score - left.score)
        .slice(0, 10)
        .forEach(match => {
            const button = createElement('button', {
                className: 'sb-search-result',
                attrs: {
                    type: 'button',
                },
            });

            button.innerHTML = `
                <strong>${match.sectionLabel}</strong>
                <span>${match.displayText}</span>
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
        empty.innerHTML = '<strong>No matches yet.</strong><span>Try a broader term like “theme”, “temperature”, or “persona”.</span>';
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

    shellState.activeTabId = tabId;
    safeSetItem(shellConfig.storageKey, tabId);

    for (const [currentTabId, tabState] of shellState.tabs.entries()) {
        const isActive = currentTabId === tabId;
        tabState.button?.classList.toggle('is-active', isActive);
        tabState.button?.setAttribute('aria-selected', String(isActive));
        tabState.button?.setAttribute('tabindex', isActive ? '0' : '-1');
        tabState.panel.classList.toggle('sb-shell-panel-active', isActive);
        tabState.panel.setAttribute('aria-hidden', String(!isActive));
    }

    const activeTab = shellState.tabs.get(tabId);
    shellState.headerTitle.textContent = activeTab.label;
    shellState.headerSubtitle.textContent = activeTab.description;

    if (focusButton) {
        activeTab.button?.focus();
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
    const shellRoot = document.getElementById(shellConfig.rootPanelId);

    if (!(shellRoot instanceof HTMLElement) || !shellRoot.classList.contains('openDrawer')) {
        return;
    }

    clearShellSearch(shellKey);

    if (!isDrawerActuallyOpen(shellRoot)) {
        forceDrawerState(shellRoot, false, shellConfig.hostIconSelector);
        return;
    }

    if (shellRoot.classList.contains('openDrawer')) {
        triggerDrawerToggle(shellConfig.hostToggleSelector);
        window.requestAnimationFrame(() => {
            if (shellRoot.classList.contains('openDrawer')) {
                forceDrawerState(shellRoot, false, shellConfig.hostIconSelector);
            }
        });
    }
}

function buildShell(shellKey) {
    const shellConfig = getShellConfig(shellKey);
    const shellRoot = document.getElementById(shellConfig.rootPanelId);

    if (!(shellRoot instanceof HTMLElement) || shellRoot.dataset.sbShellReady === 'true') {
        return;
    }

    shellRoot.dataset.sbShellReady = 'true';
    shellRoot.classList.add('sb-shell-root', `sb-shell-root-${shellKey}`);

    if (shellKey === 'right') {
        shellRoot.classList.add('fillRight');
    }

    const originalContent = createElement('div', { className: 'sb-shell-column' });
    moveChildrenIntoContainer(shellRoot, originalContent);
    originalContent.querySelector('#settingsSearch')?.classList.add('sb-legacy-search-hidden');

    const frame = createElement('div', { className: 'sb-shell-frame' });
    const nav = createElement('nav', {
        className: 'sb-shell-nav',
        attrs: {
            role: 'tablist',
            'aria-label': `${shellConfig.title} sections`,
        },
    });
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
    const searchResults = createElement('div', { className: 'sb-search-results' });
    const panelBody = createElement('div', { className: 'sb-shell-body' });

    closeButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    closeButton.addEventListener('click', () => closeShell(shellKey));

    searchWrap.append(searchIcon, searchInput);
    header.append(closeButton, eyebrow, title, subtitle, shellDescription, searchWrap, searchResults);
    main.append(header, panelBody);
    frame.append(nav, main);
    shellRoot.appendChild(frame);

    const shellState = {
        activeTabId: shellConfig.defaultTabId,
        tabs: new Map(),
        nav,
        headerTitle: title,
        headerSubtitle: subtitle,
        searchInput,
        searchResults,
        root: shellRoot,
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
            closeMobileNav();
            return;
        }

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
            const agentPanel = buildAgentsPanel();
            registerShellTab(shellKey, customTab, agentPanel, agentPanel.searchRoot);
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
            <small>${tabConfig.description}</small>
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
    shellState.tabs.set(tabConfig.id, {
        ...tabConfig,
        button,
        panel: panelBundle.panel,
        searchRoot: explicitSearchRoot ?? panelBundle.scroller,
        searchIndex: null,
    });
}

function updateAgentOverview() {
    const overview = document.getElementById('sb-agent-overview');
    const agentPanel = document.getElementById('agent_mode_panel');

    if (!(overview instanceof HTMLElement) || !(agentPanel instanceof HTMLElement)) {
        return;
    }

    const isEnabled = Boolean(document.getElementById('agent_mode_enabled')?.checked);
    const hintText = String(document.getElementById('agent_mode_status_hint')?.textContent ?? '').trim();
    const services = [
        { id: 'retrieval', label: 'Retrieval', inputId: 'agent_service_retrieval' },
        { id: 'memory', label: 'Memory', inputId: 'agent_service_memory' },
        { id: 'lorebook', label: 'Lorebook', inputId: 'agent_service_lorebook' },
    ];
    const statusRows = Array.from(document.querySelectorAll('#agent_status_list > div'));

    overview.replaceChildren();

    const hero = createElement('div', { className: 'sb-agent-hero' });
    hero.innerHTML = `
        <strong>${isEnabled ? 'Agent mode is ready' : 'Agent mode is idle'}</strong>
        <p>${hintText || 'Open a chat to configure per-chat agent behavior.'}</p>
    `;
    overview.appendChild(hero);

    const cardGrid = createElement('div', { className: 'sb-agent-grid' });

    for (const service of services) {
        const enabled = Boolean(document.getElementById(service.inputId)?.checked);
        const matchingStatus = statusRows.find(row => normalizeText(row.querySelector('strong')?.textContent) === normalizeText(service.label));
        const statusText = String(matchingStatus?.querySelector('small')?.textContent ?? (enabled ? 'ready' : 'disabled')).trim();

        const card = createElement('div', { className: 'sb-agent-card' });
        const badgeClass = enabled && isEnabled ? 'is-on' : 'is-off';

        card.innerHTML = `
            <div class="sb-agent-card-title">
                <strong>${service.label}</strong>
                <span class="sb-agent-pill ${badgeClass}">${enabled && isEnabled ? 'Active' : 'Off'}</span>
            </div>
            <p>${statusText}</p>
        `;

        cardGrid.appendChild(card);
    }

    overview.appendChild(cardGrid);
}

function initAgentOverview() {
    updateAgentOverview();

    const agentPanel = document.getElementById('agent_mode_panel');
    const statusList = document.getElementById('agent_status_list');
    const statusHint = document.getElementById('agent_mode_status_hint');

    agentPanel?.addEventListener('input', updateAgentOverview);
    agentPanel?.addEventListener('change', updateAgentOverview);

    if (statusList instanceof HTMLElement) {
        new MutationObserver(updateAgentOverview).observe(statusList, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    if (statusHint instanceof HTMLElement) {
        new MutationObserver(updateAgentOverview).observe(statusHint, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }
}

function routeDrawerTarget(targetId) {
    const route = SB_DRAWER_ROUTES[targetId];
    if (!route) {
        return false;
    }

    openShell(route.shell, route.tab);
    return true;
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
    button.addEventListener('click', () => closeCharacterPanel());
    target.appendChild(button);
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

function applyDefaultDrawerStates() {
    setInlineDrawerExpanded(document.querySelector('#UI-Customization > .inline-drawer'), false);
}

function syncMobileViewportState() {
    if (!isMobileViewport()) {
        closeMobileNav();
        closeMobileChatTools();
    }
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

function initAll() {
    if (sbState.initialized) {
        return;
    }

    const leftShellRoot = document.getElementById(getShellConfig('left').rootPanelId);
    const rightShellRoot = document.getElementById(getShellConfig('right').rootPanelId);

    if (!(leftShellRoot instanceof HTMLElement) || !(rightShellRoot instanceof HTMLElement)) {
        return;
    }

    sbState.initialized = true;

    hideHostToggles();
    forceDrawerState(leftShellRoot, false, getShellConfig('left').hostIconSelector);
    forceDrawerState(rightShellRoot, false, getShellConfig('right').hostIconSelector);
    buildShell('left');
    buildShell('right');
    buildMobileNav();
    buildMobileChatTools();
    injectCharacterCloseButton();
    setShellTheme(sbState.theme, { persist: false });
    setSurfaceTransparency(sbState.surfaceTransparency, { persist: false });
    setTopbarScale('desktop', sbState.topbarScale.desktop, { persist: false });
    setTopbarScale('mobile', sbState.topbarScale.mobile, { persist: false });
    buildTopBar();
    bindChatbarEvents();
    interceptDrawerOpeners();
    bindWorldInfoRoute();
    initAgentOverview();
    applyDefaultDrawerStates();
    syncMobileViewportState();

    window.addEventListener('resize', syncMobileViewportState, { passive: true });
    window.addEventListener('orientationchange', syncMobileViewportState);

    // Reinitialize Select2 widgets after shell reparents DOM elements.
    // Select2 bindings break when elements are moved in the DOM.
    reinitSelect2AfterShell();

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
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    window.setTimeout(initAll, 120);
}
