import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  // Full-page standalone layouts (own header + sidebar — no Shell wrapper)
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'administration',
    loadComponent: () =>
      import('./features/administration/administration.component').then((m) => m.AdministrationComponent),
  },
  {
    path: 'administration/mass-events',
    loadComponent: () =>
      import('./features/administration/mass-events/mass-events.component').then((m) => m.MassEventsComponent),
  },
  {
    path: 'claims',
    loadComponent: () =>
      import('./features/claims/claims-list/claims-list.component').then((m) => m.ClaimsListComponent),
  },
  {
    path: 'loss-events',
    loadComponent: () =>
      import('./features/loss-events/loss-events-list/loss-events-list.component').then((m) => m.LossEventsListComponent),
  },
  {
    path: 'approvals',
    loadComponent: () =>
      import('./features/approvals/approvals.component').then((m) => m.ApprovalsComponent),
  },
  // FNOL wizard (own layout shell, no sidebar)
  {
    path: 'fnol',
    loadChildren: () =>
      import('./features/fnol/fnol.routes').then(m => m.FNOL_ROUTES),
  },
  // BMPCC-FNOL-SUMMARY (2026-05-27): placeholder Loss Event Overview — landing
  // page when an FNOL submission produces multiple derived claims.
  {
    path: 'loss-events/:id/overview',
    loadComponent: () =>
      import('./features/loss-events/loss-event-overview/loss-event-overview.component').then(
        (m) => m.LossEventOverviewComponent,
      ),
  },
  // Shell layout routes
  {
    path: '',
    loadComponent: () =>
      import('./features/layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'claims/:id',
        redirectTo: 'claims/:id/overview',
        pathMatch: 'full',
      },
      {
        path: 'claims/:id/overview',
        loadComponent: () =>
          import('./features/claims/claim-overview/claim-overview.component').then(
            (m) => m.ClaimOverviewComponent
          ),
      },
      {
        path: 'claims/:id/loss-information/edit',
        loadComponent: () =>
          import('./features/claims/edit-loss-information/edit-loss-information.component').then(
            (m) => m.EditLossInformationComponent
          ),
      },
      {
        path: 'claims/:id/edit',
        loadComponent: () =>
          import('./features/claims/edit-claim/edit-claim.component').then(
            (m) => m.EditClaimComponent
          ),
      },
      {
        path: 'claims/:id/sections',
        loadComponent: () =>
          import('./features/sections/sections').then((m) => m.Sections),
      },
      // Stub routes — redirect to overview until dedicated pages are built
      { path: 'claims/:id/policy',     redirectTo: 'claims/:id/overview', pathMatch: 'full' },
      { path: 'claims/:id/parties',    redirectTo: 'claims/:id/overview', pathMatch: 'full' },
      {
        path: 'claims/:id/financial',
        loadComponent: () =>
          import('./features/claims/financial-overview/financial-overview.component').then(
            m => m.FinancialOverviewComponent
          ),
      },
      {
        path: 'claims/:id/notes',
        loadComponent: () =>
          import('./features/claims/claim-notes-full/claim-notes-full.component').then(
            m => m.ClaimNotesFullComponent
          ),
      },
      { path: 'claims/:id/limits',     redirectTo: 'claims/:id/overview', pathMatch: 'full' },
      { path: 'claims/:id/recoveries', redirectTo: 'claims/:id/overview', pathMatch: 'full' },
      { path: 'claims/:id/providers',  redirectTo: 'claims/:id/overview', pathMatch: 'full' },
      {
        path: 'claims/:id/risk',
        loadComponent: () =>
          import('./features/claims/risk-analysis/risk-analysis.component').then((m) => m.RiskAnalysisComponent),
      },
      {
        path: 'claims/:id/litigation',
        loadComponent: () =>
          import('./features/claims/litigation/litigation.component').then((m) => m.LitigationComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
