import { ClaimSection } from '../../../core/models/section.model';
import { computeSectionImpacts } from './impacted-sections';

// Pure computation — no TestBed. Exercises the real function the Edit claim
// screen and its confirm modal both render from.
describe('computeSectionImpacts', () => {
  const section = (name: string, damageType: string, status: 'Open' | 'Closed', entities = 1): ClaimSection =>
    ({
      id: `sec-${name}`, claimId: 'CLM-1', name, damageType, status,
      expanded: false,
      entities: Array.from({ length: entities }, (_, i) => ({
        id: `ent-${i}`, name: `Entity ${i}`, instructionStatus: 'Pending', expandable: false,
      })),
      hasOpenDeductible: false, hasActiveLitigation: false, hasSubrogation: false,
      hasActiveSalvage: false, hasOpenReserves: false, hasOpenPayments: false,
      hasActiveProvider: false,
    }) as ClaimSection;

  const label = (k: string) => ({ 'material-damage': 'Material damage', 'business-interruption': 'Business interruption' }[k] ?? k);

  const sections = [
    section('Property Damage', 'material-damage', 'Open', 2),
    section('BI — Machinery', 'business-interruption', 'Closed'),
  ];

  it('names the open section carrying a damage type that is being removed', () => {
    const impacts = computeSectionImpacts({
      sections,
      originalDamageKeys: ['material-damage'],
      updatedDamageKeys: [],
      damageLabel: label,
      changedLabels: ['Type of damages'],
    });
    expect(impacts).toEqual([{
      kind: 'damage-removed', sectionName: 'Property Damage',
      damageLabel: 'Material damage', entityCount: 2,
    }]);
  });

  it('ignores closed sections — their coverage question was settled on closure', () => {
    const impacts = computeSectionImpacts({
      sections,
      originalDamageKeys: ['business-interruption'],
      updatedDamageKeys: [],
      damageLabel: label,
      changedLabels: ['Type of damages'],
    });
    expect(impacts).toEqual([]);
  });

  it('reports an added damage type as having no section yet', () => {
    const impacts = computeSectionImpacts({
      sections,
      originalDamageKeys: ['material-damage'],
      updatedDamageKeys: ['material-damage', 'business-interruption'],
      damageLabel: label,
      changedLabels: ['Type of damages'],
    });
    expect(impacts).toEqual([{
      kind: 'damage-added', sectionName: '',
      damageLabel: 'Business interruption', entityCount: 0,
    }]);
  });

  it('does not flag an added damage type that an open section already covers', () => {
    const impacts = computeSectionImpacts({
      sections,
      originalDamageKeys: [],
      updatedDamageKeys: ['material-damage'],
      damageLabel: label,
      changedLabels: ['Type of damages'],
    });
    expect(impacts).toEqual([]);
  });

  it('flags every open section for coverage re-check when cause of loss changes', () => {
    const impacts = computeSectionImpacts({
      sections,
      originalDamageKeys: ['material-damage'],
      updatedDamageKeys: ['material-damage'],
      damageLabel: label,
      changedLabels: ['Cause of loss'],
    });
    expect(impacts.map(i => [i.kind, i.sectionName])).toEqual([['coverage-review', 'Property Damage']]);
  });

  it('reports an orphaned section once, not twice, when damage AND cause both change', () => {
    const impacts = computeSectionImpacts({
      sections,
      originalDamageKeys: ['material-damage'],
      updatedDamageKeys: [],
      damageLabel: label,
      changedLabels: ['Type of damages', 'Cause of loss'],
    });
    expect(impacts.length).toBe(1);
    expect(impacts[0].kind).toBe('damage-removed');
  });

  it('stays empty for an update that touches neither damage type nor coverage inputs', () => {
    const impacts = computeSectionImpacts({
      sections,
      originalDamageKeys: ['material-damage'],
      updatedDamageKeys: ['material-damage'],
      damageLabel: label,
      changedLabels: ['Loss description'],
    });
    expect(impacts).toEqual([]);
  });
});
