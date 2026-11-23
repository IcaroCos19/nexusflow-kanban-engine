import { CriticalPathAnalysis, EngineeringTask } from '../types/workflow';

/**
 * Checks whether adding a directed dependency edge (`taskId` depends on `prerequisiteId`)
 * would introduce a cycle into the task graph using Depth-First Search (DFS).
 */
export function wouldIntroduceCycle(
  tasks: readonly EngineeringTask[],
  taskId: string,
  prerequisiteId: string
): boolean {
  if (taskId === prerequisiteId) return true;

  const taskMap = new Map<string, EngineeringTask>(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const stack: string[] = [prerequisiteId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    if (currentId === taskId) {
      return true;
    }
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = taskMap.get(currentId);
    if (!node) continue;
    for (const depId of node.dependencies) {
      stack.push(depId);
    }
  }

  return false;
}

/**
 * Performs Kahn's Topological Sort and Dynamic Programming Critical Path Method (CPM)
 * on the Directed Acyclic Graph (DAG) of engineering tasks.
 * Returns the execution order, earliest start/finish times, and the bottleneck critical path.
 */
export function analyzeTaskDag(tasks: readonly EngineeringTask[]): CriticalPathAnalysis {
  const taskMap = new Map<string, EngineeringTask>(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    dependents.set(task.id, []);
  }

  for (const task of tasks) {
    for (const prereqId of task.dependencies) {
      if (!taskMap.has(prereqId)) continue;
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
      dependents.get(prereqId)!.push(task.id);
    }
  }

  // Kahn's Queue initialized with zero-prerequisite tasks
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const topologicalOrder: string[] = [];
  const earliestStart: Record<string, number> = {};
  const earliestFinish: Record<string, number> = {};
  const predecessorOnCriticalPath: Record<string, string | null> = {};

  for (const task of tasks) {
    earliestStart[task.id] = 0;
    earliestFinish[task.id] = task.estimateHours;
    predecessorOnCriticalPath[task.id] = null;
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    topologicalOrder.push(currentId);
    const currentTask = taskMap.get(currentId)!;
    const finishTime = earliestStart[currentId] + currentTask.estimateHours;
    earliestFinish[currentId] = finishTime;

    for (const nextId of dependents.get(currentId) ?? []) {
      const nextTask = taskMap.get(nextId)!;
      if (finishTime > earliestStart[nextId]) {
        earliestStart[nextId] = finishTime;
        earliestFinish[nextId] = finishTime + nextTask.estimateHours;
        predecessorOnCriticalPath[nextId] = currentId;
      }

      const updatedDegree = (inDegree.get(nextId) ?? 1) - 1;
      inDegree.set(nextId, updatedDegree);
      if (updatedDegree === 0) {
        queue.push(nextId);
      }
    }
  }

  if (topologicalOrder.length !== tasks.length) {
    throw new Error('CYCLE_DETECTED_IN_DAG');
  }

  // Backtrack from the task with maximum earliestFinish to reconstruct the Critical Path
  let endTaskId: string | null = null;
  let maxDuration = -1;

  for (const id of topologicalOrder) {
    if (earliestFinish[id] > maxDuration) {
      maxDuration = earliestFinish[id];
      endTaskId = id;
    }
  }

  const criticalPathIds: string[] = [];
  let cursor = endTaskId;
  while (cursor !== null) {
    criticalPathIds.unshift(cursor);
    cursor = predecessorOnCriticalPath[cursor] ?? null;
  }

  return {
    topologicalOrder,
    criticalPathIds,
    totalCriticalDurationHours: Math.max(0, maxDuration),
    earliestStartByTask: earliestStart,
    earliestFinishByTask: earliestFinish,
  };
}

/**
 * Immutable Command History Manager supporting O(1) Undo / Redo snapshots.
 */
export class UndoRedoHistory<T> {
  private past: T[] = [];
  private present: T;
  private future: T[] = [];

  constructor(initialState: T) {
    this.present = initialState;
  }

  public getCurrent(): T {
    return this.present;
  }

  public push(nextState: T): T {
    this.past.push(this.present);
    this.present = nextState;
    this.future = [];
    return this.present;
  }

  public undo(): T {
    if (this.past.length === 0) return this.present;
    const previous = this.past.pop()!;
    this.future.unshift(this.present);
    this.present = previous;
    return this.present;
  }

  public redo(): T {
    if (this.future.length === 0) return this.present;
    const next = this.future.shift()!;
    this.past.push(this.present);
    this.present = next;
    return this.present;
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }
}
