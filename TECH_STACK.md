# Technical Approach — Claim Management Prototype

*A working, deployable prototype of the Allianz Commercial Claims journeys —
built so CS, BA and FE can open it, click it, and review together. Not a mockup.*

---

## 1. Why these technologies

Every choice was made to **match the real production stack**, so the prototype
hands off to engineering with zero translation — and so reviews happen on a
real, clickable thing instead of a static screen.

| Choice | Why |
|---|---|
| **Angular 21** | The framework the delivery teams actually build with. Prototype = production language. |
| **@allianz/ng-aquila (NDBX) 21.8** | The real Allianz design system. We compose *the same components devs ship*, not look-alikes. |
| **@allianz/ngx-brand-kit 21.8** | Official Allianz tokens + fonts — brand-accurate by construction. |
| **SCSS + CSS custom properties** | NDBX is SCSS-based; Angular defaults to it. SCSS for structure (mixins/nesting), CSS variables for runtime theming. |
| **TypeScript 5.9 (strict)** | Type-safe domain models — the data shapes are contracts, not guesses. |
| **GitHub Pages deploy** | One URL anyone can open. Review live, not "send me the file." |

---

## 2. Scale of what was built (real counts)

- **158** TypeScript files · **68** standalone components · **25** typed domain models
- **51** templates on Angular's modern control flow (`@if` / `@for` / `@else`)
- **29** components using **signals / `computed` / `toSignal`** (reactive state)
- **28** files using **reactive forms** (no `ngModel`)
- **32** distinct NDBX component modules composed (table, modal, popover,
  datefield, dropdown, tabs, progressbar, badge, tooltip, …)
- **26** mock services over **29** JSON datasets — a full fake backend

---

## 3. Architecture & techniques

### Modern Angular (the current way, not legacy)
- **Standalone components** — no NgModules; each component declares its own imports.
- **Signals + `computed()`** for derived state; **`toSignal()`** to bridge RxJS
  streams into signals. Filtered lists, KPI counts, tab state are all reactive.
- **New control flow** (`@if`/`@for`) instead of `*ngIf`/`*ngFor`.
- **ViewModel pattern** — `vm$ | async` + `BehaviorSubject`; no manual
  `.subscribe()` in components (enforced — see audits below).
- **Lazy routing** — `loadComponent` / `loadChildren` so feature areas
  (FNOL wizard, claim shell) load on demand.

### Mock backend (so the prototype behaves like the real thing)
- **Service layer** (`MockBaseService` + 26 services) over JSON datasets, with
  realistic latency and `structuredClone` so state mutates like a real API.
- **Relational mock data** — claims ↔ tasks ↔ approvals ↔ assignees ↔ loss
  events are cross-linked, so every persona sees coherent, connected data.
- **Scenario/state engine** (`scenario-stage.service`, `mock-state.service`) —
  drives ticket-based demo states (open → closed → reopened, blockers, etc.).

### Design system as enforced rules (not vibes)
- **Shared SCSS mixins** — `_modal-layout.scss` gives every dialog the same
  header/body/footer rhythm via `@include modal.shell` (one source of truth).
- **Design-token discipline** — all colour/spacing flows through
  `var(--token)`; **no raw hex in components**.
- **Documented standards** — `SPACING.md` (4px scale, icon colour/opacity
  rules), `MODAL_WIDTH.md` (4-tier width + height strategy). Decisions become
  reusable assets, not knowledge trapped in one head.

### Runtime theming nuance
- `NxExpertModule` injects `expert.css` at runtime and overrides some tokens;
  `styles.scss` re-asserts the correct light-theme values in `:root`. This is
  why CSS custom properties (runtime) matter more than SCSS variables (compile-time).
- App-wide date format set once via `NX_DATE_FORMATS` provider → every
  datefield reads/writes **DD-MM-YYYY** (fixed a US-format default).

### Micro-interactions
- Angular animations (`trigger`/`animate`) for the slide-out panel and
  transitions — 7 components — so the prototype *feels* real, not static.

---

## 4. Quality guardrails (automated)

`package.json` ships **audit scripts** that fail the build on rule violations —
the design system polices itself:

- `audit:colors` — no hardcoded hex / rgb (must use tokens)
- `audit:spacing` — no raw `px` padding/margin (must use the scale)
- `audit:any` — no `: any` (typed models required)
- `audit:subscribe` — no manual `.subscribe()` in components (async pipe only)
- `audit:imports` — no cross-feature imports (extract to shared first)
- `audit:hardcoded-data` — no inline data arrays in feature components

### Visual verification loop
Beyond "it compiles": the app is launched headless via Chrome DevTools
Protocol, driven (click, toggle, navigate), and **screenshotted** — every change
is checked *with eyes* against the user's view, because a green test ≠ a correct
screen.

---

## 5. The point

The technology is deliberately **the real stack, used the modern way**, and
wrapped in **enforced standards + visual verification**. That's what lets a
design decision survive as production-grade code — and what turns the
"change-this-move-that" review loop from a sprint or two into a couple of days.
