/**
 * audit-status-colors.mjs
 *
 * Enforces: status/clearance/chip/badge color values live in exactly one
 * place — the CSS custom properties in styles.scss, consumed only through
 * StatusChipComponent's TOKEN_MAP (src/app/shared/components/status-chip/).
 *
 * Flags raw hex color values (#fff, #f8d7da, ...) inside any SCSS rule whose
 * selector name contains a status/chip/badge/clearance keyword, anywhere
 * OUTSIDE shared/components/status-chip/. A hardcoded hex in that shape is
 * exactly the fork pattern this consolidation pass removed (see closure
 * chip, broker clearance twins, CAT/pending badges — CONVERSIONS.md 2026-08-06).
 *
 * Deliberately narrow: does NOT flag hex hidden inside `var(--token, #hex)`
 * fallbacks (a separate, pre-existing issue tracked independently — see
 * TECH_DEBT.md) or hex unrelated to status/chip/badge selectors (icons, SVG
 * fills, unrelated decorative color). Widening this later is fine, but must
 * not silently start failing on pre-existing, unrelated violations.
 *
 * Exit 0 = no status-color forks found outside status-chip/.
 * Exit 1 = at least one hardcoded status-color hex found.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');
const srcDir = resolve(root, 'src/app');

const EXEMPT_DIR = resolve(srcDir, 'shared/components/status-chip');
// Deliberately narrow to selectors that actually name a status/clearance/
// recovery/risk-severity concept — bare "badge"/"chip" alone (e.g. a tab
// notification-count badge) is a different, unrelated UI primitive and is
// NOT status-colors' concern.
const SELECTOR_KEYWORDS = /status|clearance|recovery-chip|risk-badge|risk-status/i;
const HEX_OUTSIDE_VAR = /#[0-9a-fA-F]{3,8}\b/;

function walkScss(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkScss(full, files);
    else if (entry.endsWith('.scss')) files.push(full);
  }
  return files;
}

const files = walkScss(srcDir).filter(f => !f.startsWith(EXEMPT_DIR));
const violations = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');

  // Track which selector block we're inside via a simple brace-depth stack —
  // good enough for this codebase's SCSS nesting style (no interpolated
  // selectors, no @each-generated class names in the flagged files).
  const selectorStack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Selector line: ends with '{', not a plain property.
    if (trimmed.endsWith('{') && !trimmed.startsWith('//')) {
      const selector = trimmed.slice(0, -1).trim();
      selectorStack.push(selector);
    }
    if (trimmed === '}' || trimmed.startsWith('}')) {
      selectorStack.pop();
    }

    if (trimmed.startsWith('//')) continue;
    if (!HEX_OUTSIDE_VAR.test(line)) continue;

    // Ignore hex that's only inside a var(..., #hex) fallback — separate,
    // pre-existing issue, not this rule's job.
    const hexMatches = line.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const allInsideVarFallback = hexMatches.every(hex => {
      const idx = line.indexOf(hex);
      const before = line.slice(0, idx);
      // crude but effective: hex is inside a var(...) call if the nearest
      // unclosed '(' before it belongs to a var(
      const openVar = before.lastIndexOf('var(');
      const closeParenAfterVar = openVar >= 0 ? line.indexOf(')', openVar) : -1;
      return openVar >= 0 && (closeParenAfterVar === -1 || closeParenAfterVar > idx);
    });
    if (allInsideVarFallback) continue;

    const inStatusSelector = selectorStack.some(s => SELECTOR_KEYWORDS.test(s));
    if (inStatusSelector) {
      violations.push(`${relative(root, file)}:${i + 1}: ${trimmed}`);
    }
  }
}

if (violations.length > 0) {
  console.log('[audit:status-colors] Hardcoded hex found inside a status/chip/badge/clearance rule:');
  for (const v of violations) console.log(`  ${v}`);
  console.log('\nAll status-like colors must come from styles.scss custom properties, consumed via <app-status-chip>.');
  process.exit(1);
}

console.log('[audit:status-colors] passed — no status-color forks found outside shared/components/status-chip/.');
process.exit(0);
