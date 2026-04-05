import {
    chat_metadata,
    eventSource,
    event_types,
    getCurrentChatId,
    saveSettingsDebounced,
} from '../../../../script.js';
import { extension_settings, saveMetadataDebounced } from '../../../extensions.js';
import { background_settings } from '../../../backgrounds.js';
import { promptManager } from '../../../openai.js';

const EXTENSION_NAME = 'NemoPresetExt';
const BUILT_IN_DIVIDER_PATTERNS = ['=+', '-{3,}', '\\*{3,}', '[^\\w\\s]*[─—-]\\+'];
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'm4v']);
const BACKGROUND_LOCK_KEY = 'custom_background';

let promptListElement = null;
let promptListObserver = null;
let promptRefreshTimer = null;
let isRefreshingPromptSections = false;

let backgroundLayerElement = null;
let backgroundMutationObserver = null;
let backgroundCardObserversAttached = false;
let backgroundSyncTimer = null;

function ensureSettings() {
    if (!extension_settings[EXTENSION_NAME] || typeof extension_settings[EXTENSION_NAME] !== 'object') {
        extension_settings[EXTENSION_NAME] = {};
    }

    const settings = extension_settings[EXTENSION_NAME];

    if (typeof settings.enablePromptSections !== 'boolean') {
        settings.enablePromptSections = true;
    }
    if (typeof settings.dividerRegexPattern !== 'string') {
        settings.dividerRegexPattern = '';
    }
    if (!settings.promptSectionStates || typeof settings.promptSectionStates !== 'object') {
        settings.promptSectionStates = {};
    }
    if (!settings.openSectionStates || typeof settings.openSectionStates !== 'object') {
        settings.openSectionStates = {};
    }
    if (typeof settings.enableAnimatedBackgrounds !== 'boolean') {
        settings.enableAnimatedBackgrounds = true;
    }
    if (typeof settings.animatedBackgroundMuted !== 'boolean') {
        settings.animatedBackgroundMuted = true;
    }
    if (typeof settings.animatedBackgroundLoop !== 'boolean') {
        settings.animatedBackgroundLoop = true;
    }
    if (typeof settings.animatedBackgroundAutoplay !== 'boolean') {
        settings.animatedBackgroundAutoplay = true;
    }
    if (typeof settings.animatedBackgroundShowControls !== 'boolean') {
        settings.animatedBackgroundShowControls = false;
    }
    if (typeof settings.animatedBackgroundVolume !== 'number') {
        settings.animatedBackgroundVolume = 15;
    }
    if (!Array.isArray(settings.savedAnimatedSources)) {
        settings.savedAnimatedSources = [];
    }

    return settings;
}

function bootstrap() {
    ensureSettings();
    injectSettingsPanel();
    attachPromptEnhancer();
    attachBackgroundEnhancer();
}

function attachPromptEnhancer() {
    const nextPromptList = document.querySelector('#completion_prompt_manager_list');
    if (!nextPromptList || nextPromptList === promptListElement) {
        return;
    }

    promptListElement = nextPromptList;
    injectPromptToolbar(promptListElement);

    if (promptListObserver) {
        promptListObserver.disconnect();
    }

    promptListObserver = new MutationObserver(() => {
        if (!isRefreshingPromptSections) {
            schedulePromptRefresh();
        }
    });

    promptListObserver.observe(promptListElement, {
        childList: true,
        subtree: true,
    });

    schedulePromptRefresh();
}

function schedulePromptRefresh() {
    if (!promptListElement) {
        return;
    }

    clearTimeout(promptRefreshTimer);
    promptRefreshTimer = setTimeout(refreshPromptSections, 40);
}

