import { Component, computed, input } from '@angular/core';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxPopoverModule } from '@allianz/ng-aquila/popover';
import { EntityRow } from '../../../../core/models';

/** (i) beside an entity name: the events the entity is covered for. */
@Component({
  selector: 'app-entity-events-info',
  standalone: true,
  imports: [NxIconModule, NxPopoverModule],
  template: `
    @if (events().length) {
      <button
        type="button"
        class="info-btn"
        [nxPopoverTriggerFor]="eventsPopover"
        nxPopoverTrigger="click"
        nxPopoverDirection="bottom"
        [nxPopoverCloseable]="true"
        [attr.aria-label]="'Events ' + entity().name + ' is covered for'"
      >
        <nx-icon name="info-circle-o" size="s"></nx-icon>
      </button>
      <nx-popover #eventsPopover>
        <p class="info-pop__title">{{ title() }}</p>
        <ul class="info-pop__list">
          @for (ev of events(); track ev) {
            <li>{{ ev }}</li>
          }
        </ul>
      </nx-popover>
    }
  `,
  styles: `
    .info-btn {
      display: inline-flex;
      align-items: center;
      border: none;
      background: none;
      padding: 0;
      cursor: pointer;
      color: var(--interactive-primary);
    }
    .info-pop__title {
      margin: 0 0 var(--space-sm);
    }
    .info-pop__list {
      margin: 0;
      padding-left: var(--space-base);
    }
  `
})
export class EntityEventsInfoComponent {
  readonly entity = input.required<EntityRow>();
  readonly events = computed(() => this.entity().coveredForEvents ?? []);
  readonly title = computed(() =>
    this.events().length > 1
      ? 'This entity is covered for multiple events:'
      : 'This entity is covered for:'
  );
}
