import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VendorVariantComponent } from './vendor-variant/vendor-variant.component';

/**
 * Test page for how the Salvage vendor dropdown should clear a choice.
 * Three versions side by side, each with a readout of what the form holds.
 */
@Component({
  selector: 'app-vendor-dropdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [VendorVariantComponent],
  templateUrl: './vendor-dropdown.component.html',
  styleUrl: './vendor-dropdown.component.scss'
})
export class VendorDropdownComponent {}
