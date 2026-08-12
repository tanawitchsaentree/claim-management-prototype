# NDBX (@allianz/ng-aquila) Accessibility Reference

Source: read in full from `node_modules/@allianz/ng-aquila/mcp/static/best-practices.md`,
`node_modules/@allianz/ng-aquila/mcp/static/instruction-context.md`, and all 79 files in
`node_modules/@allianz/ng-aquila/mcp/generated/components/` (version pinned in this repo:
`@allianz/ng-aquila ^21.8.0`). Every component doc shipped with the library was read; components
with no accessibility-relevant API are listed at the bottom so nothing is silently skipped.

This file complements — does not replace — `.claude/CONTEXT.md` § Accessibility (Typography /
Beyond Typography), which covers project-added rules (WCAG font-size floor, mandatory
`aria-label` on icon-only buttons, `LiveAnnouncer` for toasts, etc). This file covers what NDBX
itself already provides per component, and what its docs explicitly warn you to still handle
yourself.

Baseline claim from NDBX itself (`best-practices.md` intro): *"NDBX components are WCAG 2 Level
AA compliant out of the box."* — `.claude/CONTEXT.md:345` already notes correctly that this does
**not** make the application accessible by default; the per-component notes below are exactly
the gaps NDBX's own docs flag as still the consumer's responsibility.

---

## Cross-cutting / global

- **RTL**: all components have built-in right-to-left support, but it requires two things the
  app must do itself: import `BidiModule` from Angular CDK in the root module, and set
  `dir="rtl"` on a parent container (commonly `app.component`). Not automatic just by using the
  components (`rtl.md`).
- **Angular CDK overlay/a11y CSS**: several overlay-based components (Modal, Popover, Dropdown,
  Autocomplete, Tooltip, Info Icon) require `@angular/cdk/overlay-prebuilt.css`; Tooltip
  additionally requires `@angular/cdk/a11y-prebuilt.css`. Missing these breaks positioning *and*
  the focus-trap/keyboard behavior the component relies on for accessibility, not just visuals.
- **Selection Indicators** (`selection.md`) exist specifically as **purely presentational**
  checkbox/radio glyphs for building custom UI — using them means you own all accessibility
  semantics yourself (role, state, label association); NDBX provides zero a11y wiring for these.

---

## Forms & inputs

### Formfield (`formfield.md`)
- `label` input: "the component uses input and label to properly support accessibility" — always
  pass a real label through the formfield, don't rely on placeholder text as a label substitute.
- Cannot be used standalone; only valid paired with a control implementing `NxFormfieldControl`
  (e.g. `nxInput`). Using a bare `<input>` styled to look like it's in a formfield, without the
  actual pairing, forfeits the label/hint/error id-linking NDBX wires up for you.

### Input (`input.md`)
- `nxAriaLabel` input: **required when the input has no connected `<label>`** — i.e. any input
  used outside a formfield needs this set explicitly, or it has no accessible name at all.
- `NxPasswordToggleComponent.ariaLabel`: must describe the *initial* action given current
  visibility state (e.g. if the field starts masked, the label should read "Show password", not
  a generic "Toggle password").

### Autocomplete (`autocomplete.md`)
- No explicit aria props beyond composing with formfield/input's own labelling; option focus and
  active-state (`setActiveStyles`/`setInactiveStyles`) is handled internally via
  `ActiveDescendantKeyManager` — don't override option DOM structure or you'll break this.

### Dropdown (`dropdown.md`)
- `ariaLabelledBy` and `required` (adds `aria-required`) are explicit inputs.
- `setAriaLabel()` note: "Support for aria-label removed in favor of aria-labelledby" — if
  building a dropdown outside a formfield, you must supply `ariaLabelledBy`, plain `aria-label`
  is not honored the same way.
- `ignoreItemTruncation` input exists but the docs explicitly recommend against disabling
  truncation ("we recommend following UX guidelines and always truncating long items").

