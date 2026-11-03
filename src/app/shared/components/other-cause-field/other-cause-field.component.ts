import { Component, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxAutocompleteModule } from '@allianz/ng-aquila/autocomplete';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';

/**
 * "Other Event (please specify)": shown next to Cause of loss while "Other" is
 * selected. Free text with a type-ahead list of loss causes, copied from
 * production (claims-management-loss-events loss-information.component):
 * suggestions match the last word typed, and picking one replaces only that
 * last word, so "Fire after s" + "Solar Flare / Solar Storm" keeps "Fire after ".
 * Used by FNOL Loss information and Edit claim details so both behave the same.
 */
@Component({
  selector: 'app-other-cause-field',
  standalone: true,
  imports: [ReactiveFormsModule, NxFormfieldModule, NxInputModule, NxAutocompleteModule],
  templateUrl: './other-cause-field.component.html'
})
export class OtherCauseFieldComponent {
  private readonly lookupSvc = inject(MockLookupService);

  readonly control = input.required<FormControl<string | null>>();
  readonly showError = input(false);

  /** What the handler had typed before picking a suggestion. */
  private typed = '';

  readonly suggestions = (query: string): Observable<string[]> =>
    this.lookupSvc.getLossCauseSuggestions(query);

  readonly keepPrefix = (selected: string): string => {
    const trimmed = this.typed.trimEnd();
    const space = trimmed.lastIndexOf(' ');
    return (space >= 0 ? trimmed.slice(0, space + 1) : '') + selected;
  };

  onKeyUp(event: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Tab'].includes(event.key)) return;
    this.typed = (event.target as HTMLInputElement).value;
  }
}
