import {
    characters,
    chat,
    deleteCharacterChatByName,
    displayVersion,
    doNewChat,
    event_types,
    eventSource,
    getCharacters,
    getCurrentChatId,
    getRequestHeaders,
    getThumbnailUrl,
    is_send_press,
    main_api,
    newAssistantChat,
    openCharacterChat,
    printCharactersDebounced,
    renameGroupOrCharacterChat,
    saveSettingsDebounced,
    selectCharacterById,
    setActiveCharacter,
    setActiveGroup,
    system_avatar,
    this_chid,
    updateRemoteChatName,
} from '../script.js';
import { deleteGroupChatByName, getGroupAvatar, groups, is_group_generating, openGroupById, openGroupChat } from './group-chats.js';
import { enableExtension, findExtension, installExtension } from './extensions.js';
import { t } from './i18n.js';
import { getPresetManager } from './preset-manager.js';
import { callGenericPopup, POPUP_TYPE } from './popup.js';
import { renderTemplateAsync } from './templates.js';
import { isAdmin } from './user.js';
import { accountStorage } from './util/AccountStorage.js';
import { flashHighlight, isElementInViewport, sortMoments, timestampToMoment } from './utils.js';

const assistantAvatarKey = 'assistant';
const pinnedChatsKey = 'pinnedChats';
const tutorialStatusKey = 'WelcomePage_TutorialStatus';
const welcomeDeckViewKey = 'WelcomePage_DeckView';
const welcomeDeckCollapsedKey = 'WelcomePage_DeckCollapsed';
const DEFAULT_BUNDLED_ASSISTANT_ID = 'guide';
const bundledAssistantNahidaAvatarKey = 'bundledAssistantNahidaAvatar';
const DEFAULT_NEUTRAL_ASSISTANT_NAME = 'Assistant';

const DEFAULT_DISPLAYED = 3;
const MAX_DISPLAYED = 15;
const STARTER_PACK_PRESET_NAME_SILLYBUNNY = 'Pura\'s Director Preset (SillyBunny)';
const STARTER_PACK_PRESET_NAME_SILLYTAVERN = 'Pura\'s Director Preset (SillyTavern)';
const STARTER_PACK_PRESET_TITLE = 'Pura\'s Director Presets';
const STARTER_PACK_CREATOR_NAME = 'purachina';
const STARTER_PACK_SITE_URL = 'https://platberlitz.github.io/';
const GEECHAN_SITE_URL = 'https://rentry.org/geechan';
const TLD_CHUB_URL = 'https://chub.ai/users/thelonelydevil';
const TLD_DISCORD_PALS_URL = 'https://github.com/TheLonelyDevil9/discord-pals/';
const STARTER_PACK_EXTENSIONS = Object.freeze({
    dialogueColors: Object.freeze({
        id: 'third-party/sillytavern-character-colors',
        repoUrl: 'https://github.com/platberlitz/sillytavern-character-colors',
    }),
    quickImageGen: Object.freeze({
        id: 'third-party/sillytavern-image-gen',
        repoUrl: 'https://github.com/platberlitz/sillytavern-image-gen',
    }),
    summarySharder: Object.freeze({
        id: 'third-party/summary-sharder',
        repoUrl: 'https://github.com/Promansis/summary-sharder',
    }),
    guidedGenerations: Object.freeze({
        id: 'third-party/GuidedGenerations-Extension',
        repoUrl: 'https://github.com/platberlitz/GuidedGenerations-Extension',
    }),
});

const WELCOME_TUTORIAL_STEPS = Object.freeze([
    {
        title: 'Start on Home',
        body: 'Home is your calm launchpad. You can start a Temporary Chat, open the built-in assistant, or pull in sample characters before touching the deeper controls.',
        hint: 'If you just want to poke around safely, Temporary Chat is the fastest low-pressure starting point.',
        chips: ['Home', 'Temporary Chat', 'Open Assistant', 'Sample Characters'],
        actionLabel: 'Open Assistant',
        actionType: 'open-assistant',
        actionValue: '',
    },
    {
        title: 'Connect a model',
        body: 'The API tab is where you connect a provider and choose the model that will actually respond. If characters cannot send replies yet, this is usually the first place to check.',
        hint: 'Providers host models. Models generate the text. SillyBunny needs one working connection before chat can begin.',
        chips: ['API', 'Providers', 'Models', 'Connection'],
        actionLabel: 'Open API',
        actionType: 'open-tab',
        actionValue: 'left:api',
    },
    {
        title: 'Shape the replies',
        body: 'Presets change the feel of responses. Advanced Formatting controls templates and prompt structure. World Info helps the model remember lore and setting details.',
        hint: 'You do not need to master every knob at once. Start with a preset, then adjust deeper tools only when a chat needs them.',
        chips: ['Presets', 'Advanced Formatting', 'World Info', 'Context'],
        actionLabel: 'Open Presets',
        actionType: 'open-tab',
        actionValue: 'left:presets',
    },
    {
        title: 'Personalize the workspace',
        body: 'The right shell handles your atmosphere and extras. This is where you enable optional extensions, manage personas, and tune the look of the workspace.',
        hint: 'Extensions are optional. SillyBunny ships a starter pack here, but nothing turns itself on without your permission.',
        chips: ['Settings', 'Extensions', 'Persona', 'Background'],
        actionLabel: 'Open Extensions',
        actionType: 'open-tab',
        actionValue: 'right:extensions',
    },
    {
        title: 'Ask the bunny when stuck',
        body: 'The default welcome assistant is a beginner-friendly bunny guide. It can explain LLM basics, SillyBunny concepts, and SillyTavern terms without assuming you already know the jargon.',
        hint: 'A good first question is the difference between providers, models, presets, personas, and world info.',
        chips: ['LLM basics', 'SillyBunny tips', 'SillyTavern terms', 'Show Launchpad'],
        actionLabel: 'Prefill a beginner question',
        actionType: 'assistant-prompt',
        actionValue: 'Explain the difference between providers, models, presets, personas, and world info in simple terms.',
    },
]);

const WELCOME_GUIDE_CARDS = Object.freeze([
    {
        title: 'What the left shell is for',
        body: 'Use the left shell when you want to change how the AI behaves: connect APIs, swap presets, tune formatting, or load lore and agent helpers.',
        chips: ['Presets', 'API', 'Advanced Formatting', 'World Info', 'Agents'],
        icon: 'fa-compass-drafting',
        actionLabel: 'Open the left shell',
        actionType: 'open-tab',
        actionValue: 'left:presets',
    },
    {
        title: 'What the right shell is for',
        body: 'Use the right shell when you want to change your setup: app settings, extensions, personas, and the visual feel of the workspace live there.',
        chips: ['Settings', 'Extensions', 'Persona', 'Background'],
        icon: 'fa-sliders',
        actionLabel: 'Open the right shell',
        actionType: 'open-tab',
        actionValue: 'right:settings',
    },
    {
        title: 'What the big home buttons mean',
        body: 'Temporary Chat is for low-stakes testing. Open Assistant brings up your guide character. Sample Characters and Import Characters are the easiest ways to start an actual conversation.',
        chips: ['Temporary Chat', 'Open Assistant', 'Sample Characters', 'Import Characters'],
        icon: 'fa-hand-pointer',
        actionLabel: 'Browse sample characters',
        actionType: 'open-sample-characters',
        actionValue: '',
    },
    {
        title: 'What to do when confused',
        body: 'Show the Launchpad, ask the bunny guide a plain-English question, or open the docs. You should not need to memorize the whole interface to start using it.',
        chips: ['Show Launchpad', 'Bunny guide', 'Docs', 'Start small'],
        icon: 'fa-life-ring',
        actionLabel: 'Show Launchpad',
        actionType: 'replay-tutorial',
        actionValue: '',
    },
]);

const WELCOME_ASSISTANT_QUESTIONS = Object.freeze([
    'What is an LLM, in plain English?',
    'Why can\'t I send messages yet?',
    'What does a preset actually change?',
    'How is SillyBunny different from base SillyTavern?',
]);

