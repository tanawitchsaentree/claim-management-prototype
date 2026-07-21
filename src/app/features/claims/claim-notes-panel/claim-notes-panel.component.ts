import { Component, Input, OnChanges, SimpleChanges, computed, inject, signal, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxAvatarModule } from '@allianz/ng-aquila/avatar';
import { NxEyebrowModule } from '@allianz/ng-aquila/eyebrow';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { Note, NoteSection } from '../../../core/models';
import { MockNotesService } from '../../../core/mock/services/mock-notes.service';

type FilterValue = 'all' | 'pinned' | 'recovery' | 'litigation' | 'general';

const SECTION_LABEL: Record<Exclude<NoteSection, null>, string> = {
  recovery:   'Recovery',
  litigation: 'Litigation',
  general:    'General',
};

const PINNED_LIMIT = 3;
const PAGE_STEP   = 5;

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
    NxAvatarModule,
    NxEyebrowModule,
    NxContextMenuModule,
    NxDropdownModule,
    NxFormfieldModule,
  ],
  templateUrl: './claim-notes-panel.component.html',
  styleUrl: './claim-notes-panel.component.scss',
})
export class ClaimNotesPanelComponent implements OnChanges {
  @Input({ required: true }) claimId!: string;
  @Input() highlightNoteId: string | null = null;
  @Input() quickAddEntity: string | null = null;

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

  /** Pinned notes (max 3) — only shown when filter allows pinned. */
  readonly pinnedNotes = computed<Note[]>(() => {
    const f = this.filter();
    if (f !== 'all' && f !== 'pinned') return [];
    return [...this.notes()]
      .filter(n => n.pinned)
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
      .slice(0, PINNED_LIMIT);
  });

  /** Activity = non-pinned (no duplication with pinned section). */
  readonly activityAll = computed<Note[]>(() => {
    const f = this.filter();
    let list = this.notes().filter(n => !n.pinned);
    if (f === 'pinned')     list = [];   // pinned-only filter hides activity
    if (f === 'recovery')   list = list.filter(n => n.section === 'recovery');
    if (f === 'litigation') list = list.filter(n => n.section === 'litigation');
    if (f === 'general')    list = list.filter(n => n.section === 'general');
    return [...list].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  });

  readonly activityVisible = computed<Note[]>(() =>
    this.activityAll().slice(0, this.visibleCount()),
  );

  readonly hasMoreActivity = computed(() =>
    this.activityVisible().length < this.activityAll().length,
  );

  readonly totalCount = computed(() =>
    this.pinnedNotes().length + this.activityAll().length,
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['claimId'] && this.claimId) this.load();
    if (changes['highlightNoteId'] && this.highlightNoteId) {
      this.scrollToNote(this.highlightNoteId);
    }
    if (changes['quickAddEntity'] && this.quickAddEntity) {
      this.startQuickAdd(this.quickAddEntity);
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
    const allNotes = this.activityAll();
    const idx = allNotes.findIndex(n => n.id === noteId);
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

  sectionLabel(section: NoteSection): string | null {
    return section ? SECTION_LABEL[section] : null;
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

  isExpanded = signal<Record<string, boolean>>({});
  toggleExpand(id: string): void {
    const next = { ...this.isExpanded() };
    next[id] = !next[id];
    this.isExpanded.set(next);
  }
  expanded(id: string): boolean { return !!this.isExpanded()[id]; }

  onEditNote(_note: Note):   void { /* phase 2 */ }
  onDeleteNote(_note: Note): void { /* phase 2 */ }
  onTranslate():             void { /* phase 2 */ }
  onViewAll(): void {
    this.router.navigate(['/claims', this.claimId, 'notes']);
  }

  onAddNote(): void {
    this.quickAddMode.set(false);
    this.showAddForm.set(true);
  }

  /** Opened from a "See details" comment icon / kebab "Add note" action — only the Note field is shown. */
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
    const next = await firstValueFrom(
      this.notesSvc.addNote(this.claimId, {
        title:   title?.trim() ?? '',
        section: category ?? null,
        body:    body.trim(),
      }),
    );
    this.notes.set(next);
    this.cancelAddNote();
  }
}
