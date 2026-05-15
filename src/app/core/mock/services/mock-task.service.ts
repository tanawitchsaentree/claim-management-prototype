import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Task, TaskStatus, TaskType } from '../../models';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';

export interface TaskFilter {
  status?: TaskStatus;
  taskType?: TaskType;
  assignee?: string;
  priority?: string;
}

@Injectable({ providedIn: 'root' })
export class MockTaskService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
  private get tasks() { return this.stateSvc.state().tasks; }

  getAll(filter?: TaskFilter): Observable<Task[]> {
    let result = [...this.tasks];

    if (filter) {
      if (filter.status)    result = result.filter(t => t.status === filter.status);
      if (filter.taskType)  result = result.filter(t => t.taskType === filter.taskType);
      if (filter.assignee)  result = result.filter(t => t.assignee === filter.assignee);
      if (filter.priority)  result = result.filter(t => t.priority === filter.priority);
    }

    return this.list(result);
  }

  getByClaimId(claimId: string): Observable<Task[]> {
    const result = this.tasks.filter(t => t.claimId === claimId);
    return this.list(result);
  }

  getById(taskId: string): Observable<Task> {
    return this.findById(this.tasks as unknown as Record<string, unknown>[], 'taskId', taskId) as unknown as Observable<Task>;
  }

  create(payload: Omit<Task, 'taskId' | 'taskKey'>): Observable<Task> {
    const count = this.tasks.length + 1;
    const newTask: Task = {
      ...payload,
      taskId:  `t${Date.now()}`,
      taskKey: `TSK-${String(count).padStart(3, '0')}`,
    } as Task;
    this.stateSvc.patchTasks(tasks => [...tasks, newTask]);
    return this.respond(newTask);
  }

  update(taskId: string, payload: Partial<Task>): Observable<Task> {
    const existing = this.tasks.find(t => t.taskId === taskId);
    if (!existing) {
      return this.findById([], 'taskId', taskId) as unknown as Observable<Task>;
    }
    const updated = { ...existing, ...payload };
    this.stateSvc.patchTasks(tasks => tasks.map(t => t.taskId === taskId ? updated : t));
    return this.respond(updated);
  }

  delete(taskId: string): Observable<void> {
    this.stateSvc.patchTasks(tasks => tasks.filter(t => t.taskId !== taskId));
    return this.respond(undefined as void);
  }
}
