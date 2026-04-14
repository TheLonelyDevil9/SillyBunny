import { getSettings, findConnectionProfile, listConnectionProfiles } from './tree-store.js';

async function callOpenAI(messages, apiKey, model, apiUrl) {
    const response = await fetch(apiUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 2048 }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Sidecar API error ${response.status}: ${err}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(messages, apiKey, model) {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model,
            max_tokens: 2048,
            system: systemMsg?.content || 'You are a helpful assistant.',
            messages: userMsgs,
        }),
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Sidecar Anthropic error ${response.status}: ${err}`);
    }
    const data = await response.json();
    return data.content?.[0]?.text || '';
}

/**
 * Generate using the default connection profile from settings
 * @param {string} prompt - User prompt
 * @param {string} [systemPrompt=''] - System prompt
 * @returns {Promise<string>}
 */
export async function sidecarGenerate(prompt, systemPrompt = '') {
    const s = getSettings();
    const profileId = s.connectionProfile ?? '';
    return sidecarGenerateWithProfile(prompt, systemPrompt, profileId);
}

/**
 * Generate using a specific connection profile
 * @param {string} prompt - User prompt
 * @param {string} [systemPrompt=''] - System prompt
 * @param {string} [profileId=''] - Connection profile ID (empty = use default/main model)
 * @param {number} [maxTokens=2048] - Maximum tokens for response
 * @returns {Promise<string>}
 */
export async function sidecarGenerateWithProfile(prompt, systemPrompt = '', profileId = '', maxTokens = 2048) {
    const ctx = window?.SillyTavern?.getContext?.();

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    // Try specified profile first
    if (ctx?.ConnectionManagerRequestService && profileId) {
        const CMRS = ctx.ConnectionManagerRequestService;
        try {
            const result = await CMRS.sendRequest(profileId, messages, maxTokens, {
                extractData: true,
                includePreset: true,
                stream: false,
            });
            return typeof result === 'string' ? result : result?.content || '';
        } catch (err) {
            console.warn(`[Pathfinder] Sidecar via profile "${profileId}" failed:`, err);
        }
    }

    // Fallback to main model
    const cm = ctx?.ConnectionManagerRequestService;
    if (cm) {
        try {
            const result = await cm.sendRequest('', messages, maxTokens, {
                extractData: true,
                includePreset: true,
                stream: false,
            });
            return typeof result === 'string' ? result : result?.content || '';
        } catch (err) {
            console.warn('[Pathfinder] Sidecar via main model failed:', err);
        }
    }

    return '';
}

export function isSidecarConfigured() {
    return true;
}

export function getSidecarModelLabel() {
    const s = getSettings();
    if (s.connectionProfile) return `profile: ${s.connectionProfile}`;
    return 'main model';
}