import { Component, inject, signal, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { firstValueFrom, debounceTime, distinctUntilChanged } from 'rxjs';
import { MockUserDirectoryService, UserDirectoryEntry } from '../../../../../core/mock/services/mock-user-directory.service';
import { AccessListEntry, FileRestriction } from '../../../../../core/models/claim-overview.model';

export interface ManageAccessModalData {
  restriction: FileRestriction;
  claimId: string;
}

export type ManageAccessModalResult = FileRestriction;

@Component({
  selector: 'app-manage-access-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxFormfieldModule,
    NxInputModule,
  ],
  templateUrl: './manage-access-modal.component.html',
  styleUrl:    './manage-access-modal.component.scss',
})
export class ManageAccessModalComponent {
  readonly data     = inject<ManageAccessModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ManageAccessModalComponent, ManageAccessModalResult>>(NxModalRef);
  private readonly userDir = inject(MockUserDirectoryService);

  readonly accessList    = signal<AccessListEntry[]>([...this.data.restriction.accessList]);
  readonly searchResults = signal<UserDirectoryEntry[]>([]);
  readonly searchControl = new FormControl('');
  private readonly searchQuery = toSignal(
    this.searchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()),
    { initialValue: this.searchControl.value },
  );

  constructor() {
    effect(() => {
      const q = this.searchQuery();
      firstValueFrom(this.userDir.search(q ?? '')).then(results => {
        const addedIds = new Set(this.accessList().map(e => e.userId));
        this.searchResults.set(results.filter(u => !addedIds.has(u.userId)));
      });
    });
  }

  addUser(user: UserDirectoryEntry): void {
    const entry: AccessListEntry = {
      userId:  user.userId,
      name:    user.name,
      role:    user.role,
      email:   user.email,
      addedAt: new Date().toISOString().split('T')[0],
    };
    this.accessList.update(list => [...list, entry]);
    this.searchControl.setValue('');
    this.searchResults.set([]);
  }

  removeUser(userId: string): void {
    // index 0 = creator, non-removable
    this.accessList.update(list => list.filter((e, i) => i === 0 || e.userId !== userId));
  }

  close(): void {
    const updated: FileRestriction = {
      ...this.data.restriction,
      accessList: this.accessList(),
    };
    this.modalRef.close(updated);
  }
}
