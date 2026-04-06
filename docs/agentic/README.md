# Agentic Staging Workflow

This folder is the working area for making `staging` the branch where SillyBunny experiments with more autonomous, story-aware behavior.

The reference point is Aventuras:

- richer durable memory
- autonomous lore maintenance
- structured world tracking
- stronger per-turn orchestration

SillyBunny already has a useful baseline in [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js): retrieval, memory, and lorebook services tied into the generation loop. The goal here is to evolve that foundation instead of replacing it blindly.

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
