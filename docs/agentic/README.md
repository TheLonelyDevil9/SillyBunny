# Agentic Staging Workflow

This folder is the working area for making `staging` the branch where SillyBunny experiments with more autonomous, story-aware behavior.

The reference point is Aventuras:

- richer durable memory
- autonomous lore maintenance
- structured world tracking
- stronger per-turn orchestration

SillyBunny already has a useful baseline in [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js): retrieval, memory, and lorebook services tied into the generation loop. The goal here is to evolve that foundation instead of replacing it blindly.

## Recent hotfix note

### 2026-04-10 group chat recovery hotfix

- Repository hotfix refresh for `v1.2.8`; this is not a new feature release.
- Fixed stale group metadata that could point group workflows at a missing chat `.jsonl` after failed creation or rename attempts.
- Existing on-disk group chats are now preferred during recovery, and missing references are repaired instead of trapping the UI in repeated missing-file loops.
- This matters for agentic and metadata-heavy group sessions because chat-scoped state should no longer get stranded behind a broken active group-chat pointer.

### 2026-04-10 UI fixes patch

- Patch refresh for `v1.2.8`; this is not a new feature release.
- Added Reset button next to palette presets, improved slider disabled-state feedback, fixed mobile eye toggle double-tap, persona overflow clip, settings grid centering, macOS top-bar border artifact, and a comprehensive border-radius token migration pass across theme stylesheets.

## Rules for experiments

- Build agentic features on `staging` first.
- Keep each experiment narrow and reversible.
- Prefer one capability jump per change:
  - orchestration
  - memory
  - lore autonomy
  - story state
  - action suggestion / narrative guidance
- Record every experiment with the template in [experiment-template.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/experiment-template.md).
- If an experiment changes prompt behavior, document the before/after user-visible effect.
- If an experiment changes stored chat or lore data, document migration and rollback risk.

## Current SillyBunny baseline

- Pre-generation retrieval injection already exists.
- Post-generation memory updates already exist.
- Post-generation lorebook maintenance already exists.
- Agent state is chat-scoped and stored in metadata.
- Agent profiles can reuse the main chat model or use per-service model settings.

## Near-term target

Phase 1 is not "full Aventuras". It is:

- a clearer orchestrator around the existing services
- stronger durable memory and retrieval quality
- safer lorebook autonomy
- the first structured story-state layer

See:

- [current-state-map.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/current-state-map.md)
- [milestones.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/milestones.md)
- [experiment-template.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/experiment-template.md)
- [experiments/001-director-layer.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/experiments/001-director-layer.md)
- [experiments/002-durable-memory.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/experiments/002-durable-memory.md)
- [experiments/003-structured-story-state.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/experiments/003-structured-story-state.md)
- [experiments/004-safer-lore-autonomy.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/experiments/004-safer-lore-autonomy.md)
- [experiments/005-agentic-turn-ux.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/experiments/005-agentic-turn-ux.md)
- [experiments/006-agent-preset-import.md](/run/media/platinum/HDD/SillyBunny/docs/agentic/experiments/006-agent-preset-import.md)
