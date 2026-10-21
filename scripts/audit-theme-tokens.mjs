/**
 * audit-theme-tokens.mjs - finds styling that will NOT follow the NDBX <-> A1
 * theme switch, with file:line and the token to use instead. Added 2026-10-21
 * with the theme-layer split; the why and the fix recipes are in
 * .claude/THEMING.md.
 *
 *   node scripts/audit-theme-tokens.mjs           # report, exit 1 on findings
 *   node scripts/audit-theme-tokens.mjs --fix     # also apply the safe rewrites
 *   node scripts/audit-theme-tokens.mjs --summary # counts per rule only
 *
 * Rules
 *   colour     raw hex / rgb() / hsl() in a component
 *   fallback   var(--token, #hex): fallback is dead when the token exists (fix
 *              removes it) and a hidden hardcode when it does not
 *   undefined  var(--token) that no theme file, project file or runtime setter defines
 *   spacing    px/rem literal in padding / margin / gap (fix: on-scale values -> --space-*;
 *              under 4px is an optical nudge and allowed)
 *   radius     px literal in border-radius (fix: 2/3/4/6/8px -> --radius-*)
 *   font-size  px/rem literal font-size outside icon selectors (fix: 12-32px steps)
 *
 * --fix only rewrites values whose NDBX result is identical, so NDBX renders
 * the same before and after (check with scripts/theme-snapshot.mjs compare).
 * A line (or the line above it) containing `theme-exempt: <reason>` is skipped.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const FIX = process.argv.includes('--fix');
const SUMMARY = process.argv.includes('--summary');
const THEMES = 'node_modules/@allianz/ngx-brand-kit/css/themes';

// ── Where tokens are defined ────────────────────────────────────────────────
const walk = (dir, re, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, re, out);
    else if (re.test(e.name)) out.push(p);
  }
  return out;
};
const defined = new Set();
const addDefs = text => { for (const m of text.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]); };
for (const f of ['ndbx.css', 'allianz-one.css']) addDefs(readFileSync(join(THEMES, f), 'utf8'));
for (const f of walk('src/styles', /\.scss$/)) addDefs(readFileSync(f, 'utf8'));
// Set at runtime: style.setProperty('--x'), [style.--x], style="--x: ...".
for (const f of walk('src/app', /\.(ts|html)$/)) {
  const t = readFileSync(f, 'utf8');
  for (const m of t.matchAll(/setProperty\(\s*['"`](--[\w-]+)|style\.(--[\w-]+)|['"\s;](--[\w-]+)\s*:/g)) defined.add(m[1] ?? m[2] ?? m[3]);
}

// ── Scales (values must equal the NDBX value, so --fix changes nothing in NDBX) ──
const SPACE = {
  4: 'xs', 8: 'sm', 12: 'md', 16: 'base', 20: 'lg', 24: 'xl', 32: '2xl', 40: '3xl', 48: '4xl', 64: '5xl',
  5: 'ndbx-5', 6: 'ndbx-6', 7: 'ndbx-7', 10: 'ndbx-10', 14: 'ndbx-14', 18: 'ndbx-18', 28: 'ndbx-28'
};
// Spacing below the smallest A1 step (4px) is an optical nudge, not layout: allowed.
const SPACE_NUDGE_MAX = 3;
const RADIUS = { 2: 'xs', 3: 'ndbx-3', 4: 's', 6: 'ndbx-6', 8: 'm' };
const FONT = {
  12: '--paragraph-05-font-size', 14: '--paragraph-03-font-size', 16: '--paragraph-01-font-size',
  18: '--heading-06-font-size', 20: '--heading-05-font-size',
  24: '--display-s-font-size', 28: '--display-m-font-size', 32: '--display-l-font-size'
};
const px = v => {
  const m = v.match(/^(-?)(\d*\.?\d+)(px|rem)$/);
  if (!m) return null;
  const n = parseFloat(m[2]) * (m[3] === 'rem' ? 16 : 1);
  return { neg: m[1] === '-', n };
};
// Rewrites each top-level px/rem word of a value; anything inside (...) is left alone.
function rewrite(value, map, nudgeMax = 0) {
  const left = [];
  const out = value.split(/(\s+)/).map(w => {
    if (/[()]/.test(w) || !/\d/.test(w)) return w;
    const v = px(w);
    if (!v) return w;
    if (v.n <= nudgeMax) return w;
    const token = map(v.n);
    if (!token) { left.push(w); return w; }
    return v.neg ? `calc(-1 * var(${token}))` : `var(${token})`;
  }).join('');
  return { out, left };
}

const findings = [];
const report = (file, line, rule, msg) => findings.push({ file, line, rule, msg });

function audit(file) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const isTs = file.endsWith('.ts');
  const selectors = [];
  let changed = false;
  lines.forEach((raw, i) => {
    const code = raw.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    const exempt = /theme-exempt:/.test(raw) || /theme-exempt:/.test(lines[i - 1] ?? '');
    const opens = code.split('{').length - 1, closes = code.split('}').length - 1;
    if (opens) selectors.push(code.slice(0, code.indexOf('{')));
    const decl = code.match(/^\s*([$a-z0-9-]+)\s*:\s*(.+?);?\s*$/);
    for (let c = 0; c < closes; c++) selectors.pop();
    if (!decl || exempt || opens) return;
    if (isTs && !/;\s*$/.test(code)) return; // TS: only CSS lines inside styles: [`...`]
    const [, prop, value] = decl;
    const where = selectors.join(' ');
    let line = raw;

    // fallback + undefined
    for (const m of value.matchAll(/var\((--[\w-]+)\s*(,\s*([^()]*(\([^()]*\))?[^()]*))?\)/g)) {
      const [whole, name, , fb] = m;
      if (!defined.has(name)) report(file, i + 1, 'undefined', `${name} is not defined anywhere${fb ? ` (renders the fallback ${fb.trim()})` : ''}`);
      else if (fb !== undefined) {
        if (FIX) line = line.replace(whole, `var(${name})`);
        else report(file, i + 1, 'fallback', `${whole}: fallback is dead, ${name} exists`);
      }
    }
    // colour
    const bare = value.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, '');
    if (/#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/.test(bare)) report(file, i + 1, 'colour', `${prop}: ${value.trim()}`);

    // spacing / radius / font-size
    const isSpacingVar = prop.startsWith('$') && /(sp-|gap|pad|-p[tblr]$|margin|space)/.test(prop);
    const kind = /^(padding|margin|gap|row-gap|column-gap)(-|$)/.test(prop) || isSpacingVar ? 'spacing'
      : /^border(-[a-z]+)*-radius$/.test(prop) ? 'radius'
      : prop === 'font-size' && !/icon/i.test(where + code) ? 'font-size' : null;
    if (kind) {
      const map = kind === 'spacing' ? n => SPACE[n] && `--space-${SPACE[n]}`
        : kind === 'radius' ? n => RADIUS[n] && `--radius-${RADIUS[n]}`
        : n => FONT[n];
      const val = value.replace(/\s*!important\s*$/, '');
      const { out, left } = rewrite(val, map, kind === 'spacing' ? SPACE_NUDGE_MAX : 0);
      if (FIX && out !== val) line = line.replace(val, out);
      if (left.length) report(file, i + 1, kind, `${prop}: ${value.trim()} (off-scale: ${left.join(' ')})`);
      else if (!FIX && out !== val) report(file, i + 1, kind, `${prop}: ${value.trim()} -> fixable: ${out}`);
    }
    if (line !== raw) { lines[i] = line; changed = true; }
  });
  if (changed) writeFileSync(file, lines.join('\n'));
}

const files = [
  ...walk('src/app', /\.scss$/),
  ...walk('src/app', /\.ts$/).filter(f => !f.endsWith('.spec.ts') && /styles:\s*\[/.test(readFileSync(f, 'utf8'))),
  'src/styles/_globals.scss',
  'src/styles/_overlays.scss'
];
files.forEach(audit);

const byRule = {};
for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
if (!SUMMARY) for (const f of findings) console.log(`${f.file}:${f.line}  [${f.rule}]  ${f.msg}`);
console.log(`\n${findings.length} findings${FIX ? ' left after --fix' : ''}: ${Object.entries(byRule).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
if (findings.length) console.log('How to fix each rule: .claude/THEMING.md');
process.exit(findings.length ? 1 : 0);
