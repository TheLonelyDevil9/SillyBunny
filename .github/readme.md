<!-- This file mirrors the root README so GitHub renders the correct project homepage copy. -->

# SillyBunny

Based on **SillyTavern 1.17.0 stable** -- same data, same extensions, better shell.

SillyBunny is a fork of [SillyTavern](https://github.com/SillyTavern/SillyTavern) that keeps the workflow you already know but ships it inside a cleaner UI, a Bun-first backend, and two lightweight agent systems for roleplay.

Project site, presets, themes, and extras: [platberlitz.github.io](https://platberlitz.github.io/)

> [!WARNING]
> Active fork. UI, Bun compat, and upstream syncs are ongoing, so expect some churn.

---

## At a glance

| | |
|-|-|
| **Runtime** | Bun (auto-installed), Node.js fallback |
| **Default port** | `4444` |
| **UI** | Custom navigation shell with search, themes, and mobile layout |
| **Agents** | Built-in Agent Mode + user-facing In-Chat Agents for modular RP prompting |
| **Data** | Drop-in compatible with SillyTavern characters, chats, presets, and extensions |

---

## Quick start

```bash
git clone https://github.com/platberlitz/SillyBunny.git
cd SillyBunny
```

Then run the launcher for your OS:

| Platform | Command |
|----------|---------|
| Linux / WSL | `./start.sh` |
| macOS (Terminal) | `./Start.command` |
| macOS (Finder) | Double-click `Start.command` (right-click > Open if Gatekeeper warns) |
| Windows | `.\Start.bat` |
| Android (Termux) | `bash start.sh` |

The launcher handles everything: installs Bun if missing, installs packages, checks for updates, then starts the server. Open `http://127.0.0.1:4444` in your browser.

If you already manage your own Bun install, `bun run start` still works. Other launch variants:

```bash
bun run start:mobile   # lower-memory (--smol)
bun run start:global   # SillyBunny-owned data paths
bun run start:no-csrf  # disable CSRF (local dev)
```

### macOS notes

- If the launcher window closes too fast, run `./Start.command` from Terminal to keep output visible
- If Git is missing, the launcher triggers `xcode-select --install` automatically
- Quarantine metadata from ZIP downloads: `xattr -dr com.apple.quarantine /path/to/SillyBunny`
- Stripped permissions from unzip: `chmod +x Start.command start.sh scripts/*.sh`

### Termux (Android) notes

```bash
pkg update && pkg upgrade -y
pkg install -y git curl unzip
git clone https://github.com/platberlitz/SillyBunny.git
cd SillyBunny
bash start.sh
```

- The launcher defaults to Node.js + npm on native Termux (more reliable than Bun under grun)
- To force Bun anyway: `SILLYBUNNY_TERMUX_RUNTIME=bun bash start.sh`
- For shared storage access: `termux-setup-storage` once before starting

### Update controls

| What you want | Command |
|---------------|---------|
| Normal launch (auto-checks for updates) | `./start.sh` |
| Force update then launch | `./start.sh --self-update` |
| Update only, don't start | `./start.sh --self-update-only` |
| Skip update check once | `./start.sh --skip-self-update` |
| Disable auto-update permanently | `SILLYBUNNY_AUTO_UPDATE=0 ./start.sh` |

---

## What's different from SillyTavern

### Better UI

The stock SillyTavern layout is replaced with a custom navigation shell:

- **Left/right panel navigation** for workspace and customization
- **Search-first** across presets, lore, extensions, personas, and settings
- **Mobile-aware** with a dedicated phone/tablet navigation layer
- **Collapsible settings sections** in both Chat Completions and Text Completions presets
- **Three shell themes**: Modern Glass, Clean Minimal, Bold Stylized
- **Three palette presets**: Forest Dusk, Forest Dawn, Rose Glow
- **Three message styles**: Flat, Bubbles, Document

### Bun-first runtime

Bun is the default. Startup is faster, and the launchers bootstrap it automatically. Node.js still works as a fallback.

### Agents, without the buzzword soup

SillyBunny has **two different agent systems**, and they solve different problems:

- **Agent Mode** is the built-in service layer. It handles retrieval, memory, and lorebook upkeep for an active chat.
- **In-Chat Agents** are user-facing prompt modules. They are the modular building blocks you toggle on the Agents page for trackers, formatting, cleanup, randomisers, and other RP helpers.

These are not autonomous "go do tasks on the internet" agents. They are deliberately scoped prompt hooks around the chat generation pipeline.

### How agents work

The short version:

1. **Pre-generation agents** can inject prompt text before the main reply is generated.
2. **The main model** writes the assistant response as usual.
3. **Post-generation prompt transforms** can optionally rewrite the reply or append extra content after the reply. These can use the main model or a different connection profile.
4. **Post-process utilities** can extract structured data, run regex cleanup/formatting, or preserve machine-readable blocks while showing cleaner UI.
5. **Groups and templates** let you swap whole stacks quickly without editing your base preset every time.

Typical uses:

- Trackers for scene, time, items, relationships, off-screen activity, and world state
- Formatting helpers like direction menus, CYOA choices, or NPC profile cards
- Cleanup passes like anti-slop or regex-based formatting
- Randomisers and directives that change the pressure, genre, pacing, or escalation of a scene
- Cheap helper-model passes that prepare or polish content without spending your main model's budget

### Agent Mode

Agent Mode is the built-in chat-scoped system for durable story support.

**Current services:**

- **Retrieval** -- injects relevant context from recent chat, memory, and lorebooks before the next reply
- **Memory** -- updates compact long-term memory after a reply is saved
- **Lorebook** -- syncs lorebook entries after a reply is saved

**How it works:**

- Each service can reuse the main chat profile or use its own source/model/reverse-proxy settings
- You can copy the active chat profile to all Agent Mode services in one click
- Agent Mode state is stored per chat
- World info entries can be marked `Agent blacklisted` to exclude them from agent processing

**Scope:**

- Runs with active chats only
- Targets the chat-completions pipeline
- Intentionally lightweight: the goal is stronger RP support, not autonomous orchestration

### In-Chat Agents (Beta)

In-Chat Agents are modular prompt blocks you can create, toggle, group, refine, import, export, and share.

Think of them like a mini prompt pipeline builder inside the Agents page:

- Each agent has a **phase**: `Pre`, `Post`, or `Pre/Post`
- Each agent has a **run order**, so you can decide what runs first or later within a pass
- Agents can be gated by **generation type**, **keywords**, or **trigger probability**
- Agents can target the **main connection** or a separate **connection profile**
- Agents can carry **regex scripts** in a SillyTavern-style format for output formatting and cleanup
- Agents can run **prompt transforms** in `rewrite` or `append` mode
- Agents can be bundled into **Agent Groups** for one-click setup

**What ships with v1.3.2:**

- **31 bundled templates** based on Pura's Director Preset ecosystem
- Trackers, randomisers, directives, formatting helpers, anti-slop, and content toggles
- Built-in groups for the full preset, trackers only, and randomisers only
- ST-style regex options for bundled and custom agents
- Per-agent and global prompt-transform toast notifications
- Inline run-order editing directly from the agent cards
- Prompt-transform greeting protection: greeting messages are intentionally left alone

**Bundled defaults in v1.3.2:**

- Bundled trackers are set up for **post-generation prompt append**
- Bundled regex-backed helpers default to **post-generation**
- `Anti-Slop Regex` remains the exception and stays a straightforward cleanup tool
- Pura's Director Preset now ships in **two versions**:
  - **SillyTavern** version: includes the Toggle and Randomiser prompts
  - **SillyBunny** version: keeps the Main, Primary Toggles, and Prefill Toggles, because Agents cover the optional toggles and randomisers

**Status:** Beta. The goal is fast, toggleable prompt modules for RP without needing to write a full extension.

---

## UI preview

These screenshots show the `v1.3.2` shell on desktop and mobile.

#### Desktop

![SillyBunny desktop home](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-home-v1.2.8.png)

![SillyBunny desktop customization](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-customize-v1.2.8.png)

#### Mobile

![SillyBunny mobile home](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-home-v1.2.8.png)

![SillyBunny mobile customization](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-customize-v1.2.8.png)

---

## Changelog

### v1.3.2 (2026-04-13)

**UI/UX overhaul**

- Redesigned shell panels: centered on screen, narrower (900px max), horizontal tab bar at top
- Centered shell open animations (scale+fade instead of directional slide)
- Rearranged top bar: Navigate + Customize left, Home + Characters right, removed duplicate API button
- Added customizable quick-access shortcut buttons in the top bar (configurable in Settings)
- Removed chatbar overlay; integrated chat management into the bottom bar with persona bubble
- Added bottom bar size slider in Settings
- Home screen defaults to First Steps with launchpad collapsed; "Show Launchpad" replaces "Replay Tutorial"
- Added "Chat with Assistant Nahida" button on home screen; Nahida now appears in character list by default
- Starter pack split into Pre-installed and Optional sections; added Summary Sharder, Guided Generations
- Bundled Memory Sharding Quick Reply preset for chat summarisation

**Agent mode changes**

- Removed Agent Mode orchestration; kept In-Chat Agents as a standalone lightweight tab
- Summary Sharder recommended as the memory solution

**Bug fixes**

- Fixed stop generation button (`isStopped` flag now set correctly in `onStopStreaming`)
- Fixed story branching performance (shallow copy instead of full `structuredClone`)
- Fixed `applyBundledOptInDefaults()` always returning true
- Fixed CLIENT_VERSION `v` prefix breaking extension version checks
- Fixed circular dependency TDZ errors in GuidedGenerations, TunnelVision, Quick Reply, TTS
- Fixed duplicate TTS settings panel
- Fixed shell search showing generic "Extensions" instead of actual section names

**Platform support**

- Added Node.js fallback launchers (`start-node.sh`, `Start-Node.bat`, `npm run start:node`)
- Auto-switches to Node.js on macOS and ARM to avoid Bun CPU overhead (oven-sh/bun#26415)

### v1.3.1 (2026-04-12)

**In-Chat Agents**

- Fixed the broken agent-card interactions and restored reliable backend-backed Agent Group behavior
- Added ST-style regex script support for agents, including bundled regex packs for tracker and formatting templates
- Added prompt-transform passes with `rewrite` and `append` modes, optional alternate connection profiles, and automatic message refresh after mutation
- Bundled trackers now default to post-generation prompt append, while bundled regex-backed helpers default to post-generation behavior
- Greeting messages are now left untouched by all prompt-transform agents
- Added global and per-agent toast notifications for prompt-transform runs, enabled by default
- Added inline run-order editing on agent cards with clearer `lower first` ordering semantics
- Removed the duplicate bundled `Director Core` case and added bundled-template migration helpers for saved agents
- Split Pura's Director Preset into **SillyBunny** and **SillyTavern** variants

**Starter pack and bundled extras**

- Starter-pack extension cards now install **Character Colors** and **Image Gen** directly from GitHub instead of shipping their files inside the repo
- Updated the preset starter card to explain the two Director Preset variants more clearly

**UI/UX fixes**

- Moved the Agent Mode status overview inside the Agent Mode drawer so the Agents page reads more cleanly
- Improved narrow-width behavior for agent cards, toggles, and inline controls
- Refined the welcome-screen starter-pack presentation and preset actions

### v1.3.0

**In-Chat Agents (Beta)**

- Added the first release of In-Chat Agents on the Agents page
- Shipped 31 pre-made templates derived from Pura's Director Preset v12
- Added built-in Agent Groups plus one-click Prompt Manager transfer and JSON import/export
- Added connection-profile support for the `Refine with AI` flow

**UI/UX fixes**

- Agent Mode and In-Chat Agents became collapsible drawers on the Agents page
- Settings drawer state persistence was fixed
- Advanced Formatting now hides Instruct Template in Chat Completions mode
- Search labels, preset drawer styling, avatar centering, and narrow-card overflow all received cleanup
- Bundled third-party extensions were git-ignored to reduce local git churn

### v1.2.9

- Text Completion and Advanced Formatting settings moved to collapsible drawer sections
- Added OpenAI Responses API support
- Added auto-stash before git pull
- Added encrypted secrets at rest plus improved auth options

### v1.2.8

- CSS optimization pass, prompt drawer styling cleanup, adaptive contrast text variables
- Group-chat recovery fixes for stale or missing `.jsonl` references
- Version-label, palette-reset, mobile toggle, and border-radius token fixes

### v1.2.7

- Reworked Chat Completion drawers
- Added top-bar customization and Console Logs tab
- Improved character flow, settings UX, and Termux support

### v1.2.5

- Switched default port to `4444`
- Added cache clearing and message screenshot export
- Fixed Claude token counting on Bun and improved startup reliability

---

## Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```

---

## Compatibility

SillyBunny is a fork, not a replacement. Most SillyTavern behavior, data formats, and ecosystem knowledge still apply.

| Resource | Link |
|----------|------|
| Upstream repo | [SillyTavern/SillyTavern](https://github.com/SillyTavern/SillyTavern) |
| Upstream docs | [docs.sillytavern.app](https://docs.sillytavern.app/) |
| Discord | [discord.gg/sillytavern](https://discord.gg/sillytavern) |
| Subreddit | [r/SillyTavernAI](https://reddit.com/r/SillyTavernAI) |

If something feels off, compare against the upstream `release` branch first.

## License

AGPL-3.0
