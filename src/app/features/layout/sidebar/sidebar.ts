import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { CommonModule } from '@angular/common';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  exact?: boolean;
}

const GLOBAL_NAV: NavItem[] = [
  { label: 'Dashboard',   icon: 'home',        path: '/dashboard',   exact: true },
  { label: 'New Claim',   icon: 'plus-circle', path: '/fnol',        exact: true },
];

const CLAIM_NAV: NavItem[] = [
  { label: 'Claim overview',                    icon: 'file-text',                      path: 'overview' },
  { label: 'Policy overview',                   icon: 'card-o',                         path: 'policy' },
  { label: 'Sections',                          icon: 'users-o',                        path: 'sections' },
  { label: 'Parties',                           icon: 'product-share-graph-arrow-up',   path: 'parties' },
  { label: 'Financial overview',                icon: 'product-shield-money',           path: 'financial' },
  { label: 'Limits and Deductibles',            icon: 'shield-o',                       path: 'limits' },
  { label: 'Recoveries',                        icon: 'file-arrow',                     path: 'recoveries' },
  { label: 'Provider management',               icon: 'shield-warning',                 path: 'providers' },
  { label: 'Risk analysis and investigation',   icon: 'policy-processing-03',           path: 'risk' },
  { label: 'Litigation',                        icon: 'product-legal-protection',       path: 'litigation' },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NxIconModule, NxButtonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private readonly router = inject(Router);

  collapsed = false;

  private readonly url$ = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(e => (e as NavigationEnd).urlAfterRedirects),
    startWith(this.router.url),
  );

  private readonly urlSignal = toSignal(this.url$, { initialValue: this.router.url });

  readonly claimId = computed(() => {
    const match = this.urlSignal().match(/^\/claims\/([^/]+)/);
    return match ? match[1] : null;
  });

  readonly isClaimRoute = computed(() => {
    const id = this.claimId();
    return !!id && id !== 'new';
  });

  readonly globalNav = GLOBAL_NAV;

  claimNavItems = computed<NavItem[]>(() => {
    const id = this.claimId();
    if (!id) return [];
    return CLAIM_NAV.map(item => ({ ...item, path: `/claims/${id}/${item.path}` }));
  });

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
  }
}
