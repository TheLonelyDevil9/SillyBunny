# Current State Map

This is the repo-grounded map of where agentic behavior lives today.

## Existing execution loop

- [public/script.js](/run/media/platinum/HDD/SillyBunny/public/script.js:4684)
  Calls `runPreGenerationAgents()` before chat-completions generation.
- [public/script.js](/run/media/platinum/HDD/SillyBunny/public/script.js)
  Calls `runPostGenerationAgents()` after generation.
- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js:2103)
  Handles pre-generation retrieval injection.
- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js:2124)
  Handles post-generation memory and lorebook runs.

## Current agent services

- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js:1476)
  `runRetrievalAgent()` searches lorebook entries, chat history, and saved memory, then injects a context block.
- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js:1663)
  `runMemoryAgent()` writes durable memory plus structured story state into chat metadata.
- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js:1813)
  `runLorebookAgent()` now queues, validates, and optionally reviews lore changes before applying them to active world books.

## Current storage model

- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js:121)
  Chat-scoped agent state currently stores:
  - enabled flags
  - service toggles
  - durable memory summary/facts/unresolved threads/chapters
  - structured story state for location, time, characters, locations, inventory, and plot threads
  - lore review mode plus pending/applied lore changes
  - last run status
- [public/scripts/world-info.js](/run/media/platinum/HDD/SillyBunny/public/scripts/world-info.js:4011)
  World info entries already support `agentBlacklisted`.

## Current strengths

- SillyBunny already has a live tool-using agent loop.
- It already separates retrieval, memory, and lore maintenance concerns.
- It already exposes agent state in the UI.
- It already has lore mutation primitives instead of prompt-only simulation.
- It now has a first-pass lore review layer with pending vs applied changes.

## Current gaps versus Aventuras-style behavior

- The director exists, but it still follows a fixed service schedule instead of making richer plan-time decisions.
- Story state now exists in a first-pass schema, but it still lacks relationships, stronger state transitions, and dedicated review/update tooling.
- Durable memory is stronger now, but retrieval still has room to get smarter about when to use summaries versus structured state versus raw chat.
- Lore autonomy is safer now, but it is not yet tightly coupled to story-state diffs, richer validation rules, or fine-grained approval workflows.
- No dedicated narrative action suggestion mode or adventure-mode turn structure.

## Best first extension points

- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js)
  Add an orchestrator service or orchestration pass here first.
- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js)
  Extend metadata shape here for structured story state.
- [public/scripts/sillybunny-tabs.js](/run/media/platinum/HDD/SillyBunny/public/scripts/sillybunny-tabs.js:2966)
  Expand the existing agent UI instead of creating a separate control surface too early.
- [public/scripts/world-info.js](/run/media/platinum/HDD/SillyBunny/public/scripts/world-info.js)
  Reuse world-info storage for lore, but keep story-state distinct from raw lore entries.
