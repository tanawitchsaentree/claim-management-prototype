import {
  ALL_CIRCUMSTANCES,
  circumstanceLabel,
  circumstanceOptionsFor,
  isCircumstanceValidFor,
  UNKNOWN_CIRCUMSTANCE_KEY,
} from './circumstances';

// Pure ref-data logic — no TestBed. Exercises the real function the FNOL field,
// the Claim Overview and the Section detail all read from.
describe('circumstanceOptionsFor', () => {
  const values = (causes: string[]) => circumstanceOptionsFor(causes).map(o => o.value);

  it('narrows to the selected peril and does not offer Unknown', () => {
    const offered = values(['lightning']);
    expect(offered).toEqual(['direct-strike', 'surge-secondary']);
    expect(offered).not.toContain(UNKNOWN_CIRCUMSTANCE_KEY);
  });

  it('unions the circumstances of several confirmed perils', () => {
    const offered = values(['lightning', 'burglary']);
    expect(offered).toEqual(['direct-strike', 'surge-secondary', 'forced-entry', 'unforced-entry']);
  });

  it('does not repeat a circumstance shared by two perils', () => {
    const offered = values(['fire', 'fire']);
    expect(offered.length).toBe(new Set(offered).size);
  });

  it('falls back to the full catalogue plus Unknown when no cause is chosen', () => {
    const offered = values([]);
    expect(offered).toEqual([...ALL_CIRCUMSTANCES.map(o => o.value), UNKNOWN_CIRCUMSTANCE_KEY]);
  });

  it('falls back to the full catalogue plus Unknown for "Other event"', () => {
    expect(values(['other-event'])).toContain(UNKNOWN_CIRCUMSTANCE_KEY);
  });

  it('falls back when any selected cause has no peril mapping, even alongside a mapped one', () => {
    const offered = values(['fire', 'event-involving-kaufmann']);
    expect(offered).toContain(UNKNOWN_CIRCUMSTANCE_KEY);
    expect(offered).toContain('forced-entry'); // a burglary circumstance — full list
  });
});

describe('isCircumstanceValidFor', () => {
  it('keeps a pick that the new cause still offers', () => {
    expect(isCircumstanceValidFor('direct-strike', ['lightning'])).toBe(true);
  });

  it('rejects a pick orphaned by a cause change, so the caller can clear it', () => {
    expect(isCircumstanceValidFor('direct-strike', ['burglary'])).toBe(false);
  });

  it('treats an empty pick as valid — nothing to clear', () => {
    expect(isCircumstanceValidFor(null, ['burglary'])).toBe(true);
  });

  it('rejects Unknown once a real peril narrowed the list', () => {
    expect(isCircumstanceValidFor(UNKNOWN_CIRCUMSTANCE_KEY, ['fire'])).toBe(false);
  });
});

describe('circumstanceLabel', () => {
  it('resolves a catalogue key', () => {
    expect(circumstanceLabel('hot-work')).toBe('Hot work (welding, cutting)');
  });

  it('resolves Unknown, which lives outside the catalogue', () => {
    expect(circumstanceLabel(UNKNOWN_CIRCUMSTANCE_KEY)).toBe('Unknown / not yet established');
  });

  it('falls back to the raw key rather than rendering blank', () => {
    expect(circumstanceLabel('key-from-a-future-rda-release')).toBe('key-from-a-future-rda-release');
  });

  it('renders empty for no value', () => {
    expect(circumstanceLabel(null)).toBe('');
  });
});
