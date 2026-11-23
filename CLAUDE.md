# Claim Management — Project Rules

This file is the entry point. Detailed rules live in `.claude/`.

---

## RULE -2: What may be built, and everything built is committed

**Every feature must be committed in the same session it is built. Uncommitted work in the tree is invisible to review and gets swept into unrelated commits by accident.**

What counts as a build trigger:

- A requirement the user hands over in conversation.
- Any `not_started` ticket in this repo's tracker (Supabase `ticket` / `ticket_state`) that has a real UI surface. The user authorised building ahead of Jira assignment on 2026-08-28 and repeated it on 2026-09-02. An open spec question is not a reason to stop: pick the defensible reading, build it, and record the assumption in the pipeline (numbered `ASSUMPTION [X-n]` comments, the CONVERSIONS.md entry, the tracker's `blocked_note`), never as a question back in chat.
- NOT a trigger: raw `.agents/` scrapes (stale since 2026-08-19), tickets outside this prototype's domain (other teams' MFEs, backend or infra only). Report those, don't build them.

History: the 2026-08-20 audit found dozens of uncommitted files across 10+ features built from `.agents/jira-clone/` scrapes, none committed and none visible to review. That is why the commit rule exists and why scrapes are not a trigger.

---

## RULE -1: Read PROJECT.md FIRST (when touching tickets / banner / ACs / mocks / stages)

For any session that proposes changes to:

- `public/tickets/*.json`
- `src/app/features/claims/dev-banner/**`
- `src/app/core/mock/state/mock-state.service.ts` (`ScenarioOverrides`)
- `src/app/core/scenario/**` (ScenarioStage interfaces / runner)
- Any component that implements a Stage interface (`OverviewStage`, `FnolLossInfoStage`, etc.)
- `scripts/audit-*.mjs`
- New mock data referenced by tickets

→ **Read `/PROJECT.md` first.** Single source of truth for ticket schema, mutation entities, buildStatus heuristics, deviation notation, conversion pipeline, and Blessed Patterns (stage registration, reactivity bridge, AC ID collision). Cross-references are file:line accurate.

When done converting a ticket OR fixing a recurring bug, append an entry to `/CONVERSIONS.md`.

If you modify any file in `core/mock/data/`, run `npm run audit:ac-logic` before committing. Ticket JSONs assert against this data and go stale silently — see the CHAMP-CLOSURE-001 `closedSections` incident in `/CONVERSIONS.md` (2026-08-06).

Run `npm run pre-commit` before declaring work done — see `.claude/POST_BUILD.md`.

`PROJECT.md` and `CLAUDE.md` are both tracked and committed — PROJECT.md is still the canonical version of this rule (single source of truth for the ticket schema itself), since it's the file other tools/sessions reading only the committed tree should find first.

---

## RULE 0: /pre-build is MANDATORY

For **any** task involving UI, layout, components, or SCSS — answer the pre-build checklist before writing code.

**Triggers:**

- "fix layout" / "ตำแหน่ง" / "align" / screenshot of broken UI
- "add component" / "เพิ่มปุ่ม" / "สร้าง component"
- "change SCSS" / "เปลี่ยนสี" / "ระยะห่าง"
- Task contains: button, toolbar, modal, table, form, panel, header, footer, grid, flex

**Process:**

1. Run pre-build checklist (`.claude/PRE_BUILD.md`)
2. Output answers — including which blessed file the pattern comes from
3. Wait for "proceed" / "go" / "ได้เลย"
4. THEN write code

**When the wait does NOT apply** (the user has been explicit about these):

- Fixing a bug in work from this session, or a bug found in self-QA: fix it, then report. Asking "want me to fix?" reads as stalling.
- The user already said go for this exact work ("เอาเลย", "ทำให้หมด", a hand-off to a worker session). The hand-off is the approval; record the checklist answers in the commit message instead of waiting.
- Still wait for genuine product or UX decisions the user owns.

**User shortcuts (act immediately, no questions):**

- `/pre-build first` → stop and run the checklist
- `blessed?` → cite exactly which blessed file + line I'm copying from
- `stop, what pattern?` → pause and identify the pattern source

Skipping = token waste. User has explicit permission to interrupt.

---

## RULE 1: Check the build the team opens, not only the dev server

The deployed build is different from `npm start` (production environment, DEV banner off). After every `npm run deploy`, run `npm run verify:live`. Before removing or moving anything that lives in the DEV banner, ask: can the team still do this on the deployed link? (2026-11-23: the dashboard Persona strip was removed because the DEV banner has View as, and the team lost user switching for 10 days.)

---

## Documentation Layout

