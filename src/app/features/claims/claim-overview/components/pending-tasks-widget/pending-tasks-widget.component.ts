import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxPaginationModule } from '@allianz/ng-aquila/pagination';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';
import { AppDatePipe } from '../../../../../shared/pipes/app-date.pipe';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { Task } from '../../../../../core/models/task.model';

const TASKS_PAGE_SIZE = 10;

@Component({
  selector: 'app-pending-tasks-widget',
  standalone: true,
  imports: [TitleCasePipe, NxIconModule, NxTableModule, NxPaginationModule, StatusChipComponent, AppDatePipe, EmptyStateComponent],
  templateUrl: './pending-tasks-widget.component.html',
  styleUrl: './pending-tasks-widget.component.scss',
})
export class PendingTasksWidgetComponent {
  @Input({ required: true }) tasks: Task[] = [];
  @Input() expanded = false;
  @Output() toggled = new EventEmitter<void>();

  readonly tasksPageSize = TASKS_PAGE_SIZE;
  readonly tasksPage = signal(1);

  pendingTasks(): Task[] {
    return this.tasks.filter(t => t.status !== 'done');
  }

  taskCountByPriority(priority: string): number {
    return this.pendingTasks().filter(t => t.priority === priority).length;
  }

  pagedTasks(): Task[] {
    const start = (this.tasksPage() - 1) * TASKS_PAGE_SIZE;
    return this.tasks.slice(start, start + TASKS_PAGE_SIZE);
  }

  setPage(page: number): void {
    this.tasksPage.set(page);
  }
}
