import { Pipe, PipeTransform } from '@angular/core';
import lookupsData from '../../core/mock/data/lookups.json';
import { Lookups } from '../../core/models/lookup.model';

const lookups = lookupsData as unknown as Lookups;

// Renders a ClaimSection.damageType key (from lookups.json's typeOfDamage —
// the single consolidated damage-type vocabulary) as its human label.
@Pipe({ name: 'damageTypeLabel', standalone: true })
export class DamageTypeLabelPipe implements PipeTransform {
  transform(value?: string): string {
    if (!value) return '–';
    return lookups.typeOfDamage.find(o => o.value === value)?.label ?? value;
  }
}