function injectPromptToolbar(promptList) {
    if (!promptList || document.getElementById('nemo-sb-prompt-toolbar')) {
        return;
    }

    const toolbar = document.createElement('div');
    toolbar.id = 'nemo-sb-prompt-toolbar';
    toolbar.innerHTML = `
        <input id="nemo-sb-prompt-search" class="text_pole" type="search" placeholder="Search prompts by name or content">
        <div class="nemo-sb-toolbar-actions">
            <button id="nemo-sb-prompt-clear" class="menu_button menu_button_icon" type="button" title="Clear search">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <button id="nemo-sb-prompt-toggle" class="menu_button menu_button_icon" type="button" title="Toggle collapsible sections">
                <i class="fa-solid fa-layer-group"></i>
            </button>
            <button id="nemo-sb-prompt-collapse" class="menu_button menu_button_icon" type="button" title="Collapse all sections">
                <i class="fa-solid fa-angles-up"></i>
            </button>
            <button id="nemo-sb-prompt-expand" class="menu_button menu_button_icon" type="button" title="Expand all sections">
                <i class="fa-solid fa-angles-down"></i>
            </button>
        </div>
    `;

    promptList.parentElement.insertBefore(toolbar, promptList);

    toolbar.querySelector('#nemo-sb-prompt-search').addEventListener('input', schedulePromptRefresh);
    toolbar.querySelector('#nemo-sb-prompt-clear').addEventListener('click', () => {
        toolbar.querySelector('#nemo-sb-prompt-search').value = '';
        schedulePromptRefresh();
    });
    toolbar.querySelector('#nemo-sb-prompt-toggle').addEventListener('click', () => {
        const settings = ensureSettings();
        settings.enablePromptSections = !settings.enablePromptSections;
        saveSettingsDebounced();
        schedulePromptRefresh();
        syncSettingsPanel();
    });
    toolbar.querySelector('#nemo-sb-prompt-collapse').addEventListener('click', () => {
        const settings = ensureSettings();
        const sections = Array.from(promptList.querySelectorAll('.nemo-sb-section-row'));
        sections.forEach(section => {
            setPromptSectionOpenState(settings, section.dataset.sectionId, section.dataset.sectionName || section.dataset.sectionId, false);
        });
        saveSettingsDebounced();
        schedulePromptRefresh();
    });
    toolbar.querySelector('#nemo-sb-prompt-expand').addEventListener('click', () => {
        const settings = ensureSettings();
        const sections = Array.from(promptList.querySelectorAll('.nemo-sb-section-row'));
        sections.forEach(section => {
            setPromptSectionOpenState(settings, section.dataset.sectionId, section.dataset.sectionName || section.dataset.sectionId, true);
        });
        saveSettingsDebounced();
        schedulePromptRefresh();
    });
}

function getPromptSearchQuery() {
    return String(document.getElementById('nemo-sb-prompt-search')?.value || '').trim().toLowerCase();
}

function getPromptRows() {
    if (!promptListElement) {
        return [];
    }

    return Array.from(promptListElement.querySelectorAll(':scope > li.completion_prompt_manager_prompt[data-pm-identifier]'));
}

function getPromptRowName(row) {
    const inspectLink = row.querySelector('.prompt-manager-inspect-action');
    if (inspectLink) {
        return String(inspectLink.getAttribute('title') || inspectLink.textContent || '').trim();
    }

    const nameContainer = row.querySelector('.completion_prompt_manager_prompt_name');
    return String(nameContainer?.textContent || '').trim();
}

function getPromptSearchText(row) {
    const identifier = row.dataset.pmIdentifier;
    const prompt = identifier ? promptManager?.getPromptById?.(identifier) : null;
    return `${getPromptRowName(row)}\n${prompt?.content || ''}`.toLowerCase();
}

