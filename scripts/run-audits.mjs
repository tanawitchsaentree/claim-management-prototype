#!/usr/bin/env node
// Runs a list of `npm run <name>` audit scripts unconditionally — no `&&` short-circuiting.
// Every check runs and reports; the aggregate exits non-zero if ANY check failed.
import { execSync } from 'node:child_process';

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Usage: node scripts/run-audits.mjs <npm-script-name> [more...]');
  process.exit(1);
}

const results = [];

for (const name of names) {
  let output = '';
  let passed = true;
  try {
    output = execSync(`npm run --silent ${name}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    passed = false;
    output = (err.stdout || '') + (err.stderr || '');
  }
  results.push({ name, passed, output: output.trim() });
}

console.log('\n─────────────────────────────────────────────');
console.log(' AUDIT SUMMARY');
console.log('─────────────────────────────────────────────');
for (const r of results) {
  const violationLines = r.output ? r.output.split('\n').filter(Boolean).length : 0;
  const status = r.passed ? '✅ PASS' : `❌ FAIL (${violationLines} line${violationLines === 1 ? '' : 's'})`;
  console.log(`${status.padEnd(22)} ${r.name}`);
}
console.log('─────────────────────────────────────────────');

const failed = results.filter((r) => !r.passed);
for (const r of failed) {
  console.log(`\n── ${r.name} ──`);
  console.log(r.output || '(no output)');
}

const passedCount = results.length - failed.length;
console.log(`\n${passedCount}/${results.length} checks passed.`);

process.exit(failed.length > 0 ? 1 : 0);
