import { Component, computed, inject, signal, effect, untracked } from '@angular/core';
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
  queryParams?: Record<string, string>;
}

interface NavGroup {
  label: string;
  icon: string;
  groupKey: string;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return 'children' in e;
}

const GLOBAL_NAV: NavItem[] = [
  { label: 'Dashboard', icon: 'home',        path: '/dashboard', exact: true },
  { label: 'New Claim', icon: 'plus-circle', path: '/fnol',      exact: true },
];

const CLAIM_NAV_TEMPLATE: NavEntry[] = [
  { label: 'Claim overview',  icon: 'file-text',                    path: 'overview' },
  { label: 'Policy overview', icon: 'card-o',                       path: 'policy' },
  { label: 'Sections',        icon: 'users-o',                      path: 'sections' },
  { label: 'Parties',         icon: 'product-share-graph-arrow-up', path: 'parties' },
  {
    label: 'Financial', icon: 'product-shield-money', groupKey: 'financial',
    children: [
      { label: 'Financial Overview', icon: '', path: 'financial', queryParams: { view: 'overview'  } },
      { label: 'Payments',           icon: '', path: 'financial', queryParams: { view: 'payments'  } },
      { label: 'Reserves',           icon: '', path: 'financial', queryParams: { view: 'reserves'  } },
      { label: 'Recovery bookings',  icon: '', path: 'financial', queryParams: { view: 'recovery'  } },
    ],
  },
  { label: 'Limits and Deductibles',          icon: 'shield-o',                  path: 'limits' },
  { label: 'Recoveries',                      icon: 'file-arrow',                path: 'recoveries' },
  { label: 'Provider management',             icon: 'shield-warning',            path: 'providers' },
  { label: 'Risk analysis and investigation', icon: 'policy-processing-03',      path: 'risk' },
  { label: 'Litigation',                      icon: 'product-legal-protection',  path: 'litigation' },
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
  readonly expandedGroups = signal<Set<string>>(new Set());

  private readonly fullUrl$ = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(e => (e as NavigationEnd).urlAfterRedirects),
    startWith(this.router.url),
  );
  private readonly fullUrlSignal = toSignal(this.fullUrl$, { initialValue: this.router.url });

  // path only, no query string
  readonly pathSignal = computed(() => this.fullUrlSignal().split('?')[0]);

  readonly claimId = computed(() => {
    const match = this.pathSignal().match(/^\/claims\/([^/]+)/);
    return match ? match[1] : null;
  });

  readonly isClaimRoute = computed(() => {
    const id = this.claimId();
    return !!id && id !== 'new';
  });

  readonly globalNav = GLOBAL_NAV;
  readonly isGroup = isGroup;

  readonly claimNavItems = computed<NavEntry[]>(() => {
    const id = this.claimId();
    if (!id) return [];
    return CLAIM_NAV_TEMPLATE.map(entry => {
      if (isGroup(entry)) {
        return {
          ...entry,
          children: entry.children.map(c => ({ ...c, path: `/claims/${id}/${c.path}` })),
        } as NavGroup;
      }
      return { ...entry, path: `/claims/${id}/${(entry as NavItem).path}` } as NavItem;
    });
  });

  constructor() {
    // Auto-expand financial group when navigating to financial page
    effect(() => {
      const isFinancial = this.pathSignal().includes('/financial');
      if (isFinancial) {
        untracked(() => {
          const s = new Set(this.expandedGroups());
          if (!s.has('financial')) {
            s.add('financial');
            this.expandedGroups.set(s);
          }
        });
      }
    });
  }

  isGroupExpanded(key: string): boolean {
    return this.expandedGroups().has(key);
  }

  isGroupActive(group: NavGroup): boolean {
    return this.pathSignal().includes('/financial');
  }

  isChildActive(child: NavItem): boolean {
    const url = this.fullUrlSignal();
    const [pathPart, queryPart] = url.split('?');
    if (!pathPart.endsWith('/financial')) return false;
    const params = new URLSearchParams(queryPart ?? '');
    const current = params.get('view') ?? 'overview';
    return (child.queryParams?.['view'] ?? 'overview') === current;
  }

  toggleGroup(key: string): void {
    const s = new Set(this.expandedGroups());
    s.has(key) ? s.delete(key) : s.add(key);
    this.expandedGroups.set(s);
  }

  toggleCollapse(): void {
    this.collapsed = !this.collapsed;
  }
}
