# 005: Agentic Turn UX

## Title

Adventure Assist recaps and next-action helpers in Agent Mode.

## Goal

Make SillyBunny's agentic state feel usable from the chat UI by surfacing a compact turn recap and suggested next actions after each turn.

## Inspiration

Aventuras-style systems feel more guided when the user can see what the system thinks changed and can act on the next step without digging through hidden metadata.

## Files touched

- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js)
- [public/index.html](/run/media/platinum/HDD/SillyBunny/public/index.html)
- [public/css/sillybunny-tabs.css](/run/media/platinum/HDD/SillyBunny/public/css/sillybunny-tabs.css)

## Hypothesis

If SillyBunny turns memory, story state, and lore activity into a readable recap with one-click next actions, the app will feel more like a guided story system and less like background automation.

## User-visible change

- Agent Mode now shows an Adventure Assist section with a turn recap.
- Suggested next actions can be clicked to drop directly into the chat input.
- The turn-helper section can be disabled per chat.

## Prompt / orchestration impact

- Does not add a new service.
- Reuses memory, story-state, and lore outputs after post-generation runs.
- Adds lightweight heuristics for suggested next actions.

## Data impact

- Extends chat-scoped agent metadata with `turn_ux`.
- Stores recap sections and suggestions per chat.
- Does not change lorebook schemas.

## Validation

- Enable Agent Mode and send a few turns in one chat.
- Confirm Adventure Assist fills in after post-generation runs.
- Click a suggested next action and confirm it appears in the chat input.
- Disable turn helpers and confirm the recap/suggestions stop surfacing for that chat.

## Rollback plan

If the turn-helper layer feels noisy, remove or hide the Adventure Assist panel while keeping the underlying memory, story-state, and lore improvements intact.
