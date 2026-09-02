import { LookupOption, OTHER_CAUSE_KEY } from '../../../core/models';

// BMPCC-18160 — Incident circumstance.
//
// One circumstance per claim (single-select), dynamically filtered by the
// confirmed peril. Read-only wherever it is displayed outside FNOL.
//
// ASSUMPTION [CIRC-1]: this catalogue stands in for the real RDA circumstance
// ref-data, which is BMPCC-18146's deliverable ([BE] RDA configuration +
// Circumstance ref-data + peril mapping) and does not exist yet. Keys and
// peril mapping here are authored to be plausible, not authoritative — when
// 18146 lands, replace CIRCUMSTANCES_BY_CAUSE wholesale rather than patching it.
//
// ASSUMPTION [CIRC-2]: the ticket says "filtered by CONFIRMED peril" (singular)
// but FNOL captures cause of loss as an array. Reading it as a union: every
// circumstance mapped to any selected cause is offered. The user still picks
// exactly one.
//
// ASSUMPTION [CIRC-3]: "no CoL or other/unnamed -> full list + 'unknown'" is
// implemented as: causes empty, or causes include "Other event"
// (OTHER_CAUSE_KEY), or a cause with no mapping at all → the whole catalogue
// plus Unknown. Unknown is NOT offered when a real peril narrowed the list,
// so a handler who picked a peril has to say something about it.

export const UNKNOWN_CIRCUMSTANCE_KEY = 'unknown';

const UNKNOWN_OPTION: LookupOption = {
  value: UNKNOWN_CIRCUMSTANCE_KEY,
  label: 'Unknown / not yet established',
};

/** Peril → the circumstances that can sit underneath it. */
export const CIRCUMSTANCES_BY_CAUSE: Record<string, LookupOption[]> = {
  'fire': [
    { value: 'electrical-fault',       label: 'Electrical fault'                   },
    { value: 'hot-work',               label: 'Hot work (welding, cutting)'        },
    { value: 'cooking-appliance',      label: 'Cooking or heating appliance'       },
    { value: 'smoking-materials',      label: 'Smoking materials'                  },
    { value: 'spontaneous-combustion', label: 'Spontaneous combustion'             },
    { value: 'wildfire-spread',        label: 'Spread from an external wildfire'   },
  ],
  'lightning': [
    { value: 'direct-strike',   label: 'Direct strike'                      },
    { value: 'surge-secondary', label: 'Secondary surge damage'             },
  ],
  'explosion': [
    { value: 'gas-leak',           label: 'Gas leak'                        },
    { value: 'dust-explosion',     label: 'Dust explosion'                  },
    { value: 'boiler-rupture',     label: 'Boiler or pressure vessel rupture' },
    { value: 'chemical-reaction',  label: 'Uncontrolled chemical reaction'  },
  ],
  'aircraft-impact': [
    { value: 'aircraft-crash', label: 'Aircraft crash'          },
    { value: 'falling-parts',  label: 'Falling aircraft parts'  },
  ],
  'arson': [
    { value: 'intruder-arson',      label: 'Arson by intruder'         },
    { value: 'insider-arson',       label: 'Arson by insider'          },
    { value: 'civil-unrest-arson',  label: 'Arson during civil unrest' },
  ],
  'robbery': [
    { value: 'armed-robbery',      label: 'Armed robbery on premises' },
    { value: 'robbery-in-transit', label: 'Robbery in transit'        },
  ],
  'burglary': [
    { value: 'forced-entry',   label: 'Forced entry'     },
    { value: 'unforced-entry', label: 'Entry without force' },
  ],
  'theft': [
    { value: 'employee-theft',  label: 'Theft by employee'          },
    { value: 'theft-no-entry',  label: 'Theft without entry'        },
    { value: 'vehicle-theft',   label: 'Theft of or from a vehicle' },
  ],
  'natural-event': [
    { value: 'windstorm',           label: 'Windstorm'                 },
    { value: 'flood-surface-water', label: 'Flood or surface water'    },
    { value: 'hail',                label: 'Hail'                      },
    { value: 'snow-load',           label: 'Snow load'                 },
    { value: 'subsidence',          label: 'Subsidence or landslip'    },
  ],
  'earthquake': [
    { value: 'ground-shaking',    label: 'Ground shaking'         },
    { value: 'liquefaction',      label: 'Soil liquefaction'      },
    { value: 'tsunami-secondary', label: 'Secondary tsunami'      },
  ],
  'business-interruption': [
    { value: 'supplier-failure', label: 'Supplier failure'            },
    { value: 'utility-failure',  label: 'Utility failure'             },
    { value: 'access-denial',    label: 'Denial of access to premises' },
    { value: 'customer-failure', label: 'Customer premises loss'      },
  ],
  'act-of-piracy': [
    { value: 'vessel-hijack', label: 'Vessel hijacked' },
    { value: 'cargo-seizure', label: 'Cargo seized'    },
  ],
  'act-of-omission': [
    { value: 'maintenance-omission',  label: 'Maintenance not carried out'  },
    { value: 'procedure-not-followed', label: 'Procedure not followed'      },
  ],
  'product-fault': [
    { value: 'design-defect',        label: 'Design defect'        },
    { value: 'manufacturing-defect', label: 'Manufacturing defect' },
    { value: 'component-failure',    label: 'Bought-in component failure' },
    { value: 'contamination',        label: 'Contamination'        },
  ],
  // 'event-involving-kaufmann' and OTHER_CAUSE_KEY are deliberately absent:
  // neither names a peril specific enough to narrow the list, so both fall
  // through to the full catalogue (see ASSUMPTION [CIRC-3]).
};

