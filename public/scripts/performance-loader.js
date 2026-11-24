function activateDeferredStyles() {
    const styles = document.querySelectorAll('link[data-sb-deferred-style]:not([data-sb-panel-style])');

    for (const style of styles) {
        if (style.dataset.sbStyleActivated === 'true') {
            continue;
        }

        const deferredHref = style.getAttribute('data-sb-href');
        if (!style.getAttribute('href') && deferredHref) {
            style.setAttribute('href', deferredHref);
        }
        if (!style.getAttribute('href')) {
            continue;
        }

        // SillyBunny: retain settled state for consumers that subscribe after idle activation
        style.dataset.sbStyleState = 'loading';
        style.addEventListener('load', () => {
            style.dataset.sbStyleState = 'loaded';
            style.dataset.loaded = 'true';
        }, { once: true });
        style.addEventListener('error', () => {
            style.dataset.sbStyleState = 'error';
            style.dataset.loaded = 'false';
        }, { once: true });
        style.dataset.sbStyleActivated = 'true';
        style.rel = 'stylesheet';
        style.media = style.getAttribute('data-sb-media') || style.getAttribute('media') || 'all';
    }
}

function loadWideFontFallbacks() {
    activateDeferredStyles();
}

function scheduleIdleWork(callback) {
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(callback, { timeout: 2500 });
        return;
    }

    if (typeof window.setTimeout === 'function') {
        window.setTimeout(callback, 1200);
    }
}

let postReadyActivationScheduled = false;

function schedulePostAppReadyActivation() {
    if (postReadyActivationScheduled) {
        return;
    }

    postReadyActivationScheduled = true;
    scheduleIdleWork(activateDeferredStyles);
}

function hasAppReadyMark() {
    return Boolean(globalThis.performance?.getEntriesByName?.('sb-app-ready')?.length);
}

function waitForAppReadyThenActivate() {
    if (hasAppReadyMark()) {
        schedulePostAppReadyActivation();
        return;
    }

    if (typeof globalThis.PerformanceObserver === 'function'
        && Array.isArray(globalThis.PerformanceObserver.supportedEntryTypes)
        && globalThis.PerformanceObserver.supportedEntryTypes.includes('mark')) {
        try {
            const observer = new globalThis.PerformanceObserver((list) => {
                if (list.getEntries().some(entry => entry.name === 'sb-app-ready')) {
                    observer.disconnect();
                    schedulePostAppReadyActivation();
                }
            });
            observer.observe({ type: 'mark', buffered: true });
            if (hasAppReadyMark()) {
                observer.disconnect();
                schedulePostAppReadyActivation();
            }
            return;
        } catch {
            // Fall through to context readiness check when mark observation is unavailable.
        }
    }

    const bindContextReady = () => {
        const eventSource = window.SillyTavern?.getContext?.()?.eventSource;
        if (eventSource && typeof eventSource.on === 'function') {
            eventSource.on('app_ready', schedulePostAppReadyActivation);
            return true;
        }
        return false;
    };

    if (!bindContextReady() && typeof window.addEventListener === 'function') {
        window.addEventListener('load', () => {
            if (!bindContextReady()) {
                schedulePostAppReadyActivation();
            }
        }, { once: true, passive: true });
    }
}

window.SillyBunnyLoadStylesheet = activateDeferredStyles;
window.SillyBunnyLoadWideFontFallbacks = loadWideFontFallbacks;

waitForAppReadyThenActivate();
