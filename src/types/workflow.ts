export type WorkflowStage = 'BACKLOG' | 'IN_PROGRESS' | 'CODE_REVIEW' | 'DONE';
export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface EngineeringTask {
  id: string;
  key: string; // e.g. "NEX-101"
  title: string;
  description: string;
  stage: WorkflowStage;
  priority: TaskPriority;
  estimateHours: number;
  assignee: string;
  tags: string[];
  /** IDs of prerequisite tasks that must finish before this task */
  dependencies: string[];
}

export interface CriticalPathAnalysis {
  topologicalOrder: string[];
  criticalPathIds: string[];
  totalCriticalDurationHours: number;
  earliestStartByTask: Record<string, number>;
  earliestFinishByTask: Record<string, number>;
}
