# Contributing

## Setup

```bash
npm install
npm start          # http://localhost:4200
```

Read `CLAUDE.md` first, then `PROJECT.md` if you're touching tickets, the dev banner, mock state, or scenario stages — both are tracked in git and present on any fresh clone.

## Before opening a PR

```bash
npm run build
npm run pre-commit
```

`pre-commit` runs all 13 audit checks unconditionally via `scripts/run-audits.mjs` and prints a pass/fail summary for every one, then exits non-zero if any failed. It currently fails on a clean checkout of `main` — the repo has pre-existing violations (see `.claude/POST_BUILD.md` § baseline violations, and the counts below). Compare your branch's violation counts against `main`'s; a PR should not *increase* any of them, even though it can't yet start from zero.

**Current baseline (2026-08-06), all 13 checks now visible in one run:**

| Check | Result |
|---|---|
| `audit:colors` | ❌ 17 violations |
| `audit:radio-size` | ✅ pass |
| `audit:formfield-error` | ❌ 2 violations |
| `audit:imports` | ✅ pass |
| `audit:any` | ✅ pass |
| `audit:subscribe` | ❌ 14 violations |
| `audit:hardcoded-data` | ✅ pass |
| `audit:ac-logic` | ❌ 9 of 53 ACs fail (stale `closedSections` fixture) |
| `audit:ac-route-overrides` | ✅ pass |
| `audit:stage-pattern` | ✅ pass |
| `audit:appearance` | ✅ pass |
| `audit:ndbx-wrapper` | ❌ 6 violations |
| `audit:wizard-footer` | ✅ pass |

8/13 pass. Before this fix, `pre-commit` chained checks with `&&`, so a single early failure (`audit:colors`) silently skipped every check after it — `audit:subscribe` (14), `audit:formfield-error` (2), and `audit:ndbx-wrapper` (6) were invisible until now. None of these are new; they were always present, just unreported.

## Fresh-clone smoke test

Verified 2026-08-06 by cloning a snapshot of the tracked tree into an empty directory and running the sequence above with no local artifacts carried over (no `.claude/settings.local.json`, no `.claude/projects/`, no `.npmrc`).

| Step | Result |
|---|---|
| `npm install` | ✅ Pass (527 packages) |
| `npm run build` | ✅ Pass (0 errors; pre-existing dayjs CJS/ESM warnings only) |
| `npm run pre-commit` → `audit:colors` | ❌ Fails — 17 pre-existing hex/rgb violations (expected; see baseline) |
| `npm run audit:ac-logic` | ❌ 9 pre-existing AC failures (stale `closedSections` fixture), 40 pass, 4 skip |
| `npm run audit:ac-route-overrides` | ✅ Pass |
| `npm run audit:stage-pattern` | ✅ Pass |

**What used to break, and doesn't anymore:** `scripts/audit-ac-logic.mjs`, `scripts/audit-ac-route-overrides.mjs`, `scripts/audit-stage-pattern.mjs`, and the entire `.claude/` doc set (`BLESSED.md`, `CONTEXT.md`, `PRE_BUILD.md`, `POST_BUILD.md`, `RUNTIME_OVERRIDES.md`, `SPACING.md`, `MODAL_WIDTH.md`) plus `CLAUDE.md` itself were gitignored — a genuinely fresh clone had none of them, and `npm run pre-commit` crashed immediately with `Error: Cannot find module 'scripts/audit-ac-logic.mjs'`. All of the above are now tracked in git.

**What's still local-only, by design:** `.claude/settings.local.json` (per-developer permission settings) and `.claude/projects/` (Claude Code's own session memory, which bakes in an absolute local file path) stay gitignored — they aren't shared project knowledge, they're personal tool state. `.npmrc` (internal Allianz Nexus registry URL) also stays gitignored; a new contributor needs Allianz network access to get one, not one from this repo.

**Known gap this smoke test surfaced, not yet fixed:** the fresh clone's `npm install` succeeded here only because it ran on a machine already configured to resolve `@allianz/ng-aquila` / `@allianz/ngx-brand-kit` from the internal Nexus registry (via a local `.npmrc`, which is intentionally not in git). A contributor without that registry access cannot `npm install` at all. This is a real onboarding blocker, but it's a credentials/network problem, not something a `.gitignore` or script fix can solve — flag it explicitly when inviting an external contributor.
