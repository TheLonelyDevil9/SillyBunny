<!-- This file mirrors the root README so GitHub renders the correct project homepage copy. -->

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

These screenshots show the refreshed `v1.4.0` shell-based UI across Navigate, Customize, Agents, Characters, and a Bunny Guide in-chat view on desktop and mobile.

#### Desktop

**Navigation Menu**

<img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-desktop-navigate-v1.4.0.png" alt="Desktop Navigation Menu" width="100%">

**Customize Menu**

<img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-desktop-customize-v1.4.0.png" alt="Desktop Customize Menu" width="100%">

**Agents Menu**

<img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-desktop-agents-v1.4.0.png" alt="Desktop Agents Menu" width="100%">

**Characters Menu**

<img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-desktop-characters-v1.4.0.png" alt="Desktop Characters Menu" width="100%">

**Bunny Guide In-Chat**

<img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-desktop-in-chat-v1.4.0.png" alt="Desktop Bunny Guide Chat" width="100%">

#### Mobile

| Navigation Menu | Customize Menu | Agents Menu | Characters Menu |
| :---: | :---: | :---: | :---: |
| <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-mobile-navigate-v1.4.0.png" alt="Mobile Navigation Menu" width="100%"> | <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-mobile-customize-v1.4.0.png" alt="Mobile Customize Menu" width="100%"> | <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-mobile-agents-v1.4.0.png" alt="Mobile Agents Menu" width="100%"> | <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-mobile-characters-v1.4.0.png" alt="Mobile Characters Menu" width="100%"> |

| Bunny Guide In-Chat |
| :---: |
| <img src="https://raw.githubusercontent.com/platberlitz/SillyBunny/main/screenshots/sillybunny-ui-mobile-in-chat-v1.4.0.png" alt="Mobile Bunny Guide Chat" width="45%"> |

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

The original SillyTavern layout is replaced with a custom, easy-to-navigate graphical shell:

- **Top bar**: Reworked with cleaner, better-defined nested menus. Includes Navigate, Customize, Home, and Characters.
- **Bottom bar**: New bottom bar designed for quick access to persona switching, quick chat switching, and add/edit/remove existing chat functionality.
- **Panel-oriented navigation**: Easy access to all settings in nested panels. Collapsible settings sections in both Chat Completions and Text Completions presets.
- **Global search**: A global search bar that queries across presets, lore, extensions, personas, and settings at once.
- **Platform-aware**: Designed for both desktop and mobile, with a dedicated phone/tablet navigation layer
- **Three modern shell themes**: Modern Glass, Clean Minimal, Bold Stylized
- **Palette customization**: Easily change the accent colour of any theme you're currently using.

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

### v1.4.0 (2026-04-21)

**Documentation**

- Removed the broken screenshot automation script and outdated screenshot guide after the shell controls diverged from those instructions
- Replaced all `v1.4.0` README gallery screenshots with fresh live captures across desktop and mobile

**User Experience**

- Bunny Preset Tools now treats Geechan-style `🌱 ━+` prompt headers as built-in collapsible sections, so those preset groups open as dropdowns automatically
- Quick Access Shortcuts can now be set to Search, and fresh installs now default the right shortcut to the Search icon instead of Persona
- Replaced the old per-shell settings search bars with a single universal search row under the SillyBunny logo, so search is always available no matter which panel is open
- Universal search now expands downward from the top bar, searches across both Workspace and Customize, and jumps directly to matching settings on desktop and mobile
- Universal search is now hidden by default behind the Search shortcut icon and drops down over the header when opened, instead of permanently increasing the top bar height
- Universal search surfaces are now fully opaque so the field, results panel, and result cards stay readable over any page background
- Moved Open Launchpad button next to Temporary Chat for better visual alignment
- Open Launchpad button now toggles the launchpad (opens if closed, closes if open)
- Added active state highlighting to Open Launchpad button when launchpad is open
- Launchpad now expands by default on first startup to showcase tutorials
- Home now highlights in the top bar while the landing page is visible, matching the active-state treatment used by the shell buttons
- Switching from Navigate to Customize no longer double-triggers and closes the shell again during the opening animation
- Switching between Navigate and Customize now keeps the target shell open immediately instead of briefly collapsing through a closed state
- Home now reflows from its own panel width, so returning from Customize no longer crushes the landing copy into a narrow one-word column
- Home display toggles now render once in a centered top row instead of duplicating again above Recent Chats
- Refreshed the README gallery for v1.4.0 with updated desktop/mobile shell captures and new Bunny Guide in-chat screenshots
- Corrected the v1.4.0 README shell captures so the mobile gallery and Characters views no longer show broken overlay states
- Replaced the empty desktop Agents capture with a populated in-chat agents workspace and switched the desktop README gallery to full-width rows so the 1920x1080 screenshots render at readable size
- Regenerated the desktop Characters and mobile Navigate/Agents captures so the gallery shows the Home landing surface behind those menus and the mobile Agents view now includes populated in-chat agent cards
- Increased terminal log serialization depth so LLM request and response preview objects no longer collapse into `[Object ...]` in Windows terminal debug logs

