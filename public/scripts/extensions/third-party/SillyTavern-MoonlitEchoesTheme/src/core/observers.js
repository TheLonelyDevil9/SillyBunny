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
 *
 * Only a ResizeObserver is needed — it fires precisely when the element's
 * box size changes, which is the only thing we care about. The previous
 * implementation used a body-wide MutationObserver (childList + subtree),
 * a form_sheld MutationObserver (childList + subtree + attributes +
 * characterData), triple-fire textarea input handlers, and multiple
 * delayed setTimeout chains — all to set a single CSS variable. The
 * ResizeObserver alone handles every case (typing, QR buttons, window
 * resize, orientation change, DOM reparenting) without polling or
 * scanning the entire DOM on every mutation.
 *
 * @returns {{update: function, start: function, stop: function}} Control helpers.
 */
export function initFormSheldHeightMonitor() {
    let isInitialized = false;

    function getAccurateHeight(element) {
        if (!element) return 0;
        return element.getBoundingClientRect().height;
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

    // Light body observer: only watches for form_sheld being added to the DOM
    // (e.g. after the shell system reparents content). Once found, attaches
    // the ResizeObserver and disconnects itself.
    const bodyObserver = new MutationObserver(() => {
        const formSheld = document.getElementById('form_sheld');
        if (formSheld && !isInitialized) {
            startObservers();
        }
    });

    function stopObservers() {
        resizeObserver.disconnect();
    }

    function startObservers() {
        stopObservers();

        const formSheld = document.getElementById('form_sheld');
        if (formSheld) {
            resizeObserver.observe(formSheld);
            updateFormSheldHeight();
            // form_sheld is present — no need to keep scanning the body
            bodyObserver.disconnect();
        }
    }

    // Deferred init: attach once the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => startObservers(), { once: true });
    } else {
        startObservers();
    }

    window.addEventListener('load', () => startObservers(), { once: true });

    // Fallback: if form_sheld isn't in the DOM yet, watch body for it
    if (!document.getElementById('form_sheld')) {
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    return {
        update: updateFormSheldHeight,
        start: startObservers,
        stop: stopObservers,
    };
}