const WELCOME_BUNDLED_ASSISTANTS = Object.freeze([
    Object.freeze({
        id: 'guide',
        avatarStorageKey: assistantAvatarKey,
        defaultAvatar: 'default_SillyBunnyGuide.png',
        fileName: 'default_SillyBunnyGuide',
        portrait: 'img/sillybunny-guide-assistant-portrait.png',
        portraitAlt: 'Pixel-art bunny guide portrait',
        characterName: DEFAULT_NEUTRAL_ASSISTANT_NAME,
        title: 'Bunny Guide',
        body: 'The bundled bunny guide is a real CCv3 character card. It can explain what an LLM is, what providers and models mean, how SillyBunny differs from stock SillyTavern, and where presets, personas, and world info fit into the flow.',
        credit: 'Bundled with SillyBunny.',
        creator: 'SillyBunny',
        creatorNotes: 'Automatically created bundled Bunny Guide character. Feel free to edit.',
        description: 'A calm built-in bunny guide for explaining SillyBunny, SillyTavern, model providers, presets, personas, and related basics in plain English.',
        personality: 'Patient, beginner-friendly, calm, and practical.',
        scenario: 'You are the built-in Bunny Guide for SillyBunny. Help the user understand the interface, APIs, presets, prompt settings, personas, and world info in plain, approachable language.',
        firstMessage: 'Hi. I\'m the Bunny Guide. If anything in SillyBunny feels confusing, ask in plain English and I\'ll walk through it with you step by step.',
        chips: Object.freeze(['LLM basics', 'SillyBunny help', 'Plain English', 'Bundled']),
        questions: WELCOME_ASSISTANT_QUESTIONS,
        actionLabel: 'Open Bunny Guide',
        actionIcon: 'fa-user-graduate',
        cardIcon: 'fa-user-graduate',
    }),
    Object.freeze({
        id: 'nahida',
        avatarStorageKey: bundledAssistantNahidaAvatarKey,
        defaultAvatar: 'default_AssistantNahida.png',
        fileName: 'default_AssistantNahida',
        cardAsset: 'img/assistant-nahida-portrait.png',
        portrait: 'img/assistant-nahida-portrait.png',
        portraitAlt: 'Assistant Nahida portrait',
        characterName: 'Assistant Nahida',
        title: 'Assistant Nahida',
        body: 'Assistant Nahida is a separate bundled helper with a calmer, bookish guide tone for prompts, presets, context, and general setup questions when you want another helper alongside the bunny.',
        credit: 'Assistant Nahida was made by Geechan.',
        creator: 'Geechan',
        creatorNotes: 'Bundled with SillyBunny. Assistant Nahida was made by Geechan. Feel free to edit.',
        description: 'Assistant Nahida is a bundled SillyBunny helper who explains prompts, token budgeting, presets, context setup, and workflow choices in calm, beginner-friendly language.',
        personality: 'Patient, observant, encouraging, thoughtful, and concise.',
        scenario: 'You are Assistant Nahida, a bundled helper for SillyBunny. Guide the user through prompts, token budgeting, presets, reasoning settings, context size, and general workflow questions with calm clarity.',
        firstMessage: 'Hello. I\'m Assistant Nahida, a bundled helper made by Geechan. If you want, we can sort out prompts, presets, context size, or any confusing settings together.',
        chips: Object.freeze(['Geechan', 'Prompts', 'Context', 'Workflow']),
        questions: Object.freeze([
            'Can you help me make sense of my prompts and token budget?',
            'What should I tune first: model, preset, or prompt settings?',
        ]),
        actionLabel: 'Open Assistant Nahida',
        actionIcon: 'fa-leaf',
        cardIcon: 'fa-book-open',
    }),
]);

const WELCOME_DECK_VIEWS = Object.freeze([
    {
        id: 'tour',
        title: 'First Steps',
        summary: 'A guided five-step tour for brand-new users.',
        icon: 'fa-route',
    },
    {
        id: 'basics',
        title: 'Core Buttons',
        summary: 'A plain-English map of what the big controls do.',
        icon: 'fa-compass-drafting',
    },
    {
        id: 'guide',
        title: 'Bunny Guide + Assistant Nahida',
        summary: 'Two bundled helpers for plain-English setup help.',
        icon: 'fa-user-graduate',
    },
    {
        id: 'starter',
        title: 'Starter Pack',
        summary: 'Optional bundled extras, presets, and creator picks.',
        icon: 'fa-gift',
    },
]);

/**
 * @typedef {Pick<RecentChat, 'group' | 'avatar' | 'file_name'>} PinnedChat
 */

/**
 * Manages pinned chat storage and operations.
 */
class PinnedChatsManager {
    /** @type {Record<string, PinnedChat> | null} */
    static #cachedState = null;

    /**
     * Initializes the cached state from storage.
     * Should be called once on app init.
     */
    static init() {
        this.#cachedState = this.#loadFromStorage();
    }

    /**
     * Loads state from storage.
     * @returns {Record<string, PinnedChat>}
     */
    static #loadFromStorage() {
        const pinnedState = /** @type {Record<string, PinnedChat>} */ ({});
        const value = accountStorage.getItem(pinnedChatsKey);
        if (value) {
            try {
                Object.assign(pinnedState, JSON.parse(value));
            } catch (error) {
                console.warn('Failed to parse pinned chats from storage.', error);
            }
        }
        return pinnedState;
    }

    /**
     * Generates a key for pinned chat storage.
     * @param {RecentChat} recentChat Recent chat data
     * @returns {string} Key for pinned chat storage
     */
    static getKey(recentChat) {
        return `${recentChat.group ? 'group_' + recentChat.group : ''}${recentChat.avatar ? 'char_' + recentChat.avatar : ''}_${recentChat.file_name}`;
    }

    /**
     * Gets the pinned chat state from cache.
     * @returns {Record<string, PinnedChat>}
     */
    static getState() {
        if (this.#cachedState === null) {
            this.#cachedState = this.#loadFromStorage();
        }
        return this.#cachedState;
    }

    /**
     * Saves the pinned chat state to storage and updates cache.
     * @param {Record<string, PinnedChat>} state The state to save
     */
    static #saveState(state) {
        this.#cachedState = state;
        accountStorage.setItem(pinnedChatsKey, JSON.stringify(state));
    }

    /**
     * Checks if a chat is pinned.
     * @param {RecentChat} recentChat Recent chat data
     * @returns {boolean} True if the chat is pinned, false otherwise
     */
    static isPinned(recentChat) {
        const pinKey = this.getKey(recentChat);
        const pinState = this.getState();
        return pinKey in pinState;
    }

    /**
     * Toggles the pinned state of a chat.
     * @param {RecentChat} recentChat Recent chat data
     * @param {boolean} pinned New pinned state
     */
    static toggle(recentChat, pinned) {
        const pinKey = this.getKey(recentChat);
        const pinState = { ...this.getState() };
        if (pinned) {
            pinState[pinKey] = {
                group: recentChat.group,
                avatar: recentChat.avatar,
                file_name: recentChat.file_name,
            };
        } else {
            delete pinState[pinKey];
        }
        this.#saveState(pinState);
    }

    /**
     * Gets all pinned chats.
     * @returns {PinnedChat[]}
     */
    static getAll() {
        const pinState = this.getState();
        return Object.values(pinState);
    }
}

function getBundledAssistantConfig(assistantId = DEFAULT_BUNDLED_ASSISTANT_ID) {
    return WELCOME_BUNDLED_ASSISTANTS.find(item => item.id === assistantId) ?? WELCOME_BUNDLED_ASSISTANTS[0];
}

function setBundledAssistantStoredAvatar(config, avatar) {
    if (!avatar || avatar === config.defaultAvatar) {
        accountStorage.removeItem(config.avatarStorageKey);
        return;
    }

    accountStorage.setItem(config.avatarStorageKey, avatar);
}

function getBundledAssistantAvatar(config = getBundledAssistantConfig()) {
    const assistantAvatar = accountStorage.getItem(config.avatarStorageKey);
    if (assistantAvatar === null) {
        return config.defaultAvatar;
    }

    const character = characters.find(x => x.avatar === assistantAvatar);
    if (character === undefined) {
        accountStorage.removeItem(config.avatarStorageKey);
        return config.defaultAvatar;
    }

    return assistantAvatar;
}

export function getPermanentAssistantAvatar() {
    return getBundledAssistantAvatar(getBundledAssistantConfig(DEFAULT_BUNDLED_ASSISTANT_ID));
}

