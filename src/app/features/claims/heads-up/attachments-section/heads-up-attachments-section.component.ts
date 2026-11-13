import {
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  model,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { MockClaimDocumentsService } from '../../../../core/mock/services/mock-claim-documents.service';
import {
  HEADS_UP_ATTACHMENT_MAX_FILES,
  HEADS_UP_ATTACHMENT_MAX_MB,
  HEADS_UP_ATTACHMENT_TYPES,
  HeadsUpAttachment
} from '../../../../core/models/large-loss-heads-up.model';

const UPLOAD_MS = 1500;

// BMPCC-22350: supporting attachments. Same two ways in as the provider
// attachment-picker (features/claims/provider-management): pick a document the
// claim already has, or upload from the device. The upload is mocked (a short
// "Uploading" then done); limits are DESIGN DECISION HU-1 Q5. The list is the
// page's form state: it is kept when the draft is saved.
@Component({
  selector: 'app-heads-up-attachments-section',
  standalone: true,
  imports: [NxButtonModule, NxIconModule, NxSpinnerModule],
  templateUrl: './heads-up-attachments-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './heads-up-attachments-section.component.scss'
})
export class HeadsUpAttachmentsSectionComponent implements OnDestroy {
  private readonly docsSvc = inject(MockClaimDocumentsService);
  private readonly live = inject(LiveAnnouncer);

  readonly claimId = input.required<string>();
  readonly readonly = input(false);
  readonly attachments = model.required<HeadsUpAttachment[]>();

  readonly maxFiles = HEADS_UP_ATTACHMENT_MAX_FILES;
  readonly maxMb = HEADS_UP_ATTACHMENT_MAX_MB;
  readonly accept = HEADS_UP_ATTACHMENT_TYPES.join(',');
  readonly error = signal<string | null>(null);
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  private readonly claimDocs = toSignal(
    toObservable(this.claimId).pipe(switchMap(id => this.docsSvc.getByClaimId(id))),
    { initialValue: [] }
  );
  /** Claim documents not attached yet. */
  readonly available = computed(() => {
    const taken = new Set(this.attachments().map(a => a.id));
    return this.claimDocs().filter(d => !taken.has(d.documentId));
  });
  readonly full = computed(() => this.attachments().length >= HEADS_UP_ATTACHMENT_MAX_FILES);

  addFromClaim(id: string, fileName: string, size: number): void {
    if (this.full()) return this.fail(`You can attach up to ${HEADS_UP_ATTACHMENT_MAX_FILES} files.`);
    this.error.set(null);
    this.attachments.update(list => [...list, { id, fileName, size, source: 'claim', status: 'uploaded' }]);
  }

  onFiles(event: Event): void {
    const el = event.target as HTMLInputElement;
    const files = Array.from(el.files ?? []);
    el.value = '';
    const problems: string[] = [];
    for (const f of files) {
      const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
      if (!HEADS_UP_ATTACHMENT_TYPES.includes(ext)) problems.push(`${f.name}: this file type can't be attached.`);
      else if (f.size > HEADS_UP_ATTACHMENT_MAX_MB * 1024 * 1024) problems.push(`${f.name} is over ${HEADS_UP_ATTACHMENT_MAX_MB} MB.`);
      else if (this.full()) problems.push(`${f.name}: you can attach up to ${HEADS_UP_ATTACHMENT_MAX_FILES} files.`);
      else this.startUpload(f.name, f.size);
    }
    if (problems.length) this.fail(problems.join(' '));
    else this.error.set(null);
  }

  retry(a: HeadsUpAttachment): void {
    this.setStatus(a.id, 'uploading');
    this.timers.push(setTimeout(() => this.setStatus(a.id, 'uploaded'), UPLOAD_MS));
  }

  remove(a: HeadsUpAttachment): void {
    this.attachments.update(list => list.filter(x => x.id !== a.id));
    this.live.announce(`${a.fileName} removed`, 'polite');
  }

  size(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  ngOnDestroy(): void {
    this.timers.forEach(t => clearTimeout(t));
  }

  private startUpload(fileName: string, size: number): void {
    const id = `UP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.attachments.update(list => [...list, { id, fileName, size, source: 'upload', status: 'uploading' }]);
    this.timers.push(
      setTimeout(() => {
        this.setStatus(id, 'uploaded');
        this.live.announce(`${fileName} uploaded`, 'polite');
      }, UPLOAD_MS)
    );
  }

  private setStatus(id: string, status: HeadsUpAttachment['status']): void {
    this.attachments.update(list => list.map(a => (a.id === id ? { ...a, status } : a)));
  }

  private fail(msg: string): void {
    this.error.set(msg);
    this.live.announce(msg, 'assertive');
  }
}
