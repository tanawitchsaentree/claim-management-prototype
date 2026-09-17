import { Component, Input } from '@angular/core';

import { NxIconModule } from '@allianz/ng-aquila/icon';

export interface FnolStep {
  key: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

@Component({
  selector: 'app-fnol-stepper',
  standalone: true,
  imports: [NxIconModule],
  templateUrl: './fnol-stepper.component.html',
  styleUrl: './fnol-stepper.component.scss'
})
export class FnolStepperComponent {
  @Input() steps: FnolStep[] = [];
  @Input() currentStep = '';
}
