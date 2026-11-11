import { expect, test } from '@playwright/test';
import { openQuietChatForSmoke } from './chat-scroll-regression-helpers.js';
import { protectMaintainerServer } from './helpers/maintainer-server.js';

const IPHONE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PHONE_VIEWPORTS = [
    { width: 390, height: 844 },
    { width: 360, height: 780 },
];
const MODES = ['Roleplay', 'Conversation', 'Creator'];
const TOUCH_TARGET_PX = 44;
const SUBPIXEL_PX = 0.5;
const STARTUP_TIMEOUT = 20_000;

test.use({ serviceWorkers: 'block', contextOptions: { reducedMotion: 'reduce' } });
test.describe.configure({ timeout: 60_000 });

async function openModeMenu(page) {
    // The top bar ignores a press that closely follows the last one on the same button.
    await expect(async () => {
        await page.locator('#sb-mode-toggle').click();
        await expect(page.locator('#sb-mode-menu')).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: STARTUP_TIMEOUT });
}

async function waitForFiniteAnimations(page) {
    // Boxes read while the panel or the menu is still animating in are off, so measure once the finite animations end.
    await page.evaluate(async () => {
        const animations = document.getAnimations()
            .filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity);
        await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
    });
}

function readSwitchLayout(page) {
    return page.evaluate(() => {
        const box = (element) => {
            const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
            return { left, top, right, bottom, width, height };
        };
        const isShown = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
        const nameOf = element => element.getAttribute('aria-label') || element.title || element.id;
        const toggle = document.getElementById('sb-mode-toggle');
        const close = document.getElementById('sb-settings-close');

        return {
            toggle: { name: 'mode switch', ...box(toggle) },
            // The left group scrolls when the bar is cramped, and buttons scrolled out of view keep their boxes,
            // so only the group of the switch is compared.
            neighbours: [...toggle.closest('.sb-topbar-group-right').querySelectorAll('button')]
                .filter(button => button !== toggle && isShown(button))
                .map(button => ({ name: nameOf(button), ...box(button) })),
            close: close && isShown(close) ? { name: nameOf(close), ...box(close) } : null,
            entries: [...document.querySelectorAll('#sb-mode-menu [role="menuitemradio"]')]
                .map(item => ({ name: item.querySelector('.sb-mode-menu-label')?.textContent.trim(), ...box(item) })),
        };
    });
}

function overlaps(first, second) {
    return first.left < second.right - SUBPIXEL_PX
        && second.left < first.right - SUBPIXEL_PX
        && first.top < second.bottom - SUBPIXEL_PX
        && second.top < first.bottom - SUBPIXEL_PX;
}

function expectInside(inner, outer, message) {
    expect(inner.left, message).toBeGreaterThanOrEqual(outer.left - SUBPIXEL_PX);
    expect(inner.top, message).toBeGreaterThanOrEqual(outer.top - SUBPIXEL_PX);
    expect(inner.right, message).toBeLessThanOrEqual(outer.right + SUBPIXEL_PX);
    expect(inner.bottom, message).toBeLessThanOrEqual(outer.bottom + SUBPIXEL_PX);
}

function expectTouchTarget(rect, message) {
    expect(rect.width, message).toBeGreaterThanOrEqual(TOUCH_TARGET_PX - SUBPIXEL_PX);
    expect(rect.height, message).toBeGreaterThanOrEqual(TOUCH_TARGET_PX - SUBPIXEL_PX);
}

async function expectSwitchLayout(page) {
    await openModeMenu(page);
    await waitForFiniteAnimations(page);
    const layout = await readSwitchLayout(page);
    const { width, height } = page.viewportSize();
    const viewport = { left: 0, top: 0, right: width, bottom: height };
    const diagnostic = JSON.stringify(layout);

    expect(layout.entries.map(entry => entry.name), diagnostic).toEqual(MODES);
    for (const control of [layout.toggle, ...layout.entries]) {
        expectInside(control, viewport, `${control.name} inside the viewport: ${diagnostic}`);
        expectTouchTarget(control, `${control.name} touch target: ${diagnostic}`);
    }
    for (const neighbour of layout.neighbours) {
        expect(overlaps(layout.toggle, neighbour), `mode switch clear of ${neighbour.name}: ${diagnostic}`).toBe(false);
    }

    expect(layout.close, `the panel close button is shown: ${diagnostic}`).not.toBeNull();
    expectInside(layout.close, viewport, `panel close button inside the viewport: ${diagnostic}`);
    expect(overlaps(layout.toggle, layout.close), `mode switch clear of the panel close button: ${diagnostic}`).toBe(false);
    expectTouchTarget(layout.close, `panel close button touch target: ${diagnostic}`);
}

for (const phoneViewport of PHONE_VIEWPORTS) {
    test.describe(`workspace mode switch at ${phoneViewport.width}x${phoneViewport.height}`, () => {
        test.use({
            viewport: phoneViewport,
            isMobile: true,
            hasTouch: true,
            userAgent: IPHONE_USER_AGENT,
        });

        test.beforeEach(async ({ page }) => {
            await protectMaintainerServer(page);
            await openQuietChatForSmoke(page);
        });

        test('the mode switch and its menu fit the screen beside the open character list', async ({ page }) => {
            await page.evaluate(() => window.SillyBunnyShell.openTab('characters', 'characters'));
            await expect(page.locator('#right-nav-panel.openDrawer')).toHaveAttribute('data-menu-type', 'characters');
            await expectSwitchLayout(page);
        });

        test('the mode switch and its menu fit the screen beside the open character editor', async ({ page }) => {
            await page.evaluate(() => window.SillyBunnyShell.openTab('characters', 'editor'));
            await expect(page.locator('#right-nav-panel.openDrawer')).toHaveAttribute('data-menu-type', 'character_edit');
            await expectSwitchLayout(page);
        });
    });
}