| File                           | Use when                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/CONTEXT.md`           | Stack, tokens, traps, folder structure, NDBX gotchas, accessibility rules — foundation, read once per session                       |
| `.claude/PRE_BUILD.md`         | Before writing any UI/SCSS code — checklist Q1–Q5, Figma → NDBX mapping, FNOL step workflow, mock data workflow                     |
| `.claude/POST_BUILD.md`        | Before declaring done — audits, browser checks, evidence template, `/verify-data` for mock data                                     |
| `.claude/FORM_RHYTHM.md`       | Before building any section / accordion body / modal body of form fields: the 4-level spacing hierarchy and the mixins that enforce it |
| `.claude/BLESSED.md`           | Reference implementations to copy from — filter bar, modal, FNOL footer, page-with-toolbar, tree rows, etc.                         |
| `.claude/THEMING.md`           | Before any colour/spacing/radius/font-size change, or "X doesn't follow A1" — who owns which token, scales, audit:theme, snapshot proof |
| `.claude/RUNTIME_OVERRIDES.md` | When CSS isn't applying / before writing layout — `[nxLayout]` inline padding trap, NxExpertModule cascade, formfield space reserve |
| `docs/NDBX_RECIPES.md`         | Verified HTML snippets for every NDBX component — copy from here for forms, dropdowns, dates, etc.                                  |

---

## Task Routing

| Task contains…                                                  | Read                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| "build new FNOL step" / "add step to wizard"                    | `PRE_BUILD.md` § FNOL Step + `BLESSED.md` § wizard footer               |
| "add component" / "add dropdown" / "add modal" / any UI element | `PRE_BUILD.md` Q1–Q5 + `docs/NDBX_RECIPES.md`                           |
| "mock data" / "new service" / "JSON data"                       | `PRE_BUILD.md` § Mock Data + `BLESSED.md` § mock service                |
| "verify" / "audit" / "check" / "is this done"                   | `POST_BUILD.md`                                                         |
| "Figma" / "design" / "implement from design"                    | `PRE_BUILD.md` § Implementing from Figma                                |
| "layout broken" / "spacing wrong" / "padding ignored"           | `RUNTIME_OVERRIDES.md` first (DevTools Computed before tweaking values) |
| new section / form block / accordion body                       | `FORM_RHYTHM.md` first, then screenshot every state before "done"       |

---

## Critical Token Traps (full detail in `.claude/CONTEXT.md`)

- **`--text-02` is WHITE** (`#ffffff`) — invisible on white backgrounds. Use `--text-01` or `--text-muted`.
- **`NxExpertModule` overrides `--interactive-primary` and `--text-02` at runtime** — re-asserted in `src/styles/themes/_ndbx.scss`, do not remove.
- **Theme switch (NDBX / A1): never write raw colour, px spacing, px radius or px font-size in a component** — `npm run audit:theme` (in pre-commit) enforces. NDBX pins go in `themes/_ndbx.scss`, project tokens in `src/styles/_tokens.scss`, their A1 mapping in `themes/_a1.scss`. See `.claude/THEMING.md`.
- **`--negative` is WHITE** (inverse text), never red. Red text = `--danger`.
- **`[nxLayout]` writes inline padding on its host** — wrap with outer div before adding `padding-top`. See `RUNTIME_OVERRIDES.md`.
- **`<nx-radio>` MUST have `labelSize="small"`** — `audit:radio-size` enforces.
- **`expert.css` is NOT loaded** — never use `appearance="outline"` on `nx-formfield`.
- **No `--text-muted` token in NDBX** — defined as project token; resolves to `#767676` (= `--ui-05`).

---

## Stack (full detail in `.claude/CONTEXT.md`)

- Angular ^22.2 standalone (no NgModule); components carry `ChangeDetectionStrategy.Eager` from the 22 migration (2026-11-03)
- `@allianz/ng-aquila` ^22.6.0 (NDBX components; production is still on 21.10)
- `@allianz/ngx-brand-kit` ^22.6.0 (tokens + fonts)
- Reactive Forms only (no `ngModel`)

---

## Forbidden (full table in `.claude/CONTEXT.md`)

- `subscribe()` in component class (use `async` pipe)
- `: any` (define interface in `core/models/`)
- Inline templates >30 lines, inline styles
- Cross-feature imports (extract to `shared/` first)
- Native `<select>`, `<input type="date">`, raw `<input>` outside `nx-formfield`
- `nx-formfield appearance="outline"`
- Hardcoded hex/rgb in component scss
- `font-size` below 14px on readable text
- Em dash (—) in any on-screen text, mock data or ticket text (`audit:emdash-copy` enforces; code comments are fine)

---

## File Size Limits

- `.ts` ≤ 300 lines
- `.html` ≤ 200 lines
- `.scss` ≤ 250 lines
- Exceeds → split before adding more code
- Enforced by `audit:file-size` (in pre-commit) as a ratchet: the ~40 files already over on 2026-11-23 are frozen in `scripts/file-size-baseline.json` and may only shrink

---

## Definition of "Working Reference"

A file qualifies as blessed when ALL true:

- ✅ Renders correctly in browser (confirmed by user)
- ✅ DevTools console shows zero errors
- ✅ All interactions work
- ✅ Passes `npm run audit:all`

When user confirms a feature works → ask: "Should I add `[file path]` to `.claude/BLESSED.md`?"

**Working code in this repo beats everything else** — not training data, not NDBX docs, not theories. If it runs without errors in this project, it is the truth.
