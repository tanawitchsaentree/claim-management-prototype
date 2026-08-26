import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { MockReservesService } from '../../../../../../core/mock/services/mock-reserves.service';
import { MockLookupService } from '../../../../../../core/mock/services/mock-lookup.service';
import { ReserveNarrative } from '../../../../../../core/models/reserve.model';
import { LookupOption } from '../../../../../../core/models/lookup.model';
import { ToastService } from '../../../../../../shared/components/toast/toast.service';
import { isNarrativeActive, narrativeReasonLabel } from '../../../../../../shared/utils/reserve-narrative.util';

@Component({
  selector: 'app-reserve-narrative-panel',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, NxIconModule, NxButtonModule, NxFormfieldModule, NxInputModule, NxRadioModule],
  templateUrl: './reserve-narrative-panel.component.html',
  styleUrl: './reserve-narrative-panel.component.scss',
})
export class ReserveNarrativePanelComponent implements OnInit {
  @Input({ required: true }) narrative: ReserveNarrative | undefined;
  @Input({ required: true }) policyNumber!: string;
  @Input({ required: true }) totalReserve!: number;
  @Output() narrativeSaved = new EventEmitter<ReserveNarrative>();

  private readonly fb          = inject(FormBuilder);
  private readonly reservesSvc = inject(MockReservesService);
  private readonly lookupSvc   = inject(MockLookupService);
  private readonly toast       = inject(ToastService);

  narrativeOptions: LookupOption[] = [];
  narrativeOpen = false;
  narrativeForm = this.fb.group({
    reasonKey: ['', Validators.required],
    notes:     [''],
  });

  async ngOnInit(): Promise<void> {
    this.narrativeOptions = await firstValueFrom(this.lookupSvc.getNarrativeOptions());
  }

  // State 1: totalReserve=0, no saved narrative (or archived)
  get showNarrativeCta(): boolean {
    return this.totalReserve === 0 && !isNarrativeActive(this.narrative);
  }

  // State 3: totalReserve=0, narrative saved and not archived
  get showNarrativeSaved(): boolean {
    return this.totalReserve === 0 && isNarrativeActive(this.narrative);
  }

  get narrativeReasonLabel(): string {
    return narrativeReasonLabel(this.narrative, this.narrativeOptions);
  }

  openNarrative(): void {
    this.narrativeOpen = true;
    const n = this.narrative;
    if (n) this.narrativeForm.patchValue({ reasonKey: n.reasonKey, notes: n.notes ?? '' });
    else   this.narrativeForm.reset();
  }

  onCancelNarrative(): void {
    this.narrativeOpen = false;
    this.narrativeForm.reset();
  }

  async onSaveNarrative(): Promise<void> {
    if (this.narrativeForm.invalid) { this.narrativeForm.markAllAsTouched(); return; }
    const { reasonKey, notes } = this.narrativeForm.value;
    const narrative: ReserveNarrative = {
      reasonKey: reasonKey!,
      notes:     notes || undefined,
      savedAt:   new Date().toISOString(),
    };
    await firstValueFrom(this.reservesSvc.setNarrative(this.policyNumber, narrative));
    this.narrativeOpen = false;
    this.narrativeSaved.emit(narrative);
    this.toast.success('Explanation saved');
  }
}
