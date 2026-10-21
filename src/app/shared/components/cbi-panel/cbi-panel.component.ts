import { Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { LocationPickerOutput, LookupOption } from '../../../core/models';
import { LocationPickerComponent } from '../location-picker/location-picker.component';
import {
  cbiIndustryLabel,
  cbiShowThirdPartyName,
  cbiThirdPartyLabel
} from '../../utils/cbi-rules';

// The CBI question block, as FNOL's Loss information step shows it: the trigger
// question, then the case type, third party and originating location. The
// parent form owns the controls (cbiApplicable, cbiCaseType, cbiThirdPartyName,
// cbiThirdPartyIndustry) and the location control; the parent decides whether
// to render this at all (Business Interruption selected).
@Component({
  selector: 'app-cbi-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxInputModule,
    NxRadioModule,
    LocationPickerComponent
  ],
  templateUrl: './cbi-panel.component.html',
  styleUrl: './cbi-panel.component.scss'
})
export class CbiPanelComponent {
  readonly form = input.required<FormGroup>();
  readonly cbiLocation = input.required<FormControl<LocationPickerOutput>>();
  readonly caseTypeOptions = input.required<LookupOption[]>();
  readonly submitAttempted = input(false);
  /** Fires after an answer changes, so the parent can re-sync validators. */
  readonly answerChange = output<void>();

  get applicable(): 'yes' | 'no' | null {
    return (this.form().get('cbiApplicable')?.value as 'yes' | 'no' | null) ?? null;
  }

  get caseType(): string | null {
    return (this.form().get('cbiCaseType')?.value as string | null) ?? null;
  }

  readonly showName = (): boolean => cbiShowThirdPartyName(this.caseType);
  readonly nameLabel = (): string => cbiThirdPartyLabel(this.caseType);
  readonly industryLabel = (): string => cbiIndustryLabel(this.caseType);
  get nameRequired(): boolean {
    return !!this.caseType?.endsWith('-named');
  }

  onLocationChange(output: LocationPickerOutput): void {
    this.cbiLocation().setValue(output);
  }
}
