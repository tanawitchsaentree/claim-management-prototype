/**
 * audit-ndbx-wrapper.mjs
 *
 * Flags a raw `<input>` in a feature template that isn't wired to an NDBX
 * component: it must carry `nxInput` or `nxDatefield`, or be one of the
 * types NDBX doesn't wrap as a text field (hidden / radio / checkbox / file).
 *
 * Replaces the previous one-line grep in package.json
 * (`grep -rn '<input\b' ... | grep -v 'nxInput\|type="hidden"\|...'`), which
 * only looked at the line holding `<input`. This codebase's house style
 * (prettier) breaks long tags across lines, so `<input` sits alone on its
 * line and `nxInput` / `nxDatefield` follow below it: the grep reported every
 * correctly-wired multi-line input as a violation (found 2026-11-23, 34 false
 * hits, see CONVERSIONS.md). This script reads the whole tag, from `<input`
 * to its closing `>`, before deciding.
 *
 * Same rule as before, nothing loosened: the allowed markers are identical.
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

const ALLOWED = /\bnxInput\b|\bnxDatefield\b|type="(?:hidden|radio|checkbox|file)"/;

function walkHtml(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkHtml(full, files);
    else if (entry.endsWith('.html')) files.push(full);
  }
  return files;
}

/** Index of the `>` that closes the tag starting at `start`, skipping `>` inside quoted attribute values. */
function tagEnd(text, start) {
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return i;
    }
  }
  return text.length - 1;
}

let total = 0;
for (const file of walkHtml(featuresDir)) {
  const text = readFileSync(file, 'utf8');
  const re = /<input\b/g;
  let m;
  while ((m = re.exec(text))) {
    const tag = text.slice(m.index, tagEnd(text, m.index) + 1);
    if (ALLOWED.test(tag)) continue;
    const line = text.slice(0, m.index).split('\n').length;
    console.log(`${relative(root, file)}:${line}: ${tag.replace(/\s+/g, ' ')}`);
    total++;
  }
}

process.exit(total > 0 ? 1 : 0);
