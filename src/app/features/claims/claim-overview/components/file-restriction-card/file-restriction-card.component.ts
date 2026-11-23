import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import {
  MockUserDirectoryService,
  UserDirectoryEntry
} from '../../../../../core/mock/services/mock-user-directory.service';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import {
  FileRestriction,
  RESTRICTION_REASONS,
  AccessListEntry
} from '../../../../../core/models/claim-overview.model';

@Component({
  selector: 'app-file-restriction-card',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxSwitcherModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxInputModule,
    NxIconModule,
    NxButtonModule,
    EmptyStateComponent
  ],
  templateUrl: './file-restriction-card.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './file-restriction-card.component.scss'
})
export class FileRestrictionCardComponent implements OnChanges {
  @Input({ required: true }) restriction: FileRestriction | undefined;
  @Output() restrictionChanged = new EventEmitter<FileRestriction>();
  // `expanded` is an @Input, owned by the parent's VM, so the open/closed
  // state lives with the page rather than the card.
  @Input() expanded = false;
  @Output() toggled = new EventEmitter<void>();

  private readonly userDir = inject(MockUserDirectoryService);
  private coUserSearchGeneration = 0;

  readonly restrictionReasons = [...RESTRICTION_REASONS];

  readonly restrictionForm = new FormGroup({
    isRestricted: new FormControl(false),
    reason: new FormControl<string>(''),
    otherReason: new FormControl('')
  });

  get isRestricted(): boolean {
    return !!this.restrictionForm.get('isRestricted')?.value;
  }
  get selectedReason(): string {
    return this.restrictionForm.get('reason')?.value ?? '';
  }
  get isOtherReason(): boolean {
    return this.selectedReason === 'Other';
  }
  /** Shown under the title when collapsed, in place of the form. */
  get summaryText(): string {
    if (!this.isRestricted) return 'Not restricted';
    const n = this.coAccessList().length;
    const users = `${n} ${n === 1 ? 'user' : 'users'} with access`;
    const reason = this.isOtherReason
      ? this.restrictionForm.get('otherReason')?.value
      : this.selectedReason;
    return reason ? `${users} · ${reason}` : users;
  }
  get restrictionToggle(): FormControl {
    return this.restrictionForm.get('isRestricted') as FormControl;
  }

  readonly coAccessList = signal<AccessListEntry[]>([]);
  readonly coUserSearchControl = new FormControl('');
  readonly coUserSearchResults = signal<UserDirectoryEntry[]>([]);
  private readonly coUserSearchQuery = toSignal(
    this.coUserSearchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()),
    { initialValue: this.coUserSearchControl.value }
  );

  constructor() {
    // Debounced user-directory search, guarded against out-of-order responses
    // — moved verbatim from ClaimOverviewComponent's constructor.
    effect(() => {
      const q = this.coUserSearchQuery();
      const generation = ++this.coUserSearchGeneration;
      if (!q || q.length < 2) {
        this.coUserSearchResults.set([]);
        return;
      }
      firstValueFrom(this.userDir.search(q)).then(results => {
        if (generation !== this.coUserSearchGeneration) return; // stale — a newer query superseded this one
        const addedIds = new Set(this.coAccessList().map(e => e.userId));
        this.coUserSearchResults.set(results.filter(u => !addedIds.has(u.userId)));
      });
    });
  }

  // Re-sync only when the stored restriction itself changed, not on every
  // expand/collapse or on another card's save re-feeding the same value.
  private syncedKey: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['restriction']) return;
    const key = JSON.stringify(this.restriction ?? null);
    if (key === this.syncedKey) return;
    this.syncedKey = key;
    const r = this.restriction;
    this.restrictionForm.patchValue(
      {
        isRestricted: r?.isRestricted ?? false,
        reason: r?.reason ?? ''
      },
      { emitEvent: false }
    );
    this.coAccessList.set(r?.accessList ?? []);
  }

  onToggleRestriction(checked: boolean): void {
    this.restrictionForm.get('isRestricted')!.setValue(checked);
    if (!checked) {
      // Model only: the reason dropdown leaves the DOM with this switch, and
      // nx-dropdown applies a written value a microtask later (NG0911).
      this.restrictionForm.get('reason')!.setValue('', { emitModelToViewChange: false });
      this.coAccessList.set([]);
    }
    this.saveRestrictionToClaim();
  }

  saveRestrictionToClaim(): void {
    const isRestricted = this.isRestricted;
    const restriction: FileRestriction = {
      isRestricted,
      reason: isRestricted
        ? this.isOtherReason
          ? (this.restrictionForm.get('otherReason')?.value ?? '')
          : this.selectedReason
        : undefined,
      accessList: isRestricted ? this.coAccessList() : []
    };
    // The form already shows this; don't re-sync when the parent echoes it back.
    this.syncedKey = JSON.stringify(restriction);
    this.restrictionChanged.emit(restriction);
  }

  addCoUser(user: UserDirectoryEntry): void {
    const entry: AccessListEntry = {
      userId: user.userId,
      name: user.name,
      role: user.role,
      email: user.email,
      addedAt: new Date().toISOString().split('T')[0]
    };
    this.coAccessList.update(list => [...list, entry]);
    this.coUserSearchControl.setValue('');
    this.coUserSearchResults.set([]);
    this.saveRestrictionToClaim();
  }

  removeCoUser(userId: string): void {
    this.coAccessList.update(list => list.filter(e => e.userId !== userId));
    this.saveRestrictionToClaim();
  }
}
