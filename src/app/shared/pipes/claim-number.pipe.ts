import { Pipe, PipeTransform, inject } from '@angular/core';
import { ClaimNumberService } from '../../core/services/claim-number.service';

/** Shows the number people quote for a claim id (claim number if it has one, else the id). */
@Pipe({
  name: 'claimNumber',
  standalone: true,
  // Impure on purpose: the same id shows a different number once the claim is
  // converted, and a pure pipe would keep the old text until the id changes.
  pure: false
})
export class ClaimNumberPipe implements PipeTransform {
  private readonly numbers = inject(ClaimNumberService);

  transform(claimId: string | null | undefined): string {
    return this.numbers.displayFor(claimId);
  }
}
