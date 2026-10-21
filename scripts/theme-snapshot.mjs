/**
 * theme-snapshot.mjs - records how a theme renders, so a styling refactor can
 * prove it changed nothing (or show exactly what it changed). Added 2026-10-21
 * with the theme-layer split (see .claude/THEMING.md).
 *
 *   npm start                                                    # in one terminal
 *   node scripts/theme-snapshot.mjs capture <dir> [ndbx|a1]      # default ndbx
 *   node scripts/theme-snapshot.mjs compare <dirBefore> <dirAfter>
 *
 * capture: per page, a full-page PNG plus a JSON of the computed styles that a
 * theme controls (colour, spacing, type, radius, size) for every visible element.
 * compare: reports pages whose PNG differs and, for those, the elements and
 * properties that changed, so the cause can be found without eyeballing.
 * Output dirs live under .theme-snapshots/ (gitignored). Exit 1 on any difference.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4200';
const PAGES = [
  'dashboard',
  'tasks',
  'administration',
  'administration/mass-events',
  'claims',
  'loss-events',
  'approvals',
  'fnol/search',
  'fnol/skeleton-create',
  'claims/CLM-2024-001/overview',
  'claims/CLM-2024-001/sections',
  'claims/CLM-2024-001/policy',
  'claims/CLM-2024-001/financial?view=reserves',
  'claims/CLM-2024-001/financial?view=payments',
  'claims/CLM-2024-001/loss-information/edit',
  'claims/SK-2024-001/overview'
];
const PROPS = [
  'color', 'background-color', 'border-top-color', 'border-bottom-color',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'row-gap', 'column-gap',
  'font-size', 'font-weight', 'line-height', 'letter-spacing', 'font-family',
  'border-top-left-radius', 'border-top-width', 'box-shadow', 'height', 'width'
];
const slug = url => url.replace(/[/?=]/g, '_');

async function capture(dir, theme) {
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(t => {
    localStorage.setItem('app:access-granted', '1');
    localStorage.setItem('app:theme', t);
  }, theme);
  for (const url of PAGES) {
    await page.goto(`${BASE}/${url}`);
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(dir, `${slug(url)}.png`), fullPage: true });
    const styles = await page.evaluate(props => {
      const out = {};
      const pathOf = el => {
        const parts = [];
        for (let e = el; e && e !== document.body; e = e.parentElement) {
          const i = e.parentElement ? [...e.parentElement.children].indexOf(e) : 0;
          // Skip Angular's own classes: ng-tns-c<hash> changes on every rebuild.
          const cls = [...e.classList].find(c => !c.startsWith('ng-'));
          parts.unshift(`${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}[${i}]`);
        }
        return parts.join('>');
      };
      for (const el of document.body.querySelectorAll('*')) {
        if (!el.getClientRects().length) continue;
        const cs = getComputedStyle(el);
        out[pathOf(el)] = props.map(p => cs.getPropertyValue(p)).join('|');
      }
      return out;
    }, PROPS);
    writeFileSync(join(dir, `${slug(url)}.json`), JSON.stringify(styles));
    console.log(`captured ${url}`);
  }
  await browser.close();
}

function compare(a, b) {
  let failed = 0;
  for (const url of PAGES) {
    const s = slug(url);
    if (!existsSync(join(a, `${s}.png`)) || !existsSync(join(b, `${s}.png`))) {
      console.log(`MISSING   ${url}`);
      failed++;
      continue;
    }
    const same = readFileSync(join(a, `${s}.png`)).equals(readFileSync(join(b, `${s}.png`)));
    const sa = JSON.parse(readFileSync(join(a, `${s}.json`), 'utf8'));
    const sb = JSON.parse(readFileSync(join(b, `${s}.json`), 'utf8'));
    const changes = [];
    for (const key of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
      if (sa[key] === sb[key]) continue;
      if (!sa[key] || !sb[key]) { changes.push(`  ${sa[key] ? 'gone' : 'new '}  ${key}`); continue; }
      const va = sa[key].split('|'), vb = sb[key].split('|');
      const diff = PROPS.map((p, i) => (va[i] !== vb[i] ? `${p}: ${va[i]} -> ${vb[i]}` : null)).filter(Boolean);
      changes.push(`  ${key}\n      ${diff.join('\n      ')}`);
    }
    if (same && !changes.length) { console.log(`same      ${url}`); continue; }
    failed++;
    console.log(`DIFFERENT ${url} (pixels ${same ? 'same' : 'differ'}, ${changes.length} elements changed)`);
    changes.slice(0, 25).forEach(c => console.log(c));
    if (changes.length > 25) console.log(`  ... ${changes.length - 25} more`);
  }
  process.exit(failed ? 1 : 0);
}

const [cmd, x, y] = process.argv.slice(2);
if (cmd === 'capture' && x) await capture(x, y ?? 'ndbx');
else if (cmd === 'compare' && x && y) compare(x, y);
else {
  console.log('usage: theme-snapshot.mjs capture <dir> [ndbx|a1] | compare <dirA> <dirB>');
  process.exit(2);
}
