/**
 * audit-modal-padding.mjs
 *
 * Canonical shape: src/app/shared/styles/_modal-layout.scss's mixin (decided
 * 2026-08-21, see .claude/BLESSED.md "Mandatory modal SCSS pattern" — the
 * mixin won over this repo's own older hand-copied-CSS pattern because it
 * was already the majority pattern, and a shared mixin can't drift the way
 * 8 independently hand-copied files did). Every modal opened via
 * `dialogSvc.open()` must use it — `:host { @include modal.shell; }`,
 * header/body/footer via `@include modal.header/.body/.footer`. This
 * replaces the 2026-08-14 rule ("no nonzero horizontal padding in a
 * header/body/footer selector") with something stronger: "uses the one
 * source of truth," which makes the old rule's violations impossible by
 * construction instead of catchable after the fact.
 *
 * v2 (2026-08-21) closes gaps a full-app audit found in v1:
 *   1. v1 never looked at SCSS @include — every mixin-based modal (57% of
 *      them) passed by accident, not because anyone checked its resolved
 *      CSS. v2's pass condition is now "uses the mixin" directly — no CSS
 *      expansion needed, since the mixin IS the single source.
 *   2. v1's suffix regex required a literal hyphen (-header/-body/...) —
 *      BEM `__header` etc. was invisible. v2 matches both.
 *   3. v1 only matched the `padding:` shorthand — `padding-left:`/
 *      `padding-right:` written as discrete properties were invisible. v2
 *      checks all four discrete properties too.
 *   4. v1 never checked :host's max-height/overflow pairing (BLESSED.md
 *      marks it REQUIRED) — 71% of modals were silently missing it. v2
 *      requires either `@include modal.shell` or an explicit
 *      max-height+overflow pair on :host.
 *   5. v1 silently skipped any *.component.ts with no matching .scss file
 *      (`existsSync` check, `continue`) — a modal with genuinely no
 *      stylesheet (inline `styles: [...]`, or nothing at all) was never
 *      checked at all. v2 treats "no .scss AND no inline styles" as a
 *      violation, and DOES check inline `styles: [...]` arrays.
 *   6. Sanctioned exceptions (deliberate variants, not copy-paste drift)
 *      are named explicitly below, not silently missed by naming luck.
 *
 * Scope: any *.component.ts containing NX_MODAL_DATA or NxModalRef — i.e.
 * actually opened as modal content via NxDialogService.open().
 *
 * Exit 0 = no violations. Exit 1 = at least one violation found.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = resolve(__dir, '..');
const srcDir = resolve(root, 'src/app');

// Sanctioned variants that intentionally do not use the shared mixin —
// documented in DESIGN_PRINCIPLES.md's "Component Variant Contracts" §Modal.
// Adding a file here must come with a doc entry there, not just a comment.
const EXEMPT = new Set([
  'mass-event-edit-modal.component.ts', // bottom-sheet variant, own panelClass
]);

function walk(dir, suffix, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, suffix, files);
    else if (entry.endsWith(suffix)) files.push(full);
  }
  return files;
}

const modalTsFiles = walk(srcDir, '.component.ts').filter(f => {
  const src = readFileSync(f, 'utf8');
  return src.includes('NX_MODAL_DATA') || src.includes('NxModalRef');
});

// Matches a flat class rule ending in -header/-body/-footer/-content/-actions
// OR the BEM equivalent __header/__body/__footer/__content/__actions.
const SECTION_RULE = /\.[a-zA-Z0-9_-]+(?:[-_]{1,2})(?:header|body|footer|content|actions)\b[^{}]*\{([^}]*)\}/g;

// Nested sub-widgets (a card/row/item/panel/table INSIDE a modal body) can
// legitimately end in "...header"/"...footer" too (e.g. a bordered card
// with its own internal title bar) — their padding is unrelated to
// NxModalContainer's 40px inset entirely, so they're not a violation target.
// A false positive here (.ccm-blocker-card__header, .scm-blocker-card__header)
// surfaced immediately when BEM matching was added — this excludes that
// whole class of nested-widget name, not just those two files.
const NESTED_WIDGET_MARKER = /-(?:card|item|row|panel|table|list|tile|chip)(?=[-_])/;
const SHORTHAND_PADDING = /\bpadding\s*:\s*([^;]+);/g;
const DISCRETE_PADDING  = /\bpadding-(left|right)\s*:\s*([^;]+);/g;
const USES_MIXIN = /@include\s+modal\.(shell|header|body|footer)\b/;
const HOST_BLOCK = /:host\s*\{([^}]*)\}/;

function isZeroToken(tok) {
  return /^0(\.0+)?(px|em|rem|%)?$/.test(tok.trim());
}

// Resolves the left/right components of a 1-4 value padding shorthand and
// reports whether either is nonzero.
function hasNonzeroHorizontal(value) {
  const tokens = value.trim().split(/\s+/);
  let left, right;
  if (tokens.length === 1)      { left = right = tokens[0]; }
  else if (tokens.length === 2) { left = right = tokens[1]; }
  else if (tokens.length === 3) { left = right = tokens[1]; }
  else                          { right = tokens[1]; left = tokens[3]; }
  return !isZeroToken(left) || !isZeroToken(right);
}

// Extracts the CSS this component actually ships, whichever form it's in.
// Returns null if there's genuinely nothing to check (a real violation, not
// a skip condition).
function extractStyles(tsFile) {
  const scssFile = tsFile.replace(/\.component\.ts$/, '.component.scss');
  if (existsSync(scssFile)) {
    return { css: readFileSync(scssFile, 'utf8'), source: relative(root, scssFile) };
  }
  const tsSrc = readFileSync(tsFile, 'utf8');
  const stylesMatch = tsSrc.match(/styles\s*:\s*\[([\s\S]*?)\]\s*[,}]/);
  if (stylesMatch) {
    return { css: stylesMatch[1], source: `${relative(root, tsFile)} (inline styles array)` };
  }
  return null;
}

const violations = [];

for (const tsFile of modalTsFiles) {
  const fileName = tsFile.split('/').pop();
  if (EXEMPT.has(fileName)) continue;

  const extracted = extractStyles(tsFile);
  if (!extracted) {
    violations.push(`${relative(root, tsFile)}: no .component.scss and no inline styles array found — cannot verify modal spacing at all`);
    continue;
  }
  const { css, source } = extracted;

  if (!USES_MIXIN.test(css)) {
    violations.push(`${source}: does not use the shared modal-layout mixin (@include modal.shell/header/body/footer) — hand-rolled modal CSS is exactly how this drifted last time`);
  }

  // :host max-height/overflow pairing — satisfied by the mixin (checked
  // above) or by an explicit pair for a component that has its own reason
  // not to use the mixin but isn't in EXEMPT (still a violation either way,
  // but call out the specific missing piece).
  const hostMatch = css.match(HOST_BLOCK);
  const hostBody = hostMatch?.[1] ?? '';
  const usesShell = /@include\s+modal\.shell\b/.test(css);
  if (!usesShell) {
    const hasMaxHeight = /\bmax-height\s*:/.test(hostBody);
    const hasOverflow  = /\boverflow\s*:/.test(hostBody);
    if (!hasMaxHeight || !hasOverflow) {
      violations.push(`${source}: :host is missing the required max-height + overflow pairing (has max-height: ${hasMaxHeight}, has overflow: ${hasOverflow})`);
    }
  }

  // Raw padding checks — shorthand and discrete — regardless of mixin usage,
  // since a modal could @include the mixin AND then override with a bad
  // local padding declaration afterward (mixin usage alone doesn't prove
  // nothing was appended on top).
  let match;
  SECTION_RULE.lastIndex = 0;
  while ((match = SECTION_RULE.exec(css))) {
    const [fullRule, body] = match;
    const selector = fullRule.slice(0, fullRule.indexOf('{')).trim();
    if (NESTED_WIDGET_MARKER.test(selector)) continue;

    let pm;
    SHORTHAND_PADDING.lastIndex = 0;
    while ((pm = SHORTHAND_PADDING.exec(body))) {
      if (hasNonzeroHorizontal(pm[1])) {
        violations.push(`${source}: "${selector}" declares "padding: ${pm[1].trim()}" — nonzero horizontal value doubles NxModalContainer's 40px inset`);
      }
    }
    let dm;
    DISCRETE_PADDING.lastIndex = 0;
    while ((dm = DISCRETE_PADDING.exec(body))) {
      if (!isZeroToken(dm[2])) {
        violations.push(`${source}: "${selector}" declares "padding-${dm[1]}: ${dm[2].trim()}" — nonzero horizontal value doubles NxModalContainer's 40px inset`);
      }
    }
  }
}

if (violations.length > 0) {
  console.log('[audit:modal-padding] Violations found:');
  for (const v of violations) console.log(`  ${v}`);
  process.exit(1);
}

console.log('[audit:modal-padding] passed — every modal uses the shared modal-layout mixin (or is a documented, sanctioned exception), :host has the required max-height/overflow pairing, and no section redeclares horizontal padding.');
process.exit(0);
