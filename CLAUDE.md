# Claim Management — Project Rules

This file is the entry point. Detailed rules live in `.claude/`.

---

## RULE -2: No building from tickets nobody assigned — HARD STOP

**Never implement from a Jira ticket that is unstarted, unassigned, or sourced from `.agents/` scrapes. A ticket description is not a requirement to build. Work begins only from a ticket the user has explicitly handed over in conversation. If you spot relevant work in `.agents/` or elsewhere, report it — do not build it.**

**Every feature must be committed in the same session it is built. Uncommitted work in the tree is invisible to review and gets swept into unrelated commits by accident.**

This is not a judgment call — a "To Do" / "Unassigned" ticket in `.agents/jira-clone/*.json` (or any other scrape) is source material for reporting, never a build trigger, no matter how complete or well-specified its description reads. Before writing any feature code, check: did the user hand me this requirement directly in this conversation? If the only source is a ticket file, a scrape, or your own inference from a Jira export, stop and report what you found instead of building it.

Found via audit 2026-08-20: dozens of uncommitted files across 10+ features (circumstance selection on Sections, reassign-claim modal, attach-document modal, recovery-bookings, make-payment-modal, etc.) traced back to tickets that were still "To Do"/"Unassigned" in `.agents/jira-clone/` scrapes — none of them asked-for by the user, none committed, all invisible to review until this audit.

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

**User shortcuts (act immediately, no questions):**
- `/pre-build first` → stop and run the checklist
- `blessed?` → cite exactly which blessed file + line I'm copying from
- `stop, what pattern?` → pause and identify the pattern source

Skipping = token waste. User has explicit permission to interrupt.

---

## Documentation Layout

| File | Use when |
|------|----------|
| `.claude/CONTEXT.md` | Stack, tokens, traps, folder structure, NDBX gotchas, accessibility rules — foundation, read once per session |
| `.claude/PRE_BUILD.md` | Before writing any UI/SCSS code — checklist Q1–Q5, Figma → NDBX mapping, FNOL step workflow, mock data workflow |
| `.claude/POST_BUILD.md` | Before declaring done — audits, browser checks, evidence template, `/verify-data` for mock data |
| `.claude/BLESSED.md` | Reference implementations to copy from — filter bar, modal, FNOL footer, page-with-toolbar, tree rows, etc. |
| `.claude/RUNTIME_OVERRIDES.md` | When CSS isn't applying / before writing layout — `[nxLayout]` inline padding trap, NxExpertModule cascade, formfield space reserve |
| `docs/NDBX_RECIPES.md` | Verified HTML snippets for every NDBX component — copy from here for forms, dropdowns, dates, etc. |

---

## Task Routing

| Task contains… | Read |
|----------------|------|
| "build new FNOL step" / "add step to wizard" | `PRE_BUILD.md` § FNOL Step + `BLESSED.md` § wizard footer |
| "add component" / "add dropdown" / "add modal" / any UI element | `PRE_BUILD.md` Q1–Q5 + `docs/NDBX_RECIPES.md` |
| "mock data" / "new service" / "JSON data" | `PRE_BUILD.md` § Mock Data + `BLESSED.md` § mock service |
| "verify" / "audit" / "check" / "is this done" | `POST_BUILD.md` |
| "Figma" / "design" / "implement from design" | `PRE_BUILD.md` § Implementing from Figma |
| "layout broken" / "spacing wrong" / "padding ignored" | `RUNTIME_OVERRIDES.md` first (DevTools Computed before tweaking values) |

---

## Critical Token Traps (full detail in `.claude/CONTEXT.md`)

- **`--text-02` is WHITE** (`#ffffff`) — invisible on white backgrounds. Use `--text-01` or `--text-muted`.
- **`NxExpertModule` overrides `--interactive-primary` and `--text-02` at runtime** — re-asserted in `styles.scss :root`, do not remove.
- **`[nxLayout]` writes inline padding on its host** — wrap with outer div before adding `padding-top`. See `RUNTIME_OVERRIDES.md`.
- **`<nx-radio>` MUST have `labelSize="small"`** — `audit:radio-size` enforces.
- **`expert.css` is NOT loaded** — never use `appearance="outline"` on `nx-formfield`.
- **No `--text-muted` token in NDBX** — defined as project token; resolves to `#767676` (= `--ui-05`).

---

## Stack (full detail in `.claude/CONTEXT.md`)

- Angular ^21.2.0 standalone (no NgModule)
- `@allianz/ng-aquila` ^21.8.0 (NDBX components)
- `@allianz/ngx-brand-kit` ^21.8.0 (tokens + fonts)
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

---

## File Size Limits

- `.ts` ≤ 300 lines
- `.html` ≤ 200 lines
- `.scss` ≤ 250 lines
- Exceeds → split before adding more code

---

## Definition of "Working Reference"

A file qualifies as blessed when ALL true:
- ✅ Renders correctly in browser (confirmed by user)
- ✅ DevTools console shows zero errors
- ✅ All interactions work
- ✅ Passes `npm run audit:all`

When user confirms a feature works → ask: "Should I add `[file path]` to `.claude/BLESSED.md`?"

**Working code in this repo beats everything else** — not training data, not NDBX docs, not theories. If it runs without errors in this project, it is the truth.
