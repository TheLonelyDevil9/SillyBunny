import { getSettings as getExtensionSettings } from '../services/settings-service.js';

function stripOrigin(url) {
    if (!url) return '';
    if (url.startsWith(window.location.origin)) {
        return url.replace(window.location.origin, '');
    }
    return url;
}

function parseAvatarSource(rawSrc) {
    if (!rawSrc) return null;

    const normalized = stripOrigin(rawSrc);
    const trimmed = normalized.startsWith('/') ? normalized.slice(1) : normalized;

    try {
        const parsed = new URL(normalized, window.location.origin);
        if (parsed.pathname.endsWith('thumbnail')) {
            const type = parsed.searchParams.get('type');
            const file = parsed.searchParams.get('file');
            if (type && file) {
                return { type, file: decodeURIComponent(file) };
            }
        }
    } catch (err) {
        // Ignore URL parse errors and fall back to path inspection
    }

    if (trimmed.startsWith('characters/')) {
        return { type: 'avatar', file: trimmed.replace(/^characters\//, '') };
    }

    if (trimmed.startsWith('User Avatars/')) {
        return { type: 'persona', file: trimmed.replace(/^User Avatars\//, '') };
    }

    return { type: null, file: trimmed };
}

function getAvatarSources(rawSrc) {
    const info = parseAvatarSource(rawSrc);
    if (!info) {
        return { thumb: null, original: null };
    }

    const { type, file } = info;
    const ensureAbsolute = (path) => {
        if (!path) return '';
        return path.startsWith('/') ? path : `/${path}`;
    };

    const thumb =
        type === 'avatar' || type === 'persona'
            ? `/thumbnail?type=${type}&file=${encodeURIComponent(file)}`
            : ensureAbsolute(info.file);

    const original =
        type === 'avatar'
            ? ensureAbsolute(`characters/${file}`)
            : type === 'persona'
                ? ensureAbsolute(`User Avatars/${file}`)
                : ensureAbsolute(info.file);

    return {
        thumb: stripOrigin(thumb),
        original: stripOrigin(original),
    };
}

function applyAvatarSources(mes, avatarImg, preferOriginal) {
    const srcCandidate = avatarImg.getAttribute('src') || avatarImg.getAttribute('data-src');
    if (!srcCandidate) return;

    const { thumb, original } = getAvatarSources(srcCandidate);
    if (!thumb && !original) return;

    const thumbUrl = thumb || original;
    const originalUrl = original || thumbUrl;
    const targetUrl = preferOriginal ? originalUrl : thumbUrl;

    mes.dataset.avatarThumb = thumbUrl;
    mes.dataset.avatarOriginal = originalUrl;
    mes.dataset.avatar = targetUrl;

    mes.style.setProperty('--mes-avatar-thumb-url', `url('${thumbUrl}')`);
    mes.style.setProperty('--mes-avatar-original-url', `url('${originalUrl}')`);
    mes.style.setProperty('--mes-avatar-url', `url('${targetUrl}')`);

    const currentSrc = stripOrigin(avatarImg.getAttribute('src') || '');
    const desiredSrc = stripOrigin(targetUrl);
    if (desiredSrc && currentSrc !== desiredSrc) {
        avatarImg.setAttribute('src', targetUrl);
    }
}

/**
 * Initialize avatar injector observer.
 * Injects avatar URLs into message elements so they can be used in CSS.
 * @returns {function} Function to manually trigger avatar updates.
 */
export function initAvatarInjector() {
    function updateAvatars() {
        const context = SillyTavern.getContext();
        const settings = getExtensionSettings(context) || {};
        const preferOriginal = settings.useOriginalAvatarImages === true;

        document.querySelectorAll('.mes').forEach((mes) => {
            const avatarImg = mes.querySelector('.avatar img');
            if (!avatarImg) return;

            applyAvatarSources(mes, avatarImg, preferOriginal);
        });
    }

    updateAvatars();

    let debounceTimer;
    const observerCallback = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updateAvatars, 100);
    };

    const chatContainer = document.getElementById('chat');
    if (chatContainer) {
        const observer = new MutationObserver(observerCallback);
        observer.observe(chatContainer, { childList: true, subtree: true });
    }

    window.updateAvatars = updateAvatars;
    return updateAvatars;
}

/**
 * Initialize monitoring of #form_sheld height and expose helper controls.
 * @returns {{update: function, start: function, stop: function}} Control helpers.
 */
export function initFormSheldHeightMonitor() {
    let isInitialized = false;

    function getAccurateHeight(element) {
        if (!element) return 0;
        const rect = element.getBoundingClientRect();
        return rect.height;
    }

    function updateFormSheldHeight() {
        const formSheld = document.getElementById('form_sheld');
        if (formSheld) {
            const height = getAccurateHeight(formSheld);
            if (height > 0) {
                document.documentElement.style.setProperty('--formSheldHeight', `${height}px`);
                isInitialized = true;
            }
        }
    }

    const mutationObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;

        for (const mutation of mutations) {
            if (mutation.target.id === 'form_sheld' || mutation.target.closest?.('#form_sheld')) {
                shouldUpdate = true;
                break;
            }

            if (mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (
                        node.id === 'form_sheld' ||
                        (node.nodeType === 1 && node.querySelector && node.querySelector('#form_sheld'))
                    ) {
                        shouldUpdate = true;
                        break;
                    }
                }
            }
        }

        if (shouldUpdate) {
            setTimeout(updateFormSheldHeight, 0);
        }
    });

    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.target.id === 'form_sheld') {
                const { height } = entry.contentRect;
                if (height > 0) {
                    document.documentElement.style.setProperty('--formSheldHeight', `${height}px`);
                    isInitialized = true;
                }
            }
        }
    });

    function stopObservers() {
        resizeObserver.disconnect();
        mutationObserver.disconnect();
    }

    function startObservers() {
        stopObservers();

        const formSheld = document.getElementById('form_sheld');
        if (formSheld) {
            resizeObserver.observe(formSheld);
            mutationObserver.observe(formSheld, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true,
            });

            const parent = formSheld.parentElement;
            if (parent) {
                mutationObserver.observe(parent, {
                    attributes: true,
                    attributeFilter: ['style', 'class'],
                });
            }

            updateFormSheldHeight();
        }
    }

    const bodyObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (
                        node.id === 'form_sheld' ||
                        (node.nodeType === 1 && node.querySelector && node.querySelector('#form_sheld'))
                    ) {
                        setTimeout(startObservers, 50);
                        return;
                    }
                }
            }
        }

        const formSheld = document.getElementById('form_sheld');
        if (formSheld && !isInitialized) {
            setTimeout(startObservers, 50);
        }
    });

    function onTextAreaInput() {
        updateFormSheldHeight();
        setTimeout(updateFormSheldHeight, 10);
        setTimeout(updateFormSheldHeight, 100);
    }

    function setupTextAreaListener() {
        const textArea = document.getElementById('send_textarea');
        if (textArea) {
            textArea.removeEventListener('input', onTextAreaInput);
            textArea.addEventListener('input', onTextAreaInput);
        }
    }

    window.addEventListener('resize', updateFormSheldHeight);
    window.addEventListener('orientationchange', () => {
        updateFormSheldHeight();
        setTimeout(updateFormSheldHeight, 100);
        setTimeout(updateFormSheldHeight, 500);
    });

    document.addEventListener('DOMContentLoaded', () => {
        startObservers();
        setupTextAreaListener();
        updateFormSheldHeight();
        setTimeout(updateFormSheldHeight, 100);
        setTimeout(updateFormSheldHeight, 500);
        setTimeout(updateFormSheldHeight, 1000);
    });

    window.addEventListener('load', () => {
        startObservers();
        setupTextAreaListener();
        updateFormSheldHeight();
        setTimeout(updateFormSheldHeight, 500);
    });

    function setupUIListeners() {
        document.querySelectorAll('#qr--bar .qr--option').forEach((button) => {
            button.addEventListener('click', () => {
                setTimeout(updateFormSheldHeight, 10);
                setTimeout(updateFormSheldHeight, 100);
            });
        });

        const optionsButton = document.getElementById('options_button');
        if (optionsButton) {
            optionsButton.addEventListener('click', () => {
                setTimeout(updateFormSheldHeight, 10);
                setTimeout(updateFormSheldHeight, 100);
            });
        }
    }

    setTimeout(setupUIListeners, 1000);

    bodyObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });

    startObservers();
    setupTextAreaListener();
    updateFormSheldHeight();

    return {
        update: updateFormSheldHeight,
        start: startObservers,
        stop: stopObservers,
    };
}
