import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NxHeaderModule } from '@allianz/ng-aquila/header';
import { NxAvatarModule } from '@allianz/ng-aquila/avatar';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NxHeaderModule, NxAvatarModule, NxIconModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar {
  auth = inject(AuthService);

  get initials(): string {
    const name = this.auth.user()?.name ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
}
