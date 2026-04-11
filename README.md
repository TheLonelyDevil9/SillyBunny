# SillyBunny

Based on **SillyTavern 1.17.0 stable** -- same data, same extensions, better shell.

SillyBunny is a fork of [SillyTavern](https://github.com/SillyTavern/SillyTavern) that keeps the workflow you already know but ships it inside a cleaner UI, a Bun-first backend, and lightweight agent hooks for roleplay.

Project site, presets, themes, and extras: [platberlitz.github.io](https://platberlitz.github.io/)

> [!WARNING]
> Active fork. UI, Bun compat, and upstream syncs are ongoing -- expect some churn.

---

## At a glance

| | |
|-|-|
| **Runtime** | Bun (auto-installed), Node.js fallback |
| **Default port** | `4444` |
| **UI** | Custom navigation shell with search, themes, and mobile layout |
| **Agents** | Lightweight pre/post-generation prompt hooks for RP (think OpenClaw, not AutoGPT) |
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

### Agent Mode

Agent Mode is a set of lightweight prompt hooks that run before, during, or after in-chat generation -- similar to how [OpenClaw](https://rentry.org/OpenClaw) works, but built into SillyBunny for RP use cases. These aren't autonomous multi-step agents; they're focused custom prompts that augment the generation pipeline.

**Current agent services:**

- **Retrieval** -- injects relevant context from recent chat, memory, and lorebooks before the next reply
- **Memory** -- updates compact long-term memory after a reply is saved
- **Lorebook** -- syncs lorebook entries after a reply is saved

**How it works:**

- Each agent service has its own source, model, reverse proxy, temperature, and max-token settings
- You can copy the active chat profile to all agents with one click
- World info entries can be marked `Agent blacklisted` to exclude them from agent processing

**Current scope:**

- Runs with active chats only, targeting the chat-completions pipeline
- Intentionally lightweight -- the goal is augmented RP, not autonomous orchestration

### In-Chat Agents (Beta)

In-Chat Agents are custom prompt modules you can create, toggle, and share for RP. The core idea: run trackers, formatting rules, and writing directives through separate API connections (including cheaper models), keeping your main generation budget for the actual story.

Think of them as modular prompt building blocks -- each agent injects text into the generation pipeline at a configurable position and depth, and can optionally post-process the response (extract structured data, regex cleanup, etc.).

**What you can do:**

- Write your own custom agent prompts with full macro support (`{{char}}`, `{{user}}`, `{{random::a::b}}`)
- Use pre-made templates: 31 agents covering trackers, randomisers, directives, formatting, anti-slop, and content control
- Apply agent groups in one click (e.g. "Pura's Director Agents" imports all 31 templates at once)
- Create your own custom groups from your current agents
- Set a Connection Profile for the "Refine with AI" feature to use a cheaper model
- Import agents directly from the Prompt Manager with one click (paper-plane button on each prompt)
- Import/export agents as JSON for sharing

**Pre-made agent groups:**

- **Pura's Director Agents** -- full Director Preset v12 (all 31 agents)
- **Pura's Trackers Only** -- 11 tracker agents (relationship, scene, time, events, items, achievements, reputation, status, secrets, off-screen, world detail)
- **Pura's Randomisers Only** -- 8 randomiser agents (chaos mode, scene pressure, genre, complications, etc.)

**Status:** Beta. If you find bugs, please let me know. The system is intentionally kept simple -- extensions already handle the more complex stuff. This is for people who want quick, toggleable prompt modules without writing a full extension.

---

## UI preview

These screenshots show the `v1.3.0` shell on desktop and mobile.

#### Desktop

![SillyBunny desktop home](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-home-v1.2.8.png)

![SillyBunny desktop customization](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-customize-v1.2.8.png)

#### Mobile

![SillyBunny mobile home](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-home-v1.2.8.png)

![SillyBunny mobile customization](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-customize-v1.2.8.png)

---

## Changelog

### v1.3.0

**In-Chat Agents (Beta)**

- New "In-Chat Agents" system on the Agents page -- custom prompt modules that inject into your RP generation pipeline. Write your own or use pre-made templates. Agents run pre-generation (prompt injection), post-generation (regex cleanup, data extraction), or both.
- 31 pre-made agent templates derived from Pura's Director Preset v12: trackers (relationship, scene, time, events, items, achievements, reputation, status, secrets, off-screen, world detail), randomisers (chaos mode, scene pressure, genre, complications, combined director's cut, dead dove, intimacy/kink), directives, formatting, anti-slop, and content control.
- Agent Groups: apply a whole set of agents in one click. Three built-in groups (Pura's Director Agents, Trackers Only, Randomisers Only) plus custom group creation.
- Connection Profile support for the "Refine with AI" feature -- use a cheaper model for prompt refinement via the ConnectionManagerRequestService API.
- One-click prompt transfer: paper-plane button on each Prompt Manager entry creates an In-Chat Agent with matching settings.
- Import/export agents as JSON for sharing.

**UI/UX fixes**

- Agent Mode and In-Chat Agents panels are now collapsible drawers on the Agents page, both closed by default
- Settings drawer states now persist across page reloads (MutationObserver rebinding)
- Instruct Template section is hidden in Advanced Formatting when Chat Completions mode is active
- Removed subtitle descriptions from Customize menu tabs to save vertical space
- Settings search now shows actual extension names instead of repeated "EXTENSIONS" labels
- Prompts section in Chat Completions presets now matches the style of other drawer sections (bold title, aligned layout)
- Fixed agent overview card "OFF" pill overflow on narrow viewports
- Fixed user avatar vertical centering in Bubbles chat style
- Downgraded atomic write EPERM warnings to debug level (Windows antivirus false positives)
- Bundled third-party extensions (sillytavern-character-colors, sillytavern-image-gen) are now git-ignored to avoid stash churn

### v1.2.9

**UI overhaul -- collapsible settings sections**

- Text Completion presets now use collapsible drawer sections (Sampling, Penalties, Advanced Algorithms, Token Control, Output & Generation), matching the Chat Completions layout so the settings page isn't a wall of sliders
- Advanced Formatting sections (Context Template, Instruct Template, System Prompt, Reasoning) are now stacked collapsible drawers instead of three cramped side-by-side columns
- Consistent dropdown styling across all preset selectors -- Text Completions, Context Template, Instruct Template, System Prompt, and Reasoning Template dropdowns now use the same button wrapper pattern with visible import/export controls

**OpenAI Responses API**

- Added "OpenAI (Responses)" as a new Chat Completion source that targets `/v1/responses` instead of `/v1/chat/completions`
- Messages are converted to the Responses API format automatically (system messages become `instructions`, user/assistant messages become `input`)
- Streaming is handled via server-side SSE translation so the frontend works without changes
- Uses the same API key, model selector, and reverse proxy settings as standard OpenAI

**Auto-stash before git pull**

- New `autoStashBeforePull` option in `config.yaml` with a checkbox in the admin panel
- When enabled, local changes are automatically stashed before pulling updates for both SillyBunny and extensions, then restored afterward
- If the stash pop fails (merge conflict), the update still succeeds and a warning tells you your changes are in `git stash`
- The admin status pill shows "Update Ready (Auto-stash)" instead of "Update Blocked" when local changes exist with auto-stash on

**Encrypted secrets and improved auth**

- API keys in `secrets.json` can now be encrypted at rest using AES-256-GCM (enable with `encryptSecrets.enabled: true` in `config.yaml`)
- Encryption uses Scrypt key derivation with a configurable passphrase or auto-generated `.secret_key` file
- Existing plaintext secrets are migrated to encrypted format automatically on first write
- New `requireHttps` config option rejects plain HTTP connections from non-localhost
- New session-based token auth as an alternative to HTTP Basic Auth (`sessionAuth.enabled: true`) -- POST credentials to `/api/auth/login`, get a Bearer token, use it for subsequent requests

### v1.2.8

- CSS optimization pass: removed 130 lines of dead code, consolidated duplicate rules, replaced longhand overrides with shorthand
- Styled the Presets "Prompts" section to match other Chat Completion drawer sections
- Added adaptive contrast text variables that flip between light/dark based on surface luminance
- Fixed top-bar pointer-events leak, drag listener unbinding, and safe-area-inset padding for notched devices

#### v1.2.8 hotfix (2026-04-10)

- Fixed group chat recovery when stale metadata pointed at a missing `.jsonl` file
- Frontend group validation now repairs missing references and falls back to a valid chat

#### v1.2.8 UI fixes (2026-04-10)

- Fixed version label and Horde identifier to consistently report v1.2.8
- Added palette preset Reset button, slider disabled-state tooltips, mobile eye toggle fix
- Comprehensive border-radius token migration pass across theme stylesheets

### v1.2.7

- Reworked Chat Completion drawers (Prompt Manager gets its own section, config.yaml drawer moves inside Advanced & Reasoning)
- Top-bar customization: desktop multi-part labels, live token counter, Context Size rename
- Console Logs tab under Customize with live server output
- Improved Characters flow, Settings/Extensions UX, and CSRF token handling
- Native Termux compatibility improvements (Node.js default, bash start.sh documentation)

### v1.2.5

- Switched default port to `4444`
- Added "Clear all cache" action and message screenshot export
- Fixed Claude token counting on Bun, improved Docker bundling
- Chat workflow and startup reliability fixes

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
