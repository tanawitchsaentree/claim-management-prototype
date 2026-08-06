/**
 * audit-button-size.mjs
 *
 * Enforces the button-size zone rules (governance audit, 2026-08-06,
 * previously tribal knowledge only):
 *
 *   1. Inside any *-modal.component.html, every <button nxButton="..."> must
 *      include "small" in its nxButton value.
 *   2. Within one template, direct-sibling <button nxButton> elements (same
 *      immediate parent, not split across @if/@else branches) must not mix
 *      "small" and non-"small" sizes.
 *
 * Exemption: a button whose nxButton line is immediately preceded by a
 * comment containing "audit-exempt" is skipped entirely — used for
 * app-empty-state's [action]-projected CTA buttons, which are deliberately
 * full-size (see empty-state.component.ts, step-1-search / risk-analysis).
 *
 * This is a line-based heuristic, not a real DOM/template parser. Rule 2 in
 * particular only catches buttons at IDENTICAL indentation with no wrapper
 * element between them — it will miss siblings separated by a wrapping div
 * (e.g. a Cancel button next to a `<div class="actions">` that itself
 * contains the other buttons), which is a real, known gap. It will not
 * catch every conceivable markup shape; widen it if a real gap is found,
 * but don't let false positives on unrelated formatting styles block commits.
 *
 * Exit 0 = no violations.
 * Exit 1 = at least one violation found.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');
const srcDir = resolve(root, 'src/app');

const BUTTON_LINE = /<button\b[^>]*\bnxButton="([^"]*)"/;

function walkHtml(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkHtml(full, files);
    else if (entry.endsWith('.html')) files.push(full);
  }
  return files;
}

function isExempt(lines, i) {
  for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
    if (lines[j].includes('audit-exempt')) return true;
    if (lines[j].trim() !== '' && !lines[j].includes('<!--')) break;
  }
  return false;
}

const violations = [];

// ── Rule 1: every button inside a *-modal.component.html must be "small" ──
const modalFiles = walkHtml(srcDir).filter(f => f.endsWith('-modal.component.html'));
for (const file of modalFiles) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(BUTTON_LINE);
    if (!m) continue;
    if (isExempt(lines, i)) continue;
    if (!m[1].includes('small')) {
      violations.push(`${relative(root, file)}:${i + 1}: nxButton="${m[1]}" missing "small" (modal buttons must be small)`);
    }
  }
}

// ── Rule 2: direct-sibling buttons must not mix small/non-small ──────────
// Heuristic: within a contiguous run of sibling <button nxButton> lines at
// the SAME indentation level (no intervening line at a shallower indent),
// all must agree on "small" vs not.
const allHtml = walkHtml(srcDir);
for (const file of allHtml) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let group = []; // { indent, small, lineNo }

  const flushGroup = () => {
    if (group.length > 1) {
      const sizes = new Set(group.map(g => g.small));
      if (sizes.size > 1) {
        violations.push(
          `${relative(root, file)}: mixed button sizes among siblings — ` +
          group.map(g => `line ${g.lineNo} (${g.small ? 'small' : 'NOT small'})`).join(', ')
        );
      }
    }
    group = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(BUTTON_LINE);
    if (!m) {
      // A non-button, non-blank, non-comment line at or below the group's
      // indent breaks sibling adjacency (entered a different branch/element).
      if (group.length && line.trim() !== '' && !line.trim().startsWith('<!--')) {
        const indent = line.match(/^\s*/)[0].length;
        if (indent <= group[0].indent && !line.includes('</button>')) {
          flushGroup();
        }
      }
      continue;
    }
    if (isExempt(lines, i)) { flushGroup(); continue; }
    const indent = line.match(/^\s*/)[0].length;
    const small = m[1].includes('small');
    if (group.length && indent !== group[0].indent) flushGroup();
    group.push({ indent, small, lineNo: i + 1 });
  }
  flushGroup();
}

if (violations.length > 0) {
  console.log('[audit:button-size] Violations found:');
  for (const v of violations) console.log(`  ${v}`);
  process.exit(1);
}

console.log('[audit:button-size] passed — every modal button is small, no mixed-size sibling groups.');
process.exit(0);
