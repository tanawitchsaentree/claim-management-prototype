import { Component, inject, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { SupabaseService } from '../../../core/services/supabase.service';

type LoginState = 'form' | 'sending' | 'sent' | 'error';

@Component({
  selector: 'app-tracker-login',
  standalone: true,
  imports: [ReactiveFormsModule, NxFormfieldModule, NxInputModule, NxButtonModule, NxMessageModule],
  templateUrl: './tracker-login.component.html',
  styleUrl: './tracker-login.component.scss',
})
export class TrackerLoginComponent {
  private readonly supabase = inject(SupabaseService).client;
  private readonly live = inject(LiveAnnouncer);

  readonly email = new FormControl('', [Validators.required, Validators.email]);
  readonly state = signal<LoginState>('form');
  readonly errorMessage = signal<string | null>(null);

  async sendMagicLink(): Promise<void> {
    if (this.email.invalid) {
      this.email.markAsTouched();
      return;
    }

    this.state.set('sending');
    const { error } = await this.supabase.auth.signInWithOtp({
      email: this.email.value!,
      options: { emailRedirectTo: `${window.location.origin}/tracker` },
    });

    if (error) {
      this.errorMessage.set(error.message);
      this.state.set('error');
      this.live.announce(error.message, 'assertive');
      return;
    }

    this.state.set('sent');
    this.live.announce('Check your email for a sign-in link.', 'polite');
  }

  tryAgain(): void {
    this.state.set('form');
    this.errorMessage.set(null);
  }
}
