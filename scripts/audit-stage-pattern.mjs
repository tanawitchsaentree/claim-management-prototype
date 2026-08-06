/**
 * audit-stage-pattern.mjs
 *
 * Enforces the ScenarioStage registration pattern documented in PROJECT.md:
 *
 *   "stageSvc.register(this)" must be the FIRST executable statement of
 *   ngOnInit() in any component that implements a Stage interface.
 *
 * Past bug: stages registered AFTER an early-return / subscription chain
 * race-condition with ScenarioRunnerService — postLand hooks time out and
 * fail silently. See PROJECT.md "Blessed Patterns".
 *
 * Exit 0 = all components compliant.
 * Exit 1 = at least one component registers the stage too late.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');
const srcDir = resolve(root, 'src/app');

// ── Walk src/app and collect *.component.ts files ────────────────────────────
function walkTs(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkTs(full, files);
    else if (entry.endsWith('.component.ts') && !entry.endsWith('.spec.ts')) files.push(full);
  }
  return files;
}

const STAGE_INTERFACES = [
  'OverviewStage',
  'FnolLossInfoStage',
  // Add new stage interfaces here as they're declared in scenario-stage.model.ts
];

const REGISTER_RE   = /this\.\w*[Ss]tage\w*\.register\(this\)/;
const NG_ONINIT_RE  = /\bngOnInit\s*\([^)]*\)\s*:\s*[\w<>\[\]\s|]+\s*\{/;

function fileImplementsStage(src) {
  return STAGE_INTERFACES.some(name => new RegExp(`implements\\b[^{]*\\b${name}\\b`).test(src));
}

function extractNgOnInitBody(src) {
  const start = src.search(NG_ONINIT_RE);
  if (start < 0) return null;
  // Find the opening brace of the method body
  const braceStart = src.indexOf('{', start);
  if (braceStart < 0) return null;
  // Walk forward, counting braces to find matching close
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(braceStart + 1, i);
    }
  }
  return null;
}

function firstExecutableLine(body) {
  const lines = body.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('//')) continue;     // comment
    if (trimmed.startsWith('/*'))  continue;
    if (trimmed.startsWith('*'))   continue;    // jsdoc continuation
    return trimmed;
  }
  return null;
}

const files = walkTs(srcDir);
let totalChecked = 0;
let totalFailed  = 0;
const failures = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!fileImplementsStage(src)) continue;
  totalChecked++;

  const ngOnInitBody = extractNgOnInitBody(src);
  if (!ngOnInitBody) {
    failures.push({ file, reason: 'implements Stage interface but has no ngOnInit()' });
    totalFailed++;
    continue;
  }

  const firstLine = firstExecutableLine(ngOnInitBody);
  if (!firstLine) {
    failures.push({ file, reason: 'ngOnInit body is empty' });
    totalFailed++;
    continue;
  }

  if (!REGISTER_RE.test(firstLine)) {
    failures.push({
      file,
      reason: `first line of ngOnInit is "${firstLine}" — expected stageSvc.register(this)`,
    });
    totalFailed++;
  }
}

console.log(`\n[audit:stage-pattern] checked ${totalChecked} stage component(s)`);

if (failures.length === 0) {
  console.log('audit:stage-pattern passed — all stages register first.\n');
  process.exit(0);
}

console.log(`\n❌ ${failures.length} component(s) violate stage registration pattern:\n`);
for (const f of failures) {
  const rel = f.file.replace(root + '/', '');
  console.log(`  • ${rel}`);
  console.log(`      → ${f.reason}`);
}
console.log('\nFix: move stageSvc.register(this) to the FIRST executable line of ngOnInit().');
console.log('See PROJECT.md → "Blessed Patterns" → "Pattern: ScenarioStage component registration".\n');
process.exit(1);