/**
 * Finds the permanent assistant character in the loaded character list.
 * Falls back to the default assistant avatar if a custom assistant pointer became stale.
 * @param {string} avatar Assistant avatar name
 * @returns {number} Character ID or -1 if not found
 */
function findBundledAssistantCharacterId(config, avatar = getBundledAssistantAvatar(config)) {
    const requestedCharacterId = characters.findIndex(x => x.avatar === avatar);
    if (requestedCharacterId >= 0) {
        return requestedCharacterId;
    }

    if (avatar !== config.defaultAvatar) {
        const defaultCharacterId = characters.findIndex(x => x.avatar === config.defaultAvatar);
        if (defaultCharacterId >= 0) {
            accountStorage.removeItem(config.avatarStorageKey);
            return defaultCharacterId;
        }
    }

    return -1;
}

/**
 * Resolves the configured assistant to a loaded character, creating it on demand when needed.
 * @param {object} [options]
 * @param {boolean} [options.tryCreate=true] Whether a missing assistant should be created automatically.
 * @param {boolean} [options.created=false] Whether the current resolution came from a fresh create flow.
 * @returns {Promise<{avatar: string, characterId: number, created: boolean} | null>}
 */
async function ensureBundledAssistantCharacter(config, { tryCreate = true, created = false } = {}) {
    const avatar = getBundledAssistantAvatar(config);
    const characterId = findBundledAssistantCharacterId(config, avatar);

    if (characterId !== -1) {
        return { avatar, characterId, created };
    }

    if (!tryCreate) {
        console.error(`Character not found for avatar ID: ${avatar}. Cannot create.`);
        return null;
    }

    try {
        console.log(`Character not found for avatar ID: ${avatar}. Creating new bundled assistant.`, config.id);
        await createBundledAssistant(config);
        return ensureBundledAssistantCharacter(config, { tryCreate: false, created: true });
    } catch (error) {
        console.error(`Error creating bundled assistant "${config.id}":`, error);
        toastr.error(t`Failed to create ${config.characterName}. See console for details.`);
        return null;
    }
}

function getTutorialStatus() {
    return getWelcomeUiPreference(tutorialStatusKey) || '';
}

function isWelcomeDeckView(view) {
    return WELCOME_DECK_VIEWS.some(item => item.id === view);
}

function getInitialDeckView() {
    const storedView = getWelcomeUiPreference(welcomeDeckViewKey) || '';

    if (isWelcomeDeckView(storedView)) {
        return storedView;
    }

    return 'tour';
}

function isWelcomeDeckCollapsed() {
    const stored = getWelcomeUiPreference(welcomeDeckCollapsedKey);
    return stored === null ? true : stored === 'true';
}

function getWelcomeUiPreference(key) {
    try {
        const localValue = globalThis.localStorage?.getItem(key) ?? null;

        if (localValue !== null) {
            if (accountStorage.getItem(key) !== localValue) {
                accountStorage.setItem(key, localValue);
            }

            return localValue;
        }
    } catch {
        // Fall through to the account-backed preference.
    }

    return accountStorage.getItem(key);
}

function setWelcomeUiPreference(key, value) {
    const stringValue = String(value);
    accountStorage.setItem(key, stringValue);

    try {
        globalThis.localStorage?.setItem(key, stringValue);
    } catch {
        // Ignore storage access failures and keep the account-backed preference.
    }
}

function buildDeckTabs(activeView) {
    return WELCOME_DECK_VIEWS.map(item => ({
        ...item,
        active: item.id === activeView,
    }));
}

function buildGuideCards() {
    return WELCOME_GUIDE_CARDS.map(card => ({
        ...card,
        chips: [...card.chips],
        chipColumnCount: Math.max(2, Math.min(card.chips.length || 1, 4)),
    }));
}

function buildBundledAssistantCards() {
    return WELCOME_BUNDLED_ASSISTANTS.map((assistant) => ({
        id: assistant.id,
        title: assistant.title,
        body: assistant.body,
        credit: assistant.credit,
        portrait: assistant.portrait,
        portraitAlt: assistant.portraitAlt,
        actionLabel: assistant.actionLabel,
        actionIcon: assistant.actionIcon,
        cardIcon: assistant.cardIcon,
        chips: [...assistant.chips],
        chipColumnCount: Math.max(2, Math.min(assistant.chips.length || 1, 4)),
        questions: [...assistant.questions],
        hasQuestions: assistant.questions.length > 0,
    }));
}

function buildTutorialSteps() {
    return WELCOME_TUTORIAL_STEPS.map((step, index) => ({
        ...step,
        chips: [...step.chips],
        stepNumber: index + 1,
        active: index === 0,
    }));
}

function getStarterPackExtensionConfig(extensionName) {
    return Object.values(STARTER_PACK_EXTENSIONS).find(extension => extension.id === extensionName) ?? null;
}

function buildExtensionStarterPackItem({ title, body, icon, chips, extensionName }) {
    const extension = findExtension(extensionName);
    const extensionConfig = getStarterPackExtensionConfig(extensionName);
    const chipColumnCount = Math.max(2, Math.min(chips.length || 1, 4));

    if (!extension && extensionConfig) {
        return {
            title,
            body,
            icon,
            chips: [...chips],
            chipColumnCount,
            statusLabel: 'Git install',
            statusTone: 'warm',
            actionIcon: 'fa-download',
            actionLabel: isAdmin() ? 'Install for all users' : 'Install for me',
            actionType: 'install-starter-extension',
            actionValue: extensionName,
        };
    }

    if (!extension) {
        return {
            title,
            body,
            icon,
            chips: [...chips],
            chipColumnCount,
            statusLabel: 'Unavailable',
            statusTone: 'neutral',
            actionIcon: 'fa-arrow-up-right-from-square',
            actionLabel: 'Open Extensions',
            actionType: 'open-tab',
            actionValue: 'right:extensions',
        };
    }

    if (extension.enabled) {
        return {
            title,
            body,
            icon,
            chips: [...chips],
            chipColumnCount,
            statusLabel: 'Enabled',
            statusTone: 'good',
            actionIcon: 'fa-arrow-up-right-from-square',
            actionLabel: 'Manage in Extensions',
            actionType: 'open-tab',
            actionValue: 'right:extensions',
        };
    }

    return {
        title,
        body,
        icon,
        chips: [...chips],
        chipColumnCount,
        statusLabel: 'Installed',
        statusTone: 'warm',
        actionLabel: 'Enable and reload',
        actionIcon: 'fa-wand-magic-sparkles',
        actionType: 'enable-extension',
        actionValue: extension.name,
    };
}

