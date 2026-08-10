// src/lib/labels.ts
// Single source of truth for shared Thai labels used across 3+ files.

// Sales opportunity stages (CreateOpportunityDialog, SalesPage, ImpactOSPage)
export const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

// Project status labels (EditProjectDialog, Index pipeline, ProjectDetail)
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  'on-track': 'ตามแผน',
  'at-risk': 'มีความเสี่ยง',
  'delayed': 'ล่าช้า',
  'completed': 'เสร็จแล้ว',
  'on-hold': 'พักไว้',
  'cancelled': 'ยกเลิก',
};

// Priority levels (RecurringTasksPage, CreateTaskDialog, SurveyResponseDetailDialog, SurveyResponseViewer)
export const PRIORITY_LABELS: Record<string, string> = {
  critical: 'วิกฤต',
  high: 'สูง',
  medium: 'ปานกลาง',
  low: 'ต่ำ',
};

// Task status (CreateTaskDialog)
export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'รอดำเนินการ',
  'in-progress': 'กำลังดำเนินการ',
  completed: 'เสร็จแล้ว',
  overdue: 'เลยกำหนด',
  cancelled: 'ยกเลิก',
};

// Quotation status (QuotationDetailPage, QuotationsPage)
export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: 'ฉบับร่าง',
  sent: 'ส่งแล้ว',
  accepted: 'อนุมัติ',
  approved: 'อนุมัติ',
  rejected: 'ปฏิเสธ',
  expired: 'หมดอายุ',
};

// Support ticket status (SupportPage)
export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'เปิด',
  in_progress: 'กำลังดำเนินการ',
  'in-progress': 'กำลังดำเนินการ',
  pending: 'รอข้อมูล',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิด',
};

// Support ticket priority (SupportPage) — same values as PRIORITY_LABELS
export const TICKET_PRIORITY_LABELS = PRIORITY_LABELS;

// Role options shared by CreateOpportunityDialog and EditProjectDialog
export const ROLE_LABELS: Record<string, string> = {
  member: 'สมาชิก',
  lead: 'หัวหน้าทีม',
};

// Activity types for customer timeline (CustomerActivityTimeline)
export const CUSTOMER_ACTIVITY_LABELS: Record<string, string> = {
  email_sent: 'ส่งอีเมล',
  email_opened: 'เปิดอีเมล',
  email_clicked: 'คลิกลิงก์',
  email_replied: 'ตอบกลับ',
  email_bounced: 'อีเมลตีกลับ',
  campaign_created: 'สร้างแคมเปญ',
  group_added: 'เพิ่มเข้ากลุ่ม',
  survey_sent: 'ส่งแบบสำรวจ',
};

// Survey priority (SurveyResponseDetailDialog, SurveyResponseViewer) — same values as PRIORITY_LABELS
export const SURVEY_PRIORITY_LABELS = PRIORITY_LABELS;
