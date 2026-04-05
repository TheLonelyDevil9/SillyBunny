function safeGetItem(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Safari private browsing or quota exceeded — silently ignore
    }
}

const SB_STORAGE_KEYS = Object.freeze({
    leftTab: 'sb-left-tab',
    rightTab: 'sb-right-tab',
    theme: 'sb-theme',
    surfaceTransparency: 'sb-surface-transparency',
});

const SB_IDLE_BRAND_LABEL = 'SillyBunny';
const SB_MOBILE_MEDIA_QUERY = '(max-width: 768px)';
const SB_SURFACE_TRANSPARENCY = Object.freeze({
    min: 0,
    max: 55,
    step: 5,
    defaultValue: 0,
});

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
    isMobileViewport: null,
    theme: normalizeTheme(safeGetItem(SB_STORAGE_KEYS.theme)),
    surfaceTransparency: normalizeSurfaceTransparency(safeGetItem(SB_STORAGE_KEYS.surfaceTransparency)),
    shells: {},
};

const SB_TOP_DRAWER_IDS = Object.freeze([
    SB_SHELLS.left.rootPanelId,
    SB_SHELLS.right.rootPanelId,
    'right-nav-panel',
]);

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

function getDrawerElements(drawerRootOrId) {
    const drawerRoot = typeof drawerRootOrId === 'string'
        ? document.getElementById(drawerRootOrId)
        : drawerRootOrId;

    if (!(drawerRoot instanceof HTMLElement)) {
        return {
            drawerRoot: null,
            hostDrawer: null,
            hostToggle: null,
            hostIcon: null,
        };
    }

    const hostDrawer = drawerRoot.closest('.drawer');
    const hostToggle = hostDrawer?.querySelector(':scope > .drawer-toggle') ?? null;
    const hostIcon = hostToggle?.querySelector('.drawer-icon') ?? null;

    return {
        drawerRoot,
        hostDrawer,
        hostToggle,
        hostIcon,
    };
}

function syncDrawerMetadata(drawerRoot, isOpen = drawerRoot?.classList.contains('openDrawer')) {
    if (!(drawerRoot instanceof HTMLElement)) {
        return;
    }

    drawerRoot.dataset.sbDrawerState = isOpen ? 'open' : 'closed';
    drawerRoot.setAttribute('aria-hidden', String(!isOpen));
}

function forceDrawerState(drawerRootOrId, shouldOpen) {
    const { drawerRoot, hostIcon } = getDrawerElements(drawerRootOrId);

    if (!(drawerRoot instanceof HTMLElement)) {
        return;
    }

    const isOpen = Boolean(shouldOpen);

    drawerRoot.classList.toggle('openDrawer', isOpen);
    drawerRoot.classList.toggle('closedDrawer', !isOpen);

    if (!isOpen) {
        drawerRoot.classList.remove('pinnedOpen');

        for (const [shellKey, shellConfig] of Object.entries(SB_SHELLS)) {
            if (shellConfig.rootPanelId === drawerRoot.id) {
                clearShellSearch(shellKey);
            }
        }
    }

    syncDrawerMetadata(drawerRoot, isOpen);

    if (hostIcon instanceof HTMLElement) {
        hostIcon.classList.toggle('openIcon', isOpen);
        hostIcon.classList.toggle('closedIcon', !isOpen);

        if (!isOpen) {
            hostIcon.classList.remove('drawerPinnedOpen');
        }
    }
}

function normalizeTopDrawerState({ reason = 'startup', keepOpen = [] } = {}) {
    const keepOpenSet = new Set(
        keepOpen.filter(drawerId => typeof drawerId === 'string' && drawerId.length > 0),
    );

    for (const drawerId of SB_TOP_DRAWER_IDS) {
        forceDrawerState(drawerId, keepOpenSet.has(drawerId));
    }

    if (reason) {
        document.body.dataset.sbDrawerNormalizeReason = reason;
    }
}

function runStartupDrawerSanityCheck() {
    const openDrawers = SB_TOP_DRAWER_IDS
        .map(drawerId => document.getElementById(drawerId))
        .filter(drawerRoot => drawerRoot instanceof HTMLElement && drawerRoot.classList.contains('openDrawer'))
        .map(drawerRoot => drawerRoot.id);

    const shouldReset = openDrawers.length > 1 || (isLandingPageVisible() && openDrawers.length > 0);

    if (shouldReset) {
        normalizeTopDrawerState({ reason: 'sanity-check' });
        return;
    }

    for (const drawerId of SB_TOP_DRAWER_IDS) {
        const drawerRoot = document.getElementById(drawerId);

        if (!(drawerRoot instanceof HTMLElement)) {
            continue;
        }

        syncDrawerMetadata(drawerRoot);
        forceDrawerState(drawerRoot, drawerRoot.classList.contains('openDrawer'));
    }
}

function bindStartupDrawerSanityCheck() {
    const deferredCheck = () => {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(runStartupDrawerSanityCheck);
        });
    };

    window.addEventListener('pageshow', deferredCheck, { passive: true });
    window.addEventListener('load', deferredCheck, { once: true });

    const context = getSillyTavernContext();
    const eventSource = context?.eventSource;
    const eventTypes = context?.eventTypes ?? context?.event_types;

    if (eventSource && eventTypes?.APP_READY) {
        eventSource.on(eventTypes.APP_READY, deferredCheck);
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

function triggerDrawerToggle(selector) {
    const toggle = document.querySelector(selector);
    if (toggle instanceof HTMLElement) {
        toggle.click();
    }
}

function isShellOpen(shellKey) {
    const shellRoot = document.getElementById(getShellConfig(shellKey).rootPanelId);
    return Boolean(shellRoot?.classList.contains('openDrawer'));
}

function isShellTabOpen(shellKey, tabId) {
    const shellState = getShellState(shellKey);
    return Boolean(shellState && isShellOpen(shellKey) && shellState.activeTabId === tabId);
}

function isCharacterPanelOpen() {
    const panel = document.getElementById('right-nav-panel');
    return Boolean(panel?.classList.contains('openDrawer'));
}

function closeCharacterPanel() {
    if (isCharacterPanelOpen()) {
        triggerDrawerToggle('#rightNavHolder > .drawer-toggle');
        window.requestAnimationFrame(() => {
            if (isCharacterPanelOpen()) {
                forceDrawerState('right-nav-panel', false);
            }
        });
        return;
    }

    forceDrawerState('right-nav-panel', false);
}

function toggleCharacterPanel() {
    closeMobileNav();

    if (isCharacterPanelOpen()) {
        closeCharacterPanel();
        return;
    }

    closeShell('left');
    closeShell('right');
    triggerDrawerToggle('#rightNavHolder > .drawer-toggle');
}

function toggleShellPanel(shellKey, tabId = null) {
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
    topBar.append(topBarInner);

    observeProxyButton('sb-left-shell-toggle', getShellConfig('left').hostIconSelector);
    observeProxyButton('sb-right-shell-toggle', getShellConfig('right').hostIconSelector);
    observeProxyButton('sb-character-toggle', '#rightNavDrawerIcon');
    bindTopBarBrand();
    updateTopBarBrand();
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
    const sliderGroup = createElement('div', { className: 'sb-theme-slider-group' });
    const sliderHeader = createElement('div', { className: 'sb-theme-slider-header' });
    const sliderTitle = createElement('strong', { text: 'Background Visibility' });
    const sliderValue = createElement('span', { id: 'sb-surface-transparency-value', className: 'sb-theme-slider-value' });
    const sliderInput = createElement('input', {
        id: 'sb-surface-transparency-input',
        className: 'sb-theme-slider-input',
        attrs: {
            type: 'range',
            min: String(SB_SURFACE_TRANSPARENCY.min),
            max: String(SB_SURFACE_TRANSPARENCY.max),
            step: String(SB_SURFACE_TRANSPARENCY.step),
            value: String(sbState.surfaceTransparency),
            'aria-label': 'Background visibility',
        },
    });
    const sliderCaption = createElement('p', {
        className: 'sb-theme-slider-caption',
        text: 'Higher values make the home and chat surfaces more transparent so your selected background picture shows through.',
    });
    header.append(title, description);
    sliderHeader.append(sliderTitle, sliderValue);
    sliderGroup.append(sliderHeader, sliderInput, sliderCaption);

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

    sliderInput.addEventListener('input', event => setSurfaceTransparency(event.currentTarget?.value));
    getMessageStyleSelect()?.addEventListener('change', updateThemePickerUi);
    document.addEventListener('sb:chat-style-updated', updateThemePickerUi);

    card.append(header, optionRow, sliderGroup);
    themeBlock.prepend(card);
    updateThemePickerUi();
}

function updateThemePickerUi() {
    const sliderInput = document.getElementById('sb-surface-transparency-input');
    const sliderValue = document.getElementById('sb-surface-transparency-value');

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

    if (!shellRoot.classList.contains('openDrawer')) {
        triggerDrawerToggle(shellConfig.hostToggleSelector);
        window.requestAnimationFrame(() => {
            if (!shellRoot.classList.contains('openDrawer')) {
                forceDrawerState(shellRoot, true);
            }
        });
        return;
    }

    forceDrawerState(shellRoot, true);
}

function closeShell(shellKey) {
    const shellConfig = getShellConfig(shellKey);
    const shellRoot = document.getElementById(shellConfig.rootPanelId);

    if (shellRoot instanceof HTMLElement && shellRoot.classList.contains('openDrawer')) {
        clearShellSearch(shellKey);
        triggerDrawerToggle(shellConfig.hostToggleSelector);
        window.requestAnimationFrame(() => {
            if (shellRoot.classList.contains('openDrawer')) {
                forceDrawerState(shellRoot, false);
            }
        });
        return;
    }

    forceDrawerState(shellRoot, false);
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
    syncDrawerMetadata(shellRoot);

    let wasOpen = shellRoot.classList.contains('openDrawer');
    new MutationObserver(() => {
        const isOpen = shellRoot.classList.contains('openDrawer');
        syncDrawerMetadata(shellRoot, isOpen);

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
            label: 'Workspace',
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
    const overlay = document.getElementById('sb-mobile-nav');
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
    const overlay = document.getElementById('sb-mobile-nav');

    if (!(overlay instanceof HTMLElement)) {
        return;
    }

    const isOpen = !overlay.hidden && overlay.getAttribute('aria-hidden') === 'false';

    // If opening mobile nav, close any open shells first
    if (!isOpen) {
        closeShell('left');
        closeShell('right');
        closeCharacterPanel();
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
    const mobileViewport = isMobileViewport();

    if (!mobileViewport) {
        closeMobileNav();
    }

    if (sbState.isMobileViewport === mobileViewport) {
        return;
    }

    sbState.isMobileViewport = mobileViewport;
    reinitSelect2AfterShell();
}

function readModelFilterOptions(select) {
    return Array.from(select.options).map(opt => ({
        value: opt.value,
        text: opt.textContent,
        disabled: opt.disabled,
        selected: opt.selected,
    }));
}

function renderModelFilterOptions(select, options, query) {
    const normalizedQuery = query.toLowerCase().trim();
    const currentValue = select.value;

    select.__sbModelFilterApplying = true;

    try {
        select.innerHTML = '';

        for (const opt of options) {
            const matchesQuery = !normalizedQuery
                || opt.value === currentValue
                || opt.text.toLowerCase().includes(normalizedQuery)
                || opt.value.toLowerCase().includes(normalizedQuery);

            if (!matchesQuery) {
                continue;
            }

            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            option.disabled = opt.disabled;
            option.selected = opt.value === currentValue;
            select.appendChild(option);
        }
    } finally {
        select.__sbModelFilterApplying = false;
    }
}

function observeModelFilterInput(select) {
    if (select.__sbModelFilterObserver) {
        return;
    }

    const observer = new MutationObserver(() => {
        if (select.__sbModelFilterApplying) {
            return;
        }

        syncModelFilterInput($(select));
    });

    observer.observe(select, { childList: true, subtree: true, characterData: true });
    select.__sbModelFilterObserver = observer;
}

function syncModelFilterInput($select, { preserveQuery = true } = {}) {
    const select = $select[0];

    if (!(select instanceof HTMLSelectElement)) {
        return;
    }

    const input = select.__sbModelFilterInput;

    if (!(input instanceof HTMLInputElement)) {
        return;
    }

    if (!preserveQuery) {
        input.value = '';
    }

    select.__sbModelFilterOptions = readModelFilterOptions(select);
    renderModelFilterOptions(select, select.__sbModelFilterOptions, input.value);
}

function removeModelFilterInput($select) {
    const select = $select[0];

    if (!(select instanceof HTMLSelectElement)) {
        return;
    }

    if (Array.isArray(select.__sbModelFilterOptions)) {
        renderModelFilterOptions(select, select.__sbModelFilterOptions, '');
    }

    if (select.__sbModelFilterObserver) {
        select.__sbModelFilterObserver.disconnect();
        delete select.__sbModelFilterObserver;
    }

    if (select.__sbModelFilterInput instanceof HTMLInputElement) {
        select.__sbModelFilterInput.remove();
        delete select.__sbModelFilterInput;
    }

    delete select.__sbModelFilterOptions;
    delete select.__sbModelFilterApplying;
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
        '#model_custom_select',
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
            removeModelFilterInput($el);
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
    const select = $select[0];

    if (!(select instanceof HTMLSelectElement)) {
        return;
    }

    if (!(select.__sbModelFilterInput instanceof HTMLInputElement)) {
        const input = document.createElement('input');
        input.type = 'search';
        input.className = 'sb-model-filter text_pole';
        input.placeholder = 'Search models...';
        input.addEventListener('input', () => {
            renderModelFilterOptions(select, select.__sbModelFilterOptions || readModelFilterOptions(select), input.value);
        });

        select.__sbModelFilterInput = input;
        $select.before(input);
    }

    observeModelFilterInput(select);
    syncModelFilterInput($select);
}

function deferUntilAppReady(callback) {
    const context = getSillyTavernContext();
    const eventSource = context?.eventSource;
    const eventTypes = context?.eventTypes ?? context?.event_types;

    if (eventSource && eventTypes?.APP_READY) {
        eventSource.on(eventTypes.APP_READY, () => {
            window.requestAnimationFrame(callback);
        });
        return;
    }

    // Fallback: poll until SillyTavern context is available
    let attempts = 0;
    const MAX_ATTEMPTS = 50; // 50 * 200ms = 10s
    const poll = () => {
        attempts++;
        const ctx = getSillyTavernContext();
        const es = ctx?.eventSource;
        const et = ctx?.eventTypes ?? ctx?.event_types;

        if (es && et?.APP_READY) {
            es.on(et.APP_READY, () => window.requestAnimationFrame(callback));
        } else if (attempts < MAX_ATTEMPTS) {
            window.setTimeout(poll, 200);
        } else {
            console.warn('[SillyBunny Shell] APP_READY never fired, running deferred init anyway');
            window.requestAnimationFrame(callback);
        }
    };
    window.setTimeout(poll, 200);
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

    normalizeTopDrawerState({ reason: 'init-start' });
    sbState.initialized = true;

    // Safari-compatible: Use requestAnimationFrame to ensure class changes apply after paint
    // Remove initializing class first, then add initialized class on next frame
    requestAnimationFrame(() => {
        document.body.classList.remove('sb-shell-initializing');
        requestAnimationFrame(() => {
            document.body.classList.add('sb-shell-initialized');
        });
    });

    // Phase 1: Structural DOM work (no dependency on loaded app data)
    hideHostToggles();
    buildTopBar();
    buildShell('left');
    buildShell('right');
    buildMobileNav();
    injectCharacterCloseButton();
    syncMobileViewportState();
    setShellTheme(sbState.theme, { persist: false });
    setSurfaceTransparency(sbState.surfaceTransparency, { persist: false });

    window.addEventListener('resize', syncMobileViewportState, { passive: true });
    window.addEventListener('orientationchange', syncMobileViewportState);

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
        getTheme() {
            return sbState.theme;
        },
        getSurfaceTransparency() {
            return sbState.surfaceTransparency;
        },
    };

    // Phase 2: Deferred until app data is loaded (settings, characters, extensions)
    deferUntilAppReady(() => {
        interceptDrawerOpeners();
        bindWorldInfoRoute();
        bindStartupDrawerSanityCheck();
        initAgentOverview();
        applyDefaultDrawerStates();

        window.requestAnimationFrame(() => {
            normalizeTopDrawerState({ reason: 'post-init-frame' });
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    window.setTimeout(initAll, 80);
}

// Add initializing class immediately to enable pointer-events blocking
// This runs synchronously before initAll() to ensure Safari applies the CSS rule
if (isMobileViewport()) {
    document.body.classList.add('sb-shell-initializing');
}
