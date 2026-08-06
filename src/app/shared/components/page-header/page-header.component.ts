import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';

// Canonical typography/spacing derived from the shape claims-list, loss-events-list,
// and mass-events independently converged on (governance audit, 2026-08-06):
// eyebrow (14px, muted) + title (28px/400, text-01) + caption (14px, muted, 32px
// bottom margin). No single existing page had all of eyebrow+title+subtitle+back+
// actions at once — this generalizes the shared shape rather than picking one page
// as-is. See DESIGN_PRINCIPLES.md "Component Variant Contracts" for what varies vs.
// what's fixed.
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, NxIconModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() eyebrow?: string;
  @Input() subtitle?: string;
  @Input() showBack = false;
  @Input() backLabel = 'Back';
  @Output() back = new EventEmitter<void>();
}
