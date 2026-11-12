import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';

/**
 * Side-by-side mock for the accordion colour discussion (Investigation details):
 * A = the team's custom blue header, B = NDBX regular as shipped,
 * C = NDBX light as shipped. B and C carry no overrides at all.
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
