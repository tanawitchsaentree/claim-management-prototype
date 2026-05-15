import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

type Priority = 'high' | 'medium' | 'low';

const TOKEN_MAP: Record<Priority, string> = {
  high:   '--claim-priority-high',
  medium: '--claim-priority-medium',
  low:    '--claim-priority-low',
};

@Component({
  selector: 'app-priority-dot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './priority-dot.component.html',
  styleUrl: './priority-dot.component.scss',
})
export class PriorityDotComponent implements OnChanges {
  @Input({ required: true }) priority!: Priority;
  @Input() showLabel = false;

  colorVar = '';
  displayLabel = '';

  ngOnChanges(): void {
    const token = TOKEN_MAP[this.priority];
    if (!token) {
      console.warn(`[PriorityDot] Unknown priority "${this.priority}" — using low fallback.`);
    }
    this.colorVar    = `var(${token ?? TOKEN_MAP.low})`;
    this.displayLabel = this.priority
      ? this.priority.charAt(0).toUpperCase() + this.priority.slice(1)
      : '';
  }
}
