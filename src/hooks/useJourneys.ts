import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import type { JourneySummary, JourneyDetail, JourneyAlert } from '@/types/journey';

export function useJourneys(filters?: { sla_violated?: boolean; status?: string; year?: number }) {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const params = new URLSearchParams();
  if (filters?.sla_violated) params.set('sla_violated', '1');
  if (filters?.status) params.set('status', filters.status);
  params.set('year', String(filters?.year ?? currentYear));
  const qs = `?${params.toString()}`;

  return useQuery<JourneySummary[]>({
    queryKey: ['journeys', filters],
    queryFn: () => apiFetch(`/workflow-journeys.php${qs}`),
    enabled: !!user,
    staleTime: 0,
  });
}

export function useJourneyDetail(id: string | null) {
  const { user } = useAuth();
  return useQuery<JourneyDetail>({
    queryKey: ['journey', id],
    queryFn: () => apiFetch(`/workflow-journeys.php?id=${id}`),
    enabled: !!user && !!id,
    staleTime: 0,
  });
}

export function useJourneyAlerts() {
  const { user } = useAuth();
  return useQuery<JourneyAlert[]>({
    queryKey: ['journey-alerts'],
    queryFn: () => apiFetch('/workflow-journeys.php?action=alerts'),
    enabled: !!user,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}

export function useCreateJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { company_id: string; journey_name: string }) =>
      apiFetch('/workflow-journeys.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journeys'] }),
  });
}

export function useLinkJourneyEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { instance_id: string; stage: string; entity_type: string; entity_id: string }) =>
      apiFetch('/workflow-journeys.php?action=link', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['journey', vars.instance_id] });
      qc.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}

export function useCompleteJourneyStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { instance_id: string; stage: string }) =>
      apiFetch(`/workflow-journeys.php?id=${body.instance_id}&action=complete_stage`, {
        method: 'PUT',
        body: JSON.stringify({ stage: body.stage }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['journey', vars.instance_id] });
      qc.invalidateQueries({ queryKey: ['journeys'] });
      qc.invalidateQueries({ queryKey: ['journey-alerts'] });
    },
  });
}

export function useUpdateJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: string; journey_name?: string; status?: string }) => {
      const { id, ...rest } = body;
      return apiFetch(`/workflow-journeys.php?id=${id}`, { method: 'PUT', body: JSON.stringify(rest) });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['journey', vars.id] });
      qc.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}

export function useDeleteJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/workflow-journeys.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journeys'] });
      qc.invalidateQueries({ queryKey: ['journey-alerts'] });
    },
  });
}

export function useJourneyEntitySearch(entityType: string, q: string) {
  const { user } = useAuth();
  return useQuery<Array<{ id: string; name: string; status: string; company_name: string | null; year_label: number | null }>>({
    queryKey: ['journey-entity-search', entityType, q],
    queryFn: () => apiFetch(`/workflow-journeys.php?action=search_entities&entity_type=${entityType}&q=${encodeURIComponent(q)}`),
    enabled: !!user && !!entityType,
    staleTime: 15_000,
  });
}
