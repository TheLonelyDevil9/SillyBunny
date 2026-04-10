# SillyBunny

Currently based on **SillyTavern 1.17.0 stable**.

SillyBunny is a fork of [SillyTavern](https://github.com/SillyTavern/SillyTavern) with a better UI and a Bun-first runtime.

The goal is to keep the familiar SillyTavern workflow, data habits, and compatibility story, while shipping a more polished frontend shell, faster Bun-based startup, and native agent features directly in the app.

Project site, presets, themes, and extras: [platberlitz.github.io](https://platberlitz.github.io/).

> [!WARNING]
> SillyBunny is an active fork. Expect ongoing UI iteration, Bun compatibility work, and occasional upstream sync churn.

## Table of contents

- [What makes it different](#what-makes-it-different)
- [Quick start](#quick-start)
  - [macOS notes](#macos-notes)
  - [Termux notes](#termux-notes)
  - [Auto-update controls](#auto-update-controls)
- [Current features](#current-features)
  - [Bun-first runtime](#bun-first-runtime)
  - [Better UI](#better-ui)
  - [UI preview](#ui-preview)
  - [Native Agent Mode](#native-agent-mode)
- [Changelog](#changelog)
  - [v1.2.8](#v128)
  - [v1.2.7](#v127)
  - [v1.2.5](#v125)
- [Docker](#docker)
- [Compatibility and upstream](#compatibility-and-upstream)
- [License](#license)

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

### UI preview

These screenshots show the live `v1.2.8` shell in both full desktop and responsive mobile layouts.

#### Desktop home

![SillyBunny desktop home](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-home-v1.2.8.png)

The desktop landing view keeps the `v1.2.8` badge, assistant shortcuts, bundled links, and recent chats visible in one full-width workspace.

#### Desktop customization

![SillyBunny desktop customization](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-desktop-customize-v1.2.8.png)

The desktop customization flow highlights the settings search, shell controls, and the broader set of tabs available for tuning the app.

#### Mobile home

![SillyBunny mobile home](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-home-v1.2.8.png)

The mobile landing layout keeps the welcome cards and bunny guide accessible while condensing the shell into a phone-friendly header.

#### Mobile customization

![SillyBunny mobile customization](https://raw.githubusercontent.com/platberlitz/SillyBunny/main/docs/assets/readme/sillybunny-ui-mobile-customize-v1.2.8.png)

The mobile customization screen shows the responsive tab rail and settings search working cleanly in a narrow portrait viewport.

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

### v1.2.8

- Comprehensive CSS optimization pass across `style.css`, removing 130 lines of dead code, duplicate rules, outdated vendor prefixes, and redundant property overrides without changing any visual output.
- Consolidated duplicate logit-bias, placeholder, and scrollbar-thumb rules into shared selectors and replaced longhand padding/margin overrides with shorthand equivalents.
- Styled the Presets `Prompts` section to match the other Chat Completion drawer sections (Token Budget, Sampling, Output, Advanced & Reasoning) with consistent font weight, description opacity, and layout, while keeping the `Total Tokens` counter visible.
- Added adaptive contrast text variables (`--sb-contrast-strong`, `--sb-contrast-muted`) that automatically flip between light and dark text based on the surface luminance detected by the existing WCAG-based tone system, so drawer section headings and descriptions stay readable across any theme without manual CSS edits.
- Fixed a top-bar pointer-events leak that could let drag gestures bleed through open drawers, and added `pointer-events: auto` to Select2 dropdowns so they remain clickable under the new containment rules.
- Added safe-area-inset padding to the top bar for notched and Dynamic Island devices.
- Added layout and style containment hints to the chat-bar layer for smoother drag and scroll performance.
- Fixed top-bar drag event listeners not being unbound after a drag ends, preventing stale pointermove handlers from accumulating across sessions.

#### v1.2.8 hotfix (2026-04-10)

- This keeps the existing `v1.2.8` version number and should be treated as a hotfix refresh, not a new feature release.
- Fixed the group chat recovery path when a new or renamed group chat left behind stale metadata pointing at a missing `.jsonl` file.
- Existing group chat files on disk are now preferred over broken stale chat IDs during group load, so real chats stop getting stranded behind a missing active pointer.
- Missing group chat info now resolves cleanly instead of cascading into repeated `ENOENT` / `stat` failures, refresh warnings, and broken recent-chat or sidebar loops.
- Frontend group validation now repairs missing group-chat references in-session and falls back to a valid chat when one still exists.

#### v1.2.8 UI fixes (2026-04-10)

- This keeps the existing `v1.2.8` version number and should be treated as a patch refresh, not a new feature release.
- Fixed the visible SillyBunny UI version label and Horde client identifier so the app now consistently reports `v1.2.8`.
- Added a **Reset** button next to the SillyBunny palette presets so you can restore all colors to the current theme after applying a palette without having to re-select the theme from the dropdown.
- Blur Strength and Shadow Width sliders now show a tooltip explaining they are disabled when Fast UI Mode or No Shadows is on respectively, and applying a palette while those modes are active now shows a warning toast.
- Fixed mobile eye toggle requiring two taps to hide the top chat bar by removing a `touchstart` stop-propagation from top-bar icon buttons that was interfering with browser touch-to-click synthesis. The same fix improves the chat info bar drag handle on mobile.
- Removed the `overflow: hidden` clip from the persona management left column that was cutting off content.
- Constrained the Top Bar Label option grid width so the three checkbox cards no longer stretch across the full settings panel width.
- Fixed a sub-pixel border artifact on the top bar in Safari on macOS by replacing the `border-bottom` with an equivalent `box-shadow` line that composites correctly alongside `backdrop-filter`.
- Comprehensive border-radius consistency pass: added `--sb-radius-button: 14px` token and migrated all hardcoded `px` radius values across `sillybunny-theme.css` and `sillybunny-tabs.css` to the `--sb-radius-sm/md/lg/xl/button` design tokens.
- Equalized asymmetric vertical paddings on `#send_form`, persona section panels, `#nonQRFormItems`, `#UI-presets-block`, and settings subdrawer headers.

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

#### v1.2.7 hotfix follow-up

- This keeps the existing `v1.2.7` version number and should be treated as a hotfix refresh, not a new feature release.
- Fixed a Firefox-on-macOS header rendering issue that could leave a stray strip across the top bar.
- Fixed the Presets `Prompts` drawer so it scales like the other dropdown sections instead of staying stuck at a smaller width.
- Fixed mobile hidden top chat-info bar persistence so it survives restart.
- Fixed in-chat top-bar label restoration so `Context Size`, `Character Name`, or the chosen custom label reapply automatically instead of getting stuck on `SillyBunny`.

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
