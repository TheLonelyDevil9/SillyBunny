# Changelog

## v1.4.1

Date: 2026-04-23

Changes:
- Fixed the World Info entry enable/disable regression by restoring the kill-switch event binding to the current button markup.
- Reworked the World Info entry header layout so controls stack more cleanly on narrower desktop widths and mobile screens.
- Shrunk the World Info entry cards and header controls so each lore entry takes up much less vertical space.
- Added bulk delete actions for saved presets in the OpenAI and Text Completion preset pickers.
- Added a bulk delete action for saved connection profiles in Connection Manager.
- Clarified Pathfinder diagnostics so the UI explains that Tool Agents are only required for Pathfinder tool mode, not for pipeline lorebook retrieval.
- Removed the duplicate compact-mode shortcut strip and added the full shortcut row to List Only mode.
- Removed future-facing home-screen references to Pura's SillyTavern Director preset so only the bundled SillyBunny-tuned preset is promoted.
- Aligned the reasoning token badge more evenly with the standard token counter.
- Based bottom-bar sizing on the top-bar size variable so the shell chrome stays visually consistent across desktop and mobile.
- Preserved transparency for cropped avatar images and alpha-capable thumbnails instead of flattening them to opaque backgrounds.
- Updated the in-app Git updater to use a lockfile-safe npm install path and auto-restore `package-lock.json`, preventing routine update churn for existing users.
- Bumped the app version strings and default-user settings version to `1.4.1`.

Commits:
- `fix(ui): ship v1.4.1 lorebook and shell polish`
- `fix(ui): tighten home and updater polish`
