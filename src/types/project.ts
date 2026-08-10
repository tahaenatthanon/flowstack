export type TaskStatus = 'completed' | 'in-progress' | 'pending' | 'overdue';
export type TaskPriority = 'high' | 'medium' | 'low';
export type ProjectStatus = 'on-track' | 'at-risk' | 'delayed' | 'completed' | 'on-hold' | 'cancelled';

// ใหม่: Dependency Reason Codes
export type DependencyReasonCode = 
  | 'URGENT_INSERT' 
  | 'CUSTOMER_REQUEST' 
  | 'TECHNICAL_BLOCKER' 
  | 'RESOURCE_CONFLICT'
  | 'DEPENDENCY'
  | 'OTHER';

// ใหม่: Task History Actions
export type TaskHistoryAction = 
  | 'CREATED'
  | 'UPDATED'
  | 'STATUS_CHANGED'
  | 'DEADLINE_SHIFTED'
  | 'PAUSED'
  | 'RESUMED'
  | 'DELETED';

// ใหม่: Company Interface
export interface DbCompany {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tax_id: string;
  logo_url: string;
  is_active: boolean;
  business_type?: string;
  company_type?: 'customer' | 'partner' | 'manufacturer';
  company_size?: string;
  founded_year?: number | string;
  created_at: string;
  updated_at: string;
}

