# Handoff to Dev

This is a design/UX prototype, not production code. It's a standalone Angular app (mock services, no backend, no Nx). It cannot be merged into `claims-management` — different architecture entirely. Use it as **reference**, not as a source branch.

Send this file + a link/zip of this repo. That's the whole handoff — nothing else to prepare.

## 1. Copy this markup directly (pure NDBX, no mock-service logic tied to it)

These render with `@allianz/ng-aquila` only. Same component library version family as prod (see version-diff note below) — copy the `.html`/`.scss` as-is, wire up your own data/state:

- `src/app/shared/components/wizard-footer/` — step footer (Back/Next/Cancel) used across every wizard
- `src/app/shared/components/toast/toast-stack.component.ts` — toast/snackbar stack
- `src/app/shared/components/status-chip/` — status pill/badge
- `src/app/shared/components/empty-state/` — empty-state placeholder
- `src/app/shared/components/confirm-dialog/` — confirm modal shell
- `src/app/shared/components/tour/` — guided-tour step renderer
- `src/app/shared/components/priority-dot/` — priority indicator dot
- `src/app/shared/components/page-header/`, `page-shell/` — page chrome layout

NDBX version here: `@allianz/ng-aquila@21.8.0` / prod: `^21.10.0`. Checked: all API diffs between these are additive (no breaking renames/removals) — confirmed via `.d.ts` diff across message/formfield/dropdown/button/icon/modal/spinner/switcher/checkbox/table/context-menu/popover/tooltip/datefield/input. Safe to copy markup as-is.

## 2. Use as a spec, rewrite the logic (don't copy code — the flow/rules are the point)

- **FNOL wizard** (`src/app/features/fnol/steps/`) — step order, per-step validation rules, and the "skeleton claim vs standard claim" branching (`fnol-state.service.ts`) are the real spec here. Rebuild against your NgRx SignalStore.
- **Sections / entities / damages** (`src/app/features/sections/`) — blocker-card pattern for closure gating (must-resolve-before-close checklist), CBI (contingent business interruption) branching logic in `add-section-entity-modal`.
- **Claim closure/reopen modals** — 3-step flow (blockers → system checklist → reason) is the intended UX; copy the _sequence_, not the component.

## 3. Bugs found + fixed here during a full self-audit — check before you re-derive this logic

- **Claim-ID write-after-create ordering**: if you generate a claim ID and immediately write extra fields (restriction, recovery potential, incident circumstance) onto its "overview" record, you must force-read/cache the overview _before_ patching it, or a "don't write to nonexistent record" guard silently drops the patch. See `step-summary.component.ts` `doSubmit()` — real bug, real fix, applicable to any create-then-patch flow.
- **Sidebar active-group highlighting**: don't hardcode which nav group is "active" by matching one literal path string — match by the group's own key, or it breaks the moment a second nav group exists (`sidebar.ts`).

## Contact

Everything above is verifiable in this repo's own commit history / `CONVERSIONS.md`. If something here turns out stale by the time you read it, trust the code over this doc.
