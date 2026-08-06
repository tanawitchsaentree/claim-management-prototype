#!/usr/bin/env node
// audit:ac-route-overrides — ensure every AC's `howToTest.route` is reachable
// given the AC's `setup.stateOverrides`. Catches the "BMPCC-219 didn't navigate"
// class of bug at commit time instead of in the user's face.
//
// Routing guards in this app (as of 2026-05-20):
//   /fnol/loss-information    → step-loss-information.ts:122 redirects to
//                                /fnol/search if !selectedPolicy && !selectedClient
//   /fnol/skeleton-create     → no guard, but the wizard sidebar / FnolStateService.path
//                                must be 'orphan' for the correct stepper to render
//   /fnol/skeleton-summary    → same as skeleton-create
//
// Add new guard rules below as they appear.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const TICKET_DIR = join(__dirname, '..', 'public', 'tickets');

const RULES = [
  {
    route: '/fnol/loss-information',
    requires: (ovr) =>
      !!ovr?.fnolStateOverride?.selectedPolicy ||
      !!ovr?.fnolStateOverride?.selectedClient,
    message: 'route /fnol/loss-information requires fnolStateOverride.selectedPolicy or selectedClient (otherwise step-loss-information redirects to /fnol/search)',
  },
  {
    route: '/fnol/skeleton-create',
    requires: (ovr) => ovr?.fnolStateOverride?.path === 'orphan',
    message: 'route /fnol/skeleton-create requires fnolStateOverride.path === "orphan" (otherwise wizard sidebar shows the wrong steps)',
  },
  {
    route: '/fnol/skeleton-summary',
    requires: (ovr) => ovr?.fnolStateOverride?.path === 'orphan',
    message: 'route /fnol/skeleton-summary requires fnolStateOverride.path === "orphan"',
  },
];

const violations = [];

for (const file of readdirSync(TICKET_DIR)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  const ticket = JSON.parse(readFileSync(join(TICKET_DIR, file), 'utf8'));

  for (const ac of ticket.acceptanceCriteria || []) {
    const route = ac.howToTest?.route;
    if (!route) continue;
    const rule = RULES.find(r => r.route === route);
    if (!rule) continue;
    if (!rule.requires(ac.setup?.stateOverrides)) {
      violations.push(`${file} :: ${ac.id} (${route}) — ${rule.message}`);
    }
  }
}

if (violations.length > 0) {
  console.error('\n✘ audit:ac-route-overrides — violations found:\n');
  for (const v of violations) console.error('  •', v);
  console.error(`\n${violations.length} AC route(s) would redirect after Apply & Navigate.`);
  console.error('Add the missing override under acceptanceCriteria[i].setup.stateOverrides.\n');
  process.exit(1);
}

console.log('✓ audit:ac-route-overrides — all AC routes reachable');
