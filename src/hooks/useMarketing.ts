import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  body_html?: string;
  sender_name?: string;
  sender_email?: string;
  total_recipients: number;
  total_sent: number;
  total_opens: number;
  total_clicks: number;
  enable_track_opens: 0 | 1;
  enable_track_clicks: 0 | 1;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface EmailGroup {
  id: string;
  name: string;
  description: string;
  member_count: number;
  created_at: string;
}

export interface GroupMember {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
}

export interface CustomerStats {
  customers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company_name: string;
    total_delivered: number;
    total_opens: number;
    total_clicks: number;
    last_open_at: string | null;
    last_click_at: string | null;
  }>;
  total: number;
}

// ── Query keys ─────────────────────────────────────────────────

export const marketingKeys = {
  all: ['marketing'] as const,
  campaigns: () => [...marketingKeys.all, 'campaigns'] as const,
  campaign: (id: string) => [...marketingKeys.campaigns(), id] as const,
  campaignRecipients: (id: string) => [...marketingKeys.campaign(id), 'recipients'] as const,
  groups: () => [...marketingKeys.all, 'groups'] as const,
  group: (id: string) => [...marketingKeys.groups(), id] as const,
  customerStats: () => [...marketingKeys.all, 'customerStats'] as const,
  settings: () => [...marketingKeys.all, 'settings'] as const,
};

// ── Queries ────────────────────────────────────────────────────

export function useEmailCampaigns() {
  return useQuery<EmailCampaign[]>({
    queryKey: marketingKeys.campaigns(),
    queryFn: () => apiFetch('/email-campaigns.php'),
    staleTime: 30_000,
  });
}

export function useEmailCampaign(id: string | null) {
  return useQuery<{ campaign: EmailCampaign; groups: Array<{ id: string; name: string }> }>({
    queryKey: marketingKeys.campaign(id!),
    queryFn: () => apiFetch(`/email-campaigns.php?id=${id}`),
    enabled: !!id,
  });
}

export function useEmailGroups() {
  return useQuery<EmailGroup[]>({
    queryKey: marketingKeys.groups(),
    queryFn: () => apiFetch('/email-groups.php'),
    staleTime: 30_000,
  });
}

export function useEmailGroup(id: string | null) {
  return useQuery<{ members: GroupMember[] } & EmailGroup>({
    queryKey: marketingKeys.group(id!),
    queryFn: () => apiFetch(`/email-groups.php?id=${id}`),
    enabled: !!id,
  });
}

export function useCustomerEmailStats() {
  return useQuery<CustomerStats>({
    queryKey: marketingKeys.customerStats(),
    queryFn: () => apiFetch('/customer-email-stats.php'),
    staleTime: 60_000,
  });
}

export function useRecipientLog(campaignId: string | null) {
  return useQuery<{ campaign: any; recipients: any[]; total: number }>({
    queryKey: marketingKeys.campaignRecipients(campaignId!),
    queryFn: () => apiFetch(`/email-campaigns.php?action=recipients&id=${campaignId}`),
    enabled: !!campaignId,
  });
}

export function useMailSettings() {
  return useQuery<{ mail_from_name?: string; mail_from_address?: string; company_website?: string }>({
    queryKey: marketingKeys.settings(),
    queryFn: () => apiFetch('/mail-settings.php'),
    staleTime: 300_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────

export function useCreateEmailCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiFetch('/email-campaigns.php', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketingKeys.campaigns() }),
  });
}

export function useUpdateEmailCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: Record<string, any>) =>
      apiFetch(`/email-campaigns.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ id, ...payload }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketingKeys.campaigns() }),
  });
}

export function useDeleteEmailCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/email-campaigns.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketingKeys.campaigns() }),
  });
}

export function useCopyEmailCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const full = await apiFetch(`/email-campaigns.php?id=${campaignId}`);
      const c = full.campaign ?? full;
      const payload = {
        name: `${c.name} (Copy)`,
        subject: c.subject,
        body_html: c.body_html,
        sender_name: c.sender_name,
        sender_email: c.sender_email,
        group_ids: (full?.groups ?? []).map((g: any) => g.id),
      };
      return apiFetch('/email-campaigns.php', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketingKeys.campaigns() }),
  });
}

export function useSendEmailCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch('/email-campaigns.php?action=send', { method: 'POST', body: JSON.stringify({ id }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketingKeys.campaigns() }),
  });
}

export function useScheduleEmailCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduled_at }: { id: string; scheduled_at: string }) =>
      apiFetch('/email-campaigns.php?action=schedule', { method: 'POST', body: JSON.stringify({ id, scheduled_at }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketingKeys.campaigns() }),
  });
}

export function useCreateEmailGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; customer_ids?: string[] }) => {
      const group = await apiFetch('/email-groups.php', {
        method: 'POST',
        body: JSON.stringify({ name: payload.name, description: payload.description ?? '' }),
      });
      if (payload.customer_ids && payload.customer_ids.length > 0) {
        await apiFetch('/email-groups.php?action=add_members', {
          method: 'POST',
          body: JSON.stringify({ group_id: group.id, customer_ids: payload.customer_ids }),
        });
      }
      return group;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketingKeys.groups() }),
  });
}

export function useUpdateEmailGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; name: string; description?: string }) =>
      apiFetch(`/email-groups.php?id=${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketingKeys.groups() }),
  });
}

export function useDeleteEmailGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/email-groups.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketingKeys.groups() }),
  });
}

export function useAddGroupMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, customerIds }: { groupId: string; customerIds: string[] }) =>
      apiFetch('/email-groups.php?action=add_members', {
        method: 'POST',
        body: JSON.stringify({ group_id: groupId, customer_ids: customerIds }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: marketingKeys.groups() });
      qc.invalidateQueries({ queryKey: marketingKeys.group(vars.groupId) });
    },
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, customerId }: { groupId: string; customerId: string }) =>
      apiFetch('/email-groups.php?action=remove_member', {
        method: 'DELETE',
        body: JSON.stringify({ group_id: groupId, customer_id: customerId }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: marketingKeys.groups() });
      qc.invalidateQueries({ queryKey: marketingKeys.group(vars.groupId) });
    },
  });
}
