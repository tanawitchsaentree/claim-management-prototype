import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { MockTaskService } from '../../core/mock/services/mock-task.service';
import { AuthService } from '../../core/services/auth';
import { Task, TaskStatus } from '../../core/models/task.model';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { AppDatePipe } from '../../shared/pipes/app-date.pipe';
import { ToastService } from '../../shared/components/toast/toast.service';

type StatusFilter = 'all' | TaskStatus;

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' }
];
import { ClaimNumberPipe } from '../../shared/pipes/claim-number.pipe';

@Component({
  selector: 'app-task-manager',
  standalone: true,
  imports: [
    ClaimNumberPipe,
    RouterLink,
    NxTableModule,
    NxIconModule,
    StatusChipComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    AppDatePipe
  ],
  templateUrl: './task-manager.component.html',
  styleUrl: './task-manager.component.scss'
})
export class TaskManagerComponent implements OnInit {
  private readonly taskSvc = inject(MockTaskService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  /** Task to highlight when arriving from a "Needs fixing" row. */
  readonly highlightTaskId = this.route.snapshot.queryParamMap.get('task');

  readonly statusOptions = STATUS_OPTIONS;
  readonly loading = signal(true);
  readonly allTasks = signal<Task[]>([]);
  readonly showMyTasksOnly = signal(false);
  readonly statusFilter = signal<StatusFilter>('all');

  readonly displayedTasks = computed<Task[]>(() => {
    const name = this.auth.user()?.name ?? '';
    let tasks = this.showMyTasksOnly() ? this.allTasks().filter(t => t.assignee === name) : this.allTasks();
    const status = this.statusFilter();
    if (status !== 'all') tasks = tasks.filter(t => t.status === status);
    const pinned = this.highlightTaskId;
    return [...tasks].sort((a, b) => {
      // Arriving from a "Couldn't be booked" row: that task goes first.
      if (pinned && (a.taskId === pinned) !== (b.taskId === pinned)) return a.taskId === pinned ? -1 : 1;
      const aDone = a.status === 'done' ? 1 : 0;
      const bDone = b.status === 'done' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return a.dueDate.localeCompare(b.dueDate);
    });
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const tasks = await firstValueFrom(this.taskSvc.getAll());
    this.allTasks.set(tasks);
    this.loading.set(false);
    const target = tasks.find(t => t.taskId === this.highlightTaskId);
    if (target) {
      // Land on "my tasks" so it isn't buried, when the task is the user's own.
      if (target.assignee === (this.auth.user()?.name ?? '')) this.showMyTasksOnly.set(true);
      setTimeout(() => {
        const row = Array.from(document.querySelectorAll('[data-task-id]')).find(
          el => el.getAttribute('data-task-id') === target.taskId
        );
        row?.scrollIntoView({ block: 'center' });
      }, 200);
    }
  }

  setStatusFilter(status: StatusFilter): void {
    this.statusFilter.set(status);
  }

  toggleMyTasksOnly(checked: boolean): void {
    this.showMyTasksOnly.set(checked);
  }

  isOverdue(dueDate: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  }

  daysOverdue(dueDate: string): number {
    return Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
  }

  async onStatusChange(task: Task, status: TaskStatus): Promise<void> {
    if (status === task.status) return;
    const updated = await firstValueFrom(this.taskSvc.update(task.taskId, { status }));
    this.allTasks.set(this.allTasks().map(t => (t.taskId === updated.taskId ? updated : t)));
    this.toast.success('Task updated', `${task.taskKey} marked ${status}.`);
  }
}
