import {
    chat,
    chat_metadata,
    extension_prompts,
    setExtensionPrompt,
    substituteParams,
    saveChatDebounced,
} from '../../../script.js';
import { eventSource, event_types } from '../../events.js';
import { getEnabledAgents } from './agent-store.js';

const PROMPT_KEY_PREFIX = 'inchat_agent_';

/**
 * Checks whether an agent should activate this turn.
 * @param {import('./agent-store.js').InChatAgent} agent
 * @param {string} generationType
 * @returns {boolean}
 */
function shouldActivate(agent, generationType) {
    const cond = agent.conditions;

    // Generation type check
    if (cond.generationTypes?.length > 0 && !cond.generationTypes.includes(generationType)) {
        return false;
    }

    // Probability check
    if (cond.triggerProbability < 100) {
        if (Math.random() * 100 > cond.triggerProbability) {
            return false;
        }
    }

    // Keyword check
    if (cond.triggerKeywords?.length > 0) {
        const lastMsg = chat[chat.length - 1]?.mes ?? '';
        const lower = lastMsg.toLowerCase();
        const hasKeyword = cond.triggerKeywords.some(kw => lower.includes(kw.toLowerCase()));
        if (!hasKeyword) {
            return false;
        }
    }

    return true;
}

/**
 * Cleans up all in-chat agent extension prompts before a new generation.
 */
function onGenerationStarted() {
    for (const key of Object.keys(extension_prompts)) {
        if (key.startsWith(PROMPT_KEY_PREFIX)) {
            delete extension_prompts[key];
        }
    }
}

/**
 * Injects pre-generation agent prompts.
 * @param {string} type - Generation type
 * @param {object} _opts - Generation options (unused)
 * @param {boolean} dryRun - Whether this is a dry run
 */
function onGenerationAfterCommands(type, _opts, dryRun) {
    if (dryRun) return;

    const enabledAgents = getEnabledAgents().filter(a => a.phase === 'pre' || a.phase === 'both');

    for (const agent of enabledAgents) {
        if (!shouldActivate(agent, type)) continue;

        const expandedPrompt = substituteParams(agent.prompt);
        if (!expandedPrompt.trim()) continue;

        const key = PROMPT_KEY_PREFIX + agent.id;
        setExtensionPrompt(
            key,
            expandedPrompt,
            agent.injection.position,
            agent.injection.depth,
            agent.injection.scan,
            agent.injection.role,
        );
    }
}

/**
 * Runs post-generation processing on the received message.
 * @param {number} messageIndex
 */
function onMessageReceived(messageIndex) {
    const message = chat[messageIndex];
    if (!message || message.is_user) return;

    const enabledAgents = getEnabledAgents().filter(
        a => (a.phase === 'post' || a.phase === 'both') && a.postProcess?.enabled,
    );

    let modified = false;

    for (const agent of enabledAgents) {
        if (!shouldActivate(agent, 'normal')) continue;

        const pp = agent.postProcess;

        switch (pp.type) {
            case 'regex': {
                if (!pp.regexFind) break;
                try {
                    const regex = new RegExp(pp.regexFind, pp.regexFlags || 'g');
                    const newText = message.mes.replace(regex, pp.regexReplace || '');
                    if (newText !== message.mes) {
                        message.mes = newText;
                        modified = true;
                    }
                } catch (e) {
                    console.warn(`[InChatAgents] Regex error in agent "${agent.name}":`, e);
                }
                break;
            }
            case 'extract': {
                if (!pp.extractPattern || !pp.extractVariable) break;
                try {
                    const regex = new RegExp(pp.extractPattern, 'g');
                    const matches = message.mes.match(regex);
                    if (matches) {
                        const key = `agent_${pp.extractVariable}`;
                        chat_metadata[key] = matches.join('\n');
                        modified = true;
                    }
                } catch (e) {
                    console.warn(`[InChatAgents] Extract error in agent "${agent.name}":`, e);
                }
                break;
            }
            case 'append': {
                if (!pp.appendText) break;
                const text = substituteParams(pp.appendText);
                if (text.trim()) {
                    message.mes += text;
                    modified = true;
                }
                break;
            }
        }
    }

    if (modified) {
        saveChatDebounced();
    }
}

/**
 * Registers all event listeners for the agent runner.
 */
export function initAgentRunner() {
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, onGenerationAfterCommands);
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
}
