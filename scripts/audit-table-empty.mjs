/**
 * audit-table-empty.mjs
 *
 * Enforces: every component rendering a table (nxTable or a plain <table>)
 * must also reference <app-empty-state> somewhere in the same template —
 * i.e. it has a real empty-state path — OR carry an explicit
 * <!-- audit-exempt: reason --> comment explaining why it doesn't need one
 * (e.g. a table that's structurally guaranteed non-empty, or a table inside
 * a component that delegates its own empty case to a parent).
 *
 * Exit 0 = every table-bearing template has an empty state or an exemption.
 * Exit 1 = at least one table-bearing template has neither.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');
const srcDir = resolve(root, 'src/app');

const HAS_TABLE = /<table\b|nxTable\b/;
const HAS_EMPTY_STATE = /<app-empty-state\b/;
const HAS_EXEMPTION = /audit-exempt/;

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

const violations = [];
const files = walkHtml(srcDir);

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (!HAS_TABLE.test(content)) continue;
  if (HAS_EMPTY_STATE.test(content)) continue;
  if (HAS_EXEMPTION.test(content)) continue;
  violations.push(relative(root, file));
}

if (violations.length > 0) {
  console.log('[audit:table-empty] Tables with no empty-state path and no exemption:');
  for (const v of violations) console.log(`  ${v}`);
  console.log('\nAdd <app-empty-state> for the zero-rows case, or a comment like');
  console.log('<!-- audit-exempt: reason --> if this table cannot be empty.');
  process.exit(1);
}

console.log('[audit:table-empty] passed — every table-bearing template has an empty state or an exemption.');
process.exit(0);
