import { CanDeactivateFn } from '@angular/router';
import type { EditLossInformationComponent } from './edit-loss-information.component';

// Intercepts in-app navigation away from the edit screen while changes are
// pending — the discard modal decides, this guard just relays the answer.
// beforeunload (in the component itself) covers tab-close/refresh, which
// this guard cannot see.
export const editLossInformationCanDeactivate: CanDeactivateFn<EditLossInformationComponent> =
  (component) => component.confirmLeaveIfDirty();
