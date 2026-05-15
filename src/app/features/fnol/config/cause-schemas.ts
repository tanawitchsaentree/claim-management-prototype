import { LookupOption } from '../../../core/models';

export interface CauseSchema {
  causeKey: string;
  causeLabel: string;
  causedByOptions?: LookupOption[];
  /** true = render per-event date/time fields; false = inherits top-level DOL */
  hasOwnDates: boolean;
  /** true = render per-event location placeholder */
  hasOwnLocation: boolean;
}

export const DEFAULT_CAUSE_SCHEMA: Omit<CauseSchema, 'causeKey' | 'causeLabel'> = {
  hasOwnDates: false,
  hasOwnLocation: false,
};

export const CAUSE_SCHEMAS: Record<string, CauseSchema> = {
  'fire': {
    causeKey: 'fire',
    causeLabel: 'Fire',
    causedByOptions: [
      { value: 'arson', label: 'Arson' },
      { value: 'other', label: 'Other' },
    ],
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'lightning': {
    causeKey: 'lightning',
    causeLabel: 'Lightning',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'explosion': {
    causeKey: 'explosion',
    causeLabel: 'Explosion',
    causedByOptions: [
      { value: 'gas-leak',            label: 'Gas leak'            },
      { value: 'industrial-accident', label: 'Industrial accident' },
      { value: 'other',               label: 'Other'               },
    ],
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'aircraft-impact': {
    causeKey: 'aircraft-impact',
    causeLabel: 'Aircraft Impact',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'arson': {
    causeKey: 'arson',
    causeLabel: 'Arson',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'robbery': {
    causeKey: 'robbery',
    causeLabel: 'Robbery',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'burglary': {
    causeKey: 'burglary',
    causeLabel: 'Burglary',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'theft': {
    causeKey: 'theft',
    causeLabel: 'Theft',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'natural-event': {
    causeKey: 'natural-event',
    causeLabel: 'Natural Event',
    causedByOptions: [
      { value: 'storm',      label: 'Storm'      },
      { value: 'flood',      label: 'Flood'      },
      { value: 'earthquake', label: 'Earthquake' },
      { value: 'other',      label: 'Other'      },
    ],
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'earthquake': {
    causeKey: 'earthquake',
    causeLabel: 'Earthquake',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'business-interruption': {
    causeKey: 'business-interruption',
    causeLabel: 'Business Interruption',
    causedByOptions: [
      { value: 'fire',  label: 'Fire'  },
      { value: 'other', label: 'Other' },
    ],
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'act-of-piracy': {
    causeKey: 'act-of-piracy',
    causeLabel: 'Act of Piracy',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'act-of-omission': {
    causeKey: 'act-of-omission',
    causeLabel: 'Act of Omission',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'event-involving-kaufmann': {
    causeKey: 'event-involving-kaufmann',
    causeLabel: "Event involving Kaufmann's Company or Kaufmann's Business",
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'product-fault': {
    causeKey: 'product-fault',
    causeLabel: 'Product Fault',
    hasOwnDates: false,
    hasOwnLocation: false,
  },
  'other-event': {
    causeKey: 'other-event',
    causeLabel: 'Other Event',
    causedByOptions: [
      { value: 'specify', label: 'Please specify' },
      { value: 'other',   label: 'Other'          },
    ],
    hasOwnDates: false,
    hasOwnLocation: false,
  },
};

export function getCauseSchema(causeKey: string): CauseSchema | null {
  return CAUSE_SCHEMAS[causeKey] ?? null;
}
