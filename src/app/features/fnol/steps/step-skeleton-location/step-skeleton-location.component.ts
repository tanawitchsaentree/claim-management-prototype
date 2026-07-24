import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FnolStateService } from '../../services/fnol-state.service';
import { LocationPickerOutput } from '../../../../core/models';
import { LocationPickerComponent } from '../../../../shared/components/location-picker/location-picker.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';

@Component({
  selector: 'app-step-skeleton-location',
  standalone: true,
  imports: [
    CommonModule,
    LocationPickerComponent,
    WizardFooterComponent,
  ],
  templateUrl: './step-skeleton-location.component.html',
  styleUrl: './step-skeleton-location.component.scss',
})
export class StepSkeletonLocationComponent implements OnInit {
  private readonly fnolState = inject(FnolStateService);
  private readonly router    = inject(Router);

  readonly lossLocation = this.fnolState.getLossLocationControl();

  ngOnInit(): void {
    if (!this.fnolState.skeleton) {
      this.router.navigate(['/fnol/skeleton-create']);
    }
  }

  onLocationChange(o: LocationPickerOutput): void { this.lossLocation.setValue(o); }

  onBack(): void   { this.router.navigate(['/fnol/skeleton-parties']); }
  onCancel(): void { this.router.navigate(['/dashboard']); }
  onNext(): void {
    this.fnolState.markStepComplete('skeleton-location');
    this.router.navigate(['/fnol/skeleton-summary']);
  }
}
