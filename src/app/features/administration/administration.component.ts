import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { PageShellComponent } from '../../shared/components/page-shell/page-shell.component';

interface AdminCard {
  key:         string;
  title:       string;
  description: string;
  icon:        string;        // Allianz product icon name
  iconAccent:  'green' | 'red' | 'purple';
  route?:      string;
}

interface AdminGroup {
  title: string;
  cards: AdminCard[];
}

const PLACEHOLDER_DESC =
  'Mauris luctus viverra mi, non semper ex tincidunt sagittis. Suspendisse accumsan magna eget pellentesque tempor. Cras lacinia eros nisi, sed tincidunt urna volutpat sit amet.';

@Component({
  selector: 'app-administration',
  standalone: true,
  imports: [CommonModule, NxIconModule, NxLinkModule, PageShellComponent],
  templateUrl: './administration.component.html',
  styleUrl: './administration.component.scss',
})
export class AdministrationComponent {
  private readonly router = inject(Router);

  readonly groups: AdminGroup[] = [
    {
      title: 'Administration',
      cards: [
        {
          key:         'profile',
          title:       'User profile management',
          description: PLACEHOLDER_DESC,
          icon:        'manager',
          iconAccent:  'green',
        },
      ],
    },
    {
      title: 'Expert configurations',
      cards: [
        {
          key:         'mass-events',
          title:       'Mass events',
          description: 'Manage events that link related claims to a single incident. Use this space to create new mass events or view and update existing ones.',
          icon:        'product-world-globe',
          iconAccent:  'red',
          route:       '/administration/mass-events',
        },
        // Pricing configuration — hidden until backend/spec is ready
        // {
        //   key:         'pricing',
        //   title:       'Pricing configuration',
        //   description: PLACEHOLDER_DESC,
        //   icon:        'product-coins-money',
        //   iconAccent:  'purple',
        // },
      ],
    },
  ];

  open(card: AdminCard): void {
    if (card.route) this.router.navigateByUrl(card.route);
  }
}
