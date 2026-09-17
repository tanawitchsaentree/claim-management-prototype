import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  signal,
  ElementRef
} from '@angular/core';

import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { Note, NoteCategory } from '../../../core/models';
import { MockNotesService } from '../../../core/mock/services/mock-notes.service';
import { NotesScope } from '../../../core/services/right-strip.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
// Dynamic import, not static — ClaimNotesFullComponent's own template needs
// *this* component (it wraps <app-claim-notes-panel> at full width), so a
// static import here would be circular: this file's top-level import of
// that one, and that file's @Component.imports array needing this class to
// already exist when ITS decorator runs. A lazy import() resolves well
// after both modules are loaded, so the cycle never has to be ordered.

type FilterValue = 'all' | 'pinned' | 'recovery' | 'litigation' | 'general';

const PAGE_STEP = 5;

const EN_WEEKDAY: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat'
};

const CATEGORY_LABEL: Record<NoteCategory, string> = {
  general: 'General',
  recovery: 'Recovery',
  litigation: 'Litigation'
};

@Component({
  selector: 'app-claim-notes-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxIconModule,
    NxButtonModule,
    NxTooltipModule,
    NxDropdownModule,
    NxFormfieldModule,
    EmptyStateComponent
  ],
  templateUrl: './claim-notes-panel.component.html',
  styleUrl: './claim-notes-panel.component.scss'
})
export class ClaimNotesPanelComponent implements OnChanges {
  @Input({ required: true }) claimId!: string;
  @Input() highlightNoteId: string | null = null;
  @Input() quickAddEntity: string | null = null;
  @Input() scope: NotesScope | null = null;

  private readonly notesSvc = inject(MockNotesService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly elRef = inject(ElementRef);

  readonly notes = signal<Note[]>([]);
  readonly loading = signal(false);
  readonly filter = signal<FilterValue>('all');
  readonly visibleCount = signal(PAGE_STEP);
  readonly showAddForm = signal(false);
  readonly quickAddMode = signal(false);
  readonly highlightedId = signal<string | null>(null);
  // Set only in quick-add mode — the entity/section name the note being
  // composed is attached to. Shown as "Note for 'X'" and used as
  // Note.attachedTo on submit; not a form control, since the user never
  // edits it (it comes from which kebab menu they clicked).
  readonly quickAddTarget = signal<string | null>(null);

  // Entity/section-scoped view — opened from Sections' "View notes" action.
  // A flat list is used everywhere (scoped or not); this is the only state
  // that decides what "everywhere" means.
  readonly activeScope = signal<NotesScope | null>(null);

  // No "Attach to" control — it used to offer CLAIM/SECTION/PARTY but only
  // ever saved CLAIM regardless of what was picked (submitAddNote() never
  // read it). The one path that actually attaches a note to something
  // specific is quick-add, which already carries real context from the
  // kebab menu the user clicked — removed the fake generalized version
  // instead of leaving it to mislead people into thinking it worked.
  readonly addForm = new FormGroup({
    category: new FormControl<NoteCategory | null>(null),
    body: new FormControl('')
  });

  readonly categoryOptions: { value: NoteCategory; label: string }[] = [
    { value: 'general', label: 'General' },
    { value: 'recovery', label: 'Recovery' },
    { value: 'litigation', label: 'Litigation' }
  ];

  readonly filterOptions: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pinned', label: 'Pinned' },
    { value: 'recovery', label: 'Recovery' },
    { value: 'litigation', label: 'Litigation' },
    { value: 'general', label: 'General' }
  ];

  // Counts per filter option, computed off the unfiltered list — shown on
  // the segmented control so a handler can see whether a category has
  // anything in it before clicking (the old context-menu trigger showed
  // none of this, and was itself hidden behind a click to discover).
  readonly filterCounts = computed<Record<FilterValue, number>>(() => {
    const all = this.notes();
    return {
      all: all.length,
      pinned: all.filter(n => n.pinned).length,
      recovery: all.filter(n => n.category === 'recovery').length,
      litigation: all.filter(n => n.category === 'litigation').length,
      general: all.filter(n => n.category === 'general').length
    };
  });

