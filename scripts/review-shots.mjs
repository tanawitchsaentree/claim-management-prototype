#!/usr/bin/env node
/**
 * review-shots.mjs - one review page per ticket: every scenario (AC) opened with
 * its own setup, screenshotted, next to what it should show. This is the visual
 * gate: the owner looks at pictures, not at a written report.
 *
 *   npm start                                    # dev server on :4200
 *   npm run shots -- BMPCC-22665                 # this computer only
 *   npm run shots -- BMPCC-22665 --live          # + the deployed team link, side by side
 *   npm run shots -- BMPCC-22665 --ac AC-03      # one scenario
 *
 * Output: review/<ticket>/index.html (+ PNGs). review/ is git-ignored.
 * Each scenario opens <route>?pt=<ticket>&ac=<AC> (PrototypeEntryService), so
 * the same link works on the dev server and on the deployed build. Overlays that
 * are not part of the product (DEV banner, arrival panel, tour) are hidden in the
 * picture. A scenario is flagged when the page crashed, logged an error, showed
 * "undefined"/"NaN", or the landed route differs from the AC's route.
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const ticketArg = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--ac');
const onlyAc = args.includes('--ac') ? args[args.indexOf('--ac') + 1] : null;
const withLive = args.includes('--live');
if (!ticketArg) {
  console.error('Usage: npm run shots -- <TICKET-ID> [--live] [--ac AC-03]');
  process.exit(1);
}

const DEV = (process.env.BASE_URL ?? 'http://localhost:4200').replace(/\/$/, '');
const LIVE = 'https://tanawitchsaentree.github.io/claim-management-prototype';
const index = JSON.parse(readFileSync('public/tickets/index.json', 'utf8')).tickets;
const entry = index.find(t => t.id.toLowerCase() === ticketArg.toLowerCase());
if (!entry) {
  console.error(`No ticket "${ticketArg}" in public/tickets/index.json`);
  process.exit(1);
}
const ticket = JSON.parse(readFileSync(join('public/tickets', entry.file), 'utf8'));
const acs = ticket.acceptanceCriteria.filter(a => (onlyAc ? a.id === onlyAc : a.buildStatus !== 'todo'));
const outDir = join('review', ticket.ticketId);
if (!onlyAc) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const HIDE = '.dev-banner-row, app-arrival-panel, app-tour-step-renderer, .exploration-banner { display: none !important; }';
const IGNORE = /ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|supabase|Failed to load resource/i;
const targets = [{ key: 'dev', label: 'This computer', base: DEV }];
if (withLive) targets.push({ key: 'live', label: 'Team link', base: LIVE });

// Text of the page itself (DEV banner excluded) once it stops changing: some
// scenarios seed a lot of state and take several seconds to draw. Max 15s.
async function settled(page) {
  const read = () =>
    page
      .evaluate(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('.dev-banner-row, app-arrival-panel, app-tour-step-renderer').forEach(n => n.remove());
        return clone.innerText ?? clone.textContent ?? '';
      })
      .catch(() => '');
  let last = await read();
  let stableFor = 0;
  for (let waited = 0; waited < 15000; waited += 500) {
    await page.waitForTimeout(500);
    const now = await read();
    stableFor = now.length === last.length && now.length > 100 ? stableFor + 500 : 0;
    last = now;
    if (stableFor >= 1500) break;
  }
  return last;
}

const browser = await chromium.launch();
const results = [];

for (const ac of acs) {
  const route = ac.howToTest?.route ?? '/dashboard';
  const shots = [];
  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => localStorage.setItem('app:access-granted', '1'));
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    page.on('console', m => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(m.text().slice(0, 200)));
    const url = `${t.base}${route}?pt=${encodeURIComponent(ticket.ticketId)}&ac=${encodeURIComponent(ac.id)}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => errors.push(String(e).slice(0, 200)));
    await page.addStyleTag({ content: HIDE }).catch(() => {});
    const text = await settled(page);
    const landed = new URL(page.url()).pathname.replace(/^\/claim-management-prototype/, '');
    const flags = [...errors];
    if (text.length < 100) flags.push('blank or almost empty page');
    if (/\bundefined\b|\bNaN\b/.test(text)) flags.push('"undefined" or "NaN" on screen');
    if (landed !== route) flags.push(`landed on ${landed}, expected ${route}`);
    const file = `${ac.id}-${t.key}.png`;
    await page.screenshot({ path: join(outDir, file), fullPage: true });
    await page.close();
    shots.push({ ...t, file, flags, url });
  }
  const ok = shots.every(s => !s.flags.length);
  console.log(`${ok ? 'ok  ' : 'FLAG'} ${ac.id} ${route}${ok ? '' : '  ' + shots.flatMap(s => s.flags).join('; ')}`);
  results.push({ ac, route, shots, ok });
}
await browser.close();

// Scenarios whose landing screen is pixel-identical differ only after a click
// (the AC's "How to try it"). Say so, so an identical picture is not mistaken
// for a scenario that was checked.
const firstWithHash = new Map();
for (const r of results) {
  const dev = r.shots[0];
  const hash = createHash('md5').update(readFileSync(join(outDir, dev.file))).digest('hex');
  if (firstWithHash.has(hash)) r.sameAs = firstWithHash.get(hash);
  else firstWithHash.set(hash, r.ac.id);
}
const needsClick = results.filter(r => r.sameAs).length;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
const flagged = results.filter(r => !r.ok).length;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(ticket.ticketId)} review</title>
<style>
body{font:15px/1.5 -apple-system,system-ui,sans-serif;margin:0;background:#f5f5f5;color:#222}
header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:16px 32px;z-index:2}
h1{font-size:20px;margin:0}.sub{color:#666;margin-top:4px}
nav a{margin-right:10px;font-size:13px;color:#006192;text-decoration:none}nav a.bad{color:#b00020;font-weight:600}
section{scroll-margin-top:110px;background:#fff;margin:24px 32px;border:1px solid #ddd;border-radius:6px;padding:20px}
section.bad{border-color:#b00020}
h2{font-size:17px;margin:0 0 8px}.route{font:13px monospace;color:#666}
.expect{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0}
.box{background:#fafafa;border-radius:4px;padding:10px 12px}.box b.t{display:block;font-size:13px;color:#666;margin-bottom:4px}
ul{margin:0;padding-left:18px}.flag{color:#b00020;font-weight:600}
.shots{display:grid;grid-template-columns:repeat(${targets.length},1fr);gap:16px}
.shots figure{margin:0}.shots figcaption{font-size:13px;color:#666;margin-bottom:4px}
.note{background:#fff4e5;border-left:3px solid #c77700;padding:8px 12px;margin:10px 0;border-radius:2px}
.shots img{width:100%;border:1px solid #ccc;border-radius:4px;cursor:zoom-in}
</style></head><body>
<header><h1>${esc(ticket.ticketId)}: ${esc(ticket.title)}</h1>
<div class="sub">${results.length} scenario(s) checked, ${flagged ? `<span class="flag">${flagged} flagged</span>` : 'nothing flagged'}${needsClick ? `, ${needsClick} need a click to see (marked)` : ''}. ${esc(new Date().toLocaleString())}</div>
<nav>${results.map(r => `<a href="#${r.ac.id}" class="${r.ok ? '' : 'bad'}">${esc(r.ac.id)}</a>`).join('')}</nav></header>
${results.map(r => `<section id="${r.ac.id}" class="${r.ok ? '' : 'bad'}">
<h2>${esc(r.ac.id)} ${r.ok ? '' : '<span class="flag">needs a look</span>'}</h2>
<div>${md(r.ac.plainStatement ?? r.ac.statement)}</div>
<div class="route">${esc(r.route)}</div>
${r.sameAs ? `<div class="note">Same starting screen as ${esc(r.sameAs)}. This scenario shows up only after: <b>${esc(r.ac.howToTest?.trigger)}</b>. Open the link and do that step.</div>` : ''}
<div class="route"><a href="${esc(r.shots[0].url)}" target="_blank">Open this scenario</a></div>
<div class="expect">
<div class="box"><b class="t">Should show</b>${esc(r.ac.expectedUI?.description)}${r.ac.expectedUI?.visualCues?.length ? `<ul>${r.ac.expectedUI.visualCues.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}</div>
<div class="box"><b class="t">How to try it</b>${esc(r.ac.howToTest?.trigger)}<br><b class="t" style="margin-top:6px">Expected</b>${esc(r.ac.howToTest?.expectedResult)}</div>
</div>
<div class="shots">${r.shots.map(s => `<figure><figcaption>${esc(s.label)} ${s.flags.map(f => `<div class="flag">${esc(f)}</div>`).join('')}</figcaption><a href="${s.file}" target="_blank"><img src="${s.file}" loading="lazy"></a></figure>`).join('')}</div>
</section>`).join('')}
</body></html>`;
writeFileSync(join(outDir, 'index.html'), html);
console.log(`\n${results.length} scenario(s), ${flagged} flagged, ${needsClick} same as another until clicked. Review page: ${join(outDir, 'index.html')}`);
if (!process.env.NO_OPEN) {
  try { execSync(`open "${join(outDir, 'index.html')}"`); } catch { /* not macOS */ }
}
process.exit(flagged ? 1 : 0);
