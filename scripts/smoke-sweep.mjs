/**
 * smoke-sweep.mjs - opens every claim page (and the top-level pages) in a real browser
 * against the running dev server and reports: pages stuck on "Loading…", visible error
 * text, "undefined"/"NaN" in the text, and console errors. Added 2026-10-13 after a
 * sweep found Recoveries and Litigation empty for every claim and /notes crashing.
 *
 *   npm start                      # in one terminal
 *   node scripts/smoke-sweep.mjs   # 6 representative claims (about 3 min)
 *   node scripts/smoke-sweep.mjs --all   # every claim in claims.json (about 25 min)
 *
 * Needs playwright (already a dev dependency). Exit 1 if anything is flagged.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4200';
const all = process.argv.includes('--all');
const claims = JSON.parse(readFileSync('src/app/core/mock/data/claims.json', 'utf8')).map(c => c.claimId);
const picked = all
  ? claims
  : ['CLM-2024-001', 'CLM-2024-003', 'CLM-2024-028', 'SK-2024-001', 'SK-2024-004', 'SK-2024-010'].filter(id => claims.includes(id));
const claimPages = [
  'overview', 'sections', 'policy', 'financial?view=reserves', 'financial?view=payments',
  'financial?view=overview', 'financial?view=recovery', 'notes', 'limits', 'recoveries',
  'providers', 'risk', 'litigation', 'loss-information/edit'
];
const topPages = ['dashboard', 'tasks', 'administration', 'administration/mass-events', 'claims', 'loss-events', 'approvals', 'fnol/search', 'fnol/skeleton-create'];
// Network errors to external services (the tracker's Supabase) are an environment matter, not a code bug.
const IGNORE = /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.setItem('app:access-granted', '1'));
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 100)));
page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errs.push(m.text().slice(0, 100)); });

const problems = [];
async function check(url, label) {
  errs.length = 0;
  await page.goto(`${BASE}/${url}`);
  await page.waitForTimeout(2200);
  const t = await page.locator('body').innerText();
  const flags = [];
  if (/Loading…|Loading\.\.\./.test(t)) flags.push('stuck Loading');
  if (/Failed to load|Something went wrong|Could not load/i.test(t)) flags.push('error text');
  if (/undefined|NaN|\[object Object\]/.test(t)) flags.push('undefined/NaN in text');
  if (errs.length) flags.push('console: ' + errs[0]);
  if (flags.length) problems.push(`${label.padEnd(44)} ${flags.join(' + ')}`);
}

for (const p of topPages) await check(p, p);
for (const id of picked) for (const p of claimPages) await check(`claims/${id}/${p}`, `${id}/${p}`);
await browser.close();

console.log(`checked ${topPages.length + picked.length * claimPages.length} pages, ${problems.length} problem(s)`);
problems.forEach(p => console.log('  ' + p));
process.exit(problems.length ? 1 : 0);
