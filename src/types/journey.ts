export type JourneyStage = 'marketing' | 'sales' | 'project' | 'support' | 'renewal';
export type JourneyStageStatus = 'active' | 'completed' | 'skipped' | 'pending';

export interface JourneySubtask {
  id: string;
  name: string;
  status: string;
  actual_hours: number | null;
  estimated_hours: number | null;
  first_name: string | null;
  last_name: string | null;
  notes: string | null;
  completed_date: string | null;
}

export interface JourneyTask {
  id: string;
  name: string;
  status: string;
  assigned_to: string | null;
  first_name: string | null;
  last_name: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  notes: string | null;
  subtasks: JourneySubtask[];
}

export interface JourneyStageData {
  stage: JourneyStage;
  status: JourneyStageStatus;
  stage_status?: 'active' | 'completed' | 'skipped';
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  days_in_stage: number | null;
  sla_days: number | null;
  sla_exceeded: boolean;
  notes: string | null;
  tasks: JourneyTask[];
}

export interface JourneyDetail {
  id: string;
  tenant_id: string;
  journey_name: string | null;
  company_id: string | null;
  company_name: string | null;
  current_stage: JourneyStage;
  sla_violated: 0 | 1;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string | null;
  updated_at: string;
  stages: Record<JourneyStage, JourneyStageData>;
}

export interface JourneySummary {
  id: string;
  journey_name: string | null;
  current_stage: JourneyStage;
  sla_violated: 0 | 1;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string | null;
  updated_at: string;
  company_name: string | null;
  days_in_stage: number | null;
  stages_done: number;
}

export interface JourneyAlert {
  id: string;
  journey_name: string | null;
  current_stage: JourneyStage;
  sla_violated: 0 | 1;
  company_name: string | null;
  days_in_stage: number | null;
}
