#!/usr/bin/env node
/**
 * verify-live.mjs - checks the build the TEAM opens, not the local dev server.
 *
 * Why: the deployed build differs from `npm start` (DEV banner off, production
 * environment). On 2026-11-23 the team could not switch user on the dashboard
 * because the only switcher left lived in the DEV banner, which the deployed
 * build never shows. Every local check passed. Run this after every deploy.
 *
 *   npm run verify:live                       # the GitHub Pages link
 *   BASE_URL=http://localhost:4300/claim-management-prototype npm run verify:live
 *                                             # a local production build
 *
 * Checks: each top page opens without a crash, stuck "Loading", "undefined"/"NaN"
 * text or console errors; the dashboard can switch to every persona and the
 * welcome line follows. Exit 1 if anything fails. Needs playwright (dev dep).
 */
import { chromium } from 'playwright';

const BASE = (process.env.BASE_URL ?? 'https://tanawitchsaentree.github.io/claim-management-prototype').replace(/\/$/, '');
const PAGES = ['dashboard', 'tasks', 'claims', 'loss-events', 'approvals', 'administration', 'fnol/search', 'claims/CLM-2024-001/overview'];
const IGNORE = /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|supabase/i;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => localStorage.setItem('app:access-granted', '1'));
const problems = [];
let errors = [];
page.on('pageerror', e => errors.push(String(e)));
// GitHub Pages answers every deep link with 404.html (status 404) and the app
// takes over from there, so the page's own 404 is normal. Any other failed file is not.
page.on('console', m => m.type() === 'error' && !IGNORE.test(m.text()) && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
page.on('response', r => {
  if (r.status() >= 400 && !r.request().isNavigationRequest() && !IGNORE.test(r.url())) errors.push(`${r.status()} ${r.url()}`);
});

for (const path of PAGES) {
  errors = [];
  await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push(String(e)));
  await page.waitForTimeout(800);
  const text = await page.locator('body').innerText().catch(() => '');
  const flags = [];
  if (/Loading…|Loading\.\.\./.test(text)) flags.push('still loading');
  if (/\bundefined\b|\bNaN\b/.test(text)) flags.push('"undefined"/"NaN" on screen');
  if (/Failed to load|Something went wrong/i.test(text)) flags.push('error message on screen');
  if (errors.length) flags.push(`console: ${errors[0].slice(0, 120)}`);
  console.log(`${flags.length ? 'FAIL' : 'ok  '} /${path}${flags.length ? '  ' + flags.join('; ') : ''}`);
  if (flags.length) problems.push(path);
}

// Persona switching on the dashboard, whichever switcher this build has.
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
const strip = page.locator('app-persona-switcher .ps-btn');
const viaStrip = (await strip.count()) > 0;
const viaBanner = (await page.locator('app-claim-dev-banner [aria-label="More prototype settings"]').count()) > 0;
if (!viaStrip && !viaBanner) {
  console.log('FAIL dashboard: no way to switch user in this build');
  problems.push('persona');
} else if (viaStrip) {
  const names = await strip.allInnerTexts();
  for (let i = 0; i < names.length; i++) {
    await strip.nth(i).click();
    await page.waitForTimeout(500);
    const headline = await page.locator('.page-headline').innerText();
    const first = names[i].trim().split(/\s+/).slice(0, 2).join(' ');
    const ok = headline.includes(first);
    console.log(`${ok ? 'ok  ' : 'FAIL'} switch to ${first}: "${headline}"`);
    if (!ok) problems.push(`persona ${first}`);
  }
  await strip.nth(0).click();
} else {
  console.log('ok   dashboard: user switch is in the DEV banner menu');
}

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s) on ${BASE}` : `\nAll good on ${BASE}`);
process.exit(problems.length ? 1 : 0);
