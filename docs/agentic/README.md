# Agents in SillyBunny

SillyBunny has two separate agent systems that serve different purposes. This page explains both, how they work, and when to use each.

---

## Quick Summary

| | **Agent Mode** | **In-Chat Agents** |
|---|---|---|
| **What it does** | Background services that maintain memory, retrieve context, and manage lorebooks across your entire chat | Modular prompt snippets that inject into a single generation turn |
| **Where to find it** | Agent Mode panel (collapsible drawer in settings) | In-Chat Agents panel (collapsible drawer in settings) |
| **Runs automatically** | Yes, every turn (when enabled for a chat) | Yes, every turn (when an agent is toggled on) |
| **Requires chat-completions** | Yes | No |
| **Scope** | Whole chat session | Single generation turn |

---

## In-Chat Agents

In-Chat Agents are the simpler system. Think of them as reusable prompt modules you can toggle on and off.

### What They Do

Each agent is a prompt that gets injected into the generation context. They modify what the AI writes by adding instructions before generation, rewriting the output after generation, or both.

**Common uses:**
- **Trackers** -- append structured state blocks (scene info, relationships, inventory, etc.) that the AI maintains turn-to-turn
- **Directives** -- steer writing style, difficulty, tone, or content
- **Formatters** -- add CYOA choices, direction menus, or HTML formatting
- **Randomizers** -- inject random complications, genre shifts, or escalations
- **Guards** -- regex scripts that clean up unwanted patterns (e.g. anti-slop)

### How They Work

Each agent has a **phase** that controls when it runs:

- **Pre-generation** -- the prompt is injected into the context *before* the AI generates. This is the default for most agents. The AI sees the instruction and follows it.
- **Post-generation** -- the agent runs *after* the AI responds. It can rewrite the response, append to it, extract data from it, or run regex cleanup.
- **Both** -- the agent runs in both phases.

### Key Settings Per Agent

- **Phase**: pre / post / both
- **Injection position**: where in the prompt the text goes (in-prompt, in-chat at a specific depth, or before the prompt)
- **Injection role**: System, User, or Assistant (controls how the AI interprets the prompt)
- **Injection depth**: how far back in chat history the prompt appears (0 = most recent)
- **Order**: lower numbers run first within the same phase
- **Conditions**: trigger probability (0-100%), keyword triggers, and which generation types activate it (normal, continue, impersonate, quiet)

### Post-Generation Features

Agents in the post phase can:

- **Prompt transform (rewrite)**: send the AI's response to a model (main or alternate connection profile) with instructions to rewrite it
- **Prompt transform (append)**: same, but appends new content after the response instead of rewriting
- **Extract**: pull structured data from the response via regex and store it in chat variables
- **Regex scripts**: find-and-replace patterns on the output (for formatting cleanup, tag removal, etc.)

### Bundled Templates

SillyBunny ships with 30+ pre-made agents from Pura's Director Preset v12, organized into categories: directives, trackers, randomizers, formatting, and guards. You can also create your own from scratch.

**Agent Groups** let you enable a curated set of agents in one click. Three built-in groups are included: the full director preset, trackers only, and randomizers only. You can also save your own custom groups.

### Running Agents Manually

Each agent card has a robot icon button that runs the agent on the latest character message on demand, without waiting for a new generation. Useful for formatting fixes or one-off rewrites.

### Tips

- Agents are independent -- they don't know about each other. If two agents give conflicting instructions, the AI sees both and does its best.
- Post-generation prompt transforms run in parallel. Each one sees the original message text, not each other's changes.
- Drag-and-drop cards to reorder them within a category. On mobile, long-press a card to start dragging.
- Use the "Reset Bundled Agents to Defaults" button in the footer to restore all template-based agents to their original settings.

---

## Agent Mode

Agent Mode is a deeper system that gives your chat persistent memory, context retrieval, and optional lorebook maintenance. It runs background services around each generation turn.

### Requirements

