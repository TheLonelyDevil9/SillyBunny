<!-- This file mirrors the root README so GitHub renders the correct project homepage copy. -->

# SillyBunny

Current release: **v1.1.0**.

Currently based on **SillyTavern 1.17.0 stable**.

SillyBunny is a fork of [SillyTavern](https://github.com/SillyTavern/SillyTavern) with a better UI and a Bun-first runtime.

The goal is to keep the familiar SillyTavern workflow, data habits, and compatibility story, while shipping a more polished frontend shell, faster Bun-based startup, and native agent features directly in the app.

> [!WARNING]
> SillyBunny is an active fork. Expect ongoing UI iteration, Bun compatibility work, and occasional upstream sync churn.

## Changelog

### v1.1.0 - 2026-04-06

- Added a new Launchpad onboarding flow with a first-launch tour, switchable guide views, responsive card-based layout, and persisted open/close state so new users can revisit it without getting buried in one long page.
- Added the built-in Bunny Guide starter assistant and bundled guide assets to explain LLM basics, providers, models, presets, personas, lorebooks/world info, and everyday SillyBunny workflow questions in plain English.
- Bundled an opt-in starter pack that includes `Pura's Director Preset 11.5`, `sillytavern-character-colors`, and `sillytavern-image-gen`, with extension metadata wired so the Manage Extensions updater can see their GitHub sources.
- Fixed preset slider persistence so saved sampling changes like temperature and Top P actually stick when you save and reload presets.
- Fixed the character drawer layout bug where an opened character view could remain visible behind the drawer when reopening Characters on desktop and mobile.
- Polished homepage and shell UI details, including responsive button sizing, launchpad cleanup, World Info separator alignment, homepage creator/site links, and the refreshed SillyBunny guide art.
- Merged the current staging branch work into `main`, including the latest built-in Agent Mode improvements and the new agentic docs in [`docs/agentic`](docs/agentic/).

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

- `start.sh` will install Bun automatically if it is missing, install project packages, then launch SillyBunny
- If you want to browse or import files from Android shared storage, run `termux-setup-storage` once before starting
- For lower-memory phones or tablet-style environments, you can also use:

```bash
bun run start:mobile
```

### Auto-update controls

On Unix-like systems, the launcher checks the tracked Git branch before launch by default:

```bash
./start.sh
```

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

Open `http://127.0.0.1:8000`.

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
