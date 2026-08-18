// src/hooks/useContent.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ContentItem, BrandContext, ContentSkill, ContentTrigger, ContentPlan, PlanItem, PublishChannel, ContentSchedule, PublishQueueItem, GlobalSettings, AIGatewaySettings, PostingAnalyticsResponse, ResultMetricsResponse } from '@/components/content/types';

// ── Query keys ─────────────────────────────────────────────────

export const contentKeys = {
  all: ['content'] as const,
  items: () => [...contentKeys.all, 'items'] as const,
  plans: () => [...contentKeys.all, 'plans'] as const,
  plan: (id: string) => [...contentKeys.plans(), id] as const,
  skills: () => [...contentKeys.all, 'skills'] as const,
  triggers: () => [...contentKeys.all, 'triggers'] as const,
  contexts: () => [...contentKeys.all, 'contexts'] as const,
  channels: () => [...contentKeys.all, 'channels'] as const,
  channelConnectionStatus: () => [...contentKeys.all, 'channelConnectionStatus'] as const,
  schedules: () => [...contentKeys.all, 'schedules'] as const,
  itemSchedules: (itemId: string) => [...contentKeys.schedules(), itemId] as const,
  publishQueue: (contentId: string) => [...contentKeys.all, 'publishQueue', contentId] as const,
  overdueCount: () => [...contentKeys.all, 'overdueCount'] as const,
  globalSettings: () => [...contentKeys.all, 'globalSettings'] as const,
  aiGatewaySettings: () => [...contentKeys.all, 'aiGateway'] as const,
  analytics: () => [...contentKeys.all, 'analytics'] as const,
  resultMetrics: () => [...contentKeys.all, 'resultMetrics'] as const,
};

// ── Queries ────────────────────────────────────────────────────

export function useContentItems() {
  return useQuery<ContentItem[]>({
    queryKey: contentKeys.items(),
    queryFn: () => apiFetch('/content-items.php'),
    staleTime: 30_000,
  });
}

export function useContentPlans() {
  return useQuery<ContentPlan[]>({
    queryKey: contentKeys.plans(),
    queryFn: () => apiFetch('/brand-content.php?action=plans'),
    staleTime: 30_000,
  });
}

export function useContentPlan(id: string | null) {
  return useQuery<ContentPlan>({
    queryKey: contentKeys.plan(id!),
    queryFn: () => apiFetch(`/brand-content.php?action=plans&id=${id}`),
    enabled: !!id,
  });
}

export function useBrandContexts(enabled = true) {
  return useQuery<BrandContext[]>({
    queryKey: contentKeys.contexts(),
    queryFn: () => apiFetch('/brand-content.php?action=contexts'),
    staleTime: 60_000,
    enabled,
  });
}

export function useContentSkills(enabled = true) {
  return useQuery<ContentSkill[]>({
    queryKey: contentKeys.skills(),
    queryFn: () => apiFetch('/brand-content.php?action=skills'),
    staleTime: 0,
    enabled,
  });
}

export function useContentTriggers(enabled = true) {
  return useQuery<ContentTrigger[]>({
    queryKey: contentKeys.triggers(),
    queryFn: () => apiFetch('/brand-content.php?action=triggers'),
    staleTime: 0,
    enabled,
  });
}

export function usePublishChannels(enabled = true) {
  return useQuery<PublishChannel[]>({
    queryKey: contentKeys.channels(),
    queryFn: () => apiFetch('/brand-content.php?action=channels'),
    staleTime: 60_000,
    enabled,
  });
}

export interface ChannelConnectionStatus {
  id: string; name: string; platform: string; ok: boolean; message: string;
}

export function useChannelConnectionStatus(enabled = true) {
  return useQuery<ChannelConnectionStatus[]>({
    queryKey: contentKeys.channelConnectionStatus(),
    queryFn: () => apiFetch('/brand-content.php?action=channels-connection-status'),
    staleTime: 30_000,
    enabled,
  });
}

export function useAllSchedules() {
  return useQuery<ContentSchedule[]>({
    queryKey: contentKeys.schedules(),
    queryFn: () => apiFetch('/brand-content.php?action=all-schedules'),
    refetchInterval: 60_000,
  });
}

export function useItemSchedules(itemId: string | null) {
  return useQuery<ContentSchedule[]>({
    queryKey: contentKeys.itemSchedules(itemId!),
    queryFn: () => apiFetch(`/brand-content.php?action=schedules&plan_item_id=${itemId}`),
    enabled: !!itemId,
  });
}