// ใหม่: Customer Interface
export interface DbCustomer {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  is_primary_contact: boolean;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DbProject {
  id: string;
  user_id: string;
  company_id: string | null;
  customer_id: string | null;
  name: string;
  description: string;
  kind?: 'project' | 'base_calendar';
  is_protected?: number;
  archived_at?: string | null;
  status: string;
  start_date: string;
  end_date: string;
  original_end_date: string | null;
  extension_reason: string | null;
  project_value?: number;
  budget_hours?: number | null;
  hourly_rate?: number | null;
  payment_status?: string;
  payment_terms?: string;
  manager_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  company_name?: string;
  creator_name?: string;
  manager_name?: string;
}

export interface DbTask {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  assignee_user_id: string | null;
  start_date: string;
  end_date: string;
  original_end_date: string | null;
  days_spent: number;
  estimated_days: number;
  is_ad_hoc: boolean;
  completed_date: string | null;
  created_at: string;
  updated_at: string;
  // Pause/Resume fields
  paused_at: string | null;
  paused_by: string | null;
  pause_reason: string | null;
  delay_reason: string | null;
  auto_shifted: boolean;
  // Subtask fields
  parent_task_id: string | null;
  is_subtask: boolean;
  level: number;
  sort_order: number;
  progress_percentage: number;
  estimated_hours: number;
  actual_hours: number;
  hourly_rate: number;
  task_type: string;
  subtask_count: number;
  subtask_actual_hours?: number;
  subtask_estimated_hours?: number;
  total_hours: number;
  subtasks?: DbTask[];
  // Recurring task
  recurring_task_id: string | null;
  // Joined fields (present when query includes JOINs)
  project_name?: string;
  user_display_name?: string;
  user_email?: string;
  parent_title?: string;
  assigned_to?: string;
  company_name?: string;
  company_business_type?: string;
}

export interface DbTaskHoursEntry {
  id: string;
  is_subtask?: number;           // 1 = subtask entry, 0 = task with direct hours
  parent_task_id: string | null;
  user_id: string;
  work_date: string;
  date: string;               // alias for work_date (backward compat)
  hours_worked: number;
  start_time: string | null;  // HH:MM
  end_time: string | null;    // HH:MM
  work_type: string;
  description: string;
  created_at: string;
  task_title?: string;        // parent task title
  subtask_title?: string;     // this subtask's title
  entry_title?: string;       // alias for subtask_title (backward compat)
  project_id?: string;
  project_name?: string;
  user_name?: string;
}

// ใหม่: Task Dependency Interface
export interface DbTaskDependency {
  id: string;
  task_id: string;             // The dependent task (blocked)
  depends_on_task_id: string;  // The task it depends on (blocker)
  dependency_type: string;     // 'depends_on' | 'blocks'
  auto_shift_dates: number;    // 0 | 1
  notes: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  deleted_at: string | null;
  // Joined fields (when fetched via GET ?task_id= or ?depends_on_task_id=)
  task_title?: string;
  task_status?: string;
  depends_on_title?: string;
  depends_on_status?: string;
  project_name?: string;
}

// ใหม่: Task History Interface
export interface DbTaskHistory {
  id: string;
  task_id: string;
  action: TaskHistoryAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_by_name: string | null; // Joined from users table
  changed_by_email: string | null;
  reason: string | null;
  related_task_id: string | null;
  created_at: string;
}

// ใหม่: Resource Workload (from VIEW)
export interface ResourceWorkload {
  assignee: string;
  work_date: string;
  project_count: number;
  task_count: number;
  active_task_count: number;
  total_estimated_days: number;
  project_names: string;
  position?: string;
  role_label?: string;
}

// ใหม่: Cross-Project Impact (from PHP inline query)
export interface CrossProjectImpact {
  dependency_id: string;
  dependency_type: string;      // 'depends_on' | 'blocks'
  notes: string;
  auto_shift_dates: number;
  created_at: string;
  resolved_at: string | null;
  is_active: number;            // 0 or 1
  // The dependent (blocked) task
  task_id: string;
  task_title: string;
  task_status: string;
  task_assignee: string;
  task_project_id: string;
  task_project_name: string;
  // The dependency (blocker) task
  depends_on_task_id: string;
  depends_on_title: string;
  depends_on_status: string;
  depends_on_project_id: string;
  depends_on_project_name: string;
  assignee: string;
}

// ใหม่: Project with Company and Customer (from VIEW)
export interface ProjectWithCompanyCustomer {
  project_id: string;
  project_name: string;
  project_description: string;
  project_status: string;
  start_date: string;
  end_date: string;
  original_end_date: string | null;
  company_id: string | null;
  company_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_position: string | null;
  is_primary_contact: boolean | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// ใหม่: Impact Simulation Result
export interface ImpactSimulation {
  affectedTasks: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    currentEndDate: string;
    suggestedEndDate: string;
    delayDays: number;
  }>;
  affectedProjects: Array<{
    projectId: string;
    projectName: string;
    currentEndDate: string;
    suggestedEndDate: string;
    delayDays: number;
    affectedTaskCount: number;
  }>;
  totalImpact: {
    affectedTaskCount: number;
    affectedProjectCount: number;
    maxDelayDays: number;
  };
}

export interface ProjectReport {
  completionPercentage: number;
  totalDays: number;
  daysUsed: number;
  daysRemaining: number;
  completedTasks: DbTask[];
  inProgressTasks: DbTask[];
  pendingTasks: DbTask[];
  overdueTasks: DbTask[];
  cancelledTasks: DbTask[];
  nextTasks: DbTask[];
  adHocTasks: DbTask[];
  extensionDays: number;
  // Pause/Block stats
  pausedTasks?: DbTask[];
  blockedTasks?: DbTask[];
}

// ============================================================
// NEW: PM System Types (Subtasks, Custom Fields, Goals, etc.)
// ============================================================

// Custom Field Types
export interface DbCustomField {
  id: string;
  name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'currency' | 'boolean' | 'url' | 'email';
  field_options: string | null;
  is_required: boolean;
  is_global: boolean;
  project_id: string | null;
  default_value: string | null;
  sort_order: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbCustomFieldValue {
  id: string;
  task_id: string;
  custom_field_id: string;
  value: string | null;
  field_name?: string;
  field_type?: string;
  field_options?: string;
}

// Goal/OKR Types
export interface DbGoal {
  id: string;
  title: string;
  description: string;
  goal_type: 'objective' | 'key_result' | 'kpi';
  project_id: string | null;
  company_id: string | null;
  parent_goal_id: string | null;
  target_value: number;
  current_value: number;
  progress_percentage: number;
  unit: string;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'completed' | 'at_risk' | 'cancelled';
  owner_id: string;
  weight: number;
  sort_order: number;
  task_count: number;
  child_goal_count: number;
  calculated_progress: number;
  linked_tasks: any[];
  child_goals: DbGoal[];
  project_name?: string;
  company_name?: string;
  created_at: string;
  updated_at: string;
}

export interface DbGoalTask {
  id: string;
  goal_id: string;
  task_id: string;
  contribution: number;
  task_title?: string;
  task_status?: string;
  task_progress?: number;
  task_end_date?: string;
  project_name?: string;
}

// Automation Types
export interface DbAutomationRule {
  id: string;
  project_id: string | null;
  user_id: string;
  name: string;
  description: string;
  trigger_event: string;
  conditions: any[];
  actions: any[];
  is_active: boolean;
  sort_order: number;
  execution_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbAutomationExecution {
  id: string;
  rule_id: string;
  task_id: string;
  trigger_event: string;
  conditions_met: boolean;
  actions_executed: any[];
  executed_at: string;
  rule_name?: string;
}

// Recurring Task Types
export interface DbRecurringTask {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  interval_value: number;
  day_of_week: number | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  due_date_offset: number;
  assignee: string;
  priority: string;
  status: string;
  estimated_days: number;
  task_type: string;
  copy_checklist: boolean;
  copy_attachments: boolean;
  copy_custom_fields: boolean;
  next_occurrence: string;
  is_active: boolean;
  instance_count: number;
  last_instance: any;
  created_at: string;
  updated_at: string;
}

// Budget Types
export interface DbBudgetItem {
  id: string;
  project_id: string;
  task_id: string | null;
  name: string;
  description: string;
  category: 'labor' | 'material' | 'equipment' | 'travel' | 'software' | 'other' | 'general';
  planned_cost: number;
  actual_cost: number;
  quantity: number;
  unit_price: number;
  unit: string;
  start_date: string | null;
  end_date: string | null;
  vendor: string;
  status: 'planned' | 'committed' | 'actual' | 'cancelled';
  project_name?: string;
  task_title?: string;
  created_at: string;
  updated_at: string;
}

export interface DbBudgetSummary {
  project_budget: number;
  total_planned: number;
  total_actual: number;
  committed: number;
  spent: number;
  labor_cost: number;
  total_with_labor: number;
  variance: number;
  variance_percent: number;
  remaining: number;
  remaining_percent: number;
  health: 'healthy' | 'warning' | 'over_budget';
  by_category: any[];
}

// ============================================================
// Phase 1 Sales Types
// ============================================================

export type OpportunityStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';

// Sales Opportunity Interface
export interface DbOpportunity {
  id: string;
  company_id: string;
  project_id: string | null;
  name: string;
  description: string;
  stage: OpportunityStage;
  value: number;
  probability: number;
  expected_close_date: string | null;
  actual_close_date: string | null;
  assigned_to: string;
  lead_source: string;
  competitor_info: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

// Sales Pipeline Summary (from view)
export interface SalesPipelineSummary {
  opportunity_id: string;
  opportunity_name: string;
  description: string;
  stage: OpportunityStage;
  value: number;
  probability: number;
  expected_close_date: string | null;
  actual_close_date: string | null;
  lead_source: string;
  company_id: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  assigned_user_id: string;
  assigned_user_name: string;
  assigned_user_email: string;
  quotation_count: number;
  approved_quotation_value: number | null;
  created_at: string;
  updated_at: string;
}

// Quotation Interface
export interface DbQuotation {
  id: string;
  opportunity_id: string | null;
  company_id: string;
  customer_id: string | null;
  quotation_number: string;
  issue_date: string;
  valid_until: string;
  total_amount: number;
  discount: number;
  tax: number;
  grand_total: number;
  status: QuotationStatus;
  payment_terms: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Quotation Item Interface
export interface DbQuotationItem {
  id: string;
  quotation_id: string;
  item_name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  sort_order: number;
  created_at: string;
}

// Quotation Summary (from view)
export interface QuotationSummary extends DbQuotation {
  company_name: string;
  customer_name: string | null;
  customer_email: string | null;
  opportunity_name: string | null;
  opportunity_stage: OpportunityStage | null;
  created_by_name: string;
  item_count: number;
  items?: DbQuotationItem[];
}

// Quotation Templates
export interface QuotationTemplateListItem {
  id: string;
  name: string;
  description: string;
  source: 'csv' | 'excel' | 'existing_quotation' | 'manual';
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DbQuotationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  source: 'csv' | 'excel' | 'existing_quotation' | 'manual';
  source_file_path: string | null;
  source_mime: string | null;
  source_quotation_id: string | null;
  parsed_schema: { headers: string[]; sample_rows: string[][] } | null;
  example_items_json: Array<{
    item_name: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
  }> | null;
  default_payment_terms: string;
  default_notes: string;
  is_active: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Project Payment Interface
export interface DbProjectPayment {
  id: string;
  project_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  receipt_number: string;
  notes: string;
  created_by: string;
  created_at: string;
}

// Company Settings (single-row system config)
export interface CompanySettings {
  id: number;
  company_name: string;
  company_name_en: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  tax_id: string;
  logo_url: string;
  app_base_url: string;
  quotation_prefix: string;
  quotation_running_number: number;
  quotation_number_format: string;
  default_validity_days: number;
  default_payment_terms: string;
  default_tax_rate: number;
  max_task_hours: number;
  currency: string;
  currency_symbol: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
  task_type_catalog?: Array<{
    key: string;
    label: string;
    color: string;
    active: number;
    system?: number;
  }>;
  calendar_event_type_catalog?: Array<{
    key: string;
    label: string;
    color: string;
    active: number;
    system?: number;
  }>;
  updated_at: string;
}

// ============================================================
// Task Intelligence Types
// ============================================================

export interface TaskIntelligenceAssessment {
  summary: {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    overdue: number;
    on_time: number;
    on_time_pct: number;
    overdue_pct: number;
    hours_diff_count: number;
    hours_diff_sum: number;
    avg_deviation_hours: number;
    total_actual_hours: number;
    total_estimated_hours: number;
  };
  workload: Array<{
    assignee: string;
    task_count: number;
    total_actual_hours: number;
    total_estimated_hours: number;
  }>;
  monthly: Array<{
    month: string;
    month_label: string;
    created: number;
    completed: number;
    actual_hours: number;
    estimated_hours: number;
  }>;
  status_dist: Array<{
    status: string;
    count: number;
  }>;
}

export interface QualityTaskItem {
  id: string;
  title: string;
  project_name: string;
  assignee: string;
  assignee_user_id: string | null;
  estimated_hours: number | null;
  end_date: string | null;
  status: string;
  actual_hours?: number;
  start_date?: string;
  last_activity?: string;
}

export interface TaskIntelligenceQuality {
  missing: QualityTaskItem[];
  missing_total: number;
  anomalies: QualityTaskItem[];
  anomalies_total: number;
  zombies: QualityTaskItem[];
  zombies_total: number;
  per_page: number;
}

export type DuplicateTaskGroup = Array<{
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  assignee_user_id: string | null;
  assignee: string;
  start_date: string;
  end_date: string;
  status: string;
}>;

export interface OrphanedTaskItem {
  id: string;
  title: string;
  assignee: string;
  status: string;
  start_date: string;
  end_date: string;
  updated_at: string;
}

export interface TaskIntelligenceOrphaned {
  data: OrphanedTaskItem[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  field_name: string;
  rule_type: string;
  rule_config: string;
  severity: string;
  is_active: number;
  is_system: number;
  created_at: string;
  updated_at: string;
}

export interface TaskIntelligenceMigratePreview {
  projects: Array<{
    id: string;
    name: string;
    task_count: number;
  }>;
  target_calendar: {
    id: string;
    name: string;
  } | null;
}

// Company enrichment response (AI-generated)
export interface CompanyEnrichResponse {
  description?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
  business_type?: string;
  company_size?: string;
  founded_year?: string;
}