### Checkbox / Checkbox Group (`checkbox.md`)
- `ariaLabel` / `ariaLabelledBy` on `NxCheckboxComponent` exist for the no-visible-label case, but
  the overview text is explicit: **"It is not intended that you use the checkbox without a
  label."** Treat the aria props as an escape hatch, not the default pattern.
- Group-level `labelSize` defaults to `'small'` — this is the same rule already enforced in this
  project by `audit:radio-size` (`.claude/CONTEXT.md`), confirmed here as an NDBX-documented
  default, not a project-invented convention.

### Radio Button (`radio-button.md`)
- No dedicated aria inputs documented; content of `nx-radio` **is** the button's accessible label
  (no separate label prop) — don't leave radio content empty and rely on an external label,
  there's no `ariaLabel` fallback documented for this component.

### Radio Toggle (`radio-toggle.md`)
- `NxRadioToggleComponent`: `ariaLabel`, `ariaLabelledBy`.
- `NxRadioToggleButtonComponent.ariaLabel`: explicitly described as "for screen reader users" —
  set this whenever the visible toggle content is icon-only or otherwise non-textual.

### Switcher (`switcher.md`)
- `ariaLabel`, `ariaLabelledBy`, `ariaDescribedBy` all present. `name` doubles as the switcher's
  label text per the docs ("Sets the label text of the switcher") — don't assume `name` is purely
  a form-field identifier here as it would be on a native input.

### Circle Toggle (`circle-toggle.md`)
- `NxCircleToggleGroupComponent.name`: "Name that is used for accessibility," required for the
  group's radio-role semantics to be announced correctly.
- `NxCircleToggleComponent.ariaDescribedBy` and `name` (same accessibility purpose) at the
  individual toggle level.
- Overview text: "the toggle circle can be used as standalone (checkbox role) or grouped (radio
  group role)" — the accessible role changes depending on whether you use it standalone or in the
  group wrapper; picking the wrong composition changes what screen readers announce.

### File Uploader (`file-uploader.md`)
- `ariaDescribedBy` on the main component.
- `name` on the component: "Name that is used for accessibility."
- `NxFileUploaderItemStatus.uploadedLabel`: "used by screen readers" for the uploaded-state
  announcement.
- `NxFileUploaderItemDelete.deleteLabel`: "used by screen readers" for the delete button.
  Both of these have no default string documented — omitting them likely means an unlabeled or
  generically-labeled control for AT users.

### Input Mask (`mask.md`)
- No accessibility-specific inputs documented at all. Validation errors surface through the
  standard `ValidationErrors` / formfield-error pipeline, not through anything mask-specific.

### Number Stepper (`number-stepper.md`)
- `ariaDescribedBy`, `label`, `inputAriaLabel`, `incrementAriaLabel`, `decrementAriaLabel` are all
  distinct inputs — the increment/decrement buttons do **not** inherit a sensible default label
  automatically from context; set them explicitly for icon-only +/- buttons.

### Slider (`slider.md`)
- `ariaLabelledBy`: "Use this when you want to reference an external label element instead of
  using the internal label."
- Keyboard support (arrow keys) is built in and documented as a first-class interaction mode
  alongside mouse/touch.

### Phone Input (`phone-input.md`)
- `areaCodeLabel`: doubles as both the visible dropdown heading text **and** the area-code
  field's `aria-label` — changing it changes both simultaneously, there's no way to set them
  independently.
- `lineNumberLabel`: sets the aria-label of the line-number field only (no visible text
  equivalent mentioned).

### Timefield (`timefield.md`)
- `labelAM` / `labelPM`: labels for the AM/PM radio buttons shown when `twelveHourFormat` is
  enabled — no aria-specific override beyond these visible labels.
- No explicit `ariaLabel`/`ariaDescribedBy` props on the main component beyond what
  `NxTimefieldControl`'s formfield-control integration provides implicitly.

