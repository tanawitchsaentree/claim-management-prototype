import { Routes } from '@angular/router';

export const TRACKER_ROUTES: Routes = [
  // Selected ticket is a query param (?key=...), not a path segment — a second 'ticket/:key'
  // path entry loading this same component used to exist, but switching between two different
  // route configs makes Angular destroy and recreate the whole component (table, filters, sync
  // state, everything), not just slide the detail panel in — every row click re-fetched the
  // entire list from scratch. One route means one persistent instance; only the detail panel
  // itself mounts/unmounts.
  {
    path: '',
    loadComponent: () =>
      import('./tracker-table/tracker-table.component').then((m) => m.TrackerTableComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./tracker-login/tracker-login.component').then((m) => m.TrackerLoginComponent),
  },
];
