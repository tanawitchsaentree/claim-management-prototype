/**
 * audit-date-format.mjs
 *
 * Enforces: date display formatting goes through AppDatePipe
 * (src/app/shared/pipes/app-date.pipe.ts), not a hand-rolled per-component
 * formatter. Flags:
 *   1. A local `formatDate(` method declaration in any component.
 *   2. `toLocaleDateString(` / `toLocaleTimeString(` calls outside the one
 *      documented exception.
 *
 * Exception: calendar-widget.ts's `toLocaleDateString('en-GB', { weekday,
 * day, month })` renders a deliberately different, human-readable calendar
 * label ("Mon, 15 Jul") — not a duplicate of the DD-MM-YYYY convention this
 * pipe centralizes. Consolidating it would be a UX regression, not a fix.
 * See CONVERSIONS.md 2026-08-06.
 *
 * Exit 0 = no hand-rolled date formatters found.
 * Exit 1 = at least one found.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, '..');
const srcDir = resolve(root, 'src/app');

const EXCEPTIONS = [
  resolve(srcDir, 'features/dashboard/widgets/calendar-widget.ts'),
];

const FORMAT_DATE_DECL = /\bformatDate\s*\(/;
const TO_LOCALE_DATE_OR_TIME_STRING = /\btoLocale(Date|Time)String\s*\(/;

function walkTs(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkTs(full, files);
    else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) files.push(full);
  }
  return files;
}

const files = walkTs(srcDir).filter(f => !EXCEPTIONS.includes(f));
const violations = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FORMAT_DATE_DECL.test(line) && /(private|public|protected)?\s*formatDate\s*\(.*\)\s*:\s*string\s*\{?$/.test(line.trim())) {
      violations.push(`${relative(root, file)}:${i + 1}: local formatDate() declaration — use AppDatePipe instead\n    ${line.trim()}`);
    }
    if (TO_LOCALE_DATE_OR_TIME_STRING.test(line)) {
      violations.push(`${relative(root, file)}:${i + 1}: toLocaleDateString()/toLocaleTimeString() — use AppDatePipe instead\n    ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.log('[audit:date-format] Hand-rolled date formatter found:');
  for (const v of violations) console.log(`  ${v}`);
  console.log('\nUse `| appDate` (or `| appDate:\'withTime\'`) from shared/pipes/app-date.pipe.ts instead.');
  process.exit(1);
}

console.log('[audit:date-format] passed — no hand-rolled date formatters found.');
process.exit(0);
