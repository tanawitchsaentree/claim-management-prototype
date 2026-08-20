import { Routes } from '@angular/router';

export const TRACKER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tracker-table/tracker-table.component').then((m) => m.TrackerTableComponent),
  },
  {
    path: 'ticket/:key',
    loadComponent: () =>
      import('./tracker-table/tracker-table.component').then((m) => m.TrackerTableComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./tracker-login/tracker-login.component').then((m) => m.TrackerLoginComponent),
  },
];