### Datefield (`datefield.md`)
- No dedicated aria-label inputs on the datefield/datepicker components documented; relies on
  formfield's label plumbing. `NxCalendarBodyComponent.label`: "The label for the table (e.g.
  'Jan 2017')" — this is the *table's* accessible name inside the popup calendar, distinct from
  the field's own label.

### Code Input (`code-input.md`)
- `getAriaLabel(keyIndex)` method exists internally to label each individual digit box — nothing
  the consumer sets directly, but confirms each digit cell gets its own accessible name rather
  than being one large unlabeled group.

### Licence Plate (`licence-plate.md`)
- No accessibility-specific inputs documented. Validation errors flow through the standard
  `ValidationErrors` pipeline like Input Mask.

### Natural Language Form (`natural-language-form.md`)
- `NxWordComponent.label`: **mandatory for accessibility** per the docs verbatim: "A word doesn't
  have a set place to show labels. In order to be accessible, you have to provide a label with
  this property." This is one of the few places NDBX docs use the word "have to" rather than
  "can" — treat every `<nx-word>` without a `label` as a defect.
- `describedByInput` (`describedBy`): links to the individual field's error message via
  `aria-describedby`; if unset, falls back to the id of the whole error message block (marked
  deprecated fallback behavior).

---

## Buttons, links, actions

### Button (`button.md`)
- No dedicated `ariaLabel` input on `NxButtonComponent`/`NxIconButtonComponent` — for icon-only
  buttons (`NxIconButtonComponent`), the accessible name must come from a plain `aria-label`
  attribute you add yourself; nothing in the documented API auto-generates one. This matches
  and confirms the existing project rule at `.claude/CONTEXT.md:355` (aria-label mandatory for
  icon-only controls) — it is not a project invention, it's filling a real NDBX gap.

### Link (`link.md`)
- Disabled links: **must** get `aria-disabled="true"` and either omit `href` or set
  `tabindex="-1"` (with `routerLink`, pass `null` to suppress the rendered `href`). NDBX does not
  do this automatically for a link you've merely styled as disabled — this is manual wiring the
  docs explicitly require.

### Action (`action.md`)
- No dedicated aria inputs on `NxActionComponent` itself. The generated example in the docs wires
  `[attr.aria-label]` manually per action item and wraps the group in `<nav aria-label="menu">`
  — treat that nav-wrapping-with-label as the expected pattern, not optional decoration.

### Signal Button (`signal-button.md`)
- `aria-label` / `aria-labelledby` are direct inputs (unusual naming vs. camelCase elsewhere in
  the library — these are literally named with the hyphen, confirm this matches your template
  binding syntax).

### Avatar (`avatar.md`)
- No accessibility-specific inputs documented on either `NxAvatarComponent` or
  `NxAvatarButtonDirective`. If used as a clickable button, you'd need to supply your own
  `aria-label` since nothing here does it for you.

### Menu (`menu.md`)
- No accessibility-specific inputs beyond structural roles implied by directive names
  (`nxMenuItem`, `nxMenuLink`). No documented aria props to set explicitly.

### Sidebar / Side Navigation (`sidebar.md`)
- `resizeHandleAriaLabel`: "sets the accessibility label for the resize handle" — required if
  `resizeable` is enabled, otherwise the resize handle is an unlabeled interactive element.
- Depends on `NxActionModule` (imported separately) for the actual list item styling/semantics
  used inside the sidebar.

---

## Overlays: modal, popover, tooltip, context menu

### Modal (`modal.md`)
- `closeButtonLabel`: sets the built-in close icon's `aria-label`, defaults to `'Close dialog'`
  — override this with something more specific (e.g. "Close claim edit dialog") when multiple
  modal types exist in the app, per general a11y guidance on ambiguous close-button labels,
  though the docs themselves only state the default and don't mandate overriding it.
- `NxModalCloseDirective.ariaLabel`: "Screenreader label for the button," default empty string —
  **any custom close/cancel button using this directive starts with no accessible name at all**
  unless you set it. This is a real gap, not just a low-priority default.
