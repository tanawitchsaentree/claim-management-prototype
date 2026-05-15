import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxHeadlineModule } from '@allianz/ng-aquila/headline';

const ACCESS_KEY = 'app:access-granted';
const CORRECT_HASH = 'f2f5d415c6717f712281fc66830f07329720cb06d89f034e8fad57b81ab161d0';

@Component({
  selector: 'app-access-gate',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule,
    NxHeadlineModule,
  ],
  templateUrl: './access-gate.component.html',
  styleUrl: './access-gate.component.scss',
})
export class AccessGateComponent implements OnInit {
  @Output() unlocked = new EventEmitter<void>();

  readonly passwordCtrl = new FormControl('');
  readonly error = signal(false);
  readonly loading = signal(false);

  ngOnInit(): void {
    if (localStorage.getItem(ACCESS_KEY) === '1') {
      this.unlocked.emit();
    }
  }

  async onSubmit(): Promise<void> {
    const value = (this.passwordCtrl.value ?? '').trim();
    if (!value) return;

    this.loading.set(true);
    this.error.set(false);

    const hash = await this.sha256(value);
    this.loading.set(false);

    if (hash === CORRECT_HASH) {
      localStorage.setItem(ACCESS_KEY, '1');
      this.unlocked.emit();
    } else {
      this.error.set(true);
      this.passwordCtrl.setValue('');
    }
  }

  private async sha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
