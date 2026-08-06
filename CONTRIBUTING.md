# Contributing

## Prerequisites — Allianz Nexus registry access

`npm install` will fail without this. This project depends on `@allianz/ng-aquila` and `@allianz/ngx-brand-kit`, which are internal Allianz packages published only to Allianz's private Nexus registry — they do not exist on the public npmjs.org registry, and no public mirror exists.

- **`.npmrc` is intentionally not tracked in git** (see `.gitignore`) — it points at an internal Allianz hostname, and while it holds no credentials itself, registry URLs for internal infrastructure shouldn't be committed to a repo that may end up outside Allianz's network (e.g. a public fork, a screenshot, a copy-pasted issue).

**Steps for a new contributor:**
1. Request access to the Allianz Nexus npm registry through the standard Allianz internal-tooling access process (ask your onboarding buddy or team lead which process applies to you — this varies by team/region and isn't something this repo can document generically).
2. Once you have registry access, copy the template and fill in the real host:
   ```bash
   cp .npmrc.example .npmrc
   ```
   Then edit `.npmrc` and replace `<nexus-host>` with the actual registry hostname you were given.
3. Run `npm install`.

**What failure looks like without access** (so you can self-diagnose):
- `npm install` failing with `404 Not Found` on `@allianz/ng-aquila` or `@allianz/ngx-brand-kit` → your `.npmrc` is missing, or still has the placeholder host from `.npmrc.example`.
- `npm install` failing with `401 Unauthorized` / `403 Forbidden` → `.npmrc` points at the right host, but your account doesn't have registry access yet (or a VPN/network connection to Allianz's internal network is required and isn't active).
- `npm install` succeeding but pulling from `registry.npmjs.org` for these two packages → check you don't have a global `~/.npmrc` overriding the project-local one; the internal packages aren't published there at all, so this will always 404 regardless of credentials.

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

**Note on this smoke test:** it ran on a machine already configured with Nexus registry access via a local `.npmrc`. A contributor without that access cannot `npm install` at all — see "Prerequisites" at the top of this file.
