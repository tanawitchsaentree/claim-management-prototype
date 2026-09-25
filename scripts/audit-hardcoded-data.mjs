/**
 * audit-hardcoded-data.mjs
 *
 * Flags an inline array-of-objects literal declared directly in a component
 * (`const NAME = [{...}]` or `readonly NAME = [{...}]`) inside src/app/features
 * — the shape option lists (dropdowns, lookup tables) take when someone
 * copy-pastes a few values instead of wiring MockLookupService/lookups.json.
 *
 * Replaces the previous one-line grep
 * (`grep -rnE 'const [a-zA-Z]+ = \[\s*\{'`), which only matched when the `[`
 * and first `{` shared a line and only recognized `const` — this codebase's
 * house style always breaks the array onto its own line and favors
 * `readonly` class fields, so that grep matched zero files regardless of
 * how much hardcoded data existed (found 2026-09-25, see CONVERSIONS.md).
 *
 * Deliberately still scoped to "array of objects", not every hardcoded
 * array (e.g. `['A', 'B']`) — a plain string array is often a legitimate
 * local enum (see claim-notes-panel's categoryOptions), and casting the net
 * that wide without reviewing every hit risks blocking commits on
 * unrelated, harmless formatting. Widen it if a real gap using plain
 * string arrays turns up, same as audit-button-size.mjs's own caveat.
 *
 * Exemption: a `const`/`readonly` line immediately preceded by a comment
 * containing "audit-exempt" is skipped — for genuinely-static UI config
 * (e.g. table column definitions) that isn't master/lookup data.
 *
 * Exit 0 = no violations.
 * Exit 1 = at least one violation found.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const featuresDir = resolve(root, 'src/app/features');

// (const|readonly) NAME [: Type] = [ ... { — the `[\s\S]*?` gap is what the
// old single-line grep couldn't cross.
const DECL_LINE = /^\s*(?:private\s+|protected\s+|public\s+)?(?:const|readonly)\s+[a-zA-Z0-9_]+\b/;

function walkTs(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkTs(full, files);
    else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) files.push(full);
  }
  return files;
}

function findViolations(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    if (!DECL_LINE.test(lines[i])) continue;
    if (i > 0 && /audit-exempt/.test(lines[i - 1])) continue;

    // Look ahead a few lines for an array literal whose first non-whitespace
    // token is `{` — i.e. `= [` then (optionally on later lines) `{`.
    const window = lines.slice(i, i + 4).join('\n');
    if (/=\s*\[\s*\{/.test(window)) {
      violations.push(i + 1);
    }
  }
  return violations;
}

const files = walkTs(featuresDir);
let total = 0;
for (const file of files) {
  const violations = findViolations(file);
  for (const lineNo of violations) {
    console.log(`${relative(root, file)}:${lineNo}`);
    total++;
  }
}

process.exit(total > 0 ? 1 : 0);
