import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NxAvatarModule } from '@allianz/ng-aquila/avatar';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NxAvatarModule, NxIconModule, NxButtonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  auth = inject(AuthService);
  private router = inject(Router);

  readonly mobileOpen = signal(false);

  get initials(): string {
    const name = this.auth.user()?.name ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  toggleMobile(): void {
    this.mobileOpen.update(v => !v);
  }

  navigateMobile(path: string): void {
    this.mobileOpen.set(false);
    this.router.navigate([path]);
  }

  @HostListener('document:keydown.escape')
  closeMobile(): void {
    this.mobileOpen.set(false);
  }
}