function buildPresetStarterPackItem() {
    const presetManager = getPresetManager('openai');
    const sillyBunnyPreset = presetManager?.findPreset(STARTER_PACK_PRESET_NAME_SILLYBUNNY);
    const sillyTavernPreset = presetManager?.findPreset(STARTER_PACK_PRESET_NAME_SILLYTAVERN);
    const isOpenAiStyleApi = main_api === 'openai';
    const selectedPresetName = isOpenAiStyleApi ? presetManager?.getSelectedPresetName() : '';
    const selectedVariant = selectedPresetName === STARTER_PACK_PRESET_NAME_SILLYBUNNY
        ? 'SillyBunny'
        : (selectedPresetName === STARTER_PACK_PRESET_NAME_SILLYTAVERN ? 'SillyTavern' : '');
    const hasPresetPair = Boolean(sillyBunnyPreset && sillyTavernPreset);
    const chips = ['OpenAI-style', 'Two versions', 'Agents-aware', STARTER_PACK_CREATOR_NAME];
    const chipColumnCount = Math.max(2, Math.min(chips.length, 4));
    const body = `${STARTER_PACK_CREATOR_NAME}'s Director Preset now ships in two versions: the SillyTavern one includes the Toggle and Randomiser prompts, while the SillyBunny version keeps the Main, the Primary Toggles, and the Prefill Toggles only because Agents already cover the optional toggles and randomiser prompts.`;

    if (!isOpenAiStyleApi) {
        return {
            title: STARTER_PACK_PRESET_TITLE,
            body: `${body} Switch to an OpenAI-compatible chat-completions setup first, then you can apply either version here.`,
            icon: 'fa-sliders',
            chips,
            chipColumnCount,
            statusLabel: 'OpenAI-style only',
            statusTone: 'neutral',
            actionIcon: 'fa-arrow-up-right-from-square',
            actionLabel: 'Open API',
            actionType: 'open-tab',
            actionValue: 'left:api',
        };
    }

    if (hasPresetPair) {
        return {
            title: STARTER_PACK_PRESET_TITLE,
            body: selectedVariant
                ? `${body} The ${selectedVariant} version is selected right now.`
                : `${body} Both versions are bundled and ready to apply without importing files by hand.`,
            icon: 'fa-sliders',
            chips,
            chipColumnCount,
            statusLabel: selectedVariant ? `Selected: ${selectedVariant}` : 'Ready',
            statusTone: selectedVariant ? 'good' : 'warm',
            actionIcon: 'fa-wand-magic-sparkles',
            actionLabel: 'Apply SillyBunny',
            actionType: 'apply-preset',
            actionValue: STARTER_PACK_PRESET_NAME_SILLYBUNNY,
            secondaryActionLabel: 'Apply SillyTavern',
            secondaryActionIcon: 'fa-wand-magic-sparkles',
            secondaryActionType: 'apply-preset',
            secondaryActionValue: STARTER_PACK_PRESET_NAME_SILLYTAVERN,
        };
    }

    return {
        title: STARTER_PACK_PRESET_TITLE,
        body: `${body} Open the preset panel if you need to check what is available.`,
        icon: 'fa-sliders',
        chips,
        chipColumnCount,
        statusLabel: 'Open Presets',
        statusTone: 'warm',
        actionIcon: 'fa-arrow-up-right-from-square',
        actionLabel: 'Open Presets',
        actionType: 'open-tab',
        actionValue: 'left:presets',
    };
}

function buildLinkStarterPackItem({
    title,
    body,
    icon,
    chips,
    actionLabel,
    actionValue,
    secondaryActionLabel = '',
    secondaryActionValue = '',
    statusLabel = 'Bundled',
    statusTone = 'warm',
}) {
    return {
        title,
        body,
        icon,
        chips: [...chips],
        chipColumnCount: Math.max(2, Math.min(chips.length || 1, 4)),
        statusLabel,
        statusTone,
        actionLabel,
        actionIcon: 'fa-arrow-up-right-from-square',
        actionType: 'open-link',
        actionValue,
        secondaryActionLabel,
        secondaryActionIcon: 'fa-arrow-up-right-from-square',
        secondaryActionType: 'open-link',
        secondaryActionValue,
    };
}

function buildSiteStarterPackItem() {
    return buildLinkStarterPackItem({
        title: `${STARTER_PACK_CREATOR_NAME}'s site`,
        body: `${STARTER_PACK_CREATOR_NAME}'s main site collects the preset, extensions, themes, cards, and other SillyBunny-adjacent tools in one easy place.`,
        icon: 'fa-globe',
        chips: ['Site', 'Cards', 'Themes', 'Extensions'],
        statusLabel: 'Creator hub',
        statusTone: 'warm',
        actionLabel: 'Visit site',
        actionValue: STARTER_PACK_SITE_URL,
    });
}

function buildGeechanStarterPackItem() {
    return buildLinkStarterPackItem({
        title: 'Geechan',
        body: 'Geechan\'s Rentry highlights his well-written Genshin character cards and sampler guide, and he is also the one who made the bundled Assistant Nahida card. SillyBunny now includes his Universal Roleplay v5.0 set across Chat Completions plus the matching Text Completions context, system prompt, and instruct pieces.',
        icon: 'fa-leaf',
        chips: ['Genshin cards', 'Assistant Nahida', 'Sampler guide', 'Rentry'],
        statusLabel: 'Preset pack',
        statusTone: 'warm',
        actionLabel: 'Visit Geechan',
        actionValue: GEECHAN_SITE_URL,
    });
}

function buildTldStarterPackItem() {
    return buildLinkStarterPackItem({
        title: 'TheLonelyDevil',
        body: 'TheLonelyDevil\'s Chub profile is linked here. SillyBunny bundles the standalone TLD Card Conversion Preset for card-maker and conversion-focused OpenAI-style workflows, and the Memory Sharding Quick Reply set for compressing chat history into structured memory shards. To use Memory Sharding, go to the Quick Reply settings, enable the "Memory Sharding" set, then click the "Shard Memory" button when you want to summarise your chat. Use around 30k context so the shard pass has enough room to work cleanly. Discord Pals is included as a GitHub link for running LLM character roleplay inside Discord.',
        icon: 'fa-shoe-prints',
        chips: ['Card maker', 'Memory shards', 'Discord RP', 'Preset'],
        statusLabel: 'Bundled',
        statusTone: 'warm',
        actionLabel: 'Open Chub profile',
        actionValue: TLD_CHUB_URL,
        secondaryActionLabel: 'View Discord Pals',
        secondaryActionValue: TLD_DISCORD_PALS_URL,
    });
}

function buildStarterPackItems() {
    return {
        preInstalled: [
            buildPresetStarterPackItem(),
            buildSiteStarterPackItem(),
            buildGeechanStarterPackItem(),
            buildTldStarterPackItem(),
        ],
        optional: [
            buildExtensionStarterPackItem({
                title: 'Summary Sharder',
                body: 'A recommended way to add persistent memory to your chats. Summary Sharder keeps a rolling summary of your conversation so the AI remembers key events, characters, and context across long sessions.',
                icon: 'fa-brain',
                chips: ['Extension', 'Memory', 'Recommended'],
                extensionName: STARTER_PACK_EXTENSIONS.summarySharder.id,
            }),
            buildExtensionStarterPackItem({
                title: 'Dialogue Colors',
                body: `${STARTER_PACK_CREATOR_NAME}'s dialogue coloring add-on helps visually busy or emotionally dense chats stay readable, with optional regex setup if you want finer control.`,
                icon: 'fa-palette',
                chips: ['Extension', 'Readable chats', 'Opt-in'],
                extensionName: STARTER_PACK_EXTENSIONS.dialogueColors.id,
            }),
            buildExtensionStarterPackItem({
                title: 'Quick Image Gen',
                body: `${STARTER_PACK_CREATOR_NAME}'s opt-in image generation companion makes visual moments easier to spin up without hunting through separate tools first.`,
                icon: 'fa-image',
                chips: ['Extension', 'Images', 'Opt-in'],
                extensionName: STARTER_PACK_EXTENSIONS.quickImageGen.id,
            }),
            buildExtensionStarterPackItem({
                title: 'Guided Generations',
                body: 'Adds structured generation controls to your chats, letting you guide the AI with specific instructions for each response to get more consistent and directed output.',
                icon: 'fa-compass',
                chips: ['Extension', 'Generation', 'Opt-in'],
                extensionName: STARTER_PACK_EXTENSIONS.guidedGenerations.id,
            }),
        ],
    };
}

function buildWelcomeTemplateData(chats) {
    const activeDeckView = getInitialDeckView();
    const deckCollapsed = isWelcomeDeckCollapsed();

    return {
        chats,
        empty: !chats.length,
        version: displayVersion,
        more: chats.some(chat => chat.hidden),
        activeDeckView,
        deckCollapsed,
        deckTabs: buildDeckTabs(activeDeckView),
        deckTourActive: activeDeckView === 'tour',
        deckBasicsActive: activeDeckView === 'basics',
        deckGuideActive: activeDeckView === 'guide',
        deckStarterActive: activeDeckView === 'starter',
        tutorialExpanded: true,
        tutorialIndex: 0,
        tutorialSteps: buildTutorialSteps(),
        guideCards: buildGuideCards(),
        bundledAssistants: buildBundledAssistantCards(),
        starterPackItems: buildStarterPackItems(),
    };
}

