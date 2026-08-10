import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DbCompany,
  DbCustomer,
  DbProject,
  DbTaskDependency,
  DbTaskHistory,
  ResourceWorkload,
  CrossProjectImpact,
  DependencyReasonCode,
  CompanySettings
} from '@/types/project';

// --- Projects ---
export function useProjects(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      return apiFetch<DbProject[]>('/projects.php');
    },
    enabled: !!user && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectsByYear(year: number | null, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['projects', user?.id, 'year', year],
    queryFn: async () => {
      const url = year ? `/projects.php?year=${year}` : '/projects.php';
      return apiFetch<DbProject[]>(url);
    },
    enabled: !!user && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProject(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      return apiFetch<DbProject>(`/projects.php?id=${id}`);
    },
    enabled: !!user && !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: { 
      name: string; 
      description: string; 
      status: string; 
      start_date: string; 
      end_date: string; 
      company_id?: string | null; 
      customer_id?: string | null; 
      user_id?: string;
      budget_hours?: number | null;
      hourly_rate?: number | null;
      opportunity_id?: string | null;
    }) => {
      return apiFetch('/projects.php', {
        method: 'POST',
        body: JSON.stringify(project),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects-with-company-customer'] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      return apiFetch(`/projects.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', vars.id] });
      qc.invalidateQueries({ queryKey: ['projects-with-company-customer'] });
      if (vars.status === 'completed') {
        qc.invalidateQueries({ queryKey: ['tasks', 'all'] });
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['subtasks'] });
      }
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/projects.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects-with-company-customer'] });
    },
  });
}

// --- Project Members ---
export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      return apiFetch(`/project-members.php?project_id=${projectId}`);
    },
    enabled: !!projectId,
  });
}

export function useAddProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, userId, role = 'member' }: { projectId: string; userId: string; role?: string }) => {
      return apiFetch('/project-members.php', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, user_id: userId, role }),
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['project-members', vars.projectId] });
    },
  });
}

export function useRemoveProjectMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      return apiFetch(`/project-members.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['project-members', vars.projectId] });
    },
  });
}

// --- Opportunity Members ---
export function useOpportunityMembers(opportunityId: string) {
  return useQuery({
    queryKey: ['opportunity-members', opportunityId],
    queryFn: async () => {
      return apiFetch(`/opportunity-members.php?opportunity_id=${opportunityId}`);
    },
    enabled: !!opportunityId,
  });
}

export function useAddOpportunityMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ opportunityId, userId, role = 'member' }: { opportunityId: string; userId: string; role?: string }) => {
      return apiFetch('/opportunity-members.php', {
        method: 'POST',
        body: JSON.stringify({ opportunity_id: opportunityId, user_id: userId, role }),
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['opportunity-members', vars.opportunityId] });
    },
  });
}

export function useRemoveOpportunityMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, opportunityId }: { id: string; opportunityId: string }) => {
      return apiFetch(`/opportunity-members.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['opportunity-members', vars.opportunityId] });
    },
  });
}


export function useBaseCalendar() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['base-calendar'],
    queryFn: async () => {
      const res = await apiFetch<DbProject[]>('/projects.php?kind=base_calendar');
      return Array.isArray(res) ? res[0] ?? null : res;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
}
