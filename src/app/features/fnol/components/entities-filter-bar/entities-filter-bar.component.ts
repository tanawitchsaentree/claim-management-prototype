import { Component, inject, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { EntityStatus } from '../../../../core/models';

export const ENTITY_STATUS_OPTIONS: { value: EntityStatus; label: string }[] = [
  { value: 'promised', label: 'Promised' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'by-extension', label: 'By extension' },
  { value: 'not-promised', label: 'Not promised' }
];

export interface EntitySearchCriteria {
  text: string;
  status: EntityStatus | '';
}

/**
 * Entity name + Status filter above the Entities & Damages list. Same
 * Search / Reset search pair as the Add entity dialog, so both searches read
 * the same way. Nothing is filtered until Search is pressed.
 */
@Component({
  selector: 'app-entities-filter-bar',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule
  ],
  templateUrl: './entities-filter-bar.component.html',
  styleUrl: './entities-filter-bar.component.scss'
})
export class EntitiesFilterBarComponent {
  private readonly fb = inject(FormBuilder);

  readonly search = output<EntitySearchCriteria>();
  readonly reset = output<void>();

  readonly statusOptions = ENTITY_STATUS_OPTIONS;
  readonly form = this.fb.nonNullable.group({
    text: '',
    status: '' as EntityStatus | ''
  });

  onSearch(): void {
    this.search.emit(this.form.getRawValue());
  }

  onReset(): void {
    this.form.reset({ text: '', status: '' });
    this.reset.emit();
  }
}
