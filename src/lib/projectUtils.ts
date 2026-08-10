import { DbProject, DbTask, ProjectReport, ImpactSimulation } from '@/types/project';
import { differenceInDays, parseISO, addDays, format, isBefore } from 'date-fns';

/** Marker substring expected in a task's pause_reason to classify it as "blocked". */
const BLOCK_REASON_MARKER = 'BLOCK';

export function calculateProjectReport(project: DbProject, tasks: DbTask[]): ProjectReport {
  // Base Calendar (ปฏิทินทีม) ไม่คำนวณ KPI โปรเจกต์
  if (project.kind === 'base_calendar') {
    return {
      completionPercentage: 0,
      totalDays: 0,
      daysUsed: 0,
      daysRemaining: 0,
      completedTasks: [],
      inProgressTasks: [],
      pendingTasks: [],
      overdueTasks: [],
      cancelledTasks: [],
      nextTasks: [],
      adHocTasks: [],
      extensionDays: 0,
      pausedTasks: [],
      blockedTasks: [],
    };
  }

  const today = new Date();
  const start = parseISO(project.start_date);
  const end = parseISO(project.end_date);
  
  // Calculate total days (including extension days if any)
  const totalDays = Math.max(1, differenceInDays(end, start) + 1);
  
  // Days used - calculate from start to today, but don't count future days
  let daysUsed = differenceInDays(today, start);
  if (today < start) {
    daysUsed = 0; // Project hasn't started yet
  }
  
  // Days remaining - calculate from today to end
  let daysRemaining = differenceInDays(end, today);
  if (today > end) {
    daysRemaining = 0; // Project is overdue/completed
  }
  
  // For completed projects, show actual days used
  if (project.status === 'completed') {
    daysUsed = totalDays;
    daysRemaining = 0;
  }

  // Filter out ad-hoc tasks for progress calculation (only regular tasks)
  const regularTasks = tasks.filter(t => !t.is_ad_hoc && !t.is_subtask);
  
  const completedTasks = regularTasks.filter(t => t.status === 'completed');
  const inProgressTasks = regularTasks.filter(t => t.status === 'in-progress');
  const pendingTasks = regularTasks.filter(t => t.status === 'pending');
  // Virtual overdue: DB status OR end_date already passed and not done/cancelled
  const overdueTasks = regularTasks.filter(t =>
    t.status !== 'completed' && t.status !== 'cancelled' &&
    (t.status === 'overdue' || isBefore(parseISO(t.end_date), today))
  );
  const cancelledTasks = regularTasks.filter(t => t.status === 'cancelled');
  const adHocTasks = tasks.filter(t => t.is_ad_hoc);
  const pausedTasks = regularTasks.filter(t => t.paused_at !== null);
  // NOTE: no code path currently writes the BLOCK marker into pause_reason, so this
  // list is presently always empty. Kept for forward-compat / UI shape; promote to a
  // dedicated `is_blocked` column if an explicit blocking feature is introduced.
  const blockedTasks = regularTasks.filter(
    t => t.paused_at !== null && t.pause_reason?.includes(BLOCK_REASON_MARKER)
  );

  // Calculate progress based on new formula:
  // % = Σ( for each task:
  //   if status = completed → estimated_days
  //   else (in-progress, pending, overdue) → MIN(days_spent, estimated_days)
  // ) ÷ Σ(estimated_days) × 100
  
  // Only include tasks with estimated_days > 0, exclude cancelled
  const tasksWithEstimate = regularTasks.filter(t => t.estimated_days > 0 && t.status !== 'cancelled');
  
  const totalEstimated = tasksWithEstimate.reduce((sum, t) => sum + t.estimated_days, 0);
  
  let progressSum = 0;
  tasksWithEstimate.forEach(t => {
    if (t.status === 'completed') {
      // Completed task: use full estimated_days (cancelled already excluded above)
      progressSum += t.estimated_days;
    } else {
      // In-progress, pending, overdue: use MIN(days_spent, estimated_days)
      const daysSpent = t.days_spent || 0;
      progressSum += Math.min(daysSpent, t.estimated_days);
    }
  });
  
  // Calculate completion percentage: 0% if no tasks with estimated_days
  const completionPercentage = totalEstimated > 0 
    ? Math.round((progressSum / totalEstimated) * 100) 
    : 0;

  const nextTasks = [...inProgressTasks, ...pendingTasks]
    .filter(t => !t.paused_at && t.status !== 'cancelled') // ไม่รวมงานที่ถูก pause หรือ cancelled
    .sort((a, b) => parseISO(a.start_date).getTime() - parseISO(b.start_date).getTime())
    .slice(0, 3);

  const extensionDays = project.original_end_date
    ? differenceInDays(parseISO(project.end_date), parseISO(project.original_end_date))
    : 0;

  return {
    completionPercentage,
    totalDays,
    daysUsed,
    daysRemaining,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    overdueTasks,
    cancelledTasks,
    nextTasks,
    adHocTasks,
    extensionDays,
    pausedTasks,
    blockedTasks,
  };
}

