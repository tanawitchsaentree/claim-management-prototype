import { Pipe, PipeTransform } from '@angular/core';
import lookupsData from '../../core/mock/data/lookups.json';
import { Lookups } from '../../core/models/lookup.model';

const lookups = lookupsData as unknown as Lookups;

// Renders a SectionEntity.cbiCaseType key (from lookups.json's cbiCaseTypes)
// as its human label — same pattern as DamageTypeLabelPipe.
@Pipe({ name: 'cbiCaseTypeLabel', standalone: true })
export class CbiCaseTypeLabelPipe implements PipeTransform {
  transform(value?: string): string {
    if (!value) return '–';
    return lookups.cbiCaseTypes.find(o => o.value === value)?.label ?? value;
  }
}
