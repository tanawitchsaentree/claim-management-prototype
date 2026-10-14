import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ClaimNumberService } from '../services/claim-number.service';

/**
 * /claims/<claim number or former number>/... -> /claims/<internal key>/...
 * so a typed or bookmarked number (SK- or the new claim number) opens the claim.
 */
export const claimAliasGuard: CanActivateFn = (route, state) => {
  const id = route.paramMap.get('id');
  if (!id) return true;
  const key = inject(ClaimNumberService).resolve(id);
  if (!key || key === id) return true;
  return inject(Router).parseUrl(state.url.replace(`/claims/${id}`, `/claims/${key}`));
};
