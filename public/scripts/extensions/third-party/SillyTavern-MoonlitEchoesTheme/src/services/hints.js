import { EXTENSION_NAME, THEME_VERSION } from '../config/theme-info.js';
import { getSettings as getExtensionSettings } from './settings-service.js';

function setHintContent(hintElement, usePresetTheme) {
    const supportMessage = usePresetTheme
        ? '<span>This SillyBunny fork is based on Moonlit Echoes Theme by</span> <a href="https://github.com/RivelleDays" target="_blank" rel="noopener noreferrer">Rivelle</a><span>. For this fork, contact</span> <a href="https://github.com/platberlitz" target="_blank" rel="noopener noreferrer">purachina</a><span>. As this is a fork, please don\'t contact Rivelle, who is the creator of the original Moonlit Echoes.</span>'
        : '<span data-i18n="customThemeIssue">This bundled SillyBunny fork may not work with all custom themes. Please troubleshoot first; if confirmed, contact</span> <a href="https://github.com/platberlitz" target="_blank" rel="noopener noreferrer">purachina</a><span>. As this is a fork, please don\'t contact Rivelle, who is the creator of the original Moonlit Echoes.</span>';

    hintElement.innerHTML = `<i class="fa-solid fa-info-circle"></i>  <b><span>You are currently using the bundled theme extension</span> ${EXTENSION_NAME} <a href="https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme" target="_blank">${THEME_VERSION}</a></b><br>
        <small>${supportMessage}</small>`;
    hintElement.style.borderLeft = usePresetTheme
        ? '3px solid var(--customThemeColor)'
        : '3px solid var(--SmartThemeBodyColor)';
}

/**
 * Ensure the Moonlit theme buttons hint is visible when the theme is enabled.
 */
export function addThemeButtonsHint() {
    const themesContainer = document.getElementById('UI-presets-block');
    if (!themesContainer) return;

    const context = SillyTavern.getContext();
    const settings = getExtensionSettings(context);

    if (!settings?.enabled) {
        const existingHint = document.getElementById('moonlit-theme-buttons-hint');
        if (existingHint) existingHint.remove();
        return;
    }

    if (document.getElementById('moonlit-theme-buttons-hint')) return;

    const hintElement = document.createElement('small');
    hintElement.id = 'moonlit-theme-buttons-hint';
    hintElement.style.margin = '5px 0';
    hintElement.style.padding = '5px 10px';
    hintElement.style.display = 'block';
    hintElement.style.lineHeight = '1.5';

    const themeSelector = document.getElementById('themes');
    let currentTheme = themeSelector ? themeSelector.value : '';

    setHintContent(hintElement, currentTheme.includes('- by Rivelle'));

    themesContainer.appendChild(hintElement);

    if (themeSelector) {
        themeSelector.addEventListener('change', () => {
            if (!settings?.enabled) {
                return;
            }

            const themeValue = themeSelector.value;
            setHintContent(hintElement, themeValue.includes('- by Rivelle'));
        });
    }
}
