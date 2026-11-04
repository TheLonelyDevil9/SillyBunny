import { expect, test } from '@playwright/test';
import { openQuietChatForSmoke } from './chat-scroll-regression-helpers.js';
import { installFixtureChats } from './helpers/fixture-chats.js';
import { protectMaintainerServer } from './helpers/maintainer-server.js';

test.use({ serviceWorkers: 'block', contextOptions: { reducedMotion: 'reduce' }, viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 60_000 });

const STARTUP_TIMEOUT = 20_000;
const creatorMode = '#sheld[data-sb-creator-mode="on"]';

async function openModeMenu(page) {
    // The top bar ignores a press that closely follows the last one on the same button.
    await expect(async () => {
        await page.locator('#sb-mode-toggle').click();
        await expect(page.locator('#sb-mode-menu')).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: STARTUP_TIMEOUT });
}

async function chooseMode(page, label) {
    await openModeMenu(page);
    await page.getByRole('menuitemradio', { name: new RegExp(label) }).click();
    // While the menu animates out, a press on the toggle closes it instead of opening a new one.
    await expect(page.locator('#sb-mode-menu')).toHaveCount(0);
}

async function expectHomeUnderneath(page) {
    await expect(page.locator(creatorMode)).toHaveCount(0, { timeout: STARTUP_TIMEOUT });
    await expect(page.locator('#sheld')).toHaveAttribute('data-sb-home', 'on');
    expect(await page.evaluate(() => window.SillyTavern.getContext().getCurrentChatId())).toBeUndefined();
}

test.describe('Creator opened on Home', () => {
    test.beforeEach(async ({ page }) => {
        await protectMaintainerServer(page);
        await installFixtureChats(page);
        await openQuietChatForSmoke(page, { selectCharacter: false });
        await expect(page.locator('#sheld')).toHaveAttribute('data-sb-home', 'on', { timeout: STARTUP_TIMEOUT });
        await chooseMode(page, 'Creator');
        await expect(page.locator(creatorMode)).toHaveCount(1, { timeout: STARTUP_TIMEOUT });
    });

    test('the switcher names Creator and checks it in the menu', async ({ page }) => {
        await expect(page.locator('#sb-mode-toggle')).toHaveAttribute('aria-label', 'Chat mode: Creator (Ctrl+M)');

        await openModeMenu(page);

        await expect(page.getByRole('menuitemradio', { name: /Creator/ })).toHaveAttribute('aria-checked', 'true');
        await expect(page.getByRole('menuitemradio', { name: /Roleplay/ })).toHaveAttribute('aria-checked', 'false');
    });

    test('choosing Roleplay closes Creator and opens no chat behind it', async ({ page }) => {
        await chooseMode(page, 'Roleplay');

        await expectHomeUnderneath(page);
        await expect(page.locator('#sb-mode-toggle')).not.toHaveAttribute('aria-label', 'Chat mode: Creator (Ctrl+M)');
    });

    test('Ctrl+M returns to Roleplay, not Conversation', async ({ page }) => {
        await page.keyboard.press('Control+m');

        await expect(page.locator(creatorMode)).toHaveCount(0, { timeout: STARTUP_TIMEOUT });
        // Conversation opens after Creator has closed, so its absence only counts once that has had time to happen.
        // eslint-disable-next-line playwright/no-wait-for-timeout -- nothing announces that a workspace did not open.
        await page.waitForTimeout(1500);
        await expect(page.locator('#sheld[data-sb-conversation-mode="on"]')).toHaveCount(0);
        await expectHomeUnderneath(page);
    });
});
