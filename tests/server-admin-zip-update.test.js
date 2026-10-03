import { describe, expect, jest, test } from '@jest/globals';

import { getCachedLatestZipReleaseStatus } from '../src/server-admin-zip-update.js';

const HOUR_MS = 60 * 60 * 1000;

function createCheck(statuses) {
    return jest.fn(async version => ({ currentVersion: version, ...statuses.shift() }));
}

describe('cached ZIP release status', () => {
    test('shares one GitHub check between concurrent callers', async () => {
        const check = createCheck([{ checked: true, canUpdate: true, latestVersion: '9.0.0' }]);

        const [first, second] = await Promise.all([
            getCachedLatestZipReleaseStatus('1.0.0', { now: 0, check }),
            getCachedLatestZipReleaseStatus('v1.0.0', { now: 0, check }),
        ]);

        expect(check).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
    });

    test('reuses successful checks for six hours, then checks again', async () => {
        const check = createCheck([
            { checked: true, canUpdate: false, latestVersion: '1.1.0' },
            { checked: true, canUpdate: true, latestVersion: '1.2.0' },
        ]);

        await getCachedLatestZipReleaseStatus('1.1.0', { now: 0, check });
        await getCachedLatestZipReleaseStatus('1.1.0', { now: 6 * HOUR_MS - 1, check });
        expect(check).toHaveBeenCalledTimes(1);

        const refreshed = await getCachedLatestZipReleaseStatus('1.1.0', { now: 6 * HOUR_MS, check });
        expect(check).toHaveBeenCalledTimes(2);
        expect(refreshed.latestVersion).toBe('1.2.0');
    });

    test('retries failed checks after thirty minutes instead of six hours', async () => {
        const check = createCheck([
            { checked: false, canUpdate: false },
            { checked: true, canUpdate: true, latestVersion: '2.1.0' },
        ]);

        await getCachedLatestZipReleaseStatus('2.0.0', { now: 0, check });
        await getCachedLatestZipReleaseStatus('2.0.0', { now: 30 * 60 * 1000 - 1, check });
        expect(check).toHaveBeenCalledTimes(1);

        const retried = await getCachedLatestZipReleaseStatus('2.0.0', { now: 30 * 60 * 1000, check });
        expect(retried.canUpdate).toBe(true);
    });

    test('force refreshes and stores the fresh result for later callers', async () => {
        const check = createCheck([
            { checked: true, canUpdate: false, latestVersion: '3.0.0' },
            { checked: true, canUpdate: true, latestVersion: '3.1.0' },
        ]);

        await getCachedLatestZipReleaseStatus('3.0.0', { now: 0, check });
        await getCachedLatestZipReleaseStatus('3.0.0', { now: 1, check, force: true });
        const cached = await getCachedLatestZipReleaseStatus('3.0.0', { now: 2, check });

        expect(check).toHaveBeenCalledTimes(2);
        expect(cached.latestVersion).toBe('3.1.0');
    });

    test('does not reuse a check made for a different installed version', async () => {
        const check = createCheck([
            { checked: true, canUpdate: true, latestVersion: '4.1.0' },
            { checked: true, canUpdate: false, latestVersion: '4.1.0' },
        ]);

        await getCachedLatestZipReleaseStatus('4.0.0', { now: 0, check });
        const afterUpdate = await getCachedLatestZipReleaseStatus('4.1.0', { now: 1, check });

        expect(check).toHaveBeenCalledTimes(2);
        expect(afterUpdate.canUpdate).toBe(false);
    });
});
