import { Routes } from '@angular/router';

export const FNOL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./fnol-shell/fnol-shell.component').then(m => m.FnolShellComponent),
    children: [
      { path: '', redirectTo: 'search', pathMatch: 'full' },
      {
        path: 'search',
        loadComponent: () =>
          import('./steps/step-1-search/step-1-search.component').then(m => m.Step1SearchComponent),
      },
      {
        path: 'skeleton-create',
        loadComponent: () =>
          import('./steps/step-skeleton-create/step-skeleton-create.component').then(m => m.StepSkeletonCreateComponent),
      },
      {
        path: 'loss-information',
        loadComponent: () =>
          import('./steps/step-loss-information/step-loss-information.component').then(m => m.StepLossInformationComponent),
      },
      {
        path: 'loss-details',
        loadComponent: () =>
          import('./steps/loss-details/loss-details.component').then(m => m.LossDetailsComponent),
      },
      {
        path: 'entities-damages',
        loadComponent: () =>
          import('./steps/step-entities-damages/step-entities-damages.component').then(m => m.StepEntitiesDamagesComponent),
      },
      {
        path: 'parties',
        loadComponent: () =>
          import('./steps/step-parties/step-parties.component').then(m => m.StepPartiesComponent),
      },
      {
        path: 'reserves',
        loadComponent: () =>
          import('./steps/step-reserves/step-reserves.component').then(m => m.StepReservesComponent),
      },
      {
        path: 'summary',
        loadComponent: () =>
          import('./steps/step-summary/step-summary.component').then(m => m.StepSummaryComponent),
      },
    ],
  },
];
