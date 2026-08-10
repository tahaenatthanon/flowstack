import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type {
  DbCompany,
  DbCustomer,
  DbTask,
  DbTaskDependency,
  DbTaskHistory,
  DbTaskHoursEntry,
  ResourceWorkload,
  CrossProjectImpact,
  DependencyReasonCode,
  CompanySettings
} from '@/types/project';

// --- Tasks ---
export function useTasks(projectId: string | undefined, parentOnly = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tasks', projectId, parentOnly],
    queryFn: async () => {
      const qs = parentOnly ? '&parent_only=1' : '';
      return apiFetch<DbTask[]>(`/tasks.php?project_id=${projectId}${qs}`);
    },
    enabled: !!user && !!projectId,
  });
}

export interface TasksPage {
  data: DbTask[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AllTasksParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  type?: string;
  assignee?: string;
  my?: boolean;
  parent_only?: boolean;
  subtask_only?: boolean;
  year_from?: string;
  year_to?: string;
}

// Get all tasks across all projects (server-side paginated)
export function useAllTasks(params: AllTasksParams = {}, enabled = true) {
  const { user } = useAuth();
  const {
    page = 1, per_page = 50, search = '', status = '', type = '', assignee = '',
    my = false, parent_only = false, subtask_only = false, year_from = '', year_to = '',
  } = params;

  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('per_page', String(per_page));
  if (search)       qs.set('search', search);
  if (status)       qs.set('status', status);
  if (type)         qs.set('type', type);
  if (assignee)     qs.set('assignee', assignee);
  if (my)           qs.set('my', '1');
  if (parent_only)  qs.set('parent_only', '1');
  if (subtask_only) qs.set('subtask_only', '1');
  if (year_from)    qs.set('year_from', year_from);
  if (year_to)      qs.set('year_to', year_to);

  return useQuery<TasksPage>({
    queryKey: ['tasks', 'all', page, per_page, search, status, type, assignee, my, parent_only, subtask_only, year_from, year_to],
    queryFn: async () => {
      return apiFetch<TasksPage>(`/tasks.php?${qs.toString()}`);
    },
    enabled: !!user && enabled,
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

// Fetch direct children of a task (for inline expand in งานทั้งหมด)
export function useTaskChildren(parentId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['tasks', 'children', parentId],
    queryFn: () => apiFetch<DbTask[]>(`/tasks.php?parent_id=${parentId}`),
    enabled: !!user && !!parentId,
    staleTime: 60 * 1000,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      project_id: string; title: string; description?: string; status?: string;
      priority?: string; assignee?: string; assignee_user_id?: string | null;
      start_date: string; end_date: string;
      estimated_days: number; estimated_hours?: number; is_ad_hoc?: boolean; task_type?: string;
    }) => {
      return apiFetch('/tasks.php', {
        method: 'POST',
        body: JSON.stringify(task),
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['tasks', 'all'] });
      qc.invalidateQueries({ queryKey: ['tasks', 'children'] });
      qc.invalidateQueries({ queryKey: ['subtasks'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-all'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; project_id: string; [key: string]: any }) => {
      const res = await apiFetch(`/tasks.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return res;
    },
    onSuccess: (data, vars) => {
      // Directly update the individual task cache with the API response.
      // This bypasses the stale-data window that occurs when a disabled
      // query is re-enabled: without this, the stale cached data is shown
      // first and the background refetch might complete after the consuming
      // component has already captured the stale value into useState.
      if (data?.id) {
        qc.setQueryData(['task', data.id], data);
      }
      qc.invalidateQueries({ queryKey: ['tasks', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['tasks', 'all'] });
      qc.invalidateQueries({ queryKey: ['tasks', 'children'] });
      qc.invalidateQueries({ queryKey: ['subtasks'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-all'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
    onError: (error: any) => {
      // 409 = concurrent edit conflict — show a prominent warning toast
      if (error?.status === 409 || error?.conflict) {
        toast({
          title: 'ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น',
          description: 'งานนี้ถูกอัปเดตหลังจากที่คุณเปิดดู กรุณาโหลดข้อมูลใหม่แล้วแก้ไขอีกครั้ง',
          variant: 'destructive',
          duration: 8000,
        });
        // Invalidate so the UI shows the latest server state automatically
        qc.invalidateQueries({ queryKey: ['task'] });
        qc.invalidateQueries({ queryKey: ['tasks'] });
      }
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      await apiFetch(`/tasks.php?id=${id}`, { method: 'DELETE' });
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', 'all'] });
      qc.invalidateQueries({ queryKey: ['tasks', 'children'] });
      qc.invalidateQueries({ queryKey: ['subtasks'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-all'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

// ============================================
// --- Subtasks ---
// ============================================

export function useSubtasks(parentTaskId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['subtasks', parentTaskId],
    queryFn: async () => {
      return apiFetch<DbTask[]>(`/subtasks.php?parent_task_id=${parentTaskId}`);
    },
    enabled: !!user && !!parentTaskId,
  });
}

export interface SubtaskReportItem {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  start_date: string;
  end_date: string;
  days_spent: number;
  estimated_days: number;
  completed_date: string | null;
  created_at: string;
  project_id: string;
  parent_task_id: string;
  project_name: string;
  parent_task_title: string;
}

export interface SubtasksReportResult {
  subtasks: SubtaskReportItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface SubtasksReportParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  start_date?: string;
  end_date?: string;
  project_id?: string;
}

export function useSubtasksReport(params: SubtasksReportParams = {}, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['subtasks-report', params],
    queryFn: async () => {
      const qs = new URLSearchParams({ report: '1' });
      if (params.page)       qs.set('page',       String(params.page));
      if (params.limit)      qs.set('limit',      String(params.limit));
      if (params.search)     qs.set('search',     params.search);
      if (params.status)     qs.set('status',     params.status);
      if (params.priority)   qs.set('priority',   params.priority);
      if (params.start_date) qs.set('start_date', params.start_date);
      if (params.end_date)   qs.set('end_date',   params.end_date);
      if (params.project_id) qs.set('project_id', params.project_id);
      return apiFetch<SubtasksReportResult>(`/subtasks.php?${qs.toString()}`);
    },
    enabled: !!user && enabled,
    staleTime: 30 * 1000,
  });
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subtask: {
      parent_task_id: string;
      project_id: string;
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      task_type?: string;
      assignee?: string;
      assignee_user_id?: string | null;
      start_date?: string;
      end_date?: string;
      estimated_days?: number;
      estimated_hours?: number;
      actual_hours?: number;
    }) => {
      return apiFetch('/subtasks.php', {
        method: 'POST',
        body: JSON.stringify({ ...subtask, is_subtask: false }),
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['subtasks', vars.parent_task_id] });
      qc.invalidateQueries({ queryKey: ['tasks', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['tasks', 'all'] });
      qc.invalidateQueries({ queryKey: ['tasks', 'children', vars.parent_task_id] });
      qc.invalidateQueries({ queryKey: ['subtasks'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-all'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id, ...updates }: { id: string; project_id: string; parent_task_id?: string; [key: string]: any }) => {
      return apiFetch(`/subtasks.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (data, vars) => {
      if (data?.id) {
        qc.setQueryData(['task', data.id], data);
      }
      if (vars.parent_task_id) qc.invalidateQueries({ queryKey: ['subtasks', vars.parent_task_id] });
      qc.invalidateQueries({ queryKey: ['tasks', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['tasks', 'all'] });
      qc.invalidateQueries({ queryKey: ['tasks', 'children'] });
      qc.invalidateQueries({ queryKey: ['subtasks'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-all'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, project_id, parent_task_id }: { id: string; project_id: string; parent_task_id?: string }) => {
      await apiFetch(`/subtasks.php?id=${id}`, { method: 'DELETE' });
      return { project_id, parent_task_id };
    },
    onSuccess: (res) => {
      if (res.parent_task_id) qc.invalidateQueries({ queryKey: ['subtasks', res.parent_task_id] });
      qc.invalidateQueries({ queryKey: ['tasks', res.project_id] });
      qc.invalidateQueries({ queryKey: ['tasks', 'all'] });
      qc.invalidateQueries({ queryKey: ['tasks', 'children'] });
      qc.invalidateQueries({ queryKey: ['subtasks'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-all'] });
      qc.invalidateQueries({ queryKey: ['task'] });
    },
  });
}

// --- Task Hours (subtask hour logging) ---
export function useTaskHoursEntries(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['task-hours', projectId],
    queryFn: async () => {
      return apiFetch<DbTaskHoursEntry[]>(`/task-hours.php?project_id=${projectId}`);
    },
    enabled: !!user && !!projectId,
  });
}

// Get all task-hours entries across all projects
export function useAllTaskHoursEntries(
  enabled = true,
  params: { dateFrom?: string; dateTo?: string } = {}
) {
  const { user } = useAuth();
  const { dateFrom = '', dateTo = '' } = params;
  const qs = new URLSearchParams();
  if (dateFrom) qs.set('date_from', dateFrom);
  if (dateTo)   qs.set('date_to',   dateTo);
  const url = `/task-hours.php${qs.toString() ? '?' + qs.toString() : ''}`;
  return useQuery({
    queryKey: ['task-hours', 'all', dateFrom, dateTo],
    queryFn: async () => {
      return apiFetch<DbTaskHoursEntry[]>(url);
    },
    enabled: !!user && enabled,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateTaskHoursEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      task_id?: string;
      date: string;
      hours_worked: number;
      description: string;
      projectId?: string;
      work_type?: string;
      start_time?: string;
      end_time?: string;
    }) => {
      const { projectId, ...rest } = entry;
      const data = await apiFetch('/task-hours.php', {
        method: 'POST',
        body: JSON.stringify({ ...rest, project_id: projectId }),
      });
      return { data, projectId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-hours'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTaskHoursEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      return apiFetch(`/task-hours.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-hours'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTaskHoursEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; projectId?: string }) => {
      await apiFetch(`/task-hours.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-hours'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ============================================
// --- Task Dependencies ---
// ============================================

// useTaskDependencies: what is blocking taskId (what taskId depends on)
export function useTaskDependencies(taskId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['task-dependencies', taskId],
    queryFn: async () => {
      return apiFetch<DbTaskDependency[]>(`/task-dependencies.php?task_id=${taskId}`);
    },
    enabled: !!user && !!taskId,
  });
}

// useBlockingDependencies: tasks that depend on taskId (what taskId is blocking)
export function useBlockingDependencies(taskId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['blocking-dependencies', taskId],
    queryFn: async () => {
      return apiFetch<DbTaskDependency[]>(`/task-dependencies.php?depends_on_task_id=${taskId}`);
    },
    enabled: !!user && !!taskId,
  });
}

// useProjectDependencies: all deps for a project (used in Gantt arrows)
export function useProjectDependencies(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['project-dependencies', projectId],
    queryFn: async () => {
      return apiFetch<DbTaskDependency[]>(`/task-dependencies.php?project_id=${projectId}`);
    },
    enabled: !!user && !!projectId,
    staleTime: 30 * 1000,
  });
}

export function useCreateTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dep: {
      task_id: string;          // the blocked task (current task)
      depends_on_task_id: string; // the blocking task (must finish first)
      dependency_type?: string; // 'depends_on' | 'blocks'
      notes?: string;
    }) => {
      return apiFetch<DbTaskDependency>('/task-dependencies.php', {
        method: 'POST',
        body: JSON.stringify({ dependency_type: 'depends_on', ...dep }),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['task-dependencies', data.task_id] });
      qc.invalidateQueries({ queryKey: ['blocking-dependencies', data.depends_on_task_id] });
      qc.invalidateQueries({ queryKey: ['project-dependencies', data.project_id] });
      qc.invalidateQueries({ queryKey: ['cross-project-impact'] });
    },
  });
}

export function useResolveDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dependencyId: string) => {
      return apiFetch<DbTaskDependency>(`/task-dependencies.php?id=${dependencyId}`, {
        method: 'PUT',
        body: JSON.stringify({ resolved: true }),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['task-dependencies', data.task_id] });
      qc.invalidateQueries({ queryKey: ['blocking-dependencies', data.depends_on_task_id] });
      qc.invalidateQueries({ queryKey: ['cross-project-impact'] });
    },
  });
}

// ============================================
// --- Task History (Audit Log) ---
// ============================================

export function useTaskHistory(taskId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['task-history', taskId],
    queryFn: async () => {
      return apiFetch<DbTaskHistory[]>(`/task-history.php?task_id=${taskId}`);
    },
    enabled: !!user && !!taskId,
  });
}

export function useCreateTaskHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (history: {
      task_id: string;
      action: DbTaskHistory['action'];
      field_name?: string;
      old_value?: string;
      new_value?: string;
      reason?: string;
      related_task_id?: string;
    }) => {
      return apiFetch<DbTaskHistory>('/task-history.php', {
        method: 'POST',
        body: JSON.stringify(history),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['task-history', data.task_id] });
    },
  });
}

// ============================================
// --- Recurring Tasks ---
// ============================================

export interface RecurringTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  priority: string;
  assignee?: string;
  estimated_days: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval_count: number;
  start_date: string;
  end_date?: string;
  next_due_date?: string;
  recur_end_date?: string;
  max_occurrences?: number;
  is_active: number;
  instance_count?: number;
  next_occurrence?: string;
  created_at?: string;
}

export function useRecurringTask(taskId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recurring-task-for', taskId],
    queryFn: async () => {
      return apiFetch<RecurringTask | null>(`/recurring-tasks.php?task_id=${taskId}`);
    },
    enabled: !!user && !!taskId,
  });
}

export function useRecurringTasks(projectId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['recurring-tasks', projectId],
    queryFn: async () => {
      return apiFetch<RecurringTask[]>(`/recurring-tasks.php?project_id=${projectId}`);
    },
    enabled: !!user && !!projectId,
  });
}

export function useCreateRecurringTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<RecurringTask> & { project_id: string; title: string; frequency: string; start_date: string }) => {
      return apiFetch<RecurringTask>('/recurring-tasks.php', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['recurring-tasks', vars.project_id] });
    },
  });
}

export function useUpdateRecurringTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RecurringTask> }) => {
      return apiFetch<RecurringTask>(`/recurring-tasks.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['recurring-tasks', data.project_id] });
    },
  });
}

export function useDeleteRecurringTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      await apiFetch(`/recurring-tasks.php?id=${id}`, { method: 'DELETE' });
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ['recurring-tasks', projectId] });
    },
  });
}

// ============================================
// --- Resource Workload (from VIEW) ---
// ============================================

export function useResourceWorkload(assignee?: string, year?: number, startDate?: string, endDate?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['resource-workload', assignee, year, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (assignee) params.append('assignee', assignee);
      if (year) params.append('year', year.toString());
      else params.append('year', new Date().getFullYear().toString()); // Default to current year
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      return apiFetch<ResourceWorkload[]>(`/views/resource-workload.php?${params.toString()}`);
    },
    enabled: !!user,
  });
}

// ============================================
// --- Cross-Project Impact (from VIEW) ---
// ============================================

export function useCrossProjectImpact(activeOnly: boolean = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cross-project-impact', activeOnly],
    queryFn: async () => {
      const params = activeOnly ? '?active_only=1' : '';
      return apiFetch<CrossProjectImpact[]>(`/views/cross-project-impact.php${params}`);
    },
    enabled: !!user,
  });
}

