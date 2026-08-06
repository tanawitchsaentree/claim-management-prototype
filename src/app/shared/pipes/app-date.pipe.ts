import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Canonical display format for this project — DD-MM-YYYY (see app.config.ts's
// NxDateFormats, the same convention already used for every date-input widget).
// Pass 'withTime' to append HH:mm.
//
// Date-only ISO strings (YYYY-MM-DD, no time/offset) are formatted by plain
// string rearrangement, not `new Date(...)` — Date-parsing a bare date string
// treats it as UTC midnight, which DatePipe then renders in the local
// timezone and can shift the displayed day by ±1 west of UTC. Datetime
// strings (with time/Z) go through DatePipe as normal, since they carry an
// unambiguous instant.
@Pipe({ name: 'appDate', standalone: true, pure: true })
export class AppDatePipe implements PipeTransform {
  private readonly datePipe = new DatePipe('en-US');

  transform(value: string | Date | null | undefined, variant?: 'withTime'): string {
    if (!value) return '';

    if (typeof value === 'string' && DATE_ONLY.test(value)) {
      const [y, m, d] = value.split('-');
      return `${d}-${m}-${y}`;
    }

    const format = variant === 'withTime' ? 'dd-MM-yyyy HH:mm' : 'dd-MM-yyyy';
    return this.datePipe.transform(value, format) ?? '';
  }
}
