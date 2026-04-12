# Current State Map

Where agent code lives in the repo and what each piece does.

---

## Agent Mode (Memory, Retrieval, Lorebook)

All three services live in a single file:

### `public/scripts/agents.js` (~3100 lines)

**Entry points called from the generation loop:**

| Function | When | What it does |
|---|---|---|
| `runPreGenerationAgents()` | Before generation | Runs the Retrieval service to inject context |
| `runPostGenerationAgents()` | After generation | Runs Memory and Lorebook services |

**Core services:**

| Function | Service | Purpose |
|---|---|---|
| `runRetrievalAgent()` | Retrieval | Fuzzy-searches lorebook entries, chat history, and saved memory chapters. Injects a context summary block into the prompt. |
| `runMemoryAgent()` | Memory | Updates durable memory: summary, facts, unresolved threads, chapter arcs, and structured story state (location, time, characters, inventory, plot threads). |
| `runLorebookAgent()` | Lorebook | Proposes creates/updates to active lorebook entries. Can run in auto-apply or review mode. |

**Storage:**

- Agent state is stored per-chat in `chat_metadata.agent_mode`
- Memory and story state persist across turns within a chat session
- Lorebook changes are queued in `pending_changes` (review mode) or applied immediately
- World info entries can be protected via `agentBlacklisted` field

**UI hooks in `public/scripts/sillybunny-tabs.js`:**

- Agent Mode panel rendering and toggles
- Per-service enable/disable
- Lorebook review approval UI
- Memory and story state display

---

## In-Chat Agents (Prompt Modules)

The extension lives in `public/scripts/extensions/in-chat-agents/`:

| File | Lines | Purpose |
|---|---|---|
| `index.js` | ~2000 | UI panel, editor, template system, drag-drop, bulk actions |
| `agent-runner.js` | ~870 | Execution engine: prompt injection, prompt transforms, regex, toast notifications |
| `agent-store.js` | ~560 | Data model, normalization, CRUD, sorting |
| `regex-scripts.js` | ~290 | Regex script data model and placement types |
| `settings.html` | ~90 | Settings panel template |
| `editor.html` | ~200 | Agent editor modal template |
| `style.css` | ~650 | All extension styling |
| `templates/` | -- | Bundled agent JSON templates and groups |

**Backend endpoint:** `src/endpoints/in-chat-agents.js` handles save/delete/group CRUD via `/api/in-chat-agents/*`.

**Execution flow:**

1. `onGenerationAfterCommands()` -- builds activation snapshot, injects pre-generation prompts via `setExtensionPrompt()`
2. `onMessageReceived()` / `processReceivedMessage()` -- runs post-generation prompt transforms (parallel via `Promise.allSettled`), utility agents (extract, append), and regex snapshot
3. `runAgentOnMessage()` -- exported for manual on-demand execution from the card UI

**Data flow:**

- Agents are loaded from server on init and kept in memory (`agent-store.js`)
- Templates are loaded from `templates/index.json` and merged with defaults via `mergeTemplateDefaults()`
- Migrations run on startup to align saved agents with template changes (respects `phaseLocked` flag)
- Agent state is saved to `extension_settings.inChatAgents` and persisted via the settings API

---

## How They Connect

Agent Mode and In-Chat Agents are independent systems. They don't directly call each other, but they share the same generation lifecycle:

```
Generation request
  |
  ├── Agent Mode: Retrieval injects context
  ├── In-Chat Agents: pre-phase prompts injected
  |
  v
Main model generates response
  |
  ├── In-Chat Agents: post-phase transforms, regex, extraction
  ├── Agent Mode: Memory updates
  ├── Agent Mode: Lorebook proposals
  |
  v
Response displayed, chat saved
```

Both systems write to `chat_metadata` but use separate keys (`agent_mode` vs `inChatAgents`/`inChatAgentPromptRuns` on individual messages).

---

## Extension Points

- **Add new In-Chat Agent templates**: create a JSON file in `templates/`, add it to `templates/index.json`
- **Add new Agent Mode services**: add to `agent_service_ids` and implement a `run*Agent()` function in `agents.js`
- **Expand Agent Mode UI**: modify `sillybunny-tabs.js` panel rendering
- **Expand In-Chat Agents UI**: modify `index.js` and the HTML templates
