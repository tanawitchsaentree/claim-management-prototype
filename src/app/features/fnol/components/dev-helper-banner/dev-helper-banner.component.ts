import { Component, inject, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { of } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { FnolDevHelperService, DevPage, FillResult } from '../../services/fnol-dev-helper.service';
import { SCENARIO_LIST } from '../../config/dev-scenarios';

@Component({
  selector: 'app-dev-helper-banner',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxIconModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxSpinnerModule,
  ],
  templateUrl: './dev-helper-banner.component.html',
  styleUrl:    './dev-helper-banner.component.scss',
})
export class DevHelperBannerComponent {
  private readonly helper = inject(FnolDevHelperService);

  readonly isVisible$   = of(isDevMode());
  readonly currentPage$ = this.helper.currentPage$;
  readonly scenarios    = SCENARIO_LIST;

  readonly presets = [
    { value: 'kaufmann-pol1', label: 'Liver Tea Group — POL-2024-001' },
    { value: 'kaufmann-pol6', label: 'Schäfer & Söhne — POL-2024-006' },
  ];

  readonly presetCtrl = new FormControl('kaufmann-pol1');
  readonly scenarioCtrl = new FormControl('fire');

  filling    = false;
  lastResult: FillResult | null = null;
  showResult = false;

  isReady(page: DevPage): boolean {
    return this.helper.isReady(page);
  }

  async onFill(page: DevPage): Promise<void> {
    if (this.filling) return;
    this.filling = true;
    this.showResult = false;
    try {
      let result: FillResult;
      switch (page) {
        case 'search':
          result = await this.helper.fillSearchForm(this.presetCtrl.value ?? 'auto');
          break;
        case 'loss-info':
          result = await this.helper.fillLossInfo(this.scenarioCtrl.value ?? 'fire');
          break;
        case 'entities':
          result = await this.helper.fillEntities();
          break;
        default:
          return;
      }
      this.lastResult = result;
    } finally {
      this.filling = false;
      this.showResult = true;
      setTimeout(() => { this.showResult = false; }, 4000);
    }
  }
}
