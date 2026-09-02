import { Pipe, PipeTransform } from '@angular/core';
import { circumstanceLabel } from '../../features/fnol/config/circumstances';

// BMPCC-18160 — renders a stored incident-circumstance key as its human label.
// Every read-only surface (Claim Overview, Section detail, the Edit claim
// ledger) goes through here so a later RDA rename shows up in one place.
// Mirrors DamageTypeLabelPipe, including its '–' for an absent value.
@Pipe({ name: 'circumstanceLabel', standalone: true })
export class CircumstanceLabelPipe implements PipeTransform {
  transform(value?: string | null): string {
    return circumstanceLabel(value) || '–';
  }
}
