# 004: Safer Lore Autonomy

## Title

Proposal-first lore updates with validation and optional review mode.

## Goal

Make lore mutations easier to trust by separating proposed changes from applied writes and by giving SillyBunny a stronger rule set for deciding when to update existing lore versus create new entries.

## Inspiration

Aventuras-style autonomy feels stronger when the system can change persistent world knowledge without feeling opaque or reckless.

## Files touched

- [public/scripts/agents.js](/run/media/platinum/HDD/SillyBunny/public/scripts/agents.js)
- [public/index.html](/run/media/platinum/HDD/SillyBunny/public/index.html)
- [public/css/sillybunny-tabs.css](/run/media/platinum/HDD/SillyBunny/public/css/sillybunny-tabs.css)

## Hypothesis

If the lore agent queues proposals first, then validates and optionally holds them for review, users will be able to trust lore autonomy more and recover from bad proposals more easily.

## User-visible change

- Agent Mode now exposes lore review mode, pending lore changes, and last applied lore changes.
- Lore runs now report proposed vs applied counts more clearly.
- Review mode can stop lore writes until the user approves them.

## Prompt / orchestration impact

- Replaces direct lore write tools with proposal queue tools.
- Adds deterministic validation that can convert creates into updates when an entry already exists.
- Keeps the current director order intact while making lore writes safer.

## Data impact

- Extends chat-scoped agent metadata with lore review state.
- Stores pending lore proposals per chat until applied or discarded.
- Does not require lorebook schema changes.

## Validation

- Enable Agent Mode and run a turn that should affect lore.
- Confirm the lore run reports proposed vs applied counts.
- Enable review mode and confirm new lore proposals are queued instead of written immediately.
- Apply and discard pending lore changes from the Agent Mode panel and confirm the result matches expectations.

## Rollback plan

If the review flow is too heavy or noisy, remove the pending review layer, keep the create-vs-update validation, and fall back to auto-apply lore changes after validation.
