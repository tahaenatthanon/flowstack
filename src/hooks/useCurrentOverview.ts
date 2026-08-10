import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

export interface CurrentOverviewStats {
  projects: {
    total: number;
    active: number;
    at_risk: number;
    completed: number;
  };
  tasks: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    overdue: number;
  };
  opportunities: {
    total: number;
    lead: number;
    qualified: number;
    proposal: number;
    negotiation: number;
    pipeline_value: number;
  };
  support_tickets: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  task_hours: {
    this_week_hours: number;
    this_week_entries: number;
  };
  companies: {
    total: number;
    customers: number;
  };
}

export interface CurrentOverviewData {
  stats: CurrentOverviewStats;
  recent_items: {
    projects: any[];
    tasks: any[];
    today_tasks: any[];
    opportunities: any[];
    support_tickets: any[];
  };
}

export function useCurrentOverview(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['current-overview'],
    queryFn: async () => {
      return apiFetch<CurrentOverviewData>('/current-overview.php');
    },
    enabled: !!user && enabled,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}
