# SillyBunny

Currently based on **SillyTavern 1.17.0 stable**.

SillyBunny is a fork of [SillyTavern](https://github.com/SillyTavern/SillyTavern) with a better UI and a Bun-first runtime.

The goal is to keep the familiar SillyTavern workflow, data habits, and compatibility story, while shipping a more polished frontend shell, faster Bun-based startup, and native agent features directly in the app.

Project site, presets, themes, and extras: [platberlitz.github.io](https://platberlitz.github.io/).

> [!WARNING]
> SillyBunny is an active fork. Expect ongoing UI iteration, Bun compatibility work, and occasional upstream sync churn.

## What makes it different

- Bun is the default runtime
- The UI is reworked around a custom SillyBunny navigation shell instead of the stock layout
- Several built-in visual themes, palette presets, and message styles are included out of the box
- Native Agent Mode is built into the app instead of being bolted on as a separate orchestration layer
- SillyTavern workflow and data compatibility remain a priority inside a Bun-only runtime

## Quick start

Requirements:

- A Git clone is recommended if you want launcher-based auto-updates
- Bun `1.3.0` or newer only if you plan to launch SillyBunny directly with `bun`; the included start scripts can install it automatically

Clone and enter the repo:

```bash
git clone https://github.com/platberlitz/SillyBunny.git
cd SillyBunny
```

Launch it with the script that matches your platform:

Linux and other Unix shells:

```bash
./start.sh
```

macOS from Terminal:

```bash
./Start.command
```

macOS from Finder:

- Double-click `Start.command`
- If Gatekeeper warns on first launch, right-click it and choose `Open`

Windows:

```powershell
.\Start.bat
```

Launcher behavior:

- `start.sh`, `Start.command`, `Start.bat`, `UpdateAndStart.bat`, and `UpdateForkAndStart.bat` all perform an automatic self-update check before launch when you are running from a clean Git clone with an upstream branch configured
- Bun is installed automatically when it is missing
- Git is installed automatically when a launcher needs it and the platform has a supported installation path
- Project packages are installed automatically before the server starts
- ZIP downloads can still be started, but they cannot auto-update until you switch to a Git clone

If you already have Bun set up and prefer direct runtime commands, `bun run start` and friends still work as usual.

### macOS notes

- Recommended Terminal launch:

```bash
cd /path/to/SillyBunny
./Start.command
```

- `Start.command` changes into the repo folder, makes the launcher scripts executable, then runs the same bootstrap flow as `./start.sh`
- If Finder is more convenient, you can double-click `Start.command`; if Gatekeeper blocks the first launch, right-click it, choose `Open`, then confirm once
- If the launcher window opens and closes too quickly, rerun it from Terminal with `./Start.command` so you can keep the output visible
- On a Git clone, if macOS does not already have Git available, the launcher will trigger the Apple Command Line Tools installer with `xcode-select --install`
- After the Command Line Tools install finishes, close that installer if needed and rerun `./Start.command`
- If you downloaded a ZIP and macOS added quarantine metadata, remove it with:

```bash
xattr -dr com.apple.quarantine "/path/to/SillyBunny"
```

- If your unzip tool stripped execute permissions, restore them with:

```bash
chmod +x Start.command start.sh scripts/*.sh
```

- `Start.command` forwards launcher flags too, so update-only runs work on Mac:

```bash
./Start.command --self-update-only
./Start.command --self-update
```

- Auto-update only works for Git clones with a tracked branch. ZIP installs can still be launched, but updating them still means downloading a fresh copy manually
- To stop the server from Terminal, press `Ctrl+C`

### Termux notes

- Recommended Android setup from a current Termux install:

```bash
pkg update && pkg upgrade -y
pkg install -y git curl unzip
git clone https://github.com/platberlitz/SillyBunny.git
cd SillyBunny
bash start.sh
```

- `start.sh` will install the runtime it needs automatically, install project packages, then launch SillyBunny
- `bash start.sh` is the recommended Android command because it keeps the self-update check, dependency bootstrap, and launch flow together
- On native Termux, the launcher now prefers `node` plus `npm` automatically because that path is currently more reliable than Bun under `grun`; if Node.js is missing, the launcher will install `nodejs-lts` for you
- The package postinstall now falls back to `node post-install.js` first, so native Termux no longer needs Bun just to finish dependency installation
- If you explicitly want to try Bun on native Termux anyway, you can override the launcher with `SILLYBUNNY_TERMUX_RUNTIME=bun bash start.sh`
- If you use an alias or launcher on Android, point it to `cd ~/SillyBunny && bash start.sh`, not `node server.js`, so dependency bootstrap and auto-update still run
- To update without starting on Android, run `bash start.sh --self-update-only`
- To force an update and then launch, run `bash start.sh --self-update`
- Auto-update only works for Git clones with a tracked branch. ZIP installs can still be launched, but they still need manual replacement downloads to update
- If you want to browse or import files from Android shared storage, run `termux-setup-storage` once before starting
- For smoother Android use on lower-memory phones or tablets, keep using the launcher default instead of forcing direct runtime commands:

```bash
bash start.sh
```

### Auto-update controls

On Unix-like systems, the launcher checks the tracked Git branch before launch by default:

```bash
./start.sh
```

Calling `node server.js` or `bun server.js` directly skips that bootstrap step, so package installs and auto-update checks will not run.

To force a non-optional update pass:

```bash
./start.sh --self-update
```

To update without starting the server:

```bash
./start.sh --self-update-only
```

Use `./start.sh --skip-self-update` to bypass the automatic check for a single launch.

You can also disable the automatic check through the environment:

```bash
SILLYBUNNY_AUTO_UPDATE=0 ./start.sh
```

On Windows PowerShell:

```powershell
$env:SILLYBUNNY_AUTO_UPDATE = '0'
.\Start.bat
```

Open `http://127.0.0.1:4444`.

For lower-memory or phone-style environments:

```bash
bun run start:mobile
```

## Current features

### Bun-first runtime

- Main server startup runs on Bun by default
- Bun mobile launch path uses `bun --smol` for lower-memory environments
- Global mode uses SillyBunny-owned paths directly

Available launch commands:

```bash
bun run start
bun run start:mobile
bun run start:global
bun run start:no-csrf
```

Those direct Bun commands are still useful if you already manage Bun, Git, and dependency updates yourself. The OS launchers below are the recommended path because they now handle prerequisite bootstrapping and auto-update checks before starting the server.

### Better UI

SillyBunny keeps the core SillyTavern workspace, but replaces the surrounding UI with a more opinionated shell focused on faster navigation and cleaner visuals.

Current UI work includes:

- A custom left/right navigation shell for workspace and customization flows
- Search-first navigation across presets, lore, extensions, personas, and settings
- A mobile navigation layer for smaller screens
- Three built-in shell themes:
  - Modern Glass
  - Clean Minimal
  - Bold Stylized
- Built-in SillyBunny palette presets:
  - Forest Dusk
  - Forest Dawn
  - Rose Glow
- Built-in message display styles:
  - Flat
  - Bubbles
  - Document

### Native Agent Mode

Agent Mode is built into the app as a per-chat feature set, not as a replacement backend.

Current v1 services:

- Retrieval agent
- Memory agent
- Lorebook agent

What Agent Mode can do today:

- Run retrieval before the next assistant reply to inject relevant context from recent chat, memory, and accessible lorebooks
- Update compact long-term memory after a reply is saved
- Sync lorebook entries after a reply is saved
- Use per-service agent profiles with their own source, model, reverse proxy, temperature, and max token settings
- Copy the active chat profile to all agents from the UI
- Mark world info entries as `Agent blacklisted` so agents skip them

Current Agent Mode limitations:

- It currently runs only with an active chat
- It currently targets the chat-completions pipeline
- The first implementation is intentionally lightweight and service-oriented

## Changelog

### v1.2.7

- Bumped the app, client, and package version strings to `v1.2.7`.
- Reworked the Chat Completion drawers so `Prompt Manager` now lives in its own persisted section below `Advanced & Reasoning`, while the Claude and Gemini `config.yaml` drawer moved inside `Advanced & Reasoning`.
- Expanded top-bar customization with desktop multi-part labels, renamed `Ctx Size` to `Context Size`, hooked the live token total into the top bar, fixed hidden-top-bar persistence on mobile, and removed the dead top-bar padding strip.
- Added a `Console Logs` tab under Customize with live server output, including Bun-safe console capture and filtering for terminal control-sequence junk.
- Improved the Characters flow so clicking `Characters` from an active single-character chat can jump straight into that character's editor, with explicit `X` exits on desktop and mobile and cleaner toggling back to the real list drawer.
- Improved Settings and Extensions UX with persistent drawer states, `Appearance` matching the other dropdowns, a more descriptive settings search, and cleaner `Notify on extension updates` layout and spacing.
- Fixed the local invalid CSRF token startup issue by hardening token refresh and no-cache handling during first-load and admin requests.
- Added the Memory Sharding Quick Reply preset, refreshed the Welcome page credits for Geechan and TheLonelyDevil, and added a clear fork reminder that issues should go to `purachina` on GitHub.
- Tightened responsive UI behavior across desktop and mobile, including stop-button sizing, flatter message divider cleanup, better smaller-screen flexibility in Settings and Extensions, and tighter mobile shell-tab spacing.
- Improved native Termux compatibility by defaulting the Android launcher path to Node.js plus npm, falling back to `node post-install.js` before Bun, and documenting `bash start.sh` as the correct path for aliases and auto-update.
- Fixed duplicated provider icons, cleaned up Prompt Manager opacity/default-open behavior, moved `Import & Restore` into its own drawer above `Appearance`, and normalized Moonlit Echoes header styling.

### v1.2.5

- Switched the default app port to `4444` across launchers, config defaults, and Docker.
- Added a built-in `Clear all cache` action in Settings for browser-side cache cleanup and reload.
- Added message screenshot export for a single message or a range, including a wand-menu entry and bundled `html2canvas` loader support.
- Fixed Claude token counting on Bun by moving the Claude path to a Bun-safe tokenizer implementation.
- Improved Bun and Docker frontend bundling so precompiled assets can be reused cleanly and Docker/Zeabur builds no longer depend on a runtime `DATA_ROOT`.
- Smoothed out several jarring menu transitions and tightened desktop/mobile layout symmetry, button sizing, overflow handling, top-bar behavior, and Moonlit Echoes spacing.
- Fixed several chat workflow regressions, including branch creation edge cases, duplicate inline media icons, and Bubbles user-message divider artifacts.
- Improved startup/import reliability, including Windows quick-start follow-through and problem spots reported around SillyTavern chat imports.

## Docker

SillyBunny includes a Bun-based Docker setup:

```bash
docker compose -f docker/docker-compose.yml up --build
```

## Compatibility and upstream

SillyBunny is still a fork of SillyTavern, and a large amount of the application behavior, data model, and ecosystem knowledge still comes from upstream.

- Upstream project: <https://github.com/SillyTavern/SillyTavern>
- Upstream docs: <https://docs.sillytavern.app/>
- Upstream Discord: <https://discord.gg/sillytavern>
- Upstream subreddit: <https://reddit.com/r/SillyTavernAI>

If something feels off, compare behavior against the upstream `release` branch first.

## License

AGPL-3.0
