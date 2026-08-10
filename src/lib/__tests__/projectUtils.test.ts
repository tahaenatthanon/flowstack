import { describe, it, expect } from 'vitest';
import {
  calculateProjectReport,
  deriveProjectStatus,
  calculateImpactSimulation,
  checkResourceConflict,
} from '@/lib/projectUtils';
import type { DbProject, DbTask } from '@/types/project';

// ── Factories ────────────────────────────────────────────────────────────────
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => iso(new Date(Date.now() + n * 86400000));

function makeProject(over: Partial<DbProject> = {}): DbProject {
  return {
    id: 'p1', user_id: 'u1', company_id: null, customer_id: null,
    name: 'Proj', kind: 'project', status: 'active',
    start_date: daysFromNow(-10), end_date: daysFromNow(10),
    original_end_date: null,
    ...over,
  } as DbProject;
}

function makeTask(over: Partial<DbTask> = {}): DbTask {
  return {
    id: Math.random().toString(36).slice(2), project_id: 'p1', user_id: 'u1',
    title: 'T', description: '', status: 'pending', priority: 'medium',
    assignee: 'A', assignee_user_id: null,
    start_date: daysFromNow(-5), end_date: daysFromNow(5), original_end_date: null,
    days_spent: 0, estimated_days: 5, is_ad_hoc: false, completed_date: null,
    created_at: '', updated_at: '', paused_at: null, paused_by: null,
    pause_reason: null, delay_reason: null, auto_shifted: false,
    parent_task_id: null, is_subtask: false, level: 0, sort_order: 0,
    progress_percentage: 0, estimated_hours: 8, actual_hours: 0, hourly_rate: 0,
    task_type: 'task', subtask_count: 0, total_hours: 0, recurring_task_id: null,
    ...over,
  } as DbTask;
}

describe('calculateProjectReport', () => {
  it('short-circuits base_calendar projects to zeroed report', () => {
    const r = calculateProjectReport(makeProject({ kind: 'base_calendar' }), [makeTask()]);
    expect(r.completionPercentage).toBe(0);
    expect(r.completedTasks).toHaveLength(0);
  });

  it('computes weighted completion % from estimated_days', () => {
    const tasks = [
      makeTask({ estimated_days: 10, status: 'completed' }), // contributes full 10
      makeTask({ estimated_days: 10, status: 'in-progress', days_spent: 5 }), // min(5,10)=5
    ];
    const r = calculateProjectReport(makeProject(), tasks);
    // (10 + 5) / 20 = 75%
    expect(r.completionPercentage).toBe(75);
  });

  it('caps days_spent at estimated_days in progress', () => {
    const tasks = [makeTask({ estimated_days: 4, status: 'in-progress', days_spent: 99 })];
    const r = calculateProjectReport(makeProject(), tasks);
    expect(r.completionPercentage).toBe(100);
  });

  it('excludes cancelled and ad-hoc tasks from progress denominator', () => {
    const tasks = [
      makeTask({ estimated_days: 10, status: 'completed' }),
      makeTask({ estimated_days: 10, status: 'cancelled' }),
      makeTask({ estimated_days: 10, status: 'pending', is_ad_hoc: true }),
    ];
    const r = calculateProjectReport(makeProject(), tasks);
    expect(r.completionPercentage).toBe(100); // only the completed regular task counts
    expect(r.adHocTasks).toHaveLength(1);
    expect(r.cancelledTasks).toHaveLength(1);
  });

  it('flags tasks past end_date as overdue (virtual)', () => {
    const tasks = [makeTask({ status: 'in-progress', end_date: daysFromNow(-1) })];
    const r = calculateProjectReport(makeProject(), tasks);
    expect(r.overdueTasks).toHaveLength(1);
  });

  it('returns 0% when no tasks carry an estimate', () => {
    const r = calculateProjectReport(makeProject(), [makeTask({ estimated_days: 0 })]);
    expect(r.completionPercentage).toBe(0);
  });
});

describe('deriveProjectStatus', () => {
  it('respects an explicitly completed project', () => {
    const p = makeProject({ status: 'completed' });
    expect(deriveProjectStatus(p, calculateProjectReport(p, []))).toBe('completed');
  });

  it('marks past-deadline projects as delayed', () => {
    const p = makeProject({ end_date: daysFromNow(-2) });
    expect(deriveProjectStatus(p, calculateProjectReport(p, []))).toBe('delayed');
  });

  it('marks low-progress near-deadline as at-risk', () => {
    const p = makeProject({ start_date: daysFromNow(-20), end_date: daysFromNow(2) });
    const tasks = [makeTask({ estimated_days: 10, status: 'pending', days_spent: 0 })];
    expect(deriveProjectStatus(p, calculateProjectReport(p, tasks))).toBe('at-risk');
  });

  it('returns on-track for healthy projects', () => {
    const p = makeProject();
    const tasks = [makeTask({ estimated_days: 10, status: 'completed' })];
    expect(deriveProjectStatus(p, calculateProjectReport(p, tasks))).toBe('on-track');
  });
});

describe('calculateImpactSimulation', () => {
  it('detects overlapping same-assignee tasks and computes delay', () => {
    const insert = { start_date: daysFromNow(0), end_date: daysFromNow(3), assignee: 'A', estimated_days: 3 };
    const tasks = [
      makeTask({ id: 't-overlap', assignee: 'A', start_date: daysFromNow(1), end_date: daysFromNow(4), estimated_days: 3 }),
      makeTask({ id: 't-other', assignee: 'B', start_date: daysFromNow(1), end_date: daysFromNow(4) }),
      makeTask({ id: 't-done', assignee: 'A', status: 'completed', start_date: daysFromNow(1), end_date: daysFromNow(4) }),
    ];
    const sim = calculateImpactSimulation(insert, tasks, [makeProject()]);
    expect(sim.totalImpact.affectedTaskCount).toBe(1);
    expect(sim.affectedTasks[0].taskId).toBe('t-overlap');
    expect(sim.totalImpact.maxDelayDays).toBeGreaterThan(0);
  });

  it('reports no impact when nothing overlaps', () => {
    const insert = { start_date: daysFromNow(0), end_date: daysFromNow(1), assignee: 'A', estimated_days: 1 };
    const tasks = [makeTask({ assignee: 'A', start_date: daysFromNow(10), end_date: daysFromNow(12) })];
    const sim = calculateImpactSimulation(insert, tasks, [makeProject()]);
    expect(sim.totalImpact.affectedTaskCount).toBe(0);
  });
});

describe('checkResourceConflict', () => {
  it('finds overlapping active tasks for the same assignee', () => {
    const tasks = [makeTask({ id: 'c1', assignee: 'A', start_date: daysFromNow(0), end_date: daysFromNow(5) })];
    const r = checkResourceConflict('A', daysFromNow(2), daysFromNow(7), tasks);
    expect(r.hasConflict).toBe(true);
  });

  it('ignores the excluded task and completed/cancelled tasks', () => {
    const tasks = [
      makeTask({ id: 'self', assignee: 'A', start_date: daysFromNow(0), end_date: daysFromNow(5) }),
      makeTask({ id: 'done', assignee: 'A', status: 'completed', start_date: daysFromNow(0), end_date: daysFromNow(5) }),
    ];
    const r = checkResourceConflict('A', daysFromNow(1), daysFromNow(4), tasks, 'self');
    expect(r.hasConflict).toBe(false);
  });
});
