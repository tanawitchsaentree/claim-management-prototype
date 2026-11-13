// 'cancelled' and 'deferred' come from Task Manager (BMPCC-21933): a task is
// open unless it is done, cancelled or deferred. Only the closure check reads
// them today; Task Manager's own status picker still offers the first three.
export type TaskStatus = 'open' | 'in-progress' | 'done' | 'cancelled' | 'deferred';
export type TaskType =
  | 'Review'
  | 'Contact'
  | 'Document'
  | 'Site visit'
  | 'Finance'
  | 'Legal'
  | 'Approval'
  | 'Investigation'
  | 'Notification';

export interface Task {
  taskId: string;
  taskKey: string;
  claimId: string;
  taskType: TaskType;
  description: string;
  status: TaskStatus;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  assignee: string;
  // GG booking fix tasks: the payment / reserve / recovery the task is about,
  // so Task manager can link straight to it.
  relatedItemId?: string;
  // Which team the task belongs to (Task Manager holds tasks from every
  // domain). Missing on most seeds; taskDomainOf() derives it from the type.
  domain?: TaskDomain;
  _scenario?: string;
}

export type TaskDomain =
  | 'Claims'
  | 'Recovery'
  | 'Reserves and payments'
  | 'Litigation'
  | 'Provider management';

// DESIGN DECISION BMPCC-22660-1: the one open-task rule (epic BMPCC-21933,
// "the rule exists once"). Manual closure, automatic closure after the final
// payment and every item of a bulk closure call this, nothing else.
export function isTaskOpen(task: Pick<Task, 'status'>): boolean {
  return task.status !== 'done' && task.status !== 'cancelled' && task.status !== 'deferred';
}

const DOMAIN_BY_TYPE: Partial<Record<TaskType, TaskDomain>> = {
  Finance: 'Reserves and payments',
  Legal: 'Litigation',
  'Site visit': 'Provider management'
};

export function taskDomainOf(task: Pick<Task, 'domain' | 'taskType'>): TaskDomain {
  return task.domain ?? DOMAIN_BY_TYPE[task.taskType] ?? 'Claims';
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
  deferred: 'Deferred'
};

export function taskStatusLabel(status: TaskStatus): string {
  return STATUS_LABEL[status];
}
