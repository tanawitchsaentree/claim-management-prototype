import { TestBed } from '@angular/core/testing';
import { TrackerViewerService } from './tracker-viewer.service';

// Same shape as auth.spec.ts — clear localStorage, inject fresh, assert on the
// signals rather than on internals. crypto.subtle is available in the Vitest
// browser-less environment via node:crypto's webcrypto global.
describe('TrackerViewerService', () => {
  function make(): TrackerViewerService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(TrackerViewerService);
  }

  beforeEach(() => localStorage.clear());

  it('defaults to the team viewer', () => {
    const service = make();
    expect(service.viewer()).toBe('team');
    expect(service.isOwner()).toBe(false);
  });

  it('unlocks with the correct password', async () => {
    const service = make();
    await expect(service.unlock('isabelle')).resolves.toBe(true);
    expect(service.isOwner()).toBe(true);
  });

  it('ignores surrounding whitespace so a pasted password still works', async () => {
    const service = make();
    await expect(service.unlock('  isabelle  ')).resolves.toBe(true);
    expect(service.isOwner()).toBe(true);
  });

  it('rejects a wrong password and stays on the team viewer', async () => {
    const service = make();
    await expect(service.unlock('Isabelle')).resolves.toBe(false);
    await expect(service.unlock('')).resolves.toBe(false);
    expect(service.isOwner()).toBe(false);
    expect(localStorage.getItem('tracker:viewer')).toBeNull();
  });

  it('remembers the unlock across a reload', async () => {
    await make().unlock('isabelle');
    expect(localStorage.getItem('tracker:viewer')).toBe('owner');
    // Second instance = a fresh page load reading the same localStorage.
    expect(make().isOwner()).toBe(true);
  });

  it('forgets the unlock on lock', async () => {
    const service = make();
    await service.unlock('isabelle');
    service.lock();
    expect(service.isOwner()).toBe(false);
    expect(localStorage.getItem('tracker:viewer')).toBeNull();
    expect(make().isOwner()).toBe(false);
  });
});
