# 🐰 SillyBunny 🐰

An elegant fork of [SillyTavern](https://github.com/SillyTavern/SillyTavern), designed with a cleaner, shell-based UI; Bun-based backend; built-in tutorials, presets, extensions, and a quick-start dashboard; and a lightweight agnetic system to faciliate modern agent functionality.

You can find additional extras here: [platberlitz.github.io](https://platberlitz.github.io/)

> [!WARNING]
> This is an in-dev fork, and is considered beta quality. [Please direct all issues to this project's issue tracker.](https://github.com/platberlitz/SillyBunny/issues)
>
> Disclaimer: LLMs are used to facilitate development of this fork. Overall software design, prompting, testing, and documentation are handled by humans. To keep things simple, we try to maintain close to upstream as possible.
---
## At a glance

| | |
|-|-|
| **UI** | Custom navigation shell with search, themes, and mobile layout |
| **Runtime** | Bun (auto-installed), Node.js fallback |
| **Bundled Goodies** | Pre-bundled RP presets, complementary extensions, and additional themes, alongside built-in detailed tutorials |
| **Agents** | Built-in In-Chat Agents for modular RP prompting |
| **Data** | Drop-in compatible with SillyTavern settings, characters, chats, presets, and extensions |
| **Default port** | `4444` |

---

## User Interface

These screenshots show the new shell-based UI across Navigate, Customize, Agents, and Characters on desktop and mobile.

#### Desktop

| Navigation Menu | Customize Menu |
| :---: | :---: |
| <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-desktop-navigate-v1.3.6.png" alt="Desktop Navigation Menu" width="100%"> | <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-desktop-customize-v1.3.6.png" alt="Desktop Customize Menu" width="100%"> |

| Agents Menu | Characters Menu |
| :---: | :---: |
| <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-desktop-agents-v1.3.6.png" alt="Desktop Agents Menu" width="100%"> | <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-desktop-characters-v1.3.6.png" alt="Desktop Characters Menu" width="100%"> |

#### Mobile

| Navigation Menu | Customize Menu | Agents Menu | Characters Menu |
| :---: | :---: | :---: | :---: |
| <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-mobile-navigate-v1.3.6.png" alt="Mobile Navigation Menu" width="100%"> | <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-mobile-customize-v1.3.6.png" alt="Mobile Customize Menu" width="100%"> | <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-mobile-agents-v1.3.6.png" alt="Mobile Agents Menu" width="100%"> | <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-mobile-characters-v1.3.6.png" alt="Mobile Characters Menu" width="100%"> |

---

## Quick Start

[Grab the latest release here.](https://github.com/platberlitz/SillyBunny/releases/latest)

Or run:

```bash
git clone https://github.com/platberlitz/SillyBunny.git
cd SillyBunny
```

Then, run the appropriate launcher for your OS, which auto-installs all dependencies, checks for updates, and starts a server instance. You can also open `http://127.0.0.1:4444` manually in your browser.

| Platform | Command |
|----------|---------|
| Windows | `.\Start.bat` |
| macOS (Terminal) | `./Start.command` |
| macOS (Finder) | Double-click `Start.command` (right-click > Open if Gatekeeper warns) |
| Linux / WSL | `./start.sh` |
| Docker | `docker compose -f docker/docker-compose.yml up --build`
| Android (Termux) | `bash start.sh` |

If you already manage your own Bun install, run via `bun run start`. Other launch variants:

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

---

### How to Update

| What you want | Command |
|---------------|---------|
| Normal launch (auto-checks for updates) | `./start.sh` |
| Force update then launch | `./start.sh --self-update` |
| Update only, don't start | `./start.sh --self-update-only` |
| Skip update check once | `./start.sh --skip-self-update` |
| Disable auto-update permanently | `SILLYBUNNY_AUTO_UPDATE=0 ./start.sh` |

---

## Changes vs. SillyTavern

### Different UI

The original SillyTavern layout is replaced with a custom navigation shell:

- **Left/right panel navigation** for workspace and customization
- **Search-first** across presets, lore, extensions, personas, and settings
- **Mobile-aware** with a dedicated phone/tablet navigation layer
- **Collapsible settings sections** in both Chat Completions and Text Completions presets
- **Extra shell themes**: Modern Glass, Clean Minimal, Bold Stylized, etc.
- **Extra palette presets**: Forest Dusk, Forest Dawn, Rose Glow, etc.

### Bun-first runtime

Instead of node.js, this fork uses Bun. This results in consistently faster startups, overall performance, and automatic launcher bootstraping. Node.js is still fully functional as a fallback system.

### In-Chat Agnetic Support

SillyBunny has support for In-Chat Agents. These are custom prompt fields that can run separately from the main generation, which allows for a lot of extra flexibility. Included are several pre-built prompts designed for trackers, post-gen cleanup, anti-slop, and more. Agents can use the main model or a different connection profile, allowing for a fast, smaller model to run long agnetic tasks with ease while a large, main model writes the actual story content.

This feature is currently in beta. These are designed to fill the gap between full extensions and simple, modular agnetic functionality.

**Pipeline:**

1. **Pre-generation agents** injects prompt text before the main reply is generated.
2. **Main Model** writes the main RP reply.
3. **Post-generation agents** optionally rewrites the contents of the main response, or appends extra content after the reply.
4. **Post-process utilities** can extract structured data, run regex cleanup/formatting, or preserve machine-readable blocks while showing cleaner UI.
5. **Groups and templates** let you swap whole stacks quickly without editing your base preset every time.

**Typical Usecases:**

- Trackers for scene, time, items, relationships, off-screen activity, and world state.
- Writing cleanup passes like anti-slop or regex-based formatting.
- Formatting helpers like direction menus, CYOA choices, or NPC profile cards.
- Randomisers and directives that change the pressure, genre, pacing, or escalation of a scene.
- Content toggles for prose style, difficulty, POV, and HTML artifacts.
- Agentic lorebook navigation for on-demand retrieval, memory maintenance, and tree building.
- Cheap helper-model passes that prepare or polish content without spending your main model's budget.

**Included Agents**

* **Trackers:** Achievements, CYOA Choices, Direction Menu, Event, Item, NPC Profiles, Parallel Off-Screen, Relationship, Reputation, Scene, Secrets, Status, Time, and World Detail.
* **Randomizers:** Chaos Mode, Combined Director's Cut, Dead Dove Escalation, Genre, Grounded Complication, Intimacy & Kink, Scene Driving Force, and Scene Pressure Cocktail.
* **Content:** Difficulty Increase, Don't Write for User, Friction Mode, Grounded Prose, HTML Toggle, and Write for User.
* **Post Generation Editors:** Prose Polisher
* **Additional Agents:** Pathfinder (an agentic lorebook navigator with 8 tools for retrieval, memory maintenance, and tree building).

**Agent Behaviors and Settings**
* Agentic prompts feature inline run-order editing, click-to-edit functionality, and fullscreen prompt editors.
* Agents use the main connection profile by default with an 8192 max token limit. Separate connection profile support is available when explicitly selected.
* Bundled trackers, including CYOA Choices, are configured for pre-generation. The main model emits clickable options directly in the response.
* All bundled tracker and menu agents default to the User injection role to maintain compatibility with models that deprioritize System injections.
* Built-in groups are available for the full preset, trackers only, and randomizers only.
* Custom agents support ST-style regex options.

### Bundled Goodies & Tutorials
SillyBunny includes some extras by default to help you get started right away:
* A tutorial that guides you through the SillyBunny interface.
* Pre-bundled roleplay presets from purachina and Geechan.
* A character card conversion preset from TLD to help you generate character cards from scratch, or convert from existing cards to a better format.
* A friendly quick-start guide with optional recommended extensions (Summary Sharder, Dialogue Colours, Quick Image Gen, Guided Generations, CSS Snippets).
* Two custom assistants to help you get started - Bunny Guide, and Assistant Nahida.

---

## Latest Update

### v1.3.8 (2026-04-21)

**Reasoning and provider compatibility**

- Added a separate "Show thought in chat" toggle so reasoning can be requested without forcing returned thought text to stay visible in chat
- Fixed response text extraction for OpenAI-style and Gemini-style payloads so parts/content/candidates/tool-plan formats render correctly instead of collapsing into blank or broken output
- Fixed Gemini thought-signature handling by reading `candidates[].content.parts` correctly and checking the `gemini.thoughtSignatures` config dynamically
- Added clarification tooltip for "Request model reasoning" toggle explaining behavior for Custom OpenAI-compatible providers

**Agents and message tools**

- Fixed message metadata badges so reasoning-token counts and agent-change actions stay in sync during both initial render and later message updates
- Upgraded in-chat agent transform history to show semantic diffs with insert/delete highlighting while keeping Undo/Redo actions
- Updated agent transform diff styling to match recast-post-processing — more subtle colors with rgba transparency for cleaner visual appearance
- Added a dedicated "View agent changes" message action and wired it to the same transform-history popup as the inline badge
- Hardened agent error/result serialization for non-JSON values and updated adventure-helper status copy to be clearer in the UI

**Bottom bar and persona fixes**

- Fixed bottom-bar chat switching to use the shared chat-opening flow and added retry refresh logic so chat lists populate more reliably after startup and chat events
- Fixed bottom-bar persona switching by preferring `/persona-set` with safely quoted avatar ids and improving active persona detection
- Fixed persona switching when multiple personas share the same name — the bottom bar now correctly selects by avatar ID instead of always falling back to the first name match
- Fixed bottom bar not loading on first page load in Node.js environments — added APP_READY state check and increased retry attempts from 8 to 30

**UI polish**

- Added persistent Full Home, Compact, and List only display modes for the Home welcome panel so recent chats can stay visible without the large onboarding card taking over the chat area
- Tightened the World Info workspace layout so the entry list and editor pane fit better on desktop-sized windows
- Improved checkbox alignment, mobile/editor layout behavior, and escaped macro braces in the in-chat agent prompt placeholder so template tokens display literally
- Added branch switching dropdown to Server Admin panel — switch between main and staging with confirmation dialog, auto-stash option, and automatic restart
- Added context size options at 4k increments — 12k, 20k, 24k, 28k, and 36k-60k now available to fill gaps between existing sizes

### v1.3.7 (2026-04-17)

**Tokenizer and compatibility**

- Fixed DeepSeek tokenizer throwing `ERR_INVALID_ARG_VALUE` by converting Node.js Buffer to UTF-8 string before passing to `Tokenizer.fromJSON()`
- Spoofed SillyTavern client version to ensure ST extension imports work (SillyBunny now reports as compatible with ST 1.13.x requirements)

**Mobile UX**

- Fixed Settings, Extensions, and Pathfinder modals not scrolling on mobile (overflow and max-height constraints added for viewports under 1000px and 600px)
- Fixed mobile tab access in Navigate and Customize panels on 1080×2400px devices

**Pathfinder and agents**

- Fixed Gemini tool registration showing 0/8 tools — diagnostics now checks for API/model support, enabled agents, and event-driven tool re-registration on settings changes
- Removed the confusing duplicate "Skip second filter pass" checkbox from the prompt editor (use the single-pass pipeline type instead)
- Added agent prompt transform history — messages modified by agents now show a 📝 badge; clicking it reveals a before/after diff popup with Undo/Redo buttons
- Fixed agent prompt transform producing `[object Object]` when using Google AI Studio connection profiles — the response text extraction now handles Gemini's parts-based response format

**Model selection**

- Added dynamic `/v1/models` dropdowns with text input fallback for Claude, AI21, Cohere, Perplexity, VertexAI, and ZAI — selecting a model from the API now populates the dropdown, while the text input allows entering custom model names

**UI and reliability**

- Added reasoning tokens inline badge (💭 count) next to message token counts for models that report reasoning tokens
- Fixed slow-start race condition where the top bar could fail to load on VPS environments (added `APP_READY` fallback initialization)

### v1.3.6 (2026-04-16)

**Startup and shell reliability**

- Fixed a slow-start race on Node.js, especially on VPS and Oracle Cloud-style environments, where the top bar and shell chrome could fail to initialize until the page was refreshed multiple times
- Added retry-safe shell/bootstrap initialization so late DOM insertion still finishes building the top bar and chat tools on first load
- Restored live chat/profile refresh binding for the top shell tools so connection and chat selectors stay in sync after delayed UI mount

**Streaming and swipe fixes**

- Fixed stopping a streaming generation leaving SillyBunny stuck in a "still generating" state, which could block sending, Home navigation, swiping, or opening other cards until a full refresh
- Cancel now immediately unlocks the UI and clears the active stream cleanly instead of waiting for a later error path to finish cleanup
- Fixed swipe-generated alternates re-running post-generation agents after the earlier Guided Generations fix, so normal swipes no longer trigger duplicate post passes that already ran on the original turn

**Connection profiles and logs**

- Fixed In-Chat Agents default profile fallback so blank/default agent profile settings now follow the live Connection Manager selection instead of silently using only the currently enabled API setting
- Added profile UI refresh hooks so Connection Manager profile changes, creation, updates, and deletion stay aligned with what agent cards and dropdowns show
- In-Chat Agent prompt-transform notifications now show the Connection Manager profile display name instead of the raw internal profile id, so running-agent toasts read the exact profile name you picked
- Restored short text previews in Google AI Studio debug logs while keeping the safer summarized logging format, so requests and responses show enough visible content to debug prompts again without dumping full payloads

[Find other changelogs in our Releases.](https://github.com/platberlitz/SillyBunny/releases)

---

## Upstream Information

SillyBunny is a fork of SillyTavern. Most SillyTavern behavior, data formats, and ecosystem knowledge still apply. If running into an issue reproducable in upstream, please direct issues there.

| Resource | Link |
|----------|------|
| Upstream repo | [SillyTavern/SillyTavern](https://github.com/SillyTavern/SillyTavern) |
| Upstream docs | [docs.sillytavern.app](https://docs.sillytavern.app/) |
| Discord | [discord.gg/sillytavern](https://discord.gg/sillytavern) |
| Subreddit | [r/SillyTavernAI](https://reddit.com/r/SillyTavernAI) |

If something feels off, compare against the upstream `release` branch first.

## Contributors

- [Platberlitz](https://github.com/platberlitz)
- [Geechan](https://github.com/Geechan)

[Licensed as free software under the AGPL-3.0.](https://www.gnu.org/licenses/agpl-3.0.en.html)
