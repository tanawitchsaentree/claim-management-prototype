import { Component, Input, OnChanges, SimpleChanges, computed, inject, signal, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { Note, NoteSection } from '../../../core/models';
import { MockNotesService } from '../../../core/mock/services/mock-notes.service';
import { NotesScope } from '../../../core/services/right-strip.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

type FilterValue = 'all' | 'pinned' | 'recovery' | 'litigation' | 'general';

const PAGE_STEP = 5;

const EN_WEEKDAY: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

@Component({
  selector: 'app-claim-notes-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxIconModule,
    NxButtonModule,
    NxTooltipModule,
    NxContextMenuModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxInputModule,
    EmptyStateComponent,
  ],
  templateUrl: './claim-notes-panel.component.html',
  styleUrl: './claim-notes-panel.component.scss',
})
export class ClaimNotesPanelComponent implements OnChanges {
  @Input({ required: true }) claimId!: string;
  @Input() highlightNoteId: string | null = null;
  @Input() quickAddEntity: string | null = null;
  @Input() scope: NotesScope | null = null;

  private readonly notesSvc = inject(MockNotesService);
  private readonly router   = inject(Router);
  private readonly elRef    = inject(ElementRef);

  readonly notes           = signal<Note[]>([]);
  readonly loading         = signal(false);
  readonly filter          = signal<FilterValue>('all');
  readonly visibleCount    = signal(PAGE_STEP);
  readonly showAddForm     = signal(false);
  readonly quickAddMode    = signal(false);
  readonly highlightedId   = signal<string | null>(null);

  // Entity/section-scoped view — opened from Sections' "View notes" action.
  // A flat list is used everywhere (scoped or not); this is the only state
  // that decides what "everywhere" means.
  readonly activeScope = signal<NotesScope | null>(null);

  readonly addForm = new FormGroup({
    title:    new FormControl(''),
    attachTo: new FormControl('CLAIM'),
    category: new FormControl<NoteSection>(null),
    body:     new FormControl(''),
  });

  readonly attachOptions = ['CLAIM', 'SECTION', 'PARTY'];
  readonly categoryOptions: { value: NoteSection; label: string }[] = [
    { value: 'general',    label: 'General' },
    { value: 'recovery',   label: 'Recovery' },
    { value: 'litigation', label: 'Litigation' },
  ];

  readonly filterOptions: { value: FilterValue; label: string }[] = [
    { value: 'all',        label: 'All notes'  },
    { value: 'pinned',     label: 'Pinned'     },
    { value: 'recovery',   label: 'Recovery'   },
    { value: 'litigation', label: 'Litigation' },
    { value: 'general',    label: 'General'    },
  ];

  readonly currentFilterLabel = computed(() =>
    this.filterOptions.find(o => o.value === this.filter())?.label ?? 'All notes',
  );