function openShellTab(route) {
    const [shellKey, tabId] = String(route || '').split(':');

    if (!shellKey || !tabId) {
        return;
    }

    if (window.SillyBunnyShell?.openTab) {
        window.SillyBunnyShell.openTab(shellKey, tabId);
        return;
    }

    const fallbackSelector = {
        'left:presets': '#ai-config-button > .drawer-toggle',
        'left:api': '#sys-settings-button > .drawer-toggle',
        'left:advanced-formatting': '#advanced-formatting-button > .drawer-toggle',
        'left:world-info': '#WI-SP-button > .drawer-toggle',
        'right:settings': '#user-settings-button > .drawer-toggle',
        'right:extensions': '#extensions-settings-button > .drawer-toggle',
        'right:persona': '#persona-management-button > .drawer-toggle',
        'right:background': '#backgrounds-button > .drawer-toggle',
    }[route];

    if (!fallbackSelector) {
        return;
    }

    document.querySelector(fallbackSelector)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function prefillSendTextarea(sendTextArea, value) {
    if (!(sendTextArea instanceof HTMLTextAreaElement)) {
        return;
    }

    sendTextArea.value = value;
    sendTextArea.dispatchEvent(new Event('input', { bubbles: true }));
    sendTextArea.focus();
}

async function refreshCharacterAvatarCache(avatar) {
    if (!avatar) {
        return;
    }

    const thumbnailUrl = getThumbnailUrl('avatar', avatar);

    try {
        await fetch(thumbnailUrl, { method: 'GET', cache: 'reload' });
        await fetch(`/characters/${encodeURIComponent(avatar)}`, { method: 'GET', cache: 'reload' });
    } catch (error) {
        console.warn(`Failed to refresh avatar cache for ${avatar}.`, error);
    }

    const cacheBustedThumbnailUrl = getThumbnailUrl('avatar', avatar, true);
    const avatarImages = document.querySelectorAll(`img[src^="${thumbnailUrl}"]`);

    for (const img of avatarImages) {
        if (img instanceof HTMLImageElement) {
            img.src = cacheBustedThumbnailUrl;
        }
    }
}

function setWelcomeDeckView(root, view, { persist = true } = {}) {
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const safeView = isWelcomeDeckView(view) ? view : getInitialDeckView();

    root.dataset.activeDeckView = safeView;

    root.querySelectorAll('.welcomeDeckTab').forEach((button) => {
        button.classList.toggle('is-active', button.getAttribute('data-deck-target') === safeView);
    });

    root.querySelectorAll('.welcomeDeckPanel').forEach((panel) => {
        panel.classList.toggle('is-active', panel.getAttribute('data-deck-panel') === safeView);
    });

    if (persist) {
        setWelcomeUiPreference(welcomeDeckViewKey, safeView);
    }
}

function setWelcomeDeckCollapsed(root, collapsed, { persist = true } = {}) {
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const deck = root.querySelector('.welcomeDeck');

    if (!(deck instanceof HTMLElement)) {
        return;
    }

    root.dataset.deckCollapsed = String(collapsed);
    deck.dataset.collapsed = String(collapsed);
    deck.classList.toggle('is-collapsed', collapsed);

    const toggleButton = deck.querySelector('.welcomeDeckToggle');

    if (toggleButton instanceof HTMLButtonElement) {
        toggleButton.setAttribute('aria-expanded', String(!collapsed));
        toggleButton.setAttribute('title', collapsed ? 'Show Launchpad' : 'Close Launchpad');
    }

    if (persist) {
        setWelcomeUiPreference(welcomeDeckCollapsedKey, collapsed ? 'true' : 'false');
    }
}

async function applyOpenAiPreset(name) {
    if (main_api !== 'openai') {
        openShellTab('left:api');
        return false;
    }

    const presetManager = getPresetManager('openai');
    const presetValue = presetManager?.findPreset(name);

    if (!presetManager || !presetValue) {
        openShellTab('left:presets');
        return false;
    }

    presetManager.selectPreset(presetValue);
    saveSettingsDebounced();
    return true;
}

async function installStarterPackExtension(extensionName) {
    const extensionConfig = getStarterPackExtensionConfig(extensionName);
    if (!extensionConfig) {
        return false;
    }

    await installExtension(extensionConfig.repoUrl, isAdmin());

    const installedExtension = findExtension(extensionName);
    if (!installedExtension) {
        await refreshWelcomeScreen();
        return false;
    }

    if (!installedExtension.enabled) {
        await enableExtension(installedExtension.name, false);
    }

    location.reload();
    return true;
}

function setTutorialUiState(panel, index, expanded) {
    if (!(panel instanceof HTMLElement)) {
        return;
    }

    const steps = Array.from(panel.querySelectorAll('.welcomeTourStep'));
    const progressButtons = Array.from(panel.querySelectorAll('.welcomeTourProgressButton'));
    const safeIndex = Math.max(0, Math.min(index, steps.length - 1));
    const nextButton = panel.querySelector('.tutorialNext');
    const previousButton = panel.querySelector('.tutorialPrev');
    const nextLabel = nextButton?.querySelector('span');

    panel.dataset.tutorialIndex = String(safeIndex);
    panel.dataset.tutorialExpanded = String(expanded);
    panel.classList.toggle('tutorialCollapsed', !expanded);

    steps.forEach((step, stepIndex) => {
        step.classList.toggle('is-active', stepIndex === safeIndex);
    });

    progressButtons.forEach((button, buttonIndex) => {
        button.classList.toggle('is-active', buttonIndex === safeIndex);
    });

    if (previousButton instanceof HTMLButtonElement) {
        previousButton.disabled = safeIndex === 0;
    }

    if (nextLabel) {
        nextLabel.textContent = safeIndex >= steps.length - 1 ? 'Finish tour' : 'Next';
    }
}

function dismissTutorial(panel, status) {
    if (status) {
        setWelcomeUiPreference(tutorialStatusKey, status);
    }

    setTutorialUiState(panel, 0, false);
}

async function handleWelcomeAction(button, sendTextArea) {
    const action = button.dataset.action || '';
    const value = button.dataset.actionValue || '';
    const assistantId = button.dataset.assistantId || DEFAULT_BUNDLED_ASSISTANT_ID;
    const welcomePanel = button.closest('.welcomePanel') || document.querySelector('.welcomePanel');
    const tutorialPanel = button.closest('.welcomeTourPanel') || document.querySelector('.welcomeTourPanel');

    switch (action) {
        case 'open-tab':
            openShellTab(value);
            break;
        case 'enable-extension':
            await enableExtension(value);
            break;
        case 'install-starter-extension':
            await installStarterPackExtension(value);
            break;
        case 'apply-preset':
            if (await applyOpenAiPreset(value)) {
                await refreshWelcomeScreen();
            }
            break;
        case 'assistant-prompt':
            await openBundledAssistantCard(assistantId);
            prefillSendTextarea(sendTextArea, value);
            break;
        case 'open-assistant':
            await openBundledAssistantCard(assistantId);
            if (sendTextArea instanceof HTMLTextAreaElement) {
                sendTextArea.focus();
            }
            break;
        case 'open-sample-characters':
            document.querySelector('.open_characters_library')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            break;
        case 'replay-tutorial':
            if (welcomePanel instanceof HTMLElement) {
                setWelcomeDeckView(welcomePanel, 'tour');
                setWelcomeDeckCollapsed(welcomePanel, false);
            }
            if (tutorialPanel instanceof HTMLElement) {
                setTutorialUiState(tutorialPanel, 0, true);
            }
            break;
        case 'close-guide':
            if (welcomePanel instanceof HTMLElement) {
                setWelcomeDeckCollapsed(welcomePanel, true);
            }
            break;
        case 'open-link':
            if (value) {
                window.open(value, '_blank', 'noopener,noreferrer');
            }
            break;
    }
}

/**
 * Opens a welcome screen if no chat is currently active.
 * @param {object} param Additional parameters
 * @param {boolean} [param.force] If true, forces clearing of the welcome screen.
 * @param {boolean} [param.expand] If true, expands the recent chats section.
 * @returns {Promise<void>}
 */
export async function openWelcomeScreen({ force = false, expand = false } = {}) {
    const currentChatId = getCurrentChatId();
    if (currentChatId !== undefined || (chat.length > 0 && !force)) {
        return;
    }

    const recentChats = await getRecentChats();
    const chatAfterFetch = getCurrentChatId();
    if (chatAfterFetch !== currentChatId) {
        console.debug('Chat changed while fetching recent chats.');
        return;
    }

    if (chatAfterFetch === undefined && force) {
        console.debug('Forcing welcome screen open.');
        chat.splice(0, chat.length);
        $('#chat').empty();
    }

    await sendWelcomePanel(recentChats, expand);
}

/**
 * Sends the welcome panel to the chat.
 * @param {RecentChat[]} chats List of recent chats
 * @param {boolean} [expand=false] If true, expands the recent chats section
 */
async function sendWelcomePanel(chats, expand = false) {
    try {
        const chatElement = document.getElementById('chat');
        const sendTextArea = document.getElementById('send_textarea');
        if (!chatElement) {
            console.error('Chat element not found');
            return;
        }
        const templateData = buildWelcomeTemplateData(chats);
        const template = await renderTemplateAsync('/scripts/templates/welcomePanelOnboarding.html?v=20260408a', templateData, true, true, true);
        const fragment = document.createRange().createContextualFragment(template);
        fragment.querySelectorAll('.welcomePanel').forEach((root) => {
            const recentHiddenClass = 'recentHidden';
            const recentHiddenKey = 'WelcomePage_RecentChatsHidden';
            const deck = root.querySelector('.welcomeDeck');
            if (getWelcomeUiPreference(recentHiddenKey) === 'true') {
                root.classList.add(recentHiddenClass);
            }
            root.querySelectorAll('.showRecentChats').forEach((button) => {
                button.addEventListener('click', () => {
                    root.classList.remove(recentHiddenClass);
                    setWelcomeUiPreference(recentHiddenKey, 'false');
                });
            });
            root.querySelectorAll('.hideRecentChats').forEach((button) => {
                button.addEventListener('click', () => {
                    root.classList.add(recentHiddenClass);
                    setWelcomeUiPreference(recentHiddenKey, 'true');
                });
            });

            const tutorialPanel = root.querySelector('.welcomeTourPanel');
            setWelcomeDeckView(root, root.dataset.activeDeckView || getInitialDeckView(), { persist: false });
            setWelcomeDeckCollapsed(root, deck instanceof HTMLElement ? deck.dataset.collapsed === 'true' : isWelcomeDeckCollapsed(), { persist: false });

            root.querySelectorAll('.welcomeDeckTab').forEach((button) => {
                button.addEventListener('click', () => {
                    const targetView = button.getAttribute('data-deck-target') || '';
                    setWelcomeDeckView(root, targetView);

                    if (targetView === 'tour' && tutorialPanel instanceof HTMLElement) {
                        const currentIndex = Number.parseInt(tutorialPanel.dataset.tutorialIndex || '0', 10) || 0;
                        setTutorialUiState(tutorialPanel, currentIndex, true);
                    }
                });
            });

            if (tutorialPanel instanceof HTMLElement) {
                setTutorialUiState(
                    tutorialPanel,
                    Number.parseInt(tutorialPanel.dataset.tutorialIndex || '0', 10) || 0,
                    tutorialPanel.dataset.tutorialExpanded !== 'false',
                );

                tutorialPanel.querySelectorAll('.welcomeTourProgressButton').forEach((button) => {
                    button.addEventListener('click', () => {
                        const targetIndex = Number.parseInt(button.getAttribute('data-step-target') || '0', 10) || 0;
                        setTutorialUiState(tutorialPanel, targetIndex, true);
                    });
                });

                tutorialPanel.querySelector('.tutorialPrev')?.addEventListener('click', () => {
                    const currentIndex = Number.parseInt(tutorialPanel.dataset.tutorialIndex || '0', 10) || 0;
                    setTutorialUiState(tutorialPanel, currentIndex - 1, true);
                });

                tutorialPanel.querySelector('.tutorialNext')?.addEventListener('click', () => {
                    const currentIndex = Number.parseInt(tutorialPanel.dataset.tutorialIndex || '0', 10) || 0;
                    const lastIndex = tutorialPanel.querySelectorAll('.welcomeTourStep').length - 1;

                    if (currentIndex >= lastIndex) {
                        dismissTutorial(tutorialPanel, 'completed');
                        return;
                    }

                    setTutorialUiState(tutorialPanel, currentIndex + 1, true);
                });
            }
        });
        fragment.querySelectorAll('.welcomeActionButton').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                await handleWelcomeAction(button, sendTextArea);
            });
        });
        fragment.querySelectorAll('.recentChat').forEach((item) => {
            item.addEventListener('click', () => {
                const avatarId = item.getAttribute('data-avatar');
                const groupId = item.getAttribute('data-group');
                const fileName = item.getAttribute('data-file');
                if (avatarId && fileName) {
                    void openRecentCharacterChat(avatarId, fileName);
                }
                if (groupId && fileName) {
                    void openRecentGroupChat(groupId, fileName);
                }
            });
        });
        const hiddenChats = fragment.querySelectorAll('.recentChat.hidden');
        fragment.querySelectorAll('button.showMoreChats').forEach((button) => {
            const showRecentChatsTitle = t`Show more recent chats`;
            const hideRecentChatsTitle = t`Show less recent chats`;

            button.setAttribute('title', showRecentChatsTitle);
            button.addEventListener('click', () => {
                const rotate = button.classList.contains('rotated');
                hiddenChats.forEach((chatItem) => {
                    chatItem.classList.toggle('hidden', rotate);
                });
                button.classList.toggle('rotated', !rotate);
                button.setAttribute('title', rotate ? showRecentChatsTitle : hideRecentChatsTitle);
            });
        });
        fragment.querySelectorAll('button.openTemporaryChat').forEach((button) => {
            button.addEventListener('click', async () => {
                await newAssistantChat({ temporary: true });
                if (sendTextArea instanceof HTMLTextAreaElement) {
                    sendTextArea.focus();
                }
            });
        });
        fragment.querySelectorAll('.recentChat.group').forEach((groupChat) => {
            const groupId = groupChat.getAttribute('data-group');
            const group = groups.find(x => x.id === groupId);
            if (group) {
                const avatar = groupChat.querySelector('.avatar');
                if (!avatar) {
                    return;
                }
                const groupAvatar = getGroupAvatar(group);
                $(avatar).replaceWith(groupAvatar);
            }
        });
        fragment.querySelectorAll('.recentChat .renameChat').forEach((renameButton) => {
            renameButton.addEventListener('click', (event) => {
                event.stopPropagation();
                const chatItem = renameButton.closest('.recentChat');
                if (!chatItem) {
                    return;
                }
                const avatarId = chatItem.getAttribute('data-avatar');
                const groupId = chatItem.getAttribute('data-group');
                const fileName = chatItem.getAttribute('data-file');
                if (avatarId && fileName) {
                    void renameRecentCharacterChat(avatarId, fileName);
                }
                if (groupId && fileName) {
                    void renameRecentGroupChat(groupId, fileName);
                }
            });
        });
        fragment.querySelectorAll('.recentChat .deleteChat').forEach((deleteButton) => {
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                const chatItem = deleteButton.closest('.recentChat');
                if (!chatItem) {
                    return;
                }
                const avatarId = chatItem.getAttribute('data-avatar');
                const groupId = chatItem.getAttribute('data-group');
                const fileName = chatItem.getAttribute('data-file');
                if (avatarId && fileName) {
                    void deleteRecentCharacterChat(avatarId, fileName);
                }
                if (groupId && fileName) {
                    void deleteRecentGroupChat(groupId, fileName);
                }
            });
        });
        fragment.querySelectorAll('.recentChat .pinChat').forEach((pinButton) => {
            pinButton.addEventListener('click', async (event) => {
                event.stopPropagation();
                const chatItem = pinButton.closest('.recentChat');
                if (!chatItem) {
                    return;
                }
                const avatarId = chatItem.getAttribute('data-avatar');
                const groupId = chatItem.getAttribute('data-group');
                const fileName = chatItem.getAttribute('data-file');
                const recentChat = chats.find(c => c.chat_name === fileName && ((c.is_group && c.group === groupId) || (!c.is_group && c.avatar === avatarId)));
                if (!recentChat) {
                    console.error('Recent chat not found for pinning.');
                    return;
                }
                const currentlyPinned = PinnedChatsManager.isPinned(recentChat);
                PinnedChatsManager.toggle(recentChat, !currentlyPinned);
                await refreshWelcomeScreen({ flashChat: recentChat });
            });
        });
        chatElement.append(fragment.firstChild);
        if (expand) {
            chatElement.querySelectorAll('button.showMoreChats').forEach((button) => {
                if (button instanceof HTMLButtonElement) {
                    button.click();
                }
            });
        }
    } catch (error) {
        console.error('Welcome screen error:', error);
    }
}