- Depends on Angular's animations module and CDK overlay CSS; the docs flag the animations
  module as something you must explicitly import if not already present.

### Popover (`popover.md`)
- `nxPopoverCloseable`: "By default a close icon is only shown for trigger type click. Can't be
  used for trigger type hover." — a `hover`-triggered popover cannot offer a persistent close
  affordance for AT users who can't easily "hover away"; keep hover-triggered popovers to
  supplementary, non-critical content only.
- `nxPopoverModal`: opens the popover in a modal state (implying focus trap) — use this when
  popover content is essential/interactive rather than a passing hint.
- No explicit `aria-label`/`aria-labelledby` input documented on `NxPopoverComponent` itself;
  accessible naming is presumably inherited from the trigger element instead.

### Info Icon (`info-icon.md`)
- `buttonAriaLabel` defaults to `'Information'` — generic; if a page has more than one info icon,
  override this per-instance (e.g. "OE field information") so screen reader users can
  distinguish them, similar reasoning to the modal close-button default above.
- `popoverModal`: same focus-trap consideration as the base Popover component.

### Tooltip (`tooltip.md`)
- `nxTooltipSelectable`: "Allow selection of text within tooltip trigger. NOTE: inputs and
  textareas always remain selectable, ignoring this input" — don't assume this input controls
  text-selectability for form-control triggers, it's a no-op there.
- Explicitly requires **both** `overlay-prebuilt.css` **and** `a11y-prebuilt.css` from Angular
  CDK — the only component in this scan that documents needing the a11y CSS file specifically,
  implying its focus-management depends on it more directly than other overlay components.

### Context Menu (`context-menu.md`)
- `NxContextMenuItemComponent` docstring: "exists mostly to set the role attribute, disabled
  state and styling" — confirms role semantics are handled internally; don't add your own `role`
  attribute on top of this directive.
- `resetActiveItem()` method: explicitly exists so keyboard users restart from the first option
  when reopening the menu via arrow-down, rather than resuming a stale active index.

### Notification Panel (`notification-panel.md`)
- No dedicated aria-label inputs documented on the panel or its trigger directive. Item-level
  `read`/`clickable` booleans exist but aren't described as driving any aria-state (e.g. no
  mention of `aria-current` or similar for "read" status) — if unread/read state needs to be
  perceivable non-visually, that wiring is on you.

### Overlay service (`overlay.md`)
- `restoreFocus()` method on the internal container: confirms NDBX overlays restore focus to the
  triggering element on close automatically — don't add redundant manual focus-restoration logic
  around components built on this service (Modal, Popover, etc. all use it).

---

## Data display: tables, lists, trees, steppers

### Table (`table.md`)
- Built on native `<table>` intentionally: "This setup maintains the capabilities of the native
  table such as accessibility and native HTML markups within cells" — don't replace `<td>`/`<th>`
  with generic `<div>`s styled to look like cells, you'd lose this for free.
- UX guidance (not strictly a11y, but related): wrap tables in a horizontal scroll container if
  not fully responsive.
- No table-level `aria-label`/`caption` input is documented — if the table needs an accessible
  name beyond a visible heading, that's on the consumer to add (e.g. a `<caption>` or
  `aria-labelledby` pointing at a heading), same gap noted for Dynamic Table below.