/**
 * Derive project status from actual progress + timeline (frontend-computed, not stored).
 *
 * Rules (priority order):
 *  1. completed  — respected as-is (user/manual)
 *  2. delayed    — end_date < today (hard deadline missed)
 *  3. at-risk    — any of:
 *       • ≤ 3 days left AND completion < 75%
 *       • has overdue tasks AND < 7 days left
 *       • time elapsed > 30% AND completion is 25+ pts behind expected
 *  4. on-track   — everything else
 */
export function deriveProjectStatus(
  project: DbProject,
  report: ProjectReport
): 'completed' | 'delayed' | 'at-risk' | 'on-track' {
  if (project.status === 'completed') return 'completed';
  if (project.kind === 'base_calendar') return 'on-track';

  const today = new Date();
  const end = parseISO(project.end_date);

  if (isBefore(end, today)) return 'delayed';

  const { daysRemaining, totalDays, daysUsed, completionPercentage, overdueTasks } = report;

  if (daysRemaining <= 3 && completionPercentage < 75) return 'at-risk';
  if (overdueTasks.length > 0 && daysRemaining < 7) return 'at-risk';

  const timeElapsedPct = totalDays > 0 ? Math.round((daysUsed / totalDays) * 100) : 0;
  if (timeElapsedPct > 30 && completionPercentage < timeElapsedPct - 25) return 'at-risk';

  return 'on-track';
}

/**
 * คำนวณผลกระทบของงานแทรก (Impact Simulation)
 * @param insertTask งานแทรกที่จะเพิ่มเข้าไป
 * @param affectedAssignee คนที่จะได้รับงานแทรก
 * @param allTasks งานทั้งหมดในระบบ
 * @param allProjects โปรเจกต์ทั้งหมดในระบบ
 * @returns ผลกระทบที่คำนวณได้
 */