/**
 * Opens a recent character chat.
 * @param {string} avatarId Avatar file name
 * @param {string} fileName Chat file name
 */
async function openRecentCharacterChat(avatarId, fileName) {
    const characterId = characters.findIndex(x => x.avatar === avatarId);
    if (characterId === -1) {
        console.error(`Character not found for avatar ID: ${avatarId}`);
        return;
    }

    try {
        await selectCharacterById(characterId);
        setActiveCharacter(avatarId);
        saveSettingsDebounced();
        const currentChatId = getCurrentChatId();
        if (currentChatId === fileName) {
            console.debug(`Chat ${fileName} is already open.`);
            return;
        }
        await openCharacterChat(fileName);
    } catch (error) {
        console.error('Error opening recent chat:', error);
        toastr.error(t`Failed to open recent chat. See console for details.`);
    }
}

/**
 * Opens a recent group chat.
 * @param {string} groupId Group ID
 * @param {string} fileName Chat file name
 */
async function openRecentGroupChat(groupId, fileName) {
    const group = groups.find(x => x.id === groupId);
    if (!group) {
        console.error(`Group not found for ID: ${groupId}`);
        return;
    }

    try {
        await openGroupById(groupId);
        setActiveGroup(groupId);
        saveSettingsDebounced();
        const currentChatId = getCurrentChatId();
        if (currentChatId === fileName) {
            console.debug(`Chat ${fileName} is already open.`);
            return;
        }
        await openGroupChat(groupId, fileName);
    } catch (error) {
        console.error('Error opening recent group chat:', error);
        toastr.error(t`Failed to open recent group chat. See console for details.`);
    }
}

