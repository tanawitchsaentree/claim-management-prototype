import { Component, input, model } from '@angular/core';

/** Count on the left, "Needs you: N" filter next to it, page action on the right. */
@Component({
  selector: 'app-fo-list-toolbar',
  standalone: true,
  templateUrl: './list-toolbar.component.html',
  styleUrl: './list-toolbar.component.scss'
})
export class ListToolbarComponent {
  readonly count = input.required<number>();
  /** Items on this list that wait for the handler. Hidden at 0. */
  readonly needsYou = input(0);
  readonly needsYouOnly = model(false);
}
