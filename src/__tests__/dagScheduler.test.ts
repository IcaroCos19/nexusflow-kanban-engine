import { describe, expect, it } from 'vitest';
import {
  analyzeTaskDag,
  UndoRedoHistory,
  wouldIntroduceCycle,
} from '../engine/dagScheduler';
import { INITIAL_TASKS } from '../data/initialTasks';

describe('NexusFlow DAG Scheduler & Critical Path Engine', () => {
  it('computes topological sort and exact Critical Path duration (CPM)', () => {
    const analysis = analyzeTaskDag(INITIAL_TASKS);

    // Path t1 (6h) -> t2 (8h) -> t3 (12h) -> t5 (14h) -> t6 (8h) = 48h
    // Alternative path t1 (6h) -> t4 (10h) -> t5 (14h) -> t6 (8h) = 38h
    expect(analysis.totalCriticalDurationHours).toBe(48);
    expect(analysis.criticalPathIds).toEqual(['t1', 't2', 't3', 't5', 't6']);
    expect(analysis.earliestStartByTask['t5']).toBe(26);
    expect(analysis.earliestFinishByTask['t6']).toBe(48);
  });

  it('detects direct and transitive dependency cycles using DFS', () => {
    // t6 depends on t5 -> t3 -> t2 -> t1. Making t1 depend on t6 creates a cycle.
    expect(wouldIntroduceCycle(INITIAL_TASKS, 't1', 't6')).toBe(true);
    // Self-dependency
    expect(wouldIntroduceCycle(INITIAL_TASKS, 't3', 't3')).toBe(true);
    // Valid acyclic edge: t6 depending on t4
    expect(wouldIntroduceCycle(INITIAL_TASKS, 't6', 't4')).toBe(false);
  });

  it('manages Undo / Redo immutable snapshots accurately', () => {
    const history = new UndoRedoHistory<number>(10);
    history.push(20);
    history.push(30);

    expect(history.getCurrent()).toBe(30);
    expect(history.undo()).toBe(20);
    expect(history.undo()).toBe(10);
    expect(history.canUndo()).toBe(false);
    expect(history.redo()).toBe(20);
  });
});