function buildDividerRegex() {
    const settings = ensureSettings();
    const customPatterns = String(settings.dividerRegexPattern || '')
        .split(',')
        .map(pattern => pattern.trim())
        .filter(Boolean);
    const allPatterns = [...new Set([
        ...BUILT_IN_DIVIDER_PATTERNS,
        ...customPatterns,
        ...customPatterns.map(escapeRegex),
    ])];

    try {
        return new RegExp(`^(${allPatterns.join('|')})`, 'u');
    } catch (error) {
        console.warn('[NemoPresetExt] Invalid divider regex, falling back to built-ins.', error);
        return new RegExp(`^(${BUILT_IN_DIVIDER_PATTERNS.join('|')})`, 'u');
    }
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPromptSectionOpenState(settings, sectionId, sectionName) {
    if (typeof settings.promptSectionStates?.[sectionId] === 'boolean') {
        return settings.promptSectionStates[sectionId];
    }

    if (typeof settings.promptSectionStates?.[sectionName] === 'boolean') {
        return settings.promptSectionStates[sectionName];
    }

    if (typeof settings.openSectionStates?.[sectionName] === 'boolean') {
        return settings.openSectionStates[sectionName];
    }

    return true;
}

function setPromptSectionOpenState(settings, sectionId, sectionName, isOpen) {
    settings.promptSectionStates[sectionId] = isOpen;
    settings.promptSectionStates[sectionName] = isOpen;
    settings.openSectionStates[sectionName] = isOpen;
}

function isDividerPrompt(promptName, dividerRegex, settings) {
    return dividerRegex.test(promptName) || Object.prototype.hasOwnProperty.call(settings.openSectionStates, promptName);
}

function cleanupPromptSections() {
    if (!promptListElement) {
        return;
    }

    promptListElement.querySelectorAll('.nemo-sb-section-row').forEach(row => row.remove());

    getPromptRows().forEach(row => {
        row.classList.remove('nemo-sb-section-item', 'nemo-sb-divider-row');
        row.style.display = '';
        delete row.dataset.sectionId;
    });
}

function createSectionRow(sectionId, title, sectionName, isOpen) {
    const row = document.createElement('li');
    row.className = `nemo-sb-section-row ${isOpen ? '' : 'is-collapsed'}`.trim();
    row.dataset.sectionId = sectionId;
    row.dataset.sectionName = sectionName;
    row.innerHTML = `
        <button class="nemo-sb-section-trigger" type="button" aria-expanded="${String(isOpen)}" aria-label="Toggle ${title}">
            <span class="nemo-sb-section-toggle" aria-hidden="true">
                <i class="fa-solid ${isOpen ? 'fa-chevron-down' : 'fa-chevron-right'}"></i>
            </span>
            <span class="nemo-sb-section-title"></span>
            <span class="nemo-sb-section-count"></span>
        </button>
    `;
    row.querySelector('.nemo-sb-section-title').textContent = title;
    const toggleSection = () => {
        const settings = ensureSettings();
        const nextIsOpen = !getPromptSectionOpenState(settings, sectionId, sectionName);
        setPromptSectionOpenState(settings, sectionId, sectionName, nextIsOpen);
        saveSettingsDebounced();
        schedulePromptRefresh();
    };

    const trigger = row.querySelector('.nemo-sb-section-trigger');
    let lastToggleAt = 0;
    const activateTrigger = event => {
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        if (now - lastToggleAt < 180) {
            return;
        }

        lastToggleAt = now;
        toggleSection();
    };
    trigger.addEventListener('click', activateTrigger);
    trigger.addEventListener('touchend', activateTrigger);
    return row;
}

function stripDividerPrefix(title, dividerRegex) {
    const cleaned = String(title).replace(dividerRegex, '').replace(/^[\s:|~>\-]+/, '').trim();
    return cleaned || String(title).trim();
}

function refreshPromptSections() {
    if (!promptListElement || isRefreshingPromptSections) {
        return;
    }

    isRefreshingPromptSections = true;

    try {
        cleanupPromptSections();

        const settings = ensureSettings();
        const query = getPromptSearchQuery();
        const rows = getPromptRows();

        if (!settings.enablePromptSections) {
            rows.forEach(row => {
                const matches = !query || getPromptSearchText(row).includes(query);
                row.style.display = matches ? '' : 'none';
            });
            return;
        }

        const dividerRegex = buildDividerRegex();
        const sections = [];
        let currentSection = null;

        rows.forEach(row => {
            const promptName = getPromptRowName(row);

            if (isDividerPrompt(promptName, dividerRegex, settings)) {
                const sectionId = row.dataset.pmIdentifier || promptName || `nemo-section-${sections.length}`;
                const isOpen = getPromptSectionOpenState(settings, sectionId, promptName);
                const sectionTitle = stripDividerPrefix(promptName, dividerRegex);
                const sectionRow = createSectionRow(sectionId, sectionTitle, promptName, isOpen);

                row.before(sectionRow);
                row.classList.add('nemo-sb-divider-row');
                row.style.display = 'none';

                currentSection = {
                    id: sectionId,
                    title: sectionTitle,
                    isOpen,
                    row: sectionRow,
                    prompts: [],
                };
                sections.push(currentSection);
                return;
            }

            if (currentSection) {
                row.classList.add('nemo-sb-section-item');
                row.dataset.sectionId = currentSection.id;
                currentSection.prompts.push(row);
            }
        });

        sections.forEach(section => {
            const titleMatches = query.length > 0 && section.title.toLowerCase().includes(query);
            let matchedCount = 0;

            section.prompts.forEach(row => {
                const matches = !query || titleMatches || getPromptSearchText(row).includes(query);
                if (matches) {
                    matchedCount += 1;
                }

                const shouldShow = matches && (query.length > 0 || section.isOpen);
                row.style.display = shouldShow ? '' : 'none';
            });

            const enabledCount = section.prompts.filter(row => row.querySelector('.prompt-manager-toggle-action.fa-toggle-on')).length;
            section.row.querySelector('.nemo-sb-section-count').textContent = `${enabledCount}/${section.prompts.length}`;
            section.row.style.display = query.length === 0 || titleMatches || matchedCount > 0 ? '' : 'none';
            section.row.classList.toggle('is-collapsed', !section.isOpen && query.length === 0);
            section.row.querySelector('.nemo-sb-section-trigger')?.setAttribute('aria-expanded', String(section.isOpen || query.length > 0));

            const icon = section.row.querySelector('.nemo-sb-section-toggle i');
            icon.className = `fa-solid ${section.isOpen || query.length > 0 ? 'fa-chevron-down' : 'fa-chevron-right'}`;
        });

        rows
            .filter(row => !row.dataset.sectionId && !row.classList.contains('nemo-sb-divider-row'))
            .forEach(row => {
                const matches = !query || getPromptSearchText(row).includes(query);
                row.style.display = matches ? '' : 'none';
            });
    } finally {
        isRefreshingPromptSections = false;
    }
}

function attachBackgroundEnhancer() {
    const bgBase = document.getElementById('bg1');
    if (bgBase && !backgroundLayerElement) {
        backgroundLayerElement = document.createElement('div');
        backgroundLayerElement.id = 'nemo-animated-bg-layer';
        bgBase.insertAdjacentElement('afterend', backgroundLayerElement);

        backgroundMutationObserver = new MutationObserver(scheduleBackgroundSync);
        backgroundMutationObserver.observe(bgBase, {
            attributes: true,
            attributeFilter: ['style', 'class'],
        });
    }

    const backgroundDrawer = document.getElementById('Backgrounds');
    if (backgroundDrawer) {
        injectAnimatedBackgroundPanel(backgroundDrawer);
    }

    if (!backgroundCardObserversAttached) {
        const bgMenuContent = document.getElementById('bg_menu_content');
        const bgCustomContent = document.getElementById('bg_custom_content');

        if (bgMenuContent) {
            new MutationObserver(decorateBackgroundCards).observe(bgMenuContent, { childList: true, subtree: true });
            backgroundCardObserversAttached = true;
        }

        if (bgCustomContent) {
            new MutationObserver(decorateBackgroundCards).observe(bgCustomContent, { childList: true, subtree: true });
        }
    }

    decorateBackgroundCards();
    scheduleBackgroundSync();
}

function injectAnimatedBackgroundPanel(backgroundDrawer) {
    if (document.getElementById('nemo-animated-bg-panel')) {
        syncBackgroundPanel();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'nemo-animated-bg-panel';
    panel.innerHTML = `
        <div class="nemo-animated-bg-header">
            <div class="nemo-animated-bg-title">Animated Backgrounds</div>
            <div class="nemo-animated-bg-note">Use the normal uploader for local MP4/WebM files, or paste a YouTube/direct video URL here.</div>
        </div>
        <div class="nemo-animated-bg-url-row">
            <input id="nemo-animated-bg-url" class="text_pole" type="text" placeholder="https://youtube.com/... or https://.../loop.mp4">
            <button id="nemo-animated-bg-apply" class="menu_button menu_button_icon" type="button">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span>Use URL</span>
            </button>
        </div>
        <div class="nemo-animated-bg-controls">
            <label class="checkbox_label" for="nemo-animated-bg-enabled">
                <input id="nemo-animated-bg-enabled" type="checkbox">
                <span>Enable video and YouTube backgrounds</span>
            </label>
            <label class="checkbox_label" for="nemo-animated-bg-muted">
                <input id="nemo-animated-bg-muted" type="checkbox">
                <span>Muted</span>
            </label>
            <label class="checkbox_label" for="nemo-animated-bg-loop">
                <input id="nemo-animated-bg-loop" type="checkbox">
                <span>Loop</span>
            </label>
            <label class="checkbox_label" for="nemo-animated-bg-autoplay">
                <input id="nemo-animated-bg-autoplay" type="checkbox">
                <span>Autoplay</span>
            </label>
            <label class="nemo-animated-bg-volume" for="nemo-animated-bg-volume">
                <span>Volume</span>
                <input id="nemo-animated-bg-volume" type="range" min="0" max="100" step="1">
            </label>
        </div>
        <div id="nemo-animated-bg-sources"></div>
    `;

    const tabs = backgroundDrawer.querySelector('#bg_tabs');
    if (tabs) {
        backgroundDrawer.insertBefore(panel, tabs);
    } else {
        backgroundDrawer.prepend(panel);
    }

    panel.querySelector('#nemo-animated-bg-apply').addEventListener('click', () => {
        const input = panel.querySelector('#nemo-animated-bg-url');
        const url = String(input.value || '').trim();
        if (!url) {
            return;
        }

        applyAnimatedSource(url);
        input.value = '';
    });

    panel.querySelector('#nemo-animated-bg-url').addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            panel.querySelector('#nemo-animated-bg-apply').click();
        }
    });

    panel.querySelector('#nemo-animated-bg-enabled').addEventListener('change', event => {
        ensureSettings().enableAnimatedBackgrounds = event.target.checked;
        saveSettingsDebounced();
        scheduleBackgroundSync();
        syncSettingsPanel();
    });

    panel.querySelector('#nemo-animated-bg-muted').addEventListener('change', event => {
        ensureSettings().animatedBackgroundMuted = event.target.checked;
        saveSettingsDebounced();
        scheduleBackgroundSync();
    });

    panel.querySelector('#nemo-animated-bg-loop').addEventListener('change', event => {
        ensureSettings().animatedBackgroundLoop = event.target.checked;
        saveSettingsDebounced();
        scheduleBackgroundSync();
    });

    panel.querySelector('#nemo-animated-bg-autoplay').addEventListener('change', event => {
        ensureSettings().animatedBackgroundAutoplay = event.target.checked;
        saveSettingsDebounced();
        scheduleBackgroundSync();
    });

    panel.querySelector('#nemo-animated-bg-volume').addEventListener('input', event => {
        ensureSettings().animatedBackgroundVolume = Number(event.target.value || 0);
        saveSettingsDebounced();
        scheduleBackgroundSync();
    });

    const fittingSelect = document.getElementById('background_fitting');
    if (fittingSelect) {
        fittingSelect.addEventListener('input', scheduleBackgroundSync);
    }

    syncBackgroundPanel();
}

