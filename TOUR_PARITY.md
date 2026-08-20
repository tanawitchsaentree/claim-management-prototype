# TOUR_PARITY.md — Reviewer launcher + tour vs. full dev banner

Written per the tour-system audit's stage 6 (2026-08-20). Answers, for
every ticket in `public/tickets/`: can `devBannerMode: 'reviewer'` reach
the same `done` ACs the full banner reaches, and does an authored tour
exist yet?

## Why there are zero state-reachability blockers

Stage 3 split the banner into reviewer-facing vs. dev-only **presentation
only** — `ClaimDevDetailsModalComponent.onApply()` / `onGoTo()` and
`ClaimDevHelperService.applyAC()` / `runPostLandFor()` were not touched.
What got hidden in `'reviewer'` mode is: the Reset button, the
reference-view variant picker (both `claim-dev-banner.component.html`),
and the raw state inspector (`claim-dev-details-modal.component.html`).
None of the three participates in reaching or verifying a scenario's
state — Reset is a manual convenience wrapping the same `resetAsync()`
that already runs automatically at the start of every `applyAC()`; the
variant picker is an unrelated reference-view UI experiment; the state
inspector is read-only debugging text.

Consequence: **every ticket's `done` ACs are reachable via the reviewer
launcher exactly as they were via the full banner.** This was verified,
not assumed — `npm run audit:ac-logic` (49/49, unchanged) and the full
`pre-commit` suite pass identically after the stage 3 split.

## Tour coverage vs. state reachability — these are different questions

A missing tour is **not** a reachability blocker. Per Goal A, a tour is
explicitly non-mandatory narration on top of a state the reviewer launcher
already reaches on its own (Apply button, unchanged). The table below
separates the two: "Reachable" is always yes (verified above); "Tour"
tracks how many tickets have a guided walkthrough authored yet — 1 of 13,
by design (stage 6 asked for "at least one complete tour," not full
coverage). The remaining 12 are a backlog item, not a regression.

## Per-ticket table

| Ticket | done ACs | Reachable via reviewer launcher | Tour authored |
|---|---|---|---|
| BMPCC-11006 | 1 | Yes — `fnolStateOverride.convertFromSkeletonId` unchanged | No |
| BMPCC-11360 | 7 | Yes | No |
| BMPCC-14434 | 5 | Yes | No |
| BMPCC-14435 | 3 | Yes | No |
| BMPCC-14437 | 2 | Yes | No |
| BMPCC-216 | 6 | Yes — `claimsAppend` unchanged | No |
| BMPCC-219 | 5 | Yes — `cwbLocationsAppend` unchanged | No |
| BMPCC-241 | 6 | Yes — `fnolStateOverride.path` unchanged | No |
| CHAMP-NO-LOSS-LOC | 1 | Yes | No |
| CHAMP-PRECLOSURE-CHECKLIST | 3 | Yes | No |
| CHAMP-CLOSE-SECTION | 5 | Yes | No |
| CHAMP-CLOSURE-001 (`closure.json`) | 7 | Yes | No |
| **CHAMP-READY-CLOSE** (`ready-to-close.json`) | 2 | Yes | **Yes** — 2 steps: Tasks widget (`co-tasks-widget`), Close Claim button (`co-close-claim-button`) |

The four tickets the original audit specifically flagged as
"unreachable-without-banner" — `ready-to-close.json`, `bmpcc-216.json`,
`bmpcc-219.json`, `bmpcc-11006.json` — are called out above with their
override mechanism named explicitly: all four still resolve through the
unchanged `applyAC()`/`loadStatePreset()` pipeline in reviewer mode.

## Blockers

**None.** Stage 7 (flip `environment.prod.ts` to `devBannerMode: 'reviewer'`)
may proceed.

## Backlog (not a blocker, not silently worked around — recorded)

Only CHAMP-READY-CLOSE has an authored tour. The other 12 tickets have no
`data-tour-id` hooks and no structured `walkthroughSteps` entries yet —
reviewers can still reach every scenario via the reviewer launcher's
ticket picker + Apply, they just don't get guided narration for those 12
until tours are authored for them (extend `walkthroughSteps` per ticket,
following the pattern in `ready-to-close.json` and
`claim-overview.component.html`'s two `data-tour-id` attributes).
