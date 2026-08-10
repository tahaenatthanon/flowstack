// src/hooks/useSurveys.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SurveyOption {
  value: string;
  label: string;
  score?: number;
}

export interface SurveyQuestion {
  id: string;
  template_id: string;
  order_index: number;
  question_text: string;
  question_type: 'yes_no' | 'scale_1_5' | 'multiple_choice' | 'text';
  options_json: string[] | SurveyOption[] | string | null;
  weight: number;
  is_critical: number;
  critical_bonus: number;
  max_score: number;
}

export function parseOptions(options: SurveyQuestion['options_json']): SurveyOption[] {
  if (!options) return [];
  let arr: unknown[];
  if (Array.isArray(options)) arr = options;
  else if (typeof options === 'string') {
    try { arr = JSON.parse(options); } catch { return []; }
  } else return [];

  return arr.map(item => {
    if (typeof item === 'string') return { value: item, label: item };
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return { value: String(obj.value ?? ''), label: String(obj.label ?? obj.value ?? '') };
    }
    return { value: '', label: '' };
  });
}

export interface SurveyTemplate {
  id: string;
  tenant_id: string;
  name: string;
  industry: string;
  strategic_theme: string;
  description: string | null;
  is_global: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  questions?: SurveyQuestion[];
}

export interface SurveyAnswer {
  question_id: string;
  answer_value: string;
}

export interface SurveyResponse {
  id: string;
  tenant_id: string;
  template_id: string;
  template_name?: string;
  industry?: string;
  strategic_theme?: string;
  opportunity_id: string;
  company_id: string;
  company_name?: string;
  token: string;
  status: 'pending' | 'in_progress' | 'completed';
  pain_point_score: number | null;
  pain_priority: 'critical' | 'high' | 'medium' | 'low' | null;
  submitted_by: string | null;
  submitted_at: string | null;
  created_at: string;
  answers?: (SurveyAnswer & { question_text: string; question_type: string; score_contribution: number; options_json?: any; is_critical?: number; max_score?: number })[];
  template?: { name: string; industry: string; strategic_theme: string };
}

export interface SurveyPublicData {
  template: SurveyTemplate & { questions: SurveyQuestion[] };
  company_name: string;
  response_id: string;
}

// ── Template Hooks ────────────────────────────────────────────────────────────

export function useSurveyTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['survey-templates'],
    queryFn: () => apiFetch<SurveyTemplate[]>('/surveys.php'),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSurveyTemplate(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['survey-template', id],
    queryFn: () => apiFetch<SurveyTemplate>(`/surveys.php?id=${id}`),
    enabled: !!user && !!id,
  });
}

export function useCreateSurveyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SurveyTemplate> & { questions: Partial<SurveyQuestion>[] }) =>
      apiFetch<{ id: string }>('/surveys.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['survey-templates'] }),
  });
}

export function useUpdateSurveyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SurveyTemplate> & { questions?: Partial<SurveyQuestion>[] } }) =>
      apiFetch(`/surveys.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['survey-templates'] });
      qc.invalidateQueries({ queryKey: ['survey-template'] });
    },
  });
}

export function useDeleteSurveyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/surveys.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['survey-templates'] }),
  });
}

export interface SurveyResponseListItem {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  pain_point_score: number | null;
  pain_priority: 'critical' | 'high' | 'medium' | 'low' | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  token: string;
  template_id: string;
  template_name: string;
  industry: string;
  strategic_theme: string;
  company_id: string;
  company_name: string;
  opportunity_name: string | null;
}

export interface SurveyResponsesFilter {
  template_id?: string;
  company_id?: string;
}

// ── Response Hooks ────────────────────────────────────────────────────────────

export function useSurveyResponses(opportunityId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['survey-responses', opportunityId],
    queryFn: () => apiFetch<SurveyResponse[]>(`/survey-responses.php?opportunity_id=${opportunityId}`),
    enabled: !!user && !!opportunityId,
  });
}

export function useSurveyResponsesList(filter: SurveyResponsesFilter = {}) {
  const { user } = useAuth();
  const params = new URLSearchParams({ list: '1' });
  if (filter.template_id) params.set('template_id', filter.template_id);
  if (filter.company_id) params.set('company_id', filter.company_id);

  return useQuery({
    queryKey: ['survey-responses-list', filter.template_id, filter.company_id],
    queryFn: () => apiFetch<SurveyResponseListItem[]>(`/survey-responses.php?${params.toString()}`),
    enabled: !!user,
  });
}

export function useSurveyResponse(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['survey-response', id],
    queryFn: () => apiFetch<SurveyResponse>(`/survey-responses.php?id=${id}`),
    enabled: !!user && !!id,
  });
}

export function useCreateSurveyResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { template_id: string; opportunity_id: string; company_id: string }) =>
      apiFetch<{ id: string; token: string; public_url: string }>('/survey-responses.php', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['survey-responses', vars.opportunity_id] });
    },
  });
}

export function useSubmitSurveyInternal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: SurveyAnswer[] }) =>
      apiFetch(`/survey-responses.php?id=${id}&action=submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['survey-responses'] });
    },
  });
}

export function useDeleteSurveyResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/survey-responses.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['survey-responses-list'] });
      qc.invalidateQueries({ queryKey: ['survey-responses'] });
    },
  });
}

// ── Public Hooks (no auth) ────────────────────────────────────────────────────

export function useSurveyPublic(token: string | undefined) {
  return useQuery({
    queryKey: ['survey-public', token],
    queryFn: () => apiFetch<SurveyPublicData>(`/survey-public.php?token=${token}`),
    enabled: !!token,
    retry: false,
  });
}

export function useSubmitSurveyPublic() {
  return useMutation({
    mutationFn: ({ token, answers }: { token: string; answers: SurveyAnswer[] }) =>
      apiFetch<{ message: string; priority: string }>(`/survey-public.php?token=${token}`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }),
  });
}