/** Every circumstance in the catalogue, de-duplicated, catalogue order. */
export const ALL_CIRCUMSTANCES: LookupOption[] = (() => {
  const seen = new Set<string>();
  const all: LookupOption[] = [];
  for (const options of Object.values(CIRCUMSTANCES_BY_CAUSE)) {
    for (const option of options) {
      if (seen.has(option.value)) continue;
      seen.add(option.value);
      all.push(option);
    }
  }
  return all;
})();

/**
 * The circumstances offered for a given cause-of-loss selection.
 *
 * Narrowed to the union of the selected perils' circumstances. Falls back to
 * the full catalogue plus Unknown when nothing narrows it — no cause chosen
 * yet, "Other event" chosen, or a cause with no mapping.
 */
export function circumstanceOptionsFor(causes: readonly string[]): LookupOption[] {
  const selected = causes ?? [];
  const unnamed = selected.length === 0
    || selected.includes(OTHER_CAUSE_KEY)
    || selected.some(cause => !CIRCUMSTANCES_BY_CAUSE[cause]);
  if (unnamed) return [...ALL_CIRCUMSTANCES, UNKNOWN_OPTION];

  const seen = new Set<string>();
  const narrowed: LookupOption[] = [];
  for (const cause of selected) {
    for (const option of CIRCUMSTANCES_BY_CAUSE[cause] ?? []) {
      if (seen.has(option.value)) continue;
      seen.add(option.value);
      narrowed.push(option);
    }
  }
  return narrowed;
}

/** True when `key` is still offered for `causes` — used to clear a stale pick. */
export function isCircumstanceValidFor(key: string | null, causes: readonly string[]): boolean {
  if (!key) return true;
  return circumstanceOptionsFor(causes).some(option => option.value === key);
}

/** Display label for a stored key. Falls back to the key so nothing renders blank. */
export function circumstanceLabel(key: string | null | undefined): string {
  if (!key) return '';
  if (key === UNKNOWN_CIRCUMSTANCE_KEY) return UNKNOWN_OPTION.label;
  return ALL_CIRCUMSTANCES.find(option => option.value === key)?.label ?? key;
}