### Dynamic Table (`dynamic-table.md`)
- Built on Angular CDK's `cdk-table`, described as producing "an accessible DOM structure" by
  virtue of that CDK base — but same caveat as Table above: only string/numeric cell content is
  supported ("using markup, images or other components in dynamic tables is not currently
  possible"), which also means no icon-only action cells with independent aria-labels inside
  this component; keep those interactions outside it if row actions need distinct accessible
  names.

### Comparison Table (`comparison-table.md`)
- No accessibility-specific inputs documented anywhere in this fairly large component family
  (headers, footers, expandable groups, select buttons). `NxComparisonTableSelectButton`'s
  `selectedLabel`/`unselectedLabel` are visible text, not aria props, though they likely double
  as the button's accessible name by virtue of being its text content.

### Tree (`tree.md`)
- The most heavily a11y-instrumented component in the whole scan. Internal methods explicitly
  dedicated to accessibility: `insertToA11yNodeTracking`, `removeFromA11yNodeTracking`,
  `moveInA11yNodeTracking`, plus full keyboard navigation methods (`focusFirstVisibleNode`,
  `focusLastVisibleNode`, `focusPreviousVisibleNode`, `focusNextVisibleNode`,
  `collapseCurrentFocusedNode`, `expandCurrentFocusedNode`). One method docstring carries an
  explicit warning: `renderNodeChanges` — *"⚠️ Here we override the method from cdk tree ⚠️ Adds
  some extra method calls to update the a11y node tracking."* If ever subclassing or patching
  tree internals, this is flagged as a deliberately-overridden CDK method specifically to keep
  a11y tracking correct — do not "simplify" it back to the CDK default.
- `NxTreeNodeActionItem`: "Handles focussing of the tree action item and adds the necessary
  attributes for a11y" — action items inside tree nodes get their focus/attribute handling for
  free through this directive; don't re-implement focus handling on a custom action element
  inside a tree node.

### Progress Stepper / Wizard (`progress-stepper.md`)
- `progressbarAriaLabel` (defaults to `'Progress'`) and `progressbarAriaLabeledBy` exist on both
  `NxProgressStepperComponent` and `NxSingleStepperComponent` — override the default label when a
  page has more than one stepper/progress bar so they're distinguishable by AT.
- `currentStepLabel` on the base directive is specifically "used for mobile viewports" — a
  responsive-specific accessible-name concern, not just a visual label.

### Progress Bar (`progressbar.md`)
- `ariaLabel` (defaults `'Progress'`), `ariaLabelledBy`, and importantly `value`/`min`/`max` are
  explicitly documented as "mirrored to `aria-valuenow"`/`aria-valuemin`/`aria-valuemax`
  respectively — confirms the progress semantics are live and correct as long as you bind these
  inputs; don't separately hand-roll `aria-valuenow` bindings on top, they'd conflict.

### Spinner (`spinner.md`)
- `ariaPoliteness` (default `'assertive'`): controls the live-region politeness of the spinner
  itself.
- `activationAnnouncement` / `completionAnnouncement`: screen-reader-only messages fired on
  spinner mount/destroy respectively — explicit instruction: **"Do not combine with an
  `aria-live` area"** if you set these, since the component already manages its own live region.
  Wrapping a spinner using these props in an additional external `aria-live` wrapper would cause
  duplicate or conflicting announcements.

### Pagination (`pagination.md`)
- `ariaLabel`: "Sets the aria label on the nav element... Use this to override the global
  aria-label from PaginationTexts" — implies there's a global default text source
  (`PaginationTexts`) consumed automatically if you don't override it per-instance.

### Page Search (`page-search.md`)
- Explicit multi-instance guidance: "If you use more than one page-search or elements with
  `role=\"search\"` per page, each one should have a unique aria-label." No `ariaLabel` input is
  listed in this component's own API table, so achieving this uniqueness likely means adding a
  plain `aria-label` attribute directly to the host element rather than through a dedicated
  component input — verify against the live component if this pattern is ever used twice on one
  page in this app.

### Rating (`rating.md`)
- `ariaLabel` (typed as `string[]`, i.e. per-star labels), `ariaRatingLabels`, and
  `ariaRatingGroupLabel` — three distinct rating-specific aria props, more granular than most
  other components in this scan (individual star labels, a full override array, and a group-level
  label all separately settable).

### Taglist (`taglist.md`)
- `aria-labelledby` input (again hyphenated, not camelCase) — "Sets the label property to improve
  accessibility."
- `NxTagComponent.deleteAriaLabel`: lets you set the remove button's aria-label explicitly rather
  than relying on the shared `NxTagIntl` class default — relevant if a specific tag's delete
  action needs a more descriptive label than the app-wide default (e.g. "Remove damage type:
  Fire" instead of a generic "Remove").
- Component-level framing: "Tags are not meant to be used as purely informational, non-interactive
  element. For this use case, please use the badge component" — an explicit semantic/role
  distinction between Tag (interactive) and Badge (informational); using Tag for a
  non-removable, non-clickable status pill is documented as the wrong component choice, not just
  a style preference.

### Tabs (`tabs.md`)
- `autoselect`: "Whether the tab should be immediately selected on focus" — this is the
  documented choice between the two standard tab-keyboard-interaction patterns (activate-on-focus
  vs. activate-on-select-with-Enter/Space); which one is active changes expected keyboard
  behavior for AT users navigating via arrow keys, so treat this as an accessibility-relevant
  setting, not purely a UX nicety.
- `focusChange` output: explicitly noted as **"not supported in mobile view."**
- `NxTabHeaderComponent.handleKeydown` docstring spells out the exact behavior split: "If
  autoselect is enabled the tab gets changed immediately. If autoselect is disabled only the
  focus changes but the user still has to select the item by himself" — confirms arrow-key
  navigation always moves focus, but only *activates* content immediately when `autoselect` is
  on.

---

## Feedback: messages, notifications

### Message / Notification banners (`message.md`)
- `closeButtonLabel` on `NxMessageComponent`: label for the dismiss icon — no documented default
  string, unlike Modal's `'Close dialog'` default; confirm this repo sets one explicitly wherever
  `closable` is true, or the dismiss control may end up unlabeled.
- Directly relevant to an existing project trap already documented at
  `.claude/CONTEXT.md:372`: toast banners are visible in the DOM to VoiceOver but not reliably to
  NVDA/JAWS without pairing with Angular CDK's `LiveAnnouncer` — that project-level rule is not
  contradicted by anything in the NDBX docs (the NDBX message component itself doesn't claim to
  solve cross-screen-reader live-region announcement on its own).

---

## Components with no accessibility-specific API documented

Read and confirmed empty of accessibility-relevant inputs/methods/notes (no `aria-*`, no
"accessib"/"a11y", no "screen reader", no "keyboard", and no `noApi: true` general/conceptual
pages already excluded above). Listed here explicitly so it's clear these were checked, not
skipped:

`ag-grid` (third-party integration doc, defers to AG Grid's own theming/a11y), `badge`, `base`
(label/error base — no doc body beyond frontmatter), `breadcrumb` (structural only — last item
non-interactivity is the one accessibility-adjacent rule, already captured under a11y-general
patterns, not an explicit prop), `card`, `copytext`, `data-display`, `divider`, `eyebrow`,
`grid`/layout system, `footer` (role="list"/"listitem" applied automatically by the directives,
no explicit consumer-facing aria prop), `headline`, `image`, `icon`, `indicator`, `list`, `price`,
`rtl` (covered separately above under Cross-cutting), `selection` (flagged above as
presentational-only, i.e. *zero* built-in a11y by design), `small-stage`, `text`, `tile`,
`toolbar`, `virtual-scroll`, `web-components` (general note page, no API), `theming` (general
note page, no API), `error-handling` (general note page, no API), `patterns` (meta/showcase page,
no API), `licence-plate` (already covered above under Forms, listed here too since it has no
dedicated a11y prop despite being a form component).

For all of the above: **absence of a documented aria input does not mean "no accessibility
concerns"** — most inherit correctness from being built on semantic native elements (native
`<button>`, `<table>`, list roles, etc., per `best-practices.md`'s button-directive rationale:
*"We attach buttons through a directive so that we can rely on the native abilities of a real
`<button>` tag"*). Treat this list as "nothing extra to wire up," not "nothing to think about."
