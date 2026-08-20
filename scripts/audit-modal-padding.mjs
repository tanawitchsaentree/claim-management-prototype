/**
 * audit-modal-padding.mjs
 *
 * NxModalContainer applies --modal-padding (40px) on all four sides of every
 * dialog automatically (allianz-ng-aquila-modal.mjs, NxModalContainer :host).
 * A modal component's own header/body/footer sections must therefore only
 * ever declare VERTICAL padding (padding-top / padding-bottom) — any
 * horizontal value in a `padding:` shorthand on those sections doubles the
 * left/right inset the container already provides, and padding on the
 * outer edge (header's own top, footer's own bottom) stacks on top of the
 * container's already-40px edge, producing an oversized gap.
 *
 * See .claude/BLESSED.md "Mandatory modal SCSS pattern" (entity-search-modal
 * is the reference) and the 2026-08-14 incident — recovery-potential-modal,
 * add-litigation-party-modal, and start-investigation-modal all copied the
 * same broken shorthand from each other, none of them from the blessed file.
 *
 * Scope: only *.component.scss files paired with a *.component.ts that
 * injects NX_MODAL_DATA or NxModalRef — i.e. actually opened as modal
 * content via NxDialogService.open(). Not every "-modal"-named file is
 * necessarily one of these.
 *
 * Heuristic, not a full CSS parser: flags a `padding:` shorthand on a
 * selector whose class name ends in -header, -body, -footer, -content, or
 * -actions ONLY when the shorthand's horizontal (left/right) value is
 * nonzero — `padding: var(--space-sm) 0` is fine, since 0 horizontal adds
 * nothing to double. Will miss section classes named differently and
 * nested rules (`&.foo { }`) inside a parent block — widen it if a real
 * gap surfaces, but don't let false positives on unrelated formatting
 * block commits.
 *
 * Exit 0 = no violations.
 * Exit 1 = at least one violation found.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const root   = resolve(__dir, '..');
const srcDir = resolve(root, 'src/app');

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

const SECTION_RULE  = /\.[a-zA-Z0-9_-]+(?:-header|-body|-footer|-content|-actions)\b[^{}]*\{([^}]*)\}/g;
const PADDING_VALUE = /\bpadding\s*:\s*([^;]+);/;

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

const violations = [];

for (const tsFile of modalTsFiles) {
  const scssFile = tsFile.replace(/\.component\.ts$/, '.component.scss');
  if (!existsSync(scssFile)) continue;
  const css = readFileSync(scssFile, 'utf8');

  let match;
  while ((match = SECTION_RULE.exec(css))) {
    const [fullRule, body] = match;
    const selector = fullRule.slice(0, fullRule.indexOf('{')).trim();
    const pm = body.match(PADDING_VALUE);
    if (!pm) continue;
    if (!hasNonzeroHorizontal(pm[1])) continue;
    violations.push(
      `${relative(root, scssFile)}: "${selector}" declares "padding: ${pm[1].trim()}" — ` +
      `use padding-top / padding-bottom only (NxModalContainer already adds 40px on every ` +
      `side; see .claude/BLESSED.md modal pattern)`
    );
  }
}

if (violations.length > 0) {
  console.log('[audit:modal-padding] Violations found:');
  for (const v of violations) console.log(`  ${v}`);
  process.exit(1);
}

console.log('[audit:modal-padding] passed — no modal header/body/footer section redeclares horizontal padding.');
process.exit(0);
