import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DbCompany,
  DbCustomer,
  DbTaskDependency,
  DbTaskHistory,
  ResourceWorkload,
  CrossProjectImpact,
  DependencyReasonCode,
  CompanySettings
} from '@/types/project';

// ============================================================
// Admin Overview (single endpoint for overview tab stats)
// ============================================================

export interface AdminOverviewStats {
  users:         { total: number; active: number; admin: number };
  projects:      { total: number; active: number; completed: number };
  tasks:         { total: number; completed: number; in_progress: number; overdue: number };
  companies:     { total: number; customers: number };
  opportunities: { total: number; active: number; won: number; pipeline_value: number };
  quotations:    { total: number; approved: number; pending: number };
  task_hours: { total_hours: number; total_entries: number };
}

export interface AdminOverviewData {
  stats: AdminOverviewStats;
  at_risk_projects: any[];
  overdue_tasks:    any[];
  recent_users:     any[];
}

export function useAdminOverview(params: { start_date: string; end_date: string }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-overview', params.start_date, params.end_date],
    queryFn: async () => {
      return apiFetch<AdminOverviewData>(
        `/admin-overview.php?start_date=${params.start_date}&end_date=${params.end_date}`
      );
    },
    enabled: !!user && Number(user?.is_admin) === 1,
    staleTime: 2 * 60 * 1000,
  });
}

export interface ActivityLog {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  action: string;
  description: string;
  ip_address: string | null;
  created_at: string;
}

export interface ActivityLogsResult {
  logs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  actionTypes: string[];
}

export function useActivityLogs(
  params: { page?: number; limit?: number; user_id?: string; action?: string; search?: string; start_date?: string; end_date?: string },
  enabled = true
) {
  const { user } = useAuth();
  const qs = new URLSearchParams();
  if (params.page)       qs.set('page',       String(params.page));
  if (params.limit)      qs.set('limit',      String(params.limit));
  if (params.user_id)    qs.set('user_id',    params.user_id);
  if (params.action)     qs.set('action',     params.action);
  if (params.search)     qs.set('search',     params.search);
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date)   qs.set('end_date',   params.end_date);

  return useQuery({
    queryKey: ['activity-logs', params],
    queryFn: async () => apiFetch<ActivityLogsResult>(`/activity-logs.php?${qs.toString()}`),
    enabled: !!user && Number(user?.is_admin) === 1 && enabled,
    staleTime: 30 * 1000,
  });
}

// ── Email Aliases ────────────────────────────────────────────────
export interface EmailAlias {
  id: string;
  user_id: string;
  alias_email: string;
  label: string;
  created_at: string;
}

export function useEmailAliases(userId: string, enabled = true) {
  return useQuery({
    queryKey: ['email-aliases', userId],
    queryFn: async () => apiFetch<EmailAlias[]>(`/email-aliases.php?user_id=${userId}`),
    enabled: !!userId && enabled,
    staleTime: 60 * 1000,
  });
}

export function useCreateEmailAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { user_id: string; alias_email: string; label?: string }) =>
      apiFetch<EmailAlias>('/email-aliases.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['email-aliases', vars.user_id] });
    },
  });
}

export function useDeleteEmailAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) =>
      apiFetch(`/email-aliases.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['email-aliases', vars.userId] });
    },
  });
}

// --- Inbox Messages ---
export interface InboxMessage {
  id: string;
  user_id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  preview: string;
  type: 'ticket' | 'message' | 'notification' | 'email';
  is_read: number;
  is_starred: number;
  priority: string;
  status: string;
  related_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useInbox(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inbox'],
    queryFn: async () => apiFetch<InboxMessage[]>('/inbox.php'),
    enabled: !!user && enabled,
    staleTime: 30 * 1000,
  });
}

export function useUnreadCount() {
  const { data } = useInbox();
  return (data as InboxMessage[] || []).filter(m => !m.is_read).length;
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/inbox.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_read: 1 }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`/inbox.php?id=${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useToggleStar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_starred }: { id: string; is_starred: number }) => {
      return apiFetch(`/inbox.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_starred }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}


export function useMarkAllAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      apiFetch('/inbox.php', { method: 'POST', body: JSON.stringify({ action: 'mark_all_read' }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });
}

export function useInboxUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['inbox-users'],
    queryFn: async () => apiFetch<{ id: string; display_name: string; email: string }[]>('/inbox.php?action=users'),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { recipient_user_id: string; subject: string; preview?: string; priority?: string }) =>
      apiFetch('/inbox.php', { method: 'POST', body: JSON.stringify({ action: 'send', ...data }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });
}