export function calculateImpactSimulation(
  insertTask: { start_date: string; end_date: string; assignee: string; estimated_days: number },
  allTasks: DbTask[],
  allProjects: DbProject[]
): ImpactSimulation {
  const insertStart = parseISO(insertTask.start_date);
  const insertEnd = parseISO(insertTask.end_date);

  // หางานที่จะถูกกระทบ (งานของคนคนเดียวกันที่ทับกัน)
  const affectedTasks = allTasks.filter(task => {
    if (task.assignee !== insertTask.assignee) return false;
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    
    const taskStart = parseISO(task.start_date);
    const taskEnd = parseISO(task.end_date);
    
    // เช็คว่าช่วงเวลาทับกันหรือไม่
    return (insertStart <= taskEnd && insertEnd >= taskStart);
  });

  const affectedTasksWithDelay = affectedTasks.map(task => {
    const taskStart = parseISO(task.start_date);
    const taskEnd = parseISO(task.end_date);
    
    // คำนวณวันที่เลื่อนออกไป
    const suggestedStartDate = addDays(insertEnd, 1);
    const suggestedEndDate = addDays(suggestedStartDate, task.estimated_days);
    const delayDays = differenceInDays(suggestedEndDate, taskEnd);
    
    const project = allProjects.find(p => p.id === task.project_id);
    
    return {
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.project_id,
      projectName: project?.name || '',
      currentEndDate: task.end_date,
      suggestedEndDate: format(suggestedEndDate, 'yyyy-MM-dd'),
      delayDays: Math.max(0, delayDays),
    };
  });

  // สรุปผลกระทบต่อโปรเจกต์
  const projectImpactMap = new Map<string, {
    projectId: string;
    projectName: string;
    currentEndDate: string;
    maxDelayDays: number;
    taskCount: number;
  }>();

  affectedTasksWithDelay.forEach(task => {
    const existing = projectImpactMap.get(task.projectId);
    if (existing) {
      existing.maxDelayDays = Math.max(existing.maxDelayDays, task.delayDays);
      existing.taskCount += 1;
    } else {
      const project = allProjects.find(p => p.id === task.projectId);
      if (project) {
        projectImpactMap.set(task.projectId, {
          projectId: task.projectId,
          projectName: task.projectName,
          currentEndDate: project.end_date,
          maxDelayDays: task.delayDays,
          taskCount: 1,
        });
      }
    }
  });

  const affectedProjects = Array.from(projectImpactMap.values()).map(proj => ({
    ...proj,
    suggestedEndDate: format(
      addDays(parseISO(proj.currentEndDate), proj.maxDelayDays),
      'yyyy-MM-dd'
    ),
    delayDays: proj.maxDelayDays,
    affectedTaskCount: proj.taskCount,
  }));

  return {
    affectedTasks: affectedTasksWithDelay,
    affectedProjects,
    totalImpact: {
      affectedTaskCount: affectedTasks.length,
      affectedProjectCount: projectImpactMap.size,
      maxDelayDays: Math.max(...affectedTasksWithDelay.map(t => t.delayDays), 0),
    },
  };
}

/**
 * เช็คว่า assignee มี workload ซ้อนทับหรือไม่
 */
export function checkResourceConflict(
  assignee: string,
  startDate: string,
  endDate: string,
  tasks: DbTask[],
  excludeTaskId?: string
): { hasConflict: boolean; conflictingTasks: DbTask[] } {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  const conflictingTasks = tasks.filter(task => {
    if (task.id === excludeTaskId) return false;
    if (task.assignee !== assignee) return false;
    if (task.status === 'completed' || task.status === 'cancelled') return false;
    
    const taskStart = parseISO(task.start_date);
    const taskEnd = parseISO(task.end_date);
    
    return (start <= taskEnd && end >= taskStart);
  });
  
  return {
    hasConflict: conflictingTasks.length > 0,
    conflictingTasks,
  };
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'status-completed';
    case 'in-progress': return 'status-in-progress';
    case 'pending': return 'status-pending';
    case 'overdue': return 'status-overdue';
    case 'cancelled': return 'status-cancelled';
    default: return '';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed': return 'เสร็จแล้ว';
    case 'in-progress': return 'กำลังทำ';
    case 'pending': return 'รอดำเนินการ';
    case 'overdue': return 'เลยกำหนด';
    case 'cancelled': return 'ยกเลิก';
    case 'on-track': return 'ตามแผน';
    case 'at-risk': return 'มีความเสี่ยง';
    case 'delayed': return 'ล่าช้า';
    case 'on-hold': return 'พักไว้';
    default: return status;
  }
}

export function getProjectStatusColor(status: string): string {
  switch (status) {
    case 'on-track': return 'status-completed';
    case 'at-risk': return 'status-pending';
    case 'delayed': return 'status-overdue';
    case 'completed': return 'status-completed';
    case 'on-hold': return 'status-pending';
    case 'cancelled': return 'status-cancelled';
    default: return '';
  }
}

export function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'high': return 'สูง';
    case 'medium': return 'ปานกลาง';
    case 'low': return 'ต่ำ';
    default: return priority;
  }
}

