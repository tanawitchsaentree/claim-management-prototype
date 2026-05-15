import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';

@Component({
  selector: 'app-wizard-footer',
  standalone: true,
  imports: [CommonModule, NxButtonModule, NxIconModule],
  templateUrl: './wizard-footer.component.html',
  styleUrl: './wizard-footer.component.scss',
})
export class WizardFooterComponent {
  @Input() nextLabel    = 'Next';
  @Input() nextDisabled = false;
  @Input() showBack     = true;
  @Input() showCancel   = true;

  @Output() cancel = new EventEmitter<void>();
  @Output() back   = new EventEmitter<void>();
  @Output() next   = new EventEmitter<void>();
}