export function useContentGlobalSettings(enabled = true) {
  return useQuery<GlobalSettings>({
    queryKey: contentKeys.globalSettings(),
    queryFn: () => apiFetch('/brand-content.php?action=global-settings'),
    staleTime: 300_000,
    enabled,
  });
}

export function useAIGatewaySettings() {
  return useQuery<AIGatewaySettings>({
    queryKey: contentKeys.aiGatewaySettings(),
    queryFn: () => apiFetch('/ai-settings.php'),
    staleTime: 300_000,
  });
}

export function usePostingAnalytics(enabled = true) {
  return useQuery<PostingAnalyticsResponse>({
    queryKey: contentKeys.analytics(),
    queryFn: () => apiFetch('/brand-content.php?action=analytics-posting-times'),
    staleTime: 300_000,
    enabled,
  });
}

export function useResultMetrics(enabled = true) {
  return useQuery<ResultMetricsResponse>({
    queryKey: contentKeys.resultMetrics(),
    queryFn: () => apiFetch('/brand-content.php?action=result-metrics'),
    staleTime: 300_000,
    enabled,
  });
}

export function usePublishQueue(contentId: string | null) {
  return useQuery<PublishQueueItem[]>({
    queryKey: contentKeys.publishQueue(contentId!),
    queryFn: () => apiFetch(`/content-publish.php?content_id=${contentId}`),
    enabled: !!contentId,
  });
}

export function useOverdueCount() {
  return useQuery<{ count: number }>({
    queryKey: contentKeys.overdueCount(),
    queryFn: () => apiFetch('/content-publish.php?action=overdue_count'),
    refetchInterval: 120_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────

export function useUpdatePlanItemDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { item_id: string; scheduled_date: string }) =>
      apiFetch('/brand-content.php?action=plan-item-date', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.plans() });
    },
  });
}

export function useRecalculateAnalytics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch('/brand-content.php?action=analytics-recalculate', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.analytics() });
    },
  });
}

export function useCreatePlanItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiFetch('/brand-content.php?action=plan-items', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.plans() });
    },
  });
}

export function useDeleteContentItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/content-items.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.items() }),
  });
}

export function useSaveBrandContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiFetch(`/brand-content.php?action=contexts${payload.id ? `&id=${payload.id}` : ''}`, {
        method: payload.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.contexts() }),
  });
}

export function useDeleteBrandContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/brand-content.php?action=contexts&id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.contexts() }),
  });
}

export function useSaveContentSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiFetch(`/brand-content.php?action=skills${payload.id ? `&id=${payload.id}` : ''}`, {
        method: payload.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.skills() });
      qc.invalidateQueries({ queryKey: contentKeys.triggers() });
    },
  });
}

export function useDeleteContentSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/brand-content.php?action=skills&id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.skills() });
      qc.invalidateQueries({ queryKey: contentKeys.triggers() });
    },
  });
}

export function useSaveContentTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiFetch(`/brand-content.php?action=triggers${payload.id ? `&id=${payload.id}` : ''}`, {
        method: payload.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.triggers() }),
  });
}

export function useDeleteContentTrigger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/brand-content.php?action=triggers&id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.triggers() }),
  });
}

export function useDeleteContentPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/brand-content.php?action=plans&id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.plans() }),
  });
}

export function useSavePublishChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiFetch(`/brand-content.php?action=channels${payload.id ? `&id=${payload.id}` : ''}`, {
        method: payload.id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.channels() }),
  });
}

export function useDeletePublishChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/brand-content.php?action=channels&id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: contentKeys.channels() }),
  });
}

export function useSaveGlobalSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiFetch('/brand-content.php?action=global-settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.globalSettings() });
      // เป้าหมาย weekly_posts_target ถูกใช้ในการ์ดเมตริกผลลัพธ์ด้วย
      qc.invalidateQueries({ queryKey: contentKeys.resultMetrics() });
    },
  });
}

export function useScheduleContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content_id: string; channel_ids: string[]; scheduled_at: string; channel_overrides?: Record<string, string> }) =>
      apiFetch('/content-publish.php', {
        method: 'POST',
        body: JSON.stringify({ ...payload, action: 'schedule' }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: contentKeys.publishQueue(variables.content_id) });
      qc.invalidateQueries({ queryKey: contentKeys.overdueCount() });
    },
  });
}

export function useSendNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content_id: string; channel_ids: string[]; channel_overrides?: Record<string, string> }) =>
      apiFetch('/content-publish.php', {
        method: 'POST',
        body: JSON.stringify({ ...payload, action: 'send_now' }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: contentKeys.publishQueue(variables.content_id) });
    },
  });
}

export function useCancelQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (queueId: string) =>
      apiFetch('/content-publish.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel', queue_id: queueId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
}
