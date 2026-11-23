import { ChangeDetectionStrategy, Component, Input, OnInit, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { ClearMode, MOCK_VENDORS, MockVendor } from '../vendor-dropdown.models';

type VendorRow = FormGroup<{
  vendorId: FormControl<string | null>;
  note: FormControl<string>;
}>;

/** One version of the Party block for the /mock/vendor-dropdown test page. */
@Component({
  selector: 'app-vendor-variant',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    NxButtonModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxIconModule,
    NxInputModule,
    StatusChipComponent
  ],
  templateUrl: './vendor-variant.component.html',
  styleUrl: './vendor-variant.component.scss'
})
export class VendorVariantComponent implements OnInit {
  @Input({ required: true }) mode!: ClearMode;
  @Input({ required: true }) title!: string;
  @Input() description = '';

  private readonly dialog = inject(NxDialogService);

  readonly vendors = MOCK_VENDORS;
  readonly owner = new FormControl<string | null>('v-weber');
  readonly rows = new FormArray<VendorRow>([]);

  ngOnInit(): void {
    this.reset();
  }

  /** Back to the screenshot's starting point: one row with WanjalaWilkinson - Dare. */
  reset(): void {
    this.rows.clear();
    this.rows.push(this.newRow('v-wanjala'));
  }

  addRow(): void {
    this.rows.push(this.newRow(null));
  }

  async removeRow(index: number): Promise<void> {
    const row = this.rows.at(index).getRawValue();
    const wantsConfirm = this.mode !== 'current' && (row.vendorId || row.note.trim());
    if (wantsConfirm) {
      const name = this.vendor(row.vendorId)?.businessName;
      const ref = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Remove salvage vendor?',
          message: name
            ? `${name} and the note on this row will be removed.`
            : 'The note on this row will be removed.',
          confirmLabel: 'Remove',
          cancelLabel: 'Keep',
          confirmDanger: true,
          hideIcon: true
        } satisfies ConfirmDialogData,
        width: '440px',
        maxWidth: '92vw'
      });
      if (!(await firstValueFrom(ref.afterClosed()))) return;
    }
    this.rows.removeAt(index);
  }

  vendor(id: string | null): MockVendor | undefined {
    return id ? this.vendors.find(v => v.id === id) : undefined;
  }

  /** A vendor already picked on another row is left out of this row's list. */
  optionsFor(index: number): MockVendor[] {
    const takenElsewhere = this.rows.controls
      .filter((_, i) => i !== index)
      .map(r => r.controls.vendorId.value);
    return this.vendors.filter(v => !takenElsewhere.includes(v.id));
  }

  /** Plain-language readout of what the form is holding right now. */
  stateLines(): string[] {
    const rows = this.rows.getRawValue();
    if (!rows.length) return ['No salvage vendor rows. Nothing will be saved.'];
    return rows.map((r, i) => {
      const name = this.vendor(r.vendorId)?.businessName ?? 'nothing picked';
      const note = r.note.trim() ? `"${r.note.trim()}"` : 'empty';
      return `Row ${i + 1}: vendor = ${name}, note = ${note}`;
    });
  }

  warnings(): string[] {
    const rows = this.rows.getRawValue();
    const out: string[] = [];
    const empty = rows.filter(r => !r.vendorId).length;
    const orphanNotes = rows.filter(r => !r.vendorId && r.note.trim()).length;
    if (empty) out.push(`${empty} row(s) have no vendor but are still on screen.`);
    if (orphanNotes) out.push(`${orphanNotes} note(s) now belong to no vendor.`);
    return out;
  }

  private newRow(vendorId: string | null): VendorRow {
    return new FormGroup({
      vendorId: new FormControl<string | null>(vendorId),
      note: new FormControl('', { nonNullable: true })
    });
  }
}
