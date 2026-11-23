#!/usr/bin/env node
/**
 * audit-emdash-copy.mjs - no em dash (U+2014) in anything a person can read on
 * screen: template text, string literals in components/services, mock data and
 * ticket JSON. Code comments are allowed (existing codebase style).
 *
 * Why: the owner reads the em dash as an AI tell. Banned in UI copy, mock data
 * and ticket text since 2026-11-17 (whole app cleaned in beac95f). This was a
 * text-only rule that kept slipping, so it is now a check.
 *
 * Use ":" for labels, "," inside sentences, "-" for empty values.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const DASH = '—';
const ROOTS = ['src/app', 'public/tickets'];
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (['.html', '.ts', '.json'].includes(extname(p)) && !p.endsWith('.spec.ts')) check(p);
  }
}

function stripComments(src, ext) {
  if (ext === '.html') return src.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
  if (ext === '.ts') {
    // Blank out /* */ and // comments but keep line numbers. Strings are kept.
    let out = '';
    let i = 0;
    let quote = null;
    while (i < src.length) {
      const c = src[i];
      const n = src[i + 1];
      if (quote) {
        out += c;
        if (c === '\\') { out += n ?? ''; i += 2; continue; }
        if (c === quote) quote = null;
        i++;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
      if (c === '/' && n === '*') {
        const end = src.indexOf('*/', i + 2);
        const chunk = src.slice(i, end === -1 ? src.length : end + 2);
        out += chunk.replace(/[^\n]/g, ' ');
        i += chunk.length;
        continue;
      }
      if (c === '/' && n === '/') {
        const end = src.indexOf('\n', i);
        const chunk = src.slice(i, end === -1 ? src.length : end);
        out += ' '.repeat(chunk.length);
        i += chunk.length;
        continue;
      }
      out += c;
      i++;
    }
    return out;
  }
  return src;
}

function check(file) {
  const raw = readFileSync(file, 'utf8');
  if (!raw.includes(DASH)) return;
  const rawLines = raw.split('\n');
  const lines = stripComments(raw, extname(file)).split('\n');
  lines.forEach((line, idx) => {
    // "audit-exempt: emdash" on the same line = code that reads text, not text shown.
    if (/audit-exempt: emdash/.test(rawLines[idx])) return;
    if (line.includes(DASH)) hits.push(`${file}:${idx + 1}: ${line.trim().slice(0, 140)}`);
  });
}

for (const r of ROOTS) walk(r);

if (hits.length) {
  console.log(`Em dash in on-screen text (${hits.length}). Use ":" for labels, "," in sentences, "-" for empty values:`);
  for (const h of hits) console.log(h);
  process.exit(1);
}
console.log('audit:emdash-copy pass');