**Themes and Appearance**

- Changed default UI theme to Dark V1.0 (from Default (Dark) 1.7.1)
- Fresh installs now seed Dark V 1.0 on first run instead of briefly landing on Dark Lite until a manual reset
- Synced the fresh-install default-user theme seed values with the Dark V 1.0 preset so first boot no longer inherits leftover Dark Lite toggles like Fast UI, compact input, timestamps, or no-shadows
- Changed default shell style to Clean Minimal (from Modern Glass)
- Removed Forest Dusk, Forest Dawn, and Rose Glow theme preset buttons
- Added 9 accent color preset buttons (blue, cyan, green, yellow, orange, red, pink, purple, gray) for quick color adjustments
- Added Custom RGB Accent toggle with color pickers for full accent customization
- Reset button now resets theme colors to Dark V1.0
- Fixed extension containers showing brown colors by updating default CSS variables to match Dark V1.0
- Removed hardcoded brown colors from Modern Glass and Bold Stylized shell themes
- Made shell themes fully theme-aware - they now adapt to your chosen theme colors instead of forcing brown tones
- Replaced icon-only panel mode toggles with labeled buttons (Full Home, Compact, List only)
- Removed the remaining hardcoded brown accents from the home shell, popups, extension panels, and shared UI fallbacks so theme colors stay consistent after refreshes
- Normalized shared header surfaces and fresh-install fallback colors so section headers no longer revert to brown on desktop or mobile
- Quick context shortcut buttons now render in a strict horizontal row for both Text Completions and Chat Completions
- Accent color preset swatches are now visible on mobile and use smaller touch-friendly circles that fit narrow screens better
- Recent Chats now clips cleanly with corrected corner rounding
- Expanded the Prompt Manager editor pane and widened its dropdown controls in the workspace shell so menu fields no longer feel cramped on desktop
- Moonlit Echoes chat layouts now stay available with Moonlit Echoes itself turned off, including Echo, Whisper, Hush, Ripple, Tide, and their chat-style toggles

**Bug fixes**

- Fixed repo lint regressions across Pathfinder follow-up changes and existing workspace files so the full `npm run lint` pass succeeds again
- Fixed duplicate third-party extension cards in the Extensions panel by deduplicating manifest and render entries before they reach the UI
- Fixed SillyBunny-to-SillyTavern minimum version compatibility checks so third-party extensions like JS Slash Runner no longer fail against the forked client version
- Fixed Pathfinder settings popup scrolling on desktop and mobile, including browsers that were not honoring the parent popup scroll container
- Fixed Termux UI restarts auto-launching a detached browser session and breaking the active terminal attachment
- Fixed extensions disappearing from UI after updates — stale entries in the disabled-extensions list are now automatically cleaned on reload
- Fixed Advanced Definitions modal appearing behind Characters drawer on mobile by increasing z-index
- Fixed reasoning token counts not displaying separately — now shows format like `150t (45r)` where 45r is reasoning tokens
- Fixed auto-cache refresh causing initialization loop on fresh instances by skipping cache clear when no prior settings exist
- Fixed auto-cache refresh not fully clearing cached assets by using hard reload instead of soft reload
- Fixed bottom bar startup refresh on slow Node.js boots by giving it the same late-context binding and APP_READY retry behavior used by the top/chat bars
- Reduced Import Folder and Sync Extensions button sizes on mobile for better fit
- Removed bloated search hint text and tab descriptions on mobile for cleaner UI
- Added reinstall button for third-party extensions to quickly fix corrupted extensions by deleting and reinstalling from repository
- Changed fresh-install API defaults so Chat Completions is the first/main default instead of the old Text Completion or Horde/Kobold path

