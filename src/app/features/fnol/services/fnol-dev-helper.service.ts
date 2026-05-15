import { Injectable, inject, isDevMode } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Observable, filter, map, startWith, firstValueFrom } from 'rxjs';
import { SEARCH_PRESETS, SearchPreset } from '../config/search-presets';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { FnolStateService } from './fnol-state.service';
import { MockPolicyLocationService } from '../../../core/mock/services/mock-policy-location.service';
import { MockEntitiesDamagesService } from '../../../core/mock/services/mock-entities-damages.service';
import { LocationItem } from '../../../core/models';
import { SCENARIOS, DevScenario } from '../config/dev-scenarios';

export type DevPage = 'search' | 'loss-info' | 'entities' | 'parties' | 'reserves' | 'summary' | 'other';

export interface FillResult {
  success: boolean;
  message: string;
  warnings?: string[];
}

@Injectable({ providedIn: 'root' })
export class FnolDevHelperService {
  private readonly router      = inject(Router);
  private readonly fnolState   = inject(FnolStateService);
  private readonly locationSvc = inject(MockPolicyLocationService);
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);

  get isEnabled(): boolean { return isDevMode(); }

  readonly currentPage$: Observable<DevPage> = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(e => this.detectPage(e.urlAfterRedirects)),
    startWith(this.detectPage(this.router.url)),
  );

  private detectPage(url: string): DevPage {
    if (url.includes('/fnol/search'))            return 'search';
    if (url.includes('/fnol/loss-information'))  return 'loss-info';
    if (url.includes('/fnol/entities-damages'))  return 'entities';
    if (url.includes('/fnol/parties'))           return 'parties';
    if (url.includes('/fnol/reserves'))          return 'reserves';
    if (url.includes('/fnol/summary'))           return 'summary';
    return 'other';
  }

  // ── SEARCH PAGE ───────────────────────────────────────────────────────────

  fillSearchForm(presetKey: string): FillResult {
    const key    = (presetKey === 'auto') ? 'kaufmann-pol1' : presetKey;
    const preset = SEARCH_PRESETS[key] ?? SEARCH_PRESETS['kaufmann-pol1'];
    const policyNumber = preset.policyNumber ?? '';

    // Set selectedPolicy so downstream steps (reserves etc.) have context
    if (policyNumber) {
      this.fnolState.setSelectedPolicy(
        { policyId: policyNumber, policyNumber },
      );
      this.fnolState.path = 'standard';
    }

    this.fnolState.devSearchFill$.next({
      policyNumber,
      clientName: preset.clientName ?? '',
    });

    return { success: true, message: `Filling: ${preset.label}` };
  }

  // ── LOSS INFO PAGE ────────────────────────────────────────────────────────

  async fillLossInfo(scenarioKey: string): Promise<FillResult> {
    const hasContext = !!(this.fnolState.selectedPolicy || this.fnolState.selectedClient);
    if (!hasContext) {
      return { success: false, message: 'No client or policy selected — go to Search first' };
    }

    const scenario: DevScenario | undefined = SCENARIOS[scenarioKey] ?? SCENARIOS['fire'];
    if (!scenario) {
      return { success: false, message: `Unknown scenario: ${scenarioKey}` };
    }

    const warnings: string[] = [];
    const lossInfo = this.fnolState.fnolForm.get('lossInformation') as FormGroup;

    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const minus3 = new Date(today); minus3.setDate(today.getDate() - 3);
    const minus1 = new Date(today); minus1.setDate(today.getDate() - 1);

    lossInfo.patchValue({
      dateOfLoss: {
        dateOfOccurrence:   fmt(minus3),
        timeOfOccurrence:   '14:30',
        dateOfNotification: fmt(minus1),
        timeOfNotification: '10:00',
      },
      causeOfLoss:     scenario.causeOfLoss,
      typeOfDamage:    scenario.typeOfDamage,
      lossDescription: scenario.description,
    });

    // Location — try real policy locations
    const policyNumber = this.fnolState.selectedPolicy?.policyNumber ?? '';
    try {
      const locs = await firstValueFrom(this.locationSvc.getByPolicyNumber(policyNumber));
      if (locs.length > 0) {
        const loc = locs[0];
        const item: LocationItem = {
          id:          loc.id,
          source:      'policy',
          displayName: loc.name,
          addressLine1: loc.addressLine1,
          postalCode:  loc.postalCode,
          city:        loc.city,
          country:     loc.country,
          propertyId:  loc.propertyId,
          policyLocationRef: loc.id,
        };
        this.fnolState.getLossLocationControl().setValue({ locations: [item] });
      } else {
        warnings.push(`Policy ${policyNumber} has no listed locations — used manual address`);
        this.fnolState.getLossLocationControl().setValue({
          locations: [{
            id: 'dev-manual-001', source: 'manual',
            displayName: 'Demo Hauptstraße 1, München',
            addressLine1: 'Demo Hauptstraße 1',
            postalCode: '80331', city: 'München', country: 'DE',
          }],
        });
      }
    } catch {
      warnings.push('Failed to fetch policy locations — used manual address');
      this.fnolState.getLossLocationControl().setValue({ locations: [] });
    }

    // Rebuild events array
    const eventsArray = this.fnolState.getLossEventsArray();
    eventsArray.clear();
    scenario.causeOfLoss.forEach(causeKey => {
      eventsArray.push(new FormGroup({
        eventKey: new FormControl(causeKey),
        causedBy: new FormControl(scenario.eventCausedBy?.[causeKey] ?? []),
        damages:  new FormControl(scenario.typeOfDamage),
      }));
    });

    lossInfo.markAllAsTouched();
    lossInfo.updateValueAndValidity();

    if (lossInfo.invalid) {
      return { success: false, message: 'Form filled but validation failed', warnings };
    }

    return {
      success: true,
      message: `Filled: ${scenario.label}`,
      warnings: warnings.length ? warnings : undefined,
    };
  }

  // ── ENTITIES PAGE ─────────────────────────────────────────────────────────

  async fillEntities(): Promise<FillResult> {
    const policyNumber = this.fnolState.selectedPolicy?.policyNumber;
    if (!policyNumber) {
      return { success: false, message: 'No policy selected' };
    }

    try {
      const data = await firstValueFrom(this.entitiesSvc.getByPolicyId(policyNumber));
      if (!data.sections.length) {
        return { success: false, message: `No entity data for ${policyNumber}` };
      }

      const section = data.sections.find(s => s.promiseStatus === 'possibly-promised')
        ?? data.sections[0];
      const group   = section.damageGroups[0];
      const entity  = group?.entities[0];

      if (!entity) {
        return { success: false, message: 'No entities in first group' };
      }

      entity.selected = true;
      if (entity.subItems?.length) {
        entity.subItems.forEach(s => s.selected = true);
      }

      return { success: true, message: `Selected: ${entity.name}` };
    } catch {
      return { success: false, message: `Failed to load entities for ${policyNumber}` };
    }
  }

  // ── READINESS CHECK ───────────────────────────────────────────────────────

  isReady(page: DevPage): boolean {
    if (page === 'search')    return true;
    if (page === 'loss-info') return !!(this.fnolState.selectedPolicy || this.fnolState.selectedClient);
    if (page === 'entities')  return !!this.fnolState.selectedPolicy;
    return false;
  }
}
