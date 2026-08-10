import type { Node, Edge } from '@xyflow/react';

export type WorkflowEntityType = 'project' | 'opportunity' | 'support_ticket' | 'company_journey';
export type WorkflowNodeType = 'start' | 'end' | 'stage' | 'decision' | 'delay' | 'notify';

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: WorkflowNodeType;
  slaMinutes?: number;
  description?: string;
  avgCycleMinutes?: number;
  queueDepth?: number;
  heatLevel?: 'ok' | 'warn' | 'critical';
  subSteps?: WorkflowSubStep[];
  expanded?: boolean;
}

export interface WorkflowSubStep {
  id: string;
  name: string;
  durationMinutes: number;
  status: 'completed' | 'in_progress' | 'pending';
  heatLevel: 'ok' | 'warn' | 'critical';
}

export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;
export type WorkflowEdge = Edge;

export interface WorkflowDefinition {
  id: string;
  tenant_id: string;
  name: string;
  entity_type: WorkflowEntityType;
  definition: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  is_template: 0 | 1;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstance {
  id: string;
  tenant_id: string;
  workflow_definition_id: string;
  entity_type: WorkflowEntityType;
  entity_id: string;
  current_step_id: string | null;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowStepLog {
  id: string;
  instance_id: string;
  step_id: string;
  step_name: string | null;
  assignee_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  status: 'in_progress' | 'completed' | 'skipped';
  notes: string | null;
}

export interface StepAnalytics {
  step_id: string;
  step_name: string;
  avg_cycle_minutes: number | null;
  max_cycle_minutes: number | null;
  queue_depth: number;
  sla_minutes: number;
  heat_level: 'ok' | 'warn' | 'critical';
  completed_count?: number;
  trend_30d: { date: string; avg_minutes: number }[];
  stalled_entities: { entity_id: string; entity_name: string; days_stalled: number }[];
}

export interface WorkflowAnalytics {
  definition_id: string;
  total_instances?: number;
  steps: StepAnalytics[];
}

// Approval chain types
export type ApprovalEntityType = 'quotation' | 'content_item' | 'project' | 'task';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalRequest {
  id: string;
  tenant_id: string;
  entity_type: ApprovalEntityType;
  entity_id: string;
  step_order: number;
  approver_id: string;
  approver_name?: string;
  status: ApprovalStatus;
  requested_by: string;
  requester_name?: string;
  decided_at: string | null;
  comment: string | null;
  created_at: string;
  // entity info joined
  entity_title?: string;
}