  // Single flat, pinned-first-then-newest list — scoped view filters by
  // attachedTo membership instead of the category/pinned filter (a scoped
  // view has no use for "show me only Litigation notes for this section").
  readonly filteredNotes = computed<Note[]>(() => {
    const scope = this.activeScope();
    let list = this.notes();
    if (scope) {
      list = list.filter(n => !!n.attachedTo && scope.names.includes(n.attachedTo));
    } else {
      const f = this.filter();
      if (f === 'pinned')     list = list.filter(n => n.pinned);
      if (f === 'recovery')   list = list.filter(n => n.section === 'recovery');
      if (f === 'litigation') list = list.filter(n => n.section === 'litigation');
      if (f === 'general')    list = list.filter(n => n.section === 'general');
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return +new Date(b.timestamp) - +new Date(a.timestamp);
    });
  });

  readonly visibleNotes = computed<Note[]>(() =>
    this.filteredNotes().slice(0, this.visibleCount()),
  );

  readonly hasMore = computed(() =>
    this.visibleNotes().length < this.filteredNotes().length,
  );

  readonly totalCount = computed(() => this.filteredNotes().length);

  clearScope(): void {
    this.activeScope.set(null);
    this.visibleCount.set(PAGE_STEP);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['claimId'] && this.claimId) this.load();
    if (changes['highlightNoteId'] && this.highlightNoteId) {
      this.scrollToNote(this.highlightNoteId);
    }
    if (changes['quickAddEntity'] && this.quickAddEntity) {
      this.startQuickAdd(this.quickAddEntity);
    }
    if (changes['scope']) {
      this.visibleCount.set(PAGE_STEP);
      this.activeScope.set(this.scope);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const data = await firstValueFrom(this.notesSvc.getByClaim(this.claimId));
    this.notes.set(data);
    this.loading.set(false);
    if (this.highlightNoteId) {
      this.scrollToNote(this.highlightNoteId);
    }
  }

  private scrollToNote(noteId: string): void {
    // ensure visibleCount shows enough notes to include this one
    const all = this.filteredNotes();
    const idx = all.findIndex(n => n.id === noteId);
    if (idx >= 0 && idx >= this.visibleCount()) {
      this.visibleCount.set(idx + 1);
    }

    this.highlightedId.set(noteId);
    setTimeout(() => {
      const el = this.elRef.nativeElement.querySelector(`[data-note-id="${noteId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // clear highlight after animation finishes
      setTimeout(() => this.highlightedId.set(null), 2000);
    }, 100);
  }

  setFilter(value: FilterValue): void {
    this.filter.set(value);
    this.visibleCount.set(PAGE_STEP);
  }

  loadMore(): void {
    this.visibleCount.update(v => v + PAGE_STEP);
  }

  /** Relative-then-absolute timestamp (English).
   *  Boundary: < 60 seconds = "Just now"; >= 60s switches to minute-based. */
  formatTimestamp(iso: string): string {
    const now  = new Date();
    const d    = new Date(iso);
    const diff = now.getTime() - d.getTime();
    const sec  = 1000;
    const min  = 60 * sec;
    const hour = 60 * min;
    const day  = 24 * hour;

    if (diff < 60 * sec)  return 'Just now';
    if (diff < hour) {
      const m = Math.floor(diff / min);
      return `${m} min${m === 1 ? '' : 's'} ago`;
    }
    if (diff < 24 * hour) {
      const h = Math.floor(diff / hour);
      return `${h} hour${h === 1 ? '' : 's'} ago`;
    }

    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth()    === b.getMonth() &&
      a.getDate()     === b.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDay(d, now))       return `Today, ${hh}:${mm}`;
    if (sameDay(d, yesterday)) return `Yesterday, ${hh}:${mm}`;

    if (diff < 7 * day) return `${EN_WEEKDAY[d.getDay()]}, ${hh}:${mm}`;

    const dd  = String(d.getDate()).padStart(2, '0');
    const mo  = String(d.getMonth() + 1).padStart(2, '0');
    const yr  = d.getFullYear();
    return `${dd}-${mo}-${yr}, ${hh}:${mm}`;
  }

  async togglePin(noteId: string): Promise<void> {
    const next = await firstValueFrom(this.notesSvc.togglePin(this.claimId, noteId));
    this.notes.set(next);
  }

  onTranslate(): void { /* phase 2 */ }

  onViewAll(): void {
    this.router.navigate(['/claims', this.claimId, 'notes']);
  }

  onAddNote(): void {
    // Inside a scoped view, "Add note" should attach to the section already
    // being viewed rather than open the generic CLAIM/SECTION/PARTY form.
    const scope = this.activeScope();
    if (scope) {
      this.startQuickAdd(scope.label);
    } else {
      this.quickAddMode.set(false);
      this.showAddForm.set(true);
    }
  }

  /** Opened from the Sections "Add note" kebab action — only the Note field is shown. */
  private startQuickAdd(entityName: string): void {
    this.quickAddMode.set(true);
    this.showAddForm.set(true);
    this.addForm.patchValue({ attachTo: 'SECTION', title: entityName, category: 'general' });
  }

  cancelAddNote(): void {
    this.showAddForm.set(false);
    this.quickAddMode.set(false);
    this.addForm.reset({ attachTo: 'CLAIM', title: '', category: null, body: '' });
  }

  async submitAddNote(): Promise<void> {
    const { title, category, body } = this.addForm.value;
    if (!body?.trim()) return;
    // Quick-add is always for one specific entity/section (title === its name);
    // the full form's "Attach to" field is only a coarse CLAIM/SECTION/PARTY type,
    // with no picker for which specific one, so it can't set attachedTo reliably.
    const attachedTo = this.quickAddMode() ? (title?.trim() || null) : null;
    const next = await firstValueFrom(
      this.notesSvc.addNote(this.claimId, {
        title:   title?.trim() ?? '',
        section: category ?? null,
        body:    body.trim(),
        attachedTo,
      }),
    );
    this.notes.set(next);
    this.cancelAddNote();
  }
}
