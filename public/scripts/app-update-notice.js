import { getRequestHeaders } from '../script.js';
import { t } from './i18n.js';
import { isAdmin } from './user.js';
import { accountStorage } from './util/AccountStorage.js';

// SillyBunny: ZIP/release installs have no launcher-side update prompt, so admins
// get a toast pointing at Customize > Server, where the existing updater lives.
const NOTICE_STORAGE_KEY = 'SillyBunnyAppUpdateNotice';

function openServerUpdatePanel() {
    globalThis.SillyBunnyShell?.openTab?.('right', 'server');
}

async function checkForAppUpdate() {
    if (!isAdmin()) {
        return;
    }

    const response = await fetch('/api/server-admin/update-notice', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (!response.ok) {
        return;
    }

    const notice = await response.json();
    const latestVersion = String(notice?.latestVersion ?? '');
    // One toast per version per day; a newer release re-notifies immediately.
    const marker = `${latestVersion}|${new Date().toDateString()}`;

    if (!notice?.available || !latestVersion || accountStorage.getItem(NOTICE_STORAGE_KEY) === marker) {
        return;
    }

    accountStorage.setItem(NOTICE_STORAGE_KEY, marker);
    // DESIGN.md toasts: shared toast layer, sentence-case title, pointer-neutral copy,
    // and a timeout so a non-critical notice never sits over the chat.
    toastr.info(
        t`Installed: v${notice.currentVersion}. Open Customize > Server to update.`,
        t`SillyBunny v${latestVersion} is available`,
        {
            timeOut: 10000,
            extendedTimeOut: 5000,
            closeButton: true,
            preventDuplicates: true,
            onclick: openServerUpdatePanel,
        },
    );
}

/**
 * Runs the background release check after startup without delaying app init.
 */
export function doAppUpdateNoticeCheck() {
    setTimeout(() => {
        checkForAppUpdate().catch(error => console.warn('SillyBunny update notice check failed.', error));
    }, 1);
}