/**
 * Renames a recent character chat.
 * @param {string} avatarId Avatar file name
 * @param {string} fileName Chat file name
 */
async function renameRecentCharacterChat(avatarId, fileName) {
    const characterId = characters.findIndex(x => x.avatar === avatarId);
    if (characterId === -1) {
        console.error(`Character not found for avatar ID: ${avatarId}`);
        return;
    }
    try {
        const popupText = await renderTemplateAsync('chatRename');
        const newName = await callGenericPopup(popupText, POPUP_TYPE.INPUT, fileName);
        if (!newName || typeof newName !== 'string' || newName === fileName) {
            console.log('No new name provided, aborting');
            return;
        }
        await renameGroupOrCharacterChat({
            characterId: String(characterId),
            oldFileName: fileName,
            newFileName: newName,
            loader: false,
        });
        await updateRemoteChatName(characterId, newName);
        await refreshWelcomeScreen();
        toastr.success(t`Chat renamed.`);
    } catch (error) {
        console.error('Error renaming recent character chat:', error);
        toastr.error(t`Failed to rename recent chat. See console for details.`);
    }
}

/**
 * Renames a recent group chat.
 * @param {string} groupId Group ID
 * @param {string} fileName Chat file name
 */
async function renameRecentGroupChat(groupId, fileName) {
    const group = groups.find(x => x.id === groupId);
    if (!group) {
        console.error(`Group not found for ID: ${groupId}`);
        return;
    }
    try {
        const popupText = await renderTemplateAsync('chatRename');
        const newName = await callGenericPopup(popupText, POPUP_TYPE.INPUT, fileName);
        if (!newName || newName === fileName) {
            console.log('No new name provided, aborting');
            return;
        }
        await renameGroupOrCharacterChat({
            groupId: String(groupId),
            oldFileName: fileName,
            newFileName: String(newName),
            loader: false,
        });
        await refreshWelcomeScreen();
        toastr.success(t`Group chat renamed.`);
    } catch (error) {
        console.error('Error renaming recent group chat:', error);
        toastr.error(t`Failed to rename recent group chat. See console for details.`);
    }
}

/**
 * Deletes a recent character chat.
 * @param {string} avatarId Avatar file name
 * @param {string} fileName Chat file name
 */
async function deleteRecentCharacterChat(avatarId, fileName) {
    const characterId = characters.findIndex(x => x.avatar === avatarId);
    if (characterId === -1) {
        console.error(`Character not found for avatar ID: ${avatarId}`);
        return;
    }
    try {
        const confirm = await callGenericPopup(t`Delete the Chat File?`, POPUP_TYPE.CONFIRM);
        if (!confirm) {
            console.log('Deletion cancelled by user');
            return;
        }
        await deleteCharacterChatByName(String(characterId), fileName);
        await refreshWelcomeScreen();
        toastr.success(t`Chat deleted.`);
    } catch (error) {
        console.error('Error deleting recent character chat:', error);
        toastr.error(t`Failed to delete recent chat. See console for details.`);
    }
}

/**
 * Deletes a recent group chat.
 * @param {string} groupId Group ID
 * @param {string} fileName Chat file name
 */
async function deleteRecentGroupChat(groupId, fileName) {
    const group = groups.find(x => x.id === groupId);
    if (!group) {
        console.error(`Group not found for ID: ${groupId}`);
        return;
    }
    try {
        const confirm = await callGenericPopup(t`Delete the Chat File?`, POPUP_TYPE.CONFIRM);
        if (!confirm) {
            console.log('Deletion cancelled by user');
            return;
        }
        await deleteGroupChatByName(groupId, fileName);
        await refreshWelcomeScreen();
        toastr.success(t`Group chat deleted.`);
    } catch (error) {
        console.error('Error deleting recent group chat:', error);
        toastr.error(t`Failed to delete recent group chat. See console for details.`);
    }
}

/**
 * Reopens the welcome screen and restores the scroll position.
 * @param {object} param Additional parameters
 * @param {RecentChat} [param.flashChat] Recent chat to flash (if any)
 * @returns {Promise<void>}
 */
async function refreshWelcomeScreen({ flashChat = null } = {}) {
    const chatElement = document.getElementById('chat');
    if (!chatElement) {
        console.error('Chat element not found');
        return;
    }

    const scrollTop = chatElement.scrollTop;
    const scrollHeight = chatElement.scrollHeight;
    const expand = chatElement.querySelectorAll('button.showMoreChats.rotated').length > 0;

    await openWelcomeScreen({ force: true, expand });

    // Restore scroll position or flash specific chat
    if (flashChat) {
        const recentChats = Array.from(chatElement.querySelectorAll('.recentChat'));
        const chatToFlash = recentChats.find(el => {
            const file = el.getAttribute('data-file');
            const group = el.getAttribute('data-group');
            const avatar = el.getAttribute('data-avatar');
            return file === flashChat.chat_name &&
                ((flashChat.is_group && group === flashChat.group) || (!flashChat.is_group && avatar === flashChat.avatar));
        });
        if (chatToFlash instanceof HTMLElement) {
            if (!isElementInViewport(chatToFlash)) {
                chatElement.scrollTop = chatToFlash.offsetTop - chatElement.offsetTop - (chatToFlash.clientHeight / 2);
            }
            flashHighlight($(chatToFlash), 1000);
        }
    } else {
        // Restore scroll position
        chatElement.scrollTop = scrollTop + (chatElement.scrollHeight - scrollHeight);
    }
}

/**
 * Gets the list of recent chats from the server.
 * @returns {Promise<RecentChat[]>} List of recent chats
 *
 * @typedef {object} RecentChat
 * @property {string} file_name Name of the chat file
 * @property {string} chat_name Name of the chat (without extension)
 * @property {string} file_size Size of the chat file
 * @property {number} chat_items Number of items in the chat
 * @property {string} mes Last message content
 * @property {string} last_mes Timestamp of the last message
 * @property {string} avatar Avatar URL
 * @property {string} char_thumbnail Thumbnail URL
 * @property {string} char_name Character or group name
 * @property {string} date_short Date in short format
 * @property {string} date_long Date in long format
 * @property {string} group Group ID (if applicable)
 * @property {boolean} is_group Indicates if the chat is a group chat
 * @property {boolean} hidden Chat will be hidden by default
 * @property {boolean} pinned Indicates if the chat is pinned
 */
