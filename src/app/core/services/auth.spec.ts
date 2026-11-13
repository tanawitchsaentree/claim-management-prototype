import { TestBed } from '@angular/core/testing';
import { AuthService, PERSONAS } from './auth';

// Real behaviour tests for persona handling — input X (a persona id) → output Y
// (current user + isKcm flag). Handler, KCM and (BMPCC-22395) Claims Manager.
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('exposes the handler, KCM and Claims Manager personas', () => {
    expect(PERSONAS.length).toBe(3);
    expect(PERSONAS.map(p => p.dashboardRole).sort()).toEqual([
      'claims-handler',
      'claims-manager',
      'kcm'
    ]);
  });

  it('flags the Claims Manager persona', () => {
    service.setActivePersona('usr-tobias');
    expect(service.isClaimsManager()).toBe(true);
    expect(service.isKcm()).toBe(false);
  });

  it('defaults to the first persona (claims-handler) when nothing is stored', () => {
    expect(service.user().dashboardRole).toBe('claims-handler');
    expect(service.isKcm()).toBe(false);
  });

  it('switches persona by id and flips isKcm', () => {
    service.setActivePersona('usr-klaus'); // the KCM persona
    expect(service.user().id).toBe('usr-klaus');
    expect(service.isKcm()).toBe(true);
  });

  it('persists the active persona to localStorage', () => {
    service.setActivePersona('usr-klaus');
    expect(localStorage.getItem('dashboard:persona')).toBe('usr-klaus');
  });

  it('ignores an unknown persona id (no change)', () => {
    const before = service.user().id;
    service.setActivePersona('does-not-exist');
    expect(service.user().id).toBe(before);
  });
});