  categoryLabel(category: NoteCategory): string {
    return CATEGORY_LABEL[category];
  }

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
      if (f === 'pinned') list = list.filter(n => n.pinned);
      if (f === 'recovery') list = list.filter(n => n.category === 'recovery');
      if (f === 'litigation') list = list.filter(n => n.category === 'litigation');
      if (f === 'general') list = list.filter(n => n.category === 'general');
    }
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return +new Date(b.timestamp) - +new Date(a.timestamp);
    });
  });

  readonly visibleNotes = computed<Note[]>(() =>
    this.filteredNotes().slice(0, this.visibleCount())
  );

  readonly hasMore = computed(() => this.visibleNotes().length < this.filteredNotes().length);

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
    const now = new Date();
    const d = new Date(iso);
    const diff = now.getTime() - d.getTime();
    const sec = 1000;
    const min = 60 * sec;
    const hour = 60 * min;
    const day = 24 * hour;

    if (diff < 60 * sec) return 'Just now';
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
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return `Today, ${hh}:${mm}`;
    if (sameDay(d, yesterday)) return `Yesterday, ${hh}:${mm}`;

    if (diff < 7 * day) return `${EN_WEEKDAY[d.getDay()]}, ${hh}:${mm}`;

    const dd = String(d.getDate()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const yr = d.getFullYear();
    return `${dd}-${mo}-${yr}, ${hh}:${mm}`;
  }

  async togglePin(noteId: string): Promise<void> {
    const next = await firstValueFrom(this.notesSvc.togglePin(this.claimId, noteId));
    this.notes.set(next);
  }

  onTranslate(): void {
    /* phase 2 */
  }

  // Was a full-page route (/claims/:id/notes navigate) — now a bottom-sheet
  // modal (see styles.scss .bottom-sheet-modal-panel, same family as
  // mass-event-edit-modal), since the route was just this same panel
  // wrapped at full width with nothing else on it.
  async onViewAll(): Promise<void> {
    const { ClaimNotesFullComponent } =
      await import('../claim-notes-full/claim-notes-full.component');
    this.dialogSvc.open(ClaimNotesFullComponent, {
      data: { claimId: this.claimId },
      panelClass: 'bottom-sheet-modal-panel'
    });
  }

  onAddNote(): void {
    // Inside a scoped view, "Add note" should attach to the section already
    // being viewed rather than open the generic form.
    const scope = this.activeScope();
    if (scope) {
      this.startQuickAdd(scope.label);
    } else {
      this.quickAddMode.set(false);
      this.quickAddTarget.set(null);
      this.showAddForm.set(true);
    }
  }

  /** Opened from the Sections "Add note" kebab action — Category + Note only. */
  private startQuickAdd(entityName: string): void {
    this.quickAddMode.set(true);
    this.quickAddTarget.set(entityName);
    this.showAddForm.set(true);
    this.addForm.patchValue({ category: null });
  }

  cancelAddNote(): void {
    this.showAddForm.set(false);
    this.quickAddMode.set(false);
    this.quickAddTarget.set(null);
    this.addForm.reset({ category: null, body: '' });
  }

  async submitAddNote(): Promise<void> {
    const { category, body } = this.addForm.value;
    if (!body?.trim()) return;
    const attachedTo = this.quickAddMode() ? this.quickAddTarget() : null;
    // A note with no category picked still needs to land somewhere real —
    // otherwise it's invisible to every category filter except "All", which
    // is exactly the silent-drop bug this replaces. Default to 'general'
    // rather than block submission on a field that's genuinely optional.
    const next = await firstValueFrom(
      this.notesSvc.addNote(this.claimId, {
        category: category ?? 'general',
        body: body.trim(),
        attachedTo
      })
    );
    this.notes.set(next);
    this.cancelAddNote();
  }
}
