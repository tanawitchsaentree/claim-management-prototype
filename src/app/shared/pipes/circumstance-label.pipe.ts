import { Pipe, PipeTransform } from '@angular/core';
import lookupsData from '../../core/mock/data/lookups.json';
import { Lookups } from '../../core/models/lookup.model';

const lookups = lookupsData as unknown as Lookups;
const ALL_CIRCUMSTANCES = [
  ...Object.values(lookups.circumstances.byPeril).flat(),
  ...lookups.circumstances.fallback,
];

// BMPCC-18160: renders the stored circumstance value (a lookup slug) as its
// human label, read-only, for the Section Overview table and entity detail.
@Pipe({ name: 'circumstanceLabel', standalone: true })
export class CircumstanceLabelPipe implements PipeTransform {
  transform(value?: string): string {
    if (!value) return '–';
    return ALL_CIRCUMSTANCES.find(o => o.value === value)?.label ?? value;
  }
}