- Must be using **chat-completions** mode (not text-completion)
- Must have an active chat open
- Must be enabled per-chat (it's off by default)

### The Three Services

#### 1. Retrieval

Runs **before** generation. Searches your lorebook entries, chat history, and saved memory to find relevant context, then injects a summary block into the prompt so the AI has better awareness of past events.

- Uses fuzzy search across world info, chat messages, and memory chapters
- Configurable result limits and search depth
- Feeds context directly into the generation prompt

#### 2. Memory

Runs **after** generation. Updates a durable memory store that persists across the chat session:

- **Summary**: a running high-level summary of the story so far
- **Facts**: key facts established in the RP (max 12)
- **Unresolved threads**: open plot points and pending situations (max 12)
- **Chapters**: arc summaries with keywords for retrieval (max 8)
- **Story state**: structured data including current location, time, character cast, inventory, and active plot threads

This memory feeds back into the Retrieval service on future turns, so the AI maintains long-term awareness even as older messages scroll out of the context window.

#### 3. Lorebook

Runs **after** generation. Reviews the current turn and proposes changes to your active lorebooks:

- Can **create** new entries when the story introduces new characters, locations, or concepts
- Can **update** existing entries when information changes
- Entries marked as `agentBlacklisted` in world info are protected from agent edits
- **Review mode**: when enabled, changes are queued as proposals that you can approve, modify, or reject before they're applied. When disabled, changes apply automatically.

This is useful for keeping your world info up to date as the story evolves without having to manually edit lorebook entries after every session.

### Per-Service Configuration

Each service has its own model profile settings:

- **Use main model** or configure separate temperature and token limits
- **Max steps**: how many tool-calling rounds the service gets per turn
- **Result limits**: how many search results to consider

### When to Use Agent Mode vs In-Chat Agents

- Use **In-Chat Agents** for prompt-level behavior: writing style, formatting, trackers appended to output, regex cleanup. These are lightweight and work with any backend.
- Use **Agent Mode** when you want persistent memory, cross-turn context retrieval, or automatic lorebook maintenance. This is heavier (extra API calls per turn) but gives the AI much better long-term awareness.
- You can use both at the same time. They don't conflict -- Agent Mode handles memory and retrieval while In-Chat Agents handle per-turn prompt injection and output formatting.

---

## Pipeline Overview

Here's what happens on each generation turn when both systems are active:

1. **Agent Mode Retrieval** searches memory and lorebooks, injects context
2. **In-Chat Agents (pre)** inject their prompts into the generation context
3. **Main generation** produces the AI response
4. **In-Chat Agents (post)** run prompt transforms, regex cleanup, and data extraction
5. **Agent Mode Memory** updates durable memory and story state
6. **Agent Mode Lorebook** proposes or applies lorebook changes

---

## Recent Changes

### v1.3.2 (2026-04-12)

- Trackers now default to pre-generation phase with User role
- Added phaseLocked flag to prevent startup migrations from overriding manual phase changes
- Parallel prompt-transform execution via Promise.allSettled
- Bulk select mode with enable/disable/delete/select-all
- Drag-and-drop card reordering (long-press on mobile)
- Per-card manual run button (robot icon)
- Slimmer toast notifications
- Reset Bundled Agents to Defaults button
- Fixed drag-drop snap-back and tracker migration bugs

### v1.3.2 (2026-04-13)

- Removed Agent Mode orchestration (retrieval, memory, lorebook services) to align with "intentionally lightweight" philosophy
- Kept In-Chat Agents as a standalone tab with a simplified panel (no agent mode overlay)
- Recommended Summary Sharder extension as the replacement for agent-based memory
- Fixed circular dependency TDZ errors that prevented extensions from loading
- Fixed TunnelVision tool-registry initialization with lazy tool name resolution

### v1.3.1 (2026-04-12)

- Fixed In-Chat Agent card interactions and Agent Group behavior
- Added ST-style regex script support for bundled and custom agents
- Added prompt-transform passes with rewrite and append modes
- Added global and per-agent prompt-transform toast notifications
- Split Pura's Director Preset into SillyBunny and SillyTavern variants

### v1.3.0 (2026-04-12)

- In-Chat Agents (Beta): modular prompt modules on the Agents page
- 31 pre-made templates from Pura's Director Preset v12
- Agent Groups for one-click bulk application
- Connection-profile support for prompt refinement

## Further Reading

- [current-state-map.md](current-state-map.md) -- where agent code lives in the repo
- [milestones.md](milestones.md) -- roadmap
- [experiment-template.md](experiment-template.md) -- how to propose new experiments
