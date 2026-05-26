import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { FnolDevHelperService, DevPage, FillResult } from '../../services/fnol-dev-helper.service';

const DEFAULT_SEARCH_PRESET = 'kaufmann-pol1';
const DEFAULT_LOSS_SCENARIO = 'fire';

@Component({
  selector: 'app-dev-helper-banner',
  standalone: true,
  imports: [
    CommonModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
  ],
  templateUrl: './dev-helper-banner.component.html',
  styleUrl:    './dev-helper-banner.component.scss',
})
export class DevHelperBannerComponent {
  private readonly helper = inject(FnolDevHelperService);

  readonly isVisible$   = of(true);
  readonly currentPage$ = this.helper.currentPage$;

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
          result = await this.helper.fillSearchForm(DEFAULT_SEARCH_PRESET);
          break;
        case 'loss-info':
          result = await this.helper.fillLossInfo(DEFAULT_LOSS_SCENARIO);
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
