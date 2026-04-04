# SillyBunny

SillyBunny is a fork of [SillyTavern](https://github.com/SillyTavern/SillyTavern) with a better UI and a Bun-first runtime.

The goal is to keep the familiar SillyTavern workflow, data habits, and compatibility story, while shipping a more polished frontend shell, faster Bun-based startup, and native agent features directly in the app.

> [!WARNING]
> SillyBunny is an active fork. Expect ongoing UI iteration, Bun compatibility work, and occasional upstream sync churn.

## What makes it different

- Bun is the default runtime
- The UI is reworked around a custom SillyBunny navigation shell instead of the stock layout
- Several built-in visual themes, palette presets, and message styles are included out of the box
- Native Agent Mode is built into the app instead of being bolted on as a separate orchestration layer
- SillyTavern workflow and data compatibility remain a priority inside a Bun-only runtime

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

## Quick start

Requirements:

- Bun `1.3.0` or newer if you want to launch SillyBunny directly with `bun`; the included start scripts can install it automatically

Install and run:

```bash
git clone https://github.com/platberlitz/SillyBunny.git
cd SillyBunny
./start.sh
```

On Windows, use:

```powershell
.\Start.bat
```

Those launchers install Bun automatically when it is missing, then install the project packages before starting the server. On Windows, `UpdateAndStart.bat` and `UpdateForkAndStart.bat` now bootstrap missing Git too when a supported package manager is available. If you already have Bun set up, `bun run start` still works as usual.

On Unix-like systems, `start.sh` can also update the tracked Git branch before launch:

```bash
./start.sh --self-update
```

To update without starting the server:

```bash
./start.sh --self-update-only
```

To check for updates on every launch without failing startup when Git is unavailable or the repo is not updateable:

```bash
SILLYBUNNY_AUTO_UPDATE=1 ./start.sh
```

Use `./start.sh --skip-self-update` to bypass the automatic check for a single launch.

Open `http://127.0.0.1:8000`.

For lower-memory or phone-style environments:

```bash
bun run start:mobile
```

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