**Pathfinder enhancements**

- Added an auto-use toggle that automatically enables lorebooks attached to the active character card or chat when Pathfinder settings are opened or refreshed
- Added detailed Pathfinder console logging for lorebook discovery, tree building, pipeline stages, tool/runtime routing, diagnostics, and settings changes

**Reasoning and provider compatibility**

- Simplified reasoning controls by removing the separate "Show thought in chat" toggle, so "Request model reasoning" is the single control again
- Fixed response text extraction for OpenAI-style and Gemini-style payloads so parts/content/candidates/tool-plan formats render correctly instead of collapsing into blank or broken output
- Fixed Gemini thought-signature handling by reading `candidates[].content.parts` correctly and checking the `gemini.thoughtSignatures` config dynamically
- Added clarification tooltip for "Request model reasoning" toggle explaining behavior for Custom OpenAI-compatible providers

**Agents and message tools**

- Fixed message metadata badges so reasoning-token counts and agent-change actions stay in sync during both initial render and later message updates
- Upgraded in-chat agent transform history to show semantic diffs with insert/delete highlighting while keeping Undo/Redo actions
- Updated agent transform diff styling to match recast-post-processing — more subtle colors with rgba transparency for cleaner visual appearance
- Added a dedicated "View agent changes" message action and wired it to the same transform-history popup as the inline badge
- Hardened agent error/result serialization for non-JSON values and updated adventure-helper status copy to be clearer in the UI
- Normalized structured agent/prompt content before text-completion fallback and post-generation passes, so XML-style prompts and appended assistant responses no longer degrade into `[object Object]`
- Post-generation prompt agents now strip repeated outer `<assistant_response>` wrappers before prompting or applying results, so duplicate transport tags no longer leak into chat output

**Bottom bar and persona fixes**

- Fixed bottom-bar chat switching to use the shared chat-opening flow and added retry refresh logic so chat lists populate more reliably after startup and chat events
- Fixed bottom-bar persona switching by preferring `/persona-set` with safely quoted avatar ids and improving active persona detection
- Fixed persona switching when multiple personas share the same name — the bottom bar now correctly selects by avatar ID instead of always falling back to the first name match
- Fixed bottom bar not loading on first page load in Node.js environments — added APP_READY state check and increased retry attempts from 8 to 30

**UI polish**

- Established comprehensive spacing design system using CSS custom properties for consistent spacing, button sizing, and component padding across desktop and mobile
- Fixed button sizing asymmetry — all send form buttons now use consistent sizes (42px desktop, 40px tablet, 38px mobile)
- Corrected asymmetric padding throughout cards, panels, inputs, and navigation elements for visual balance
- Standardized popup control gaps and welcome panel spacing for consistency
- Fixed checkbox and text label alignment across all UI components on both desktop and mobile
- Improved mobile navigation padding symmetry and textarea input consistency
- Enhanced WebKit browser compatibility while maintaining all existing Safari-specific fixes
- Added persistent Full Home, Compact, and List only display modes for the Home welcome panel so recent chats can stay visible without the large onboarding card taking over the chat area
- Tightened the World Info workspace layout so the entry list and editor pane fit better on desktop-sized windows
- Improved checkbox alignment, mobile/editor layout behavior, and escaped macro braces in the in-chat agent prompt placeholder so template tokens display literally
- Added branch switching dropdown to Server Admin panel — switch between main and staging with confirmation dialog, auto-stash option, and automatic restart
- Added context size options at 4k increments — 12k, 20k, 24k, 28k, and 36k-60k now available to fill gaps between existing sizes

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
