import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';

/**
 * Side-by-side mock for the accordion colour discussion (Investigation details):
 * A = the team's custom blue header, B = NDBX Expert regular,
 * C = NDBX Expert light, B-D use the NDBX Expert accordion values, D = extra-light.
 */
@Component({
  selector: 'app-accordion-compare',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgTemplateOutlet, NxAccordionModule, NxFormfieldModule, NxInputModule],
  templateUrl: './accordion-compare.component.html',
  styleUrl: './accordion-compare.component.scss'
})
export class AccordionCompareComponent {}
