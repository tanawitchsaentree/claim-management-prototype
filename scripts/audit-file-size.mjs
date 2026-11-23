#!/usr/bin/env node
/**
 * audit-file-size.mjs - component file size limits from CLAUDE.md
 * (.ts 300, .html 200, .scss 250 lines), enforced as a ratchet.
 *
 * On 2026-11-23 about 30 files were already over the limit because the rule was
 * text only. Those are frozen in scripts/file-size-baseline.json at their size
 * that day. A frozen file may shrink, never grow; every other file must stay
 * under the limit. When a frozen file drops under its limit, its baseline entry
 * is no longer needed (the script says so).
 *
 *   node scripts/audit-file-size.mjs            # check
 *   node scripts/audit-file-size.mjs --rebase   # rewrite the baseline (only after a split)
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LIMITS = { '.component.ts': 300, '.component.html': 200, '.component.scss': 250 };
const BASELINE = 'scripts/file-size-baseline.json';

const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (Object.keys(LIMITS).some(s => p.endsWith(s))) files.push(p);
  }
})('src/app');

const lineCount = p => readFileSync(p, 'utf8').split('\n').length - 1;
const limitOf = p => LIMITS[Object.keys(LIMITS).find(s => p.endsWith(s))];

const over = Object.fromEntries(
  files.map(p => [p, lineCount(p)]).filter(([p, n]) => n > limitOf(p))
);

if (process.argv.includes('--rebase')) {
  writeFileSync(BASELINE, JSON.stringify(over, null, 2) + '\n');
  console.log(`Baseline written: ${Object.keys(over).length} files over the limit.`);
  process.exit(0);
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const problems = [];
for (const [p, n] of Object.entries(over)) {
  const frozen = baseline[p];
  if (frozen === undefined) problems.push(`NEW OVER LIMIT ${p}: ${n} lines (max ${limitOf(p)}). Split it.`);
  else if (n > frozen) problems.push(`GREW ${p}: ${n} lines (was ${frozen}, max ${limitOf(p)}). Split before adding.`);
}
const healed = Object.keys(baseline).filter(p => !(p in over));

if (problems.length) {
  problems.forEach(l => console.log(l));
  process.exit(1);
}
if (healed.length) console.log(`Now under the limit, drop from baseline: ${healed.join(', ')}`);
console.log(`audit:file-size pass (${Object.keys(over).length} frozen files, none grew)`);
