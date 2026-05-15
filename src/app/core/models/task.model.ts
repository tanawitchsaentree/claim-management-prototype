export type TaskStatus = 'open' | 'in-progress' | 'done';
export type TaskType = 'Review' | 'Contact' | 'Document' | 'Site visit' | 'Finance' | 'Legal' | 'Approval' | 'Investigation' | 'Notification';

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
  _scenario?: string;
}
