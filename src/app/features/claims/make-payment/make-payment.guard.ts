import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MakePaymentLauncher } from './make-payment-launcher.service';

/**
 * Deep link /claims/:id/financial/new-payment (DEV banner, old links): shows the
 * Payments list and opens the Make Payment sheet over it with the link's pre-fill.
 */
export const makePaymentLinkGuard: CanActivateFn = route => {
  const id = route.paramMap.get('id') ?? '';
  inject(MakePaymentLauncher).openAfterNavigation(id, route.queryParamMap);
  return inject(Router).createUrlTree(['/claims', id, 'financial'], { queryParams: { view: 'payments' } });
};
