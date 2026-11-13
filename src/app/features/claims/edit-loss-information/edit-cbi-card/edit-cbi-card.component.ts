import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { LocationPickerOutput, LookupOption } from '../../../../core/models';
import { LossInformation } from '../../../../core/models/loss-information.model';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { CbiPanelComponent } from '../../../../shared/components/cbi-panel/cbi-panel.component';
import { CbiValues, cbiDisplayRows, cbiReadLabel } from '../cbi-edit';

interface CbiReadRow {
  label: string;
  value: string;
  was: string | null;
}

// DESIGN DECISION CBI-EDIT-1 (BMPCC-18492): CBI gets its own card on Edit
// claim details, directly under Loss information (it refines that card's Type
// of damage) and above Locations of loss. Read-first like every other field
// on the page: answers as label/value rows with an Edit button; editing
// reuses the FNOL question block (app-cbi-panel) so the questions read the
// same before and after registration. It commits through the page's one
// Update button and its Field / Original / Updated confirm, never on its own.
@Component({
  selector: 'app-edit-cbi-card',
  standalone: true,
  imports: [NxButtonModule, NxIconModule, CbiPanelComponent],
  templateUrl: './edit-cbi-card.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './edit-cbi-card.component.scss'
})
export class EditCbiCardComponent {
  readonly form = input.required<FormGroup>();
  readonly cbiLocation = input.required<FormControl<LocationPickerOutput>>();
  readonly caseTypeOptions = input.required<LookupOption[]>();
  readonly original = input<LossInformation | null>(null);
  readonly editing = input(false);
  readonly changed = input(false);
  readonly submitAttempted = input(false);

  readonly edit = output<void>();
  readonly cancelEdit = output<void>();
  readonly answerChange = output<void>();

  private readonly labels = {
    caseTypes: inject(MockLookupService).getCbiCaseTypesSync(),
    utilityTypes: inject(MockLookupService).getCbiUtilityTypesSync()
  };

  get answered(): boolean {
    return !!this.form().get('cbiApplicable')?.value;
  }

  /** Only the answers that apply: an empty detail row would read as "missing". */
  get rows(): CbiReadRow[] {
    const cur = { ...this.form().getRawValue(), cbiLocation: this.cbiLocation().value } as CbiValues;
    const before = cbiDisplayRows((this.original() ?? {}) as CbiValues, this.labels);
    const caseType = cur.cbiCaseType;
    return cbiDisplayRows(cur, this.labels)
      .map((row, i) => ({
        label: cbiReadLabel(row.label, caseType),
        value: row.value,
        was: before[i].value !== row.value ? before[i].value || 'Not provided' : null
      }))
      .filter((row, i) => i === 0 || row.value || row.was);
  }
}
