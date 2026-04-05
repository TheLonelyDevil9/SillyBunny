# Upstream Parity and Sync Plan

This document is the living note for how SillyBunny should track future SillyTavern stable updates while still keeping its own identity.

## Purpose

SillyBunny is intentionally not a pixel-for-pixel or runtime-identical copy of SillyTavern.

At the same time, the fork should not drift so far that it loses the practical benefits of upstream:

- familiar workflow
- data compatibility
- ecosystem knowledge
- extension expectations
- bug fixes and security fixes
- stable behavior users already understand

This file exists to make that balance explicit.

## SillyBunny Should Stay Different In

These are intentional product-level differences that do not need to chase strict parity:

- Bun-first runtime and startup flow
- SillyBunny shell, navigation, and UI presentation
- built-in themes, palette presets, and message style direction
- native Agent Mode and related integrated agent workflows
- mobile-specific shell ergonomics and performance tuning

## SillyBunny Should Stay Close To Upstream In

These are the areas where parity matters the most:

- core chat behavior
- character, chat, lorebook, and settings data compatibility
- prompt formatting behavior unless SillyBunny intentionally documents a divergence
- extension compatibility where practical
- server/API behavior that users and tools expect from SillyTavern
- important upstream bug fixes, regressions, and security fixes

## Sync Strategy

When syncing from future SillyTavern stable or release versions:

1. Pull upstream stable behavior first, then re-apply SillyBunny-specific shell/runtime choices.
2. Prefer focused merges by subsystem instead of giant undocumented sync dumps.
3. Prioritize security fixes, bug fixes, compatibility fixes, and data-format changes before cosmetic parity.
4. Keep intentional divergences documented here instead of letting them become accidental drift.
5. When upstream behavior changes and SillyBunny does not follow it, record why.

## Default Priorities For Future Syncs

Priority order:

1. Security and correctness fixes
2. Data compatibility and migration safety
3. Core workflow parity
4. Extension and ecosystem compatibility
5. Stable feature parity
6. Nice-to-have upstream UI parity only where it fits SillyBunny

## Intentional Divergence Rule

If a future SillyTavern stable update conflicts with SillyBunny's design direction, the divergence should be kept only when at least one of these is true:

- it materially improves SillyBunny's UI/product direction
- it materially improves performance or mobile behavior
- it materially improves the Bun-first runtime story
- it supports native agent features that SillyBunny wants to keep integrated

If not, upstream parity should usually win.

## Update Template

Use this section for future stable sync notes.

### Sync Entry Template

```md
## Upstream Sync: SillyTavern <version or branch>

- Date:
- Upstream ref:
- SillyBunny branch/commit:

### Pulled In

- 

### Intentionally Kept Different

- 

### Follow-Up Work

- 

### Validation

- [ ] startup works
- [ ] existing data loads correctly
- [ ] core chat flow still behaves correctly
- [ ] known SillyBunny shell features still work
- [ ] mobile behavior checked
```

## Notes For Maintainers

- Keep this file short and current.
- Record intentional divergence decisions here instead of burying them in commit history.
- When README wording changes, keep this file as the source of truth for the long-term parity direction.
