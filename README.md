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

SillyBunny has **In-Chat Agents** -- user-facing prompt modules you can create, toggle, group, refine, import, export, and share.

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
- Content toggles for prose style, difficulty, POV, and HTML artifacts
- Agentic lorebook navigation for on-demand retrieval, memory maintenance, and tree building
- Cheap helper-model passes that prepare or polish content without spending your main model's budget

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

**What ships with v1.3.4:**

- **30 bundled templates** based on Pura's Director Preset ecosystem
- Trackers, randomisers, content helpers, tool agents, and custom prompt toggles
- Four categories: **Tracker**, **Randomizer**, **Content**, and **Tool** (plus Custom for user-created agents)
- **Pathfinder** agentic lorebook navigator with 8 tools for retrieval, memory maintenance, and tree building
- Direction Menu and CYOA Choices live in Tracker and their generated options can be clicked into the message box
- Bundled **Prose Polisher** post-generation agent by Geechan
- Built-in groups for the full preset, trackers only, and randomisers only
- ST-style regex options for custom agents
- Toast notifications while prompt-transform agents run
- Inline run-order editing directly from the agent cards
- Fullscreen prompt editors and click-to-edit agent cards

**Bundled defaults in v1.3.4:**

- Bundled trackers are set up for **post-generation prompt append**
- Agents use the main connection profile by default, with separate profile support when explicitly selected
- Agent connection profiles default to **8192 max tokens**
- Prose Polisher is pickable by default as a post-generation pass that can rewrite the current message
- Prompt transforms can target edited or user-supplied text, not only freshly generated AI messages
- Pura's Director Preset now ships in **two versions**:
  - **SillyTavern** version: includes the Toggle and Randomiser prompts
  - **SillyBunny** version: keeps the Main, Primary Toggles, and Prefill Toggles, because Agents cover the optional toggles and randomisers

**Status:** Beta. The goal is fast, toggleable prompt modules for RP without needing to write a full extension.

---

## UI preview

These screenshots show the `v1.3.4` shell across Navigate, Customize, Agents, and Characters on desktop and mobile, plus the same views with Moonlit Echoes enabled.

#### Default shell

##### Desktop

![SillyBunny desktop Navigate](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-navigate-v1.3.3.png)

![SillyBunny desktop Customize](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-customize-v1.3.3.png)

![SillyBunny desktop Agents](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-agents-v1.3.3.png)

![SillyBunny desktop Characters](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-characters-v1.3.3.png)

##### Mobile

![SillyBunny mobile Navigate](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-navigate-v1.3.3.png)

![SillyBunny mobile Customize](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-customize-v1.3.3.png)

![SillyBunny mobile Agents](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-agents-v1.3.3.png)

![SillyBunny mobile Characters](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-characters-v1.3.3.png)

#### Moonlit Echoes enabled

##### Desktop

![SillyBunny Moonlit desktop Navigate](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-moonlit-desktop-navigate-v1.3.3.png)

![SillyBunny Moonlit desktop Customize](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-moonlit-desktop-customize-v1.3.3.png)

![SillyBunny Moonlit desktop Agents](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-moonlit-desktop-agents-v1.3.3.png)

![SillyBunny Moonlit desktop Characters](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-moonlit-desktop-characters-v1.3.3.png)

##### Mobile

![SillyBunny Moonlit mobile Navigate](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-moonlit-mobile-navigate-v1.3.3.png)

![SillyBunny Moonlit mobile Customize](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-moonlit-mobile-customize-v1.3.3.png)

![SillyBunny Moonlit mobile Agents](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-moonlit-mobile-agents-v1.3.3.png)

![SillyBunny Moonlit mobile Characters](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-moonlit-mobile-characters-v1.3.3.png)

---

## Changelog

### v1.3.4 (2026-04-15)

**Shell and panel fixes**

- Widened the Navigate and Customize resize grip from 22px to 28px with a 20px invisible touch area so the corner handle is easier to grab on small or edge-positioned panels
- Fixed the Prompt Manager scrolling back to the top after saving a prompt on desktop split layout
- Fixed Advanced Definitions (character popup) clipping off the left edge of the screen on iOS Safari and other mobile browsers

**Agents**

- Added Pathfinder, an agentic lorebook navigator with eight tools (Search, Remember, Update, Forget, Summarize, Reorganize, Merge/Split, Notebook) and a predictive pipeline system with LLM-powered tree building
- Added the Tool agent category for agents that require API tool-calling support
- Reassigned Grounded Prose, HTML Toggle, Difficulty Increase, Friction Mode, Don't Write for User, and Write for User to Content; NPC Profile Cards to Tracker
- Removed the legacy Agent Mode drawer from Settings (In-Chat Agents remains)
- Removed "Apply to Last Reply" and "Export" buttons from Pathfinder cards
- Fixed a bug where clicking a category chevron in the Agents page on desktop with the edit panel open could make all agent categories disappear until the preset extension was disabled

