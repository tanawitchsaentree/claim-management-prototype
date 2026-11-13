import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import {
  HEADS_UP_TEXTS,
  HEADS_UP_TEXT_MAX,
  HeadsUpTextKey,
  YesNo
} from '../../../../core/models/large-loss-heads-up.model';
import { TextsGroup } from '../heads-up-form';

// BMPCC-22350 AC4: what only the handler can say. Cat and Multiple LOBs are
// Yes/No radios (no default: a pre-ticked No would be submitted unread), the
// four texts allow 4000 characters each with a counter (DESIGN DECISION HU-1 Q4).
@Component({
  selector: 'app-heads-up-assessment-section',
  standalone: true,
  imports: [ReactiveFormsModule, NxFormfieldModule, NxInputModule, NxRadioModule],
  templateUrl: './heads-up-assessment-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './heads-up-assessment-section.component.scss'
})
export class HeadsUpAssessmentSectionComponent {
  readonly cat = input.required<FormControl<YesNo | null>>();
  readonly multipleLobs = input.required<FormControl<YesNo | null>>();
  readonly texts = input.required<TextsGroup>();
  readonly readonly = input(false);

  readonly textFields = HEADS_UP_TEXTS;
  readonly max = HEADS_UP_TEXT_MAX;

  text(key: HeadsUpTextKey): FormControl<string> {
    return this.texts().controls[key];
  }

  yesNo(v: YesNo | null): string {
    return v === 'yes' ? 'Yes' : v === 'no' ? 'No' : 'Not answered';
  }
}