async function getRecentChats() {
    const response = await fetch('/api/chats/recent', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ max: MAX_DISPLAYED, pinned: PinnedChatsManager.getAll() }),
        cache: 'no-cache',
    });

    if (!response.ok) {
        console.warn('Failed to fetch recent character chats');
        return [];
    }

    /** @type {RecentChat[]} */
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }

    const dataWithEntities = data
        .map(chat => ({ chat, character: characters.find(x => x.avatar === chat.avatar), group: groups.find(x => x.id === chat.group) }))
        .filter(t => t.character || t.group)
        .sort((a, b) => {
            const isAPinned = PinnedChatsManager.isPinned(a.chat);
            const isBPinned = PinnedChatsManager.isPinned(b.chat);
            const momentComparison = sortMoments(timestampToMoment(a.chat.last_mes), timestampToMoment(b.chat.last_mes));

            if (isAPinned && !isBPinned) {
                return -1;
            }
            if (!isAPinned && isBPinned) {
                return 1;
            }

            return momentComparison;
        });

    dataWithEntities.forEach(({ chat, character, group }, index) => {
        const chatTimestamp = timestampToMoment(chat.last_mes);
        chat.char_name = character?.name || group?.name || '';
        chat.date_short = chatTimestamp.format('l');
        chat.date_long = chatTimestamp.format('LL LT');
        chat.chat_name = chat.file_name.replace('.jsonl', '');
        chat.char_thumbnail = character ? getThumbnailUrl('avatar', character.avatar) : system_avatar;
        chat.is_group = !!group;
        chat.hidden = index >= DEFAULT_DISPLAYED;
        chat.avatar = chat.avatar || '';
        chat.group = chat.group || '';
        chat.pinned = PinnedChatsManager.isPinned(chat);
    });

    return dataWithEntities.map(t => t.chat);
}

export async function openPermanentAssistantChat({ tryCreate = true, created = false } = {}) {
    try {
        const assistantConfig = getBundledAssistantConfig(DEFAULT_BUNDLED_ASSISTANT_ID);
        const assistant = await ensureBundledAssistantCharacter(assistantConfig, { tryCreate, created });
        if (!assistant) {
            return;
        }

        await refreshCharacterAvatarCache(assistant.avatar);
        await selectCharacterById(assistant.characterId);
        if (!assistant.created) {
            await doNewChat({ deleteCurrentChat: false });
        }
        console.log(`Opened bundled assistant chat for ${assistantConfig.characterName}.`, getCurrentChatId());
    } catch (error) {
        console.error('Error opening permanent assistant chat:', error);
        toastr.error(t`Failed to open permanent assistant chat. See console for details.`);
    }
}

async function createBundledAssistant(config) {
    if (is_group_generating || is_send_press) {
        throw new Error(t`Cannot create while generating.`);
    }

    if (config.cardAsset) {
        const formData = new FormData();
        formData.append('file_type', 'png');
        formData.append('preserved_name', config.fileName);

        const cardResponse = await fetch(config.cardAsset, { cache: 'no-store' });
        if (!cardResponse.ok) {
            throw new Error(`Failed to fetch bundled assistant card for "${config.id}".`);
        }

        const cardBlob = await cardResponse.blob();
        formData.append('avatar', cardBlob, config.defaultAvatar);

        const importResult = await fetch('/api/characters/import', {
            method: 'POST',
            headers: getRequestHeaders({ omitContentType: true }),
            body: formData,
            cache: 'no-cache',
        });

        if (!importResult.ok) {
            throw new Error(t`Import request did not succeed.`);
        }

        const importPayload = await importResult.json();
        if (importPayload?.error) {
            throw new Error(`Assistant card import failed for "${config.id}".`);
        }

        const importedAvatar = typeof importPayload?.file_name === 'string' && importPayload.file_name.trim()
            ? `${importPayload.file_name.trim()}.png`
            : config.defaultAvatar;

        await getCharacters();
        const createdCharacterId = findBundledAssistantCharacterId(config, importedAvatar);

        if (createdCharacterId === -1) {
            throw new Error(`Assistant character ${importedAvatar} was not registered after import.`);
        }

        const resolvedAvatar = characters[createdCharacterId]?.avatar;
        setBundledAssistantStoredAvatar(config, resolvedAvatar || '');
        return;
    }

    const formData = new FormData();
    formData.append('ch_name', config.characterName);
    formData.append('file_name', config.fileName);
    formData.append('creator_notes', config.creatorNotes);
    formData.append('description', config.description);
    formData.append('personality', config.personality);
    formData.append('scenario', config.scenario);
    formData.append('first_mes', config.firstMessage);
    formData.append('creator', config.creator);
    formData.append('tags', [...config.chips, 'assistant', 'bundled'].join(', '));

    try {
        const avatarResponse = await fetch(config.portrait);
        const avatarBlob = await avatarResponse.blob();
        formData.append('avatar', avatarBlob, config.defaultAvatar);
    } catch (error) {
        console.warn(`Error fetching bundled assistant portrait for "${config.id}". Fallback image will be used.`, error);
    }

    const fetchResult = await fetch('/api/characters/create', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
        body: formData,
        cache: 'no-cache',
    });

    if (!fetchResult.ok) {
        throw new Error(t`Creation request did not succeed.`);
    }

    const createdAvatar = (await fetchResult.text()).trim() || config.defaultAvatar;
    await getCharacters();
    const createdCharacterId = findBundledAssistantCharacterId(config, createdAvatar);

    if (createdCharacterId === -1) {
        throw new Error(`Assistant character ${createdAvatar} was not registered after creation.`);
    }

    const resolvedAvatar = characters[createdCharacterId]?.avatar;
    setBundledAssistantStoredAvatar(config, resolvedAvatar || '');
}

async function openBundledAssistantCard(assistantId = DEFAULT_BUNDLED_ASSISTANT_ID) {
    const assistantConfig = getBundledAssistantConfig(assistantId);
    const assistant = await ensureBundledAssistantCharacter(assistantConfig);
    if (!assistant) {
        return;
    }

    await refreshCharacterAvatarCache(assistant.avatar);
    await selectCharacterById(assistant.characterId);
}

export async function openPermanentAssistantCard() {
    await openBundledAssistantCard(DEFAULT_BUNDLED_ASSISTANT_ID);
}

/**
 * Assigns a character as the assistant.
 * @param {string?} characterId Character ID
 */
export function assignCharacterAsAssistant(characterId) {
    if (characterId === undefined) {
        return;
    }
    /** @type {Character} */
    const character = characters[characterId];
    if (!character) {
        return;
    }

    const currentAssistantAvatar = getPermanentAssistantAvatar();
    if (currentAssistantAvatar === character.avatar) {
        if (character.avatar === getBundledAssistantConfig(DEFAULT_BUNDLED_ASSISTANT_ID).defaultAvatar) {
            toastr.info(t`${character.name} is a system assistant. Choose another character.`);
            return;
        }

        toastr.info(t`${character.name} is no longer your assistant.`);
        accountStorage.removeItem(assistantAvatarKey);
        return;
    }

    accountStorage.setItem(assistantAvatarKey, character.avatar);
    printCharactersDebounced();
    toastr.success(t`Set ${character.name} as your assistant.`);
}

export function initWelcomeScreen() {
    PinnedChatsManager.init();

    // Ensure all bundled assistants exist in the character list on startup
    eventSource.on(event_types.APP_READY, async () => {
        for (const assistant of WELCOME_BUNDLED_ASSISTANTS) {
            await ensureBundledAssistantCharacter(assistant, { tryCreate: true });
        }
    });

    const events = [event_types.CHAT_CHANGED, event_types.APP_READY];
    for (const event of events) {
        eventSource.makeFirst(event, openWelcomeScreen);
    }

    eventSource.on(event_types.CHARACTER_MANAGEMENT_DROPDOWN, (target) => {
        if (target !== 'set_as_assistant') {
            return;
        }
        assignCharacterAsAssistant(this_chid);
    });

    eventSource.on(event_types.CHARACTER_RENAMED, (oldAvatar, newAvatar) => {
        for (const assistant of WELCOME_BUNDLED_ASSISTANTS) {
            const storedAvatar = accountStorage.getItem(assistant.avatarStorageKey);
            if (storedAvatar === oldAvatar || (!storedAvatar && assistant.defaultAvatar === oldAvatar)) {
                setBundledAssistantStoredAvatar(assistant, newAvatar);
            }
        }
    });
}