function syncBackgroundPanel() {
    const panel = document.getElementById('nemo-animated-bg-panel');
    if (!panel) {
        return;
    }

    const settings = ensureSettings();
    panel.querySelector('#nemo-animated-bg-enabled').checked = settings.enableAnimatedBackgrounds;
    panel.querySelector('#nemo-animated-bg-muted').checked = settings.animatedBackgroundMuted;
    panel.querySelector('#nemo-animated-bg-loop').checked = settings.animatedBackgroundLoop;
    panel.querySelector('#nemo-animated-bg-autoplay').checked = settings.animatedBackgroundAutoplay;
    panel.querySelector('#nemo-animated-bg-volume').value = String(settings.animatedBackgroundVolume);

    renderAnimatedSourceList();
}

function scheduleBackgroundSync() {
    clearTimeout(backgroundSyncTimer);
    backgroundSyncTimer = setTimeout(syncAnimatedBackgroundLayer, 40);
}

function extractCssUrl(value) {
    const match = String(value || '').match(/^url\((['"]?)(.*?)\1\)$/);
    return match?.[2] || '';
}

function getCurrentBackgroundReference() {
    const lockedBackground = extractCssUrl(chat_metadata[BACKGROUND_LOCK_KEY]);
    if (lockedBackground) {
        return lockedBackground;
    }

    if (background_settings?.name) {
        return background_settings.name;
    }

    return extractCssUrl(background_settings?.url);
}

function getUrlExtension(value) {
    if (!value) {
        return '';
    }

    try {
        const pathname = new URL(value, window.location.origin).pathname;
        return pathname.split('.').pop()?.toLowerCase() ?? '';
    } catch {
        return String(value).split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? '';
    }
}

function isYouTubeUrl(value) {
    return /(?:youtube(?:-nocookie)?\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|.*\/shorts\/)|youtu\.be\/)([^"&?/\\s]{11})/i.test(String(value));
}

function getYouTubeVideoId(value) {
    const match = String(value).match(/(?:youtube(?:-nocookie)?\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|.*\/shorts\/)|youtu\.be\/)([^"&?/\\s]{11})/i);
    return match ? match[1] : '';
}

function getAnimatedBackgroundDescriptor() {
    const currentReference = getCurrentBackgroundReference();
    if (!currentReference) {
        return null;
    }

    if (isYouTubeUrl(currentReference)) {
        const videoId = getYouTubeVideoId(currentReference);
        if (!videoId) {
            return null;
        }

        return {
            kind: 'youtube',
            key: currentReference,
            videoId,
        };
    }

    const extension = getUrlExtension(currentReference);
    if (!VIDEO_EXTENSIONS.has(extension)) {
        return null;
    }

    if (/^https?:\/\//i.test(currentReference) || currentReference.startsWith('backgrounds/')) {
        return {
            kind: 'video',
            key: currentReference,
            src: currentReference,
        };
    }

    return {
        kind: 'video',
        key: currentReference,
        src: `backgrounds/${encodeURIComponent(currentReference)}`,
    };
}

function getObjectFitValue() {
    const fitting = document.getElementById('background_fitting')?.value || 'cover';
    switch (fitting) {
        case 'contain':
            return 'contain';
        case 'stretch':
            return 'fill';
        case 'center':
            return 'none';
        default:
            return 'cover';
    }
}

function buildYouTubeEmbedUrl(videoId) {
    const settings = ensureSettings();
    const params = new URLSearchParams({
        autoplay: settings.animatedBackgroundAutoplay ? '1' : '0',
        loop: settings.animatedBackgroundLoop ? '1' : '0',
        mute: settings.animatedBackgroundMuted ? '1' : '0',
        playlist: settings.animatedBackgroundLoop ? videoId : '',
        controls: settings.animatedBackgroundShowControls ? '1' : '0',
        modestbranding: '1',
        rel: '0',
        iv_load_policy: '3',
        disablekb: '1',
    });

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function clearAnimatedBackgroundLayer() {
    if (!backgroundLayerElement) {
        return;
    }

    backgroundLayerElement.innerHTML = '';
    backgroundLayerElement.removeAttribute('data-active-key');
    document.body.classList.remove('nemo-animated-bg-active');
    renderAnimatedSourceList();
}

function syncAnimatedBackgroundLayer() {
    syncBackgroundPanel();

    if (!backgroundLayerElement) {
        return;
    }

    const settings = ensureSettings();
    const descriptor = getAnimatedBackgroundDescriptor();

    if (!settings.enableAnimatedBackgrounds || !descriptor) {
        clearAnimatedBackgroundLayer();
        return;
    }

    const activeKey = `${descriptor.kind}:${descriptor.key}:${settings.animatedBackgroundMuted}:${settings.animatedBackgroundLoop}:${settings.animatedBackgroundAutoplay}:${settings.animatedBackgroundVolume}`;
    if (backgroundLayerElement.dataset.activeKey === activeKey) {
        const video = backgroundLayerElement.querySelector('video');
        if (video) {
            video.muted = settings.animatedBackgroundMuted;
            video.loop = settings.animatedBackgroundLoop;
            video.controls = settings.animatedBackgroundShowControls;
            video.volume = settings.animatedBackgroundMuted ? 0 : settings.animatedBackgroundVolume / 100;
            video.style.objectFit = getObjectFitValue();
        }
        renderAnimatedSourceList();
        return;
    }

    backgroundLayerElement.innerHTML = '';
    backgroundLayerElement.dataset.activeKey = activeKey;

    if (descriptor.kind === 'youtube') {
        const iframe = document.createElement('iframe');
        iframe.src = buildYouTubeEmbedUrl(descriptor.videoId);
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        backgroundLayerElement.appendChild(iframe);
    } else {
        const video = document.createElement('video');
        video.src = descriptor.src;
        video.muted = settings.animatedBackgroundMuted;
        video.loop = settings.animatedBackgroundLoop;
        video.controls = settings.animatedBackgroundShowControls;
        video.autoplay = settings.animatedBackgroundAutoplay;
        video.playsInline = true;
        video.preload = 'auto';
        video.volume = settings.animatedBackgroundMuted ? 0 : settings.animatedBackgroundVolume / 100;
        video.style.objectFit = getObjectFitValue();
        backgroundLayerElement.appendChild(video);

        const playPromise = video.play();
        if (playPromise?.catch) {
            playPromise.catch(() => {});
        }
    }

    document.body.classList.add('nemo-animated-bg-active');
    renderAnimatedSourceList();
}

function makeAnimatedSourceLabel(source) {
    if (isYouTubeUrl(source)) {
        const videoId = getYouTubeVideoId(source);
        return `YouTube ${videoId}`;
    }

    try {
        const url = new URL(source);
        const lastSegment = url.pathname.split('/').filter(Boolean).pop();
        return lastSegment || url.hostname;
    } catch {
        return source.split('/').pop() || source;
    }
}

function setCurrentBackgroundToSource(source) {
    const cssUrl = `url("${source}")`;
    const hasLockedBackground = Boolean(chat_metadata[BACKGROUND_LOCK_KEY]) && Boolean(getCurrentChatId());

    if (hasLockedBackground) {
        chat_metadata[BACKGROUND_LOCK_KEY] = cssUrl;
        saveMetadataDebounced();
    } else {
        background_settings.name = source;
        background_settings.url = cssUrl;
        saveSettingsDebounced();
    }

    const bgBase = document.getElementById('bg1');
    if (bgBase) {
        bgBase.style.backgroundImage = cssUrl;
    }
}

function applyAnimatedSource(source) {
    const trimmedSource = String(source || '').trim();
    if (!trimmedSource) {
        return;
    }

    const settings = ensureSettings();
    settings.savedAnimatedSources = [
        trimmedSource,
        ...settings.savedAnimatedSources.filter(item => item !== trimmedSource),
    ].slice(0, 16);

    setCurrentBackgroundToSource(trimmedSource);
    saveSettingsDebounced();
    renderAnimatedSourceList();
    scheduleBackgroundSync();
}

function renderAnimatedSourceList() {
    const container = document.getElementById('nemo-animated-bg-sources');
    if (!container) {
        return;
    }

    const settings = ensureSettings();
    const activeSource = getCurrentBackgroundReference();
    const sources = settings.savedAnimatedSources;

    if (!sources.length) {
        container.innerHTML = '<div class="nemo-animated-source-empty">Saved video and YouTube URLs will show up here.</div>';
        return;
    }

    container.innerHTML = '';
    sources.forEach(source => {
        const card = document.createElement('div');
        card.className = 'nemo-animated-source-card';
        if (source === activeSource) {
            card.classList.add('is-active');
        }

        const icon = isYouTubeUrl(source) ? 'fa-brands fa-youtube' : 'fa-solid fa-film';
        card.innerHTML = `
            <button class="nemo-animated-source-main" type="button">
                <i class="${icon}"></i>
                <span class="nemo-animated-source-label"></span>
            </button>
            <button class="menu_button menu_button_icon" type="button" title="Remove saved source">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;

        card.querySelector('.nemo-animated-source-label').textContent = makeAnimatedSourceLabel(source);
        card.querySelector('.nemo-animated-source-main').addEventListener('click', () => applyAnimatedSource(source));
        card.querySelector('.menu_button').addEventListener('click', () => {
            settings.savedAnimatedSources = settings.savedAnimatedSources.filter(item => item !== source);
            saveSettingsDebounced();
            renderAnimatedSourceList();
        });

        container.appendChild(card);
    });
}

function decorateBackgroundCards() {
    document.querySelectorAll('.bg_example[data-media-type="video"]').forEach(card => {
        if (!card.querySelector('.nemo-bg-media-badge')) {
            const badge = document.createElement('div');
            badge.className = 'nemo-bg-media-badge';
            badge.innerHTML = '<i class="fa-solid fa-film"></i><span>Video</span>';
            card.appendChild(badge);
        }

        const clipper = card.querySelector('.thumbnail-clipper');
        if (clipper && !clipper.classList.contains('nemo-video-thumb')) {
            clipper.classList.add('nemo-video-thumb');
            const fill = document.createElement('div');
            fill.className = 'nemo-video-thumb-fill';
            fill.innerHTML = '<i class="fa-solid fa-circle-play"></i>';
            clipper.prepend(fill);
        }
    });
}

function setSettingsPanelExpanded(expand) {
    const panel = document.getElementById('nemo-presetext-settings');
    if (!panel) {
        return;
    }

    const icon = panel.querySelector(':scope > .inline-drawer-header .inline-drawer-icon');
    const content = panel.querySelector(':scope > .inline-drawer-content');
    if (!(icon instanceof HTMLElement) || !(content instanceof HTMLElement)) {
        return;
    }

    icon.classList.toggle('down', !expand);
    icon.classList.toggle('fa-circle-chevron-down', !expand);
    icon.classList.toggle('up', expand);
    icon.classList.toggle('fa-circle-chevron-up', expand);
    content.style.display = expand ? 'block' : 'none';
}

function injectSettingsPanel() {
    const settingsContainer = document.getElementById('extensions_settings');
    if (!settingsContainer || document.getElementById('nemo-presetext-settings')) {
        syncSettingsPanel();
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'nemo-presetext-settings';
    panel.className = 'inline-drawer wide100p flexFlowColumn';
    panel.innerHTML = `
        <div class="inline-drawer-toggle inline-drawer-header">
            <div class="nemo-presetext-settings-heading">
                <strong>Bunny Preset Tools</strong>
                <div class="nemo-presetext-settings-subtitle">Prompt sections and animated backgrounds</div>
            </div>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content" style="display:none;">
            <div class="nemo-presetext-settings-body">
                <div class="nemo-presetext-settings-help">Prompt sections are added directly to the prompt manager. Animated background controls live in the Backgrounds drawer.</div>
                <div class="nemo-presetext-settings-row">
                    <label class="checkbox_label" for="nemo-presetext-enable-sections">
                        <input id="nemo-presetext-enable-sections" type="checkbox">
                        <span>Enable collapsible prompt sections</span>
                    </label>
                    <label class="checkbox_label" for="nemo-presetext-enable-animated">
                        <input id="nemo-presetext-enable-animated" type="checkbox">
                        <span>Enable animated backgrounds</span>
                    </label>
                </div>
                <div class="nemo-presetext-settings-row">
                    <input id="nemo-presetext-divider-patterns" class="text_pole" type="text" placeholder="Extra divider regex patterns, comma-separated">
                    <button id="nemo-presetext-save-divider-patterns" class="menu_button menu_button_icon" type="button">
                        <i class="fa-solid fa-save"></i>
                        <span>Save</span>
                    </button>
                </div>
                <div class="nemo-presetext-settings-help">Built-in divider patterns include headings that start with <code>===</code>, <code>---</code>, <code>***</code>, or symbol prefixes like <code>⭐─+</code>.</div>
            </div>
        </div>
    `;

    settingsContainer.appendChild(panel);

    panel.querySelector('#nemo-presetext-enable-sections').addEventListener('change', event => {
        ensureSettings().enablePromptSections = event.target.checked;
        saveSettingsDebounced();
        schedulePromptRefresh();
    });

    panel.querySelector('#nemo-presetext-enable-animated').addEventListener('change', event => {
        ensureSettings().enableAnimatedBackgrounds = event.target.checked;
        saveSettingsDebounced();
        scheduleBackgroundSync();
        syncBackgroundPanel();
    });

    panel.querySelector('#nemo-presetext-save-divider-patterns').addEventListener('click', () => {
        ensureSettings().dividerRegexPattern = String(panel.querySelector('#nemo-presetext-divider-patterns').value || '').trim();
        saveSettingsDebounced();
        schedulePromptRefresh();
    });

    syncSettingsPanel();
    requestAnimationFrame(() => setSettingsPanelExpanded(false));
    setTimeout(() => setSettingsPanelExpanded(false), 120);
}

function syncSettingsPanel() {
    const panel = document.getElementById('nemo-presetext-settings');
    if (!panel) {
        return;
    }

    const settings = ensureSettings();
    panel.querySelector('#nemo-presetext-enable-sections').checked = settings.enablePromptSections;
    panel.querySelector('#nemo-presetext-enable-animated').checked = settings.enableAnimatedBackgrounds;
    panel.querySelector('#nemo-presetext-divider-patterns').value = settings.dividerRegexPattern;
}

bootstrap();
setInterval(bootstrap, 1000);
eventSource.on(event_types.CHAT_CHANGED, scheduleBackgroundSync);
