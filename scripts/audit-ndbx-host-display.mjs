/**
 * audit-ndbx-host-display.mjs
 *
 * Found 2026-09-18: .rp-prompt (recovery-potential-card) and .brb-banner
 * (blocker-return-banner) both set `display: block` on an <nx-message>
 * element. NDBX's own :host for nx-message is `display: flex;
 * align-items: flex-start` — that's how the icon and the text sit on one
 * row. A project-level `display: block` on the SAME element overrides it,
 * so the icon and text fall back to stacking as separate block children:
 * icon on its own line, text on the next, with dead space between them.
 * Looked fine in isolation ("it's a genuine NDBX component"), broke on
 * render — the bug was never in the CSS class itself, it was in fighting a
 * layout the component already owns.
 *
 * Confirmed live (via node_modules source, not memory) which NDBX tags used
 * in this app actually rely on a flex/inline-flex host for this reason:
 * nx-message (flex), nx-badge (inline-flex), nx-tag/nx-tag-group/nx-taglist
 * (flex), nx-indicator (inline-flex), nx-tile-group (flex). nx-dropdown,
 * nx-tab-group, and nx-context-menu were checked too and are NOT at risk —
 * their own :host is block/inline, so a display override there doesn't
 * fight anything.
 *
 * Rule: never declare `display` in a project CSS class applied directly to
 * one of these tags. Need spacing/margin? Use margin/gap on the class —
 * that composes with the component's own flex layout instead of replacing
 * it. Need a genuinely different layout? Wrap the element in a `<div>` and
 * put the override there, not on the component's own host.
 *
 * Scope: every *.component.html in src/app. Exit 0 = no violations.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const srcDir = resolve(root, 'src/app');

// Confirmed via node_modules/@allianz/ng-aquila source — see header comment.
// Add to this list only after confirming the tag's own :host is flex/grid
// (grep the fesm2022 bundle for `selector: '<tag>'` then check its `styles`
// array for `:host{...display:...}` — don't guess from the bundle filename,
// one file often bundles a dozen unrelated selectors).
const FLEX_HOST_TAGS = ['nx-message', 'nx-badge', 'nx-tag', 'nx-tag-group', 'nx-taglist', 'nx-indicator', 'nx-tile-group'];

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

const TAG_CLASS_RE = new RegExp(
  `<(${FLEX_HOST_TAGS.join('|')})\\b[^>]*\\bclass="([^"]+)"`,
  'g'
);

const violations = [];
const htmlFiles = walk(srcDir, '.component.html');

for (const htmlFile of htmlFiles) {
  const html = readFileSync(htmlFile, 'utf8');
  let match;
  TAG_CLASS_RE.lastIndex = 0;
  const found = new Map(); // className -> tag, deduped per file
  while ((match = TAG_CLASS_RE.exec(html))) {
    const [, tag, classAttr] = match;
    for (const cls of classAttr.split(/\s+/).filter(Boolean)) {
      // Angular structural bindings like [class.foo] land in a separate
      // attribute, not here — this only sees static class="..." strings.
      found.set(cls, tag);
    }
  }
  if (found.size === 0) continue;

  const scssFile = htmlFile.replace(/\.component\.html$/, '.component.scss');
  if (!existsSync(scssFile)) continue; // no local CSS — nothing to override with
  const css = readFileSync(scssFile, 'utf8');

  for (const [cls, tag] of found) {
    const ruleRe = new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
    const ruleMatch = css.match(ruleRe);
    if (!ruleMatch) continue;
    if (/\bdisplay\s*:/.test(ruleMatch[1])) {
      violations.push(
        `${relative(root, scssFile)}: ".${cls}" (on <${tag}>) declares "display" — ${tag}'s own :host is flex/inline-flex for its icon+content layout; overriding display here stacks them as separate block lines instead of side by side. Remove the display declaration; use margin/gap for spacing instead.`
      );
    }
  }
}

if (violations.length > 0) {
  console.log('[audit:ndbx-host-display] Violations found:');
  for (const v of violations) console.log(`  ${v}`);
  process.exit(1);
}

console.log(
  '[audit:ndbx-host-display] passed — no project CSS class overrides display on nx-message/nx-badge/nx-tag(-group)/nx-taglist/nx-indicator/nx-tile-group.'
);
process.exit(0);