**Console logging**

- Fixed `[object Object]` appearing in the browser console instead of actual prompt text across all providers

### v1.3.3 (2026-04-14)

**Shell and responsive UI**

- Redesigned shell panels: centered on screen, narrower (900px max), horizontal tab bar at top instead of vertical sidebar
- Centered shell animations: Navigate, Customize, and Characters now open with a scale-and-fade from center
- Rearranged top bar: Navigate + Customize on the left, Home + Characters on the right, removed duplicate API button
- Added customizable quick-access shortcut buttons in the top bar (configurable in Settings)
- Added desktop corner resizing for Navigate and Customize, with saved panel sizes after refresh
- Drawer open/closed state now persists across refreshes
- Removed the optional chatbar overlay; integrated chat management (select, new, rename, delete) into the bottom bar
- Added persona quick-access bubble next to the chat input with popup picker and automatic selected-persona highlighting
- Added a dedicated persona-list scroll area so the persona editor stays reachable
- Added bottom bar size slider (replaces the desktop top bar size slider)
- Rebalanced desktop, lower-resolution desktop, and mobile spacing so shell menus, World Info, prompt editors, and bottom-bar controls flex more consistently
- Aligned flat and bubble chat layouts so User and Assistant labels sit cleanly

**Home, Launchpad, and starter pack**

- Home screen defaults to First Steps with the Launchpad collapsed until opened
- Renamed "Replay Tutorial" to "Open Launchpad"
- Added "Chat with Assistant Nahida" button on the home screen alongside "Open Assistant"
- Assistant Nahida is now created at app startup so she appears in the character list by default
- Starter pack split into "Pre-installed" and "Optional installs" sections with clearer wording
- Added Summary Sharder and Guided Generations (forked) to the optional installs in the starter pack
- Bundled Memory Sharding Quick Reply preset for chat summarisation
- Updated the Geechan starter-pack card to credit Assistant Nahida and Prose Polisher
- Replaced the README screenshots with fresh Navigate, Customize, Agents, and Characters screenshots for desktop, mobile, and Moonlit Echoes

**Agents**

- Removed Agent Mode orchestration (retrieval/memory/lorebook services) to match the "intentionally lightweight" philosophy
- Removed the extra In-Chat Agents drawer so the Agents page opens directly into the standalone agent interface
- Recommended Summary Sharder extension as the memory solution in the starter pack
- Curated the bundled agent list down to Tracker, Randomizer, Content, and Custom categories
- Moved Direction Menu and CYOA Choices into Tracker and made generated choices clickable into the message box
- Bundled Geechan's Prose Polisher as a default post-generation "Rewrite current message" agent
- Credited bundled agents to Purachina, with Prose Polisher credited to Geechan
- Added running-agent toast notifications and clearer manual robot-button wording
- Fixed disabled agent buttons still being selectable
- Fixed Default/main connection profile handling for agents, including separate profile runs and 8192 default max tokens
- Fixed agents silently failing on edited or user-supplied text that was not freshly generated by the AI
- Agent cards now open in the editor when clicked, not only through the pencil icon
- Added fullscreen buttons to text editors

**Connection and extension fixes**

- Fixed stop generation button: `onStopStreaming()` now properly sets `isStopped` flag to prevent generation from appearing to complete normally
- Fixed story branching performance: replaced deep `structuredClone` of entire chat with shallow copy, only deep-cloning the target message when swipe selection requires it
- Fixed `applyBundledOptInDefaults()` always returning true (`return true || changed` → `return changed`)
- Fixed CLIENT_VERSION format: removed `v` prefix so `versionCompare()` works correctly with extensions that specify `minimum_client_version`
- Fixed circular dependency TDZ errors in GuidedGenerations, TunnelVision, Quick Reply, and TTS extensions
- Fixed OpenRouter connection state being forgotten after page reload
- Fixed TunnelVision settings not saving and lorebook search failing
- Fixed extension drawer state and extension enable/disable persistence across refreshes
- Aligned the Extensions panel update-notification checkbox and label
- Fixed duplicate TTS settings panel by adding init guard
- Fixed shell search results showing generic "Extensions" label instead of actual extension/section names
- Fixed persona search duplicate results
- Fixed the greeting/first message edit button
- Fixed double-clicking message action dots selecting the Home button
- Added custom OpenAI-compatible model-name auto-detection for matching provider icons
- Fixed current chat not auto-selecting in chat pickers
- Fixed prompt alignment for prompts that can and cannot be sent to in-chat agents
- Added single-dropdown-at-a-time enforcement via `closeAllDropdowns()`

**Platform support**

- Added Node.js fallback launcher: `start-node.sh`, `Start-Node.bat`, `npm run start:node`
- Auto-detect macOS and ARM platforms and switch to Node.js to avoid Bun CPU overhead (oven-sh/bun#26415)
- `SILLYBUNNY_USE_NODE=1` environment variable forces Node.js on any platform

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
