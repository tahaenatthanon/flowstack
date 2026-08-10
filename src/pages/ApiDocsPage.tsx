import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Copy, Check, Search, Code, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface Endpoint {
  method: HttpMethod;
  path: string;
  description: string;
  auth?: string;
  query?: Record<string, string>;
  body?: Record<string, string>;
  response?: Record<string, unknown> | string;
  note?: string;
}

interface Category {
  id: string;
  label: string;
  description: string;
  endpoints: Endpoint[];
}

const CATEGORIES: Category[] = [
  {
    id: 'auth',
    label: 'Authentication',
    description: 'เข้าสู่ระบบ, JWT token, ข้อมูลผู้ใช้ปัจจุบัน',
    endpoints: [
      {
        method: 'POST',
        path: '/api/auth.php',
        description: 'เข้าสู่ระบบ (Login)',
        body: { email: 'string', password: 'string' },
        response: { token: 'jwt-string', user: { id: 'uuid', email: 'string', display_name: 'string', is_admin: 0 } },
      },
      {
        method: 'GET',
        path: '/api/auth/me.php',
        description: 'ข้อมูลผู้ใช้ปัจจุบัน + สิทธิ์เมนู',
        auth: 'Bearer <token>',
        response: { id: 'uuid', email: 'string', display_name: 'string', permissions: ['projects', 'sales'] },
      },
      {
        method: 'POST',
        path: '/api/profile.php',
        description: 'อัปเดตโปรไฟล์ตัวเอง (display_name, position, phone, notification_settings)',
        auth: 'Bearer <token>',
        body: { display_name: 'string', position: 'string?', phone: 'string?', notification_settings: 'object?' },
        response: { id: 'uuid', display_name: 'string' },
      },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    description: 'โครงการ, สมาชิกโครงการ, รายงาน',
    endpoints: [
      {
        method: 'GET',
        path: '/api/projects.php',
        description: 'รายการโครงการ (กรองได้ตาม status, company_id, kind)',
        auth: 'Bearer <token>',
        query: { id: 'uuid (single)', status: 'on-track|at-risk|delayed|completed', company_id: 'uuid', kind: 'project|base_calendar' },
        response: [{ id: 'uuid', name: 'string', status: 'string', kind: 'project', actual_progress: 0 }],
      },
      {
        method: 'POST',
        path: '/api/projects.php',
        description: 'สร้างโครงการใหม่',
        auth: 'Bearer <token>',
        body: { name: 'string (required)', company_id: 'uuid?', start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD', description: 'string?', budget_hours: 'number?', hourly_rate: 'number?' },
        response: { id: 'uuid', name: 'string', status: 'on-track' },
      },
      {
        method: 'PUT',
        path: '/api/projects.php?id=<uuid>',
        description: 'แก้ไขโครงการ',
        auth: 'Bearer <token>',
        body: { name: 'string?', status: 'string?', end_date: 'YYYY-MM-DD?', payment_status: 'pending|paid|partial?' },
        response: { id: 'uuid', name: 'string', updated_at: 'datetime' },
      },
      {
        method: 'DELETE',
        path: '/api/projects.php?id=<uuid>',
        description: 'ลบโครงการ (soft delete)',
        auth: 'Bearer <token>',
        response: { deleted: true },
      },
      {
        method: 'GET',
        path: '/api/project-members.php?project_id=<uuid>',
        description: 'รายการสมาชิกโครงการ',
        auth: 'Bearer <token>',
        response: [{ user_id: 'uuid', display_name: 'string', role: 'string' }],
      },
      {
        method: 'POST',
        path: '/api/project-members.php',
        description: 'เพิ่มสมาชิกโครงการ',
        auth: 'Bearer <token>',
        body: { project_id: 'uuid', user_id: 'uuid', role: 'member|manager?' },
        response: { project_id: 'uuid', user_id: 'uuid' },
      },
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'งาน, subtasks, task hours, batch update, dependencies',
    endpoints: [
      {
        method: 'GET',
        path: '/api/tasks.php',
        description: 'รายการงาน (กรองได้หลายแบบ)',
        auth: 'Bearer <token>',
        query: {
          project_id: 'uuid',
          id: 'uuid (single)',
          status: 'pending|in-progress|completed|cancelled',
          task_type: 'task|meeting|leave|onsite|ot|weekend_work',
          assignee_user_id: 'uuid',
          is_subtask: '0|1',
          parent_task_id: 'uuid',
        },
        response: [{ id: 'uuid', title: 'string', status: 'string', task_type: 'task', priority: 'medium', estimated_hours: 8, actual_hours: 0 }],
      },
      {
        method: 'POST',
        path: '/api/tasks.php',
        description: 'สร้างงานใหม่',
        auth: 'Bearer <token>',
        body: {
          project_id: 'uuid (required)',
          title: 'string (required)',
          task_type: 'task|meeting|leave|onsite|ot',
          status: 'pending|in-progress',
          priority: 'low|medium|high|critical',
          start_date: 'YYYY-MM-DD?',
          end_date: 'YYYY-MM-DD?',
          estimated_hours: 'number?',
          description: 'string?',
          assignee_user_id: 'uuid?',
          assignee: 'string?',
        },
        response: { id: 'uuid', title: 'string', project_id: 'uuid' },
        note: 'assignee / assignee_user_id เป็น optional — ห้ามแต่งค่า UUID ขึ้นมาเอง',
      },
      {
        method: 'PUT',
        path: '/api/tasks.php?id=<uuid>',
        description: 'แก้ไขงาน',
        auth: 'Bearer <token>',
        body: { title: 'string?', status: 'string?', priority: 'string?', actual_hours: 'number?', completed_date: 'YYYY-MM-DD?' },
        response: { id: 'uuid', updated_at: 'datetime' },
      },
      {
        method: 'DELETE',
        path: '/api/tasks.php?id=<uuid>',
        description: 'ลบงาน (soft delete)',
        auth: 'Bearer <token>',
        response: { deleted: true },
      },
      {
        method: 'GET',
        path: '/api/subtasks.php?parent_task_id=<uuid>',
        description: 'รายการ subtasks ของงาน',
        auth: 'Bearer <token>',
        response: [{ id: 'uuid', title: 'string', parent_task_id: 'uuid', actual_hours: 0 }],
      },
      {
        method: 'GET',
        path: '/api/task-hours.php',
        description: 'บันทึกชั่วโมงงาน (subtasks กรองตามวันที่/user)',
        auth: 'Bearer <token>',
        query: { project_id: 'uuid?', date_from: 'YYYY-MM-DD?', date_to: 'YYYY-MM-DD?', user_id: 'uuid?' },
        response: [{ id: 'uuid', title: 'string', actual_hours: 4, work_date: 'YYYY-MM-DD' }],
      },
      {
        method: 'POST',
        path: '/api/tasks-batch-update.php',
        description: 'อัปเดตหลายงานพร้อมกัน',
        auth: 'Bearer <token>',
        body: { ids: ['uuid1', 'uuid2'], status: 'completed?', assignee_user_id: 'uuid?' },
        response: { updated: 2 },
      },
      {
        method: 'GET',
        path: '/api/task-dependencies.php?task_id=<uuid>',
        description: 'dependencies ของงาน',
        auth: 'Bearer <token>',
        response: [{ depends_on_task_id: 'uuid', title: 'string' }],
      },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'ปฏิทินทีม (tasks) + ปฏิทินบริษัท (calendar_events)',
    endpoints: [
      {
        method: 'GET',
        path: '/api/calendar.php?start=YYYY-MM-DD&end=YYYY-MM-DD',
        description: 'รายการ events + tasks ในช่วงวันที่ (รวม source: calendar และ task)',
        auth: 'Bearer <token>',
        query: { start: 'YYYY-MM-DD (required)', end: 'YYYY-MM-DD (required)', project_id: 'uuid?', user_id: 'uuid?' },
        response: [{ id: 'uuid', title: 'string', event_type: 'meeting|leave|holiday|other', start_at: 'datetime', end_at: 'datetime', source: 'calendar|task' }],
        note: 'นัดประชุม/วันลา → สร้างเป็น task ใน project "ปฏิทินทีม" (tasks.php) ไม่ใช่ calendar_events',
      },
      {
        method: 'POST',
        path: '/api/calendar.php',
        description: 'สร้าง company-wide event (holiday / other เท่านั้น)',
        auth: 'Bearer <token>',
        body: { title: 'string', event_type: 'holiday|other', start_at: 'YYYY-MM-DD HH:MM:SS', end_at: 'YYYY-MM-DD HH:MM:SS', description: 'string?', all_day: '0|1' },
        response: { id: 'uuid', title: 'string', event_type: 'holiday' },
        note: 'event_type=holiday ต้องเป็น admin เท่านั้น',
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    description: 'Opportunities, Quotations, Sales Activities',
    endpoints: [
      {
        method: 'GET',
        path: '/api/opportunities.php',
        description: 'รายการโอกาสการขาย',
        auth: 'Bearer <token>',
        query: { id: 'uuid?', company_id: 'uuid?', stage: 'lead|qualified|proposal|negotiation|won|lost', assigned_to: 'uuid?' },
        response: [{ id: 'uuid', name: 'string', stage: 'proposal', value: 500000, probability: 70, expected_close_date: 'YYYY-MM-DD' }],
      },
      {
        method: 'POST',
        path: '/api/opportunities.php',
        description: 'สร้าง opportunity ใหม่',
        auth: 'Bearer <token>',
        body: { name: 'string', company_id: 'uuid', value: 'number?', stage: 'lead|qualified|...', expected_close_date: 'YYYY-MM-DD?', assigned_to: 'uuid?' },
        response: { id: 'uuid', name: 'string', stage: 'lead' },
      },
      {
        method: 'PUT',
        path: '/api/opportunities.php?id=<uuid>',
        description: 'อัปเดต stage, มูลค่า, วันปิด',
        auth: 'Bearer <token>',
        body: { stage: 'string?', value: 'number?', probability: 'number?', expected_close_date: 'YYYY-MM-DD?' },
        response: { id: 'uuid', stage: 'negotiation', updated_at: 'datetime' },
      },
      {
        method: 'GET',
        path: '/api/quotations.php',
        description: 'รายการใบเสนอราคา (รองรับ filter หลายแบบ)',
        auth: 'Bearer <token>',
        query: { id: 'uuid — ดึงรายการเดียวพร้อม items', opportunity_id: 'uuid?', company_id: 'uuid?', status: 'draft|sent|approved|rejected|expired?' },
        response: [{ quotation_id: 'uuid', quotation_number: 'QUO-202506-0001', subject: 'string', status: 'draft', grand_total: 150000, company_name: 'string', item_count: 3 }],
      },
      {
        method: 'POST',
        path: '/api/quotations.php',
        description: 'สร้างใบเสนอราคาใหม่พร้อมรายการสินค้า/บริการ',
        auth: 'Bearer <token>',
        body: {
          company_id: 'uuid (required)',
          quotation_number: 'string (required) — เช่น QUO-202506-0001',
          valid_until: 'YYYY-MM-DD (required)',
          subject: 'string? — หัวข้อ/เรื่อง',
          opportunity_id: 'uuid?',
          customer_id: 'uuid?',
          issue_date: 'YYYY-MM-DD? (default: today)',
          status: 'draft|sent|approved|rejected|expired (default: draft)',
          total_amount: 'number? (before discount)',
          discount: 'number? (fixed amount)',
          tax: 'number? (VAT amount)',
          grand_total: 'number?',
          payment_terms: 'string?',
          notes: 'string?',
          items: [{ item_name: 'string', description: 'string?', quantity: 1, unit: 'รายการ', unit_price: 10000, total_price: 10000 }],
        },
        response: { data: { quotation_id: 'uuid', quotation_number: 'QT-202606-0001', subject: 'string', status: 'draft', total_amount: 150000, grand_total: 160500, items: [{ item_name: 'string', quantity: 1, unit_price: 80000, total_price: 80000 }] } },
        note: 'quotation_number ต้องไม่ซ้ำ — ใช้ GET /api/next-quotation-number.php ก่อน | response ครอบใน { data: {...} }',
      },
      {
        method: 'PUT',
        path: '/api/quotations.php?id=<uuid>',
        description: 'แก้ไขใบเสนอราคา (รองรับ partial update + items replace)',
        auth: 'Bearer <token>',
        body: { subject: 'string?', status: 'draft|sent|approved|rejected|expired?', valid_until: 'YYYY-MM-DD?', discount: 'number?', tax: 'number?', grand_total: 'number?', payment_terms: 'string?', notes: 'string?', items: '[array? — แทนที่รายการทั้งหมด]' },
        response: { data: { quotation_id: 'uuid', subject: 'string', status: 'sent', grand_total: 160500, updated_at: 'datetime', items: [] } },
      },
      {
        method: 'DELETE',
        path: '/api/quotations.php?id=<uuid>',
        description: 'ลบใบเสนอราคา (ลบ items อัตโนมัติ)',
        auth: 'Bearer <token>',
        response: { message: 'ลบใบเสนอราคาสำเร็จ' },
      },
      {
        method: 'GET',
        path: '/api/next-quotation-number.php',
        description: 'ขอเลขที่ใบเสนอราคาถัดไปอัตโนมัติ (format กำหนดได้ใน Admin)',
        auth: 'Bearer <token>',
        response: { data: { next_number: 'QT-202606-0001', period_key: 'global', sequence: 1, format: '{PREFIX}{YYYY}{MM}-{NNNN}' } },
        note: 'เลขจะไม่ถูก reserve — ต้อง POST สร้างจริงด้วย quotation_number นี้ทันที',
      },
      {
        method: 'POST',
        path: '/api/quotations.php?action=ai-generate',
        description: 'ให้ AI สร้างรายการใบเสนอราคาจาก template + brief (ไม่ save อัตโนมัติ)',
        auth: 'Bearer <token>',
        body: { template_id: 'uuid (required)', brief: 'string — อธิบายความต้องการ เช่น ระบบ ERP 200 user 6 เดือน' },
        response: { items: [{ item_name: 'string', quantity: 1, unit_price: 50000, total_price: 50000 }], discount: 0, tax: 10500, notes: 'string', payment_terms: 'string' },
        note: 'ต้องตั้งค่า AI provider ใน Admin > AI Settings ก่อน',
      },
      {
        method: 'POST',
        path: '/api/quotations.php?action=ai-fill',
        description: 'AI สร้างรายการจากข้อมูล Opportunity (ไม่ save อัตโนมัติ)',
        auth: 'Bearer <token>',
        body: { opportunity_id: 'uuid (required)', template_id: 'uuid?' },
        response: { items: [{ item_name: 'string', quantity: 1, unit_price: 50000, total_price: 50000 }] },
      },
      {
        method: 'GET',
        path: '/api/quotation-templates.php',
        description: 'รายการ template ใบเสนอราคา (สร้างจาก Admin)',
        auth: 'Bearer <token>',
        response: [{ id: 'uuid', name: 'string', source: 'excel|manual', parsed_schema: 'string?' }],
      },
      {
        method: 'GET',
        path: '/api/sales-activities.php?opportunity_id=<uuid>',
        description: 'รายการกิจกรรม sales ของ opportunity',
        auth: 'Bearer <token>',
        response: [{ id: 'uuid', activity_type: 'call|email|meeting', note: 'string', created_at: 'datetime' }],
      },
      {
        method: 'POST',
        path: '/api/sales-activities.php',
        description: 'บันทึกกิจกรรม sales',
        auth: 'Bearer <token>',
        body: { opportunity_id: 'uuid', activity_type: 'call|email|meeting|demo', note: 'string?', activity_date: 'YYYY-MM-DD?' },
        response: { id: 'uuid', activity_type: 'call' },
      },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    description: 'Companies, Customers/Contacts, Customer Tiers',
    endpoints: [
      {
        method: 'GET',
        path: '/api/companies.php',
        description: 'รายการบริษัท',
        auth: 'Bearer <token>',
        query: { id: 'uuid?', active_only: '1?' },
        response: [{ id: 'uuid', name: 'string', industry: 'string', phone: 'string' }],
      },
      {
        method: 'POST',
        path: '/api/companies.php',
        description: 'สร้างบริษัทใหม่',
        auth: 'Bearer <token>',
        body: { name: 'string', industry: 'string?', phone: 'string?', email: 'string?', website: 'string?', tax_id: 'string?' },
        response: { id: 'uuid', name: 'string' },
      },
      {
        method: 'GET',
        path: '/api/customers.php',
        description: 'รายการผู้ติดต่อ (contacts)',
        auth: 'Bearer <token>',
        query: { id: 'uuid?', company_id: 'uuid?', primary_only: '1?' },
        response: [{ id: 'uuid', name: 'string', email: 'string', position: 'string', company_id: 'uuid' }],
      },
      {
        method: 'POST',
        path: '/api/customers.php',
        description: 'สร้างผู้ติดต่อใหม่',
        auth: 'Bearer <token>',
        body: { name: 'string', company_id: 'uuid', email: 'string?', phone: 'string?', position: 'string?', is_primary: '0|1?' },
        response: { id: 'uuid', name: 'string', company_id: 'uuid' },
      },
      {
        method: 'GET',
        path: '/api/customer-tiers.php',
        description: 'ระดับลูกค้า (Partner/High-Value/Active/Inactive)',
        auth: 'Bearer <token>',
        query: { company_id: 'uuid?' },
        response: [{ company_id: 'uuid', tier: 'partner|high_value|active|inactive', score: 85 }],
      },
    ],
  },
  {
    id: 'support',
    label: 'Support / Helpdesk',
    description: 'Tickets, Comments, Support Contracts',
    endpoints: [
      {
        method: 'GET',
        path: '/api/support-tickets.php',
        description: 'รายการ tickets',
        auth: 'Bearer <token>',
        query: { id: 'uuid?', company_id: 'uuid?', status: 'open|in_progress|resolved|closed?', priority: 'critical|high|medium|low?' },
        response: [{ id: 'uuid', subject: 'string', status: 'open', priority: 'high', sla_deadline: 'datetime' }],
      },
      {
        method: 'POST',
        path: '/api/support-tickets.php',
        description: 'สร้าง ticket ใหม่',
        auth: 'Bearer <token>',
        body: { subject: 'string', company_id: 'uuid?', priority: 'critical|high|medium|low', description: 'string?', assigned_to: 'uuid?' },
        response: { id: 'uuid', subject: 'string', ticket_number: 'TKT-0001' },
        note: 'SLA: critical=2h, high=4h, medium=8h, low=24h',
      },
      {
        method: 'POST',
        path: '/api/support-tickets.php?action=comment',
        description: 'เพิ่ม comment ใน ticket',
        auth: 'Bearer <token>',
        body: { ticket_id: 'uuid', content: 'string', is_internal: '0|1?' },
        response: { id: 'uuid', content: 'string' },
      },
      {
        method: 'GET',
        path: '/api/support-contracts.php',
        description: 'รายการสัญญา support',
        auth: 'Bearer <token>',
        query: { company_id: 'uuid?', status: 'active|expiring|expired?' },
        response: [{ id: 'uuid', company_id: 'uuid', plan: 'string', end_date: 'YYYY-MM-DD', status: 'active' }],
      },
    ],
  },
  {
    id: 'goals',
    label: 'Goals & Budget',
    description: 'OKR/KPI Goals, Budget tracking',
    endpoints: [
      {
        method: 'GET',
        path: '/api/goals.php',
        description: 'รายการ goals (OKR/KPI)',
        auth: 'Bearer <token>',
        query: { project_id: 'uuid?', company_id: 'uuid?', status: 'active|completed?', id: 'uuid?' },
        response: [{ id: 'uuid', title: 'string', target_value: 100, current_value: 60, status: 'active' }],
      },
      {
        method: 'POST',
        path: '/api/goals.php',
        description: 'สร้าง goal ใหม่',
        auth: 'Bearer <token>',
        body: { title: 'string', project_id: 'uuid?', target_value: 'number', unit: 'string?', due_date: 'YYYY-MM-DD?' },
        response: { id: 'uuid', title: 'string' },
      },
      {
        method: 'GET',
        path: '/api/budget.php?project_id=<uuid>',
        description: 'รายการงบประมาณและต้นทุนของโครงการ',
        auth: 'Bearer <token>',
        response: [{ id: 'uuid', category: 'string', budgeted_amount: 100000, actual_amount: 75000 }],
      },
      {
        method: 'POST',
        path: '/api/budget.php',
        description: 'สร้างรายการงบประมาณ',
        auth: 'Bearer <token>',
        body: { project_id: 'uuid', category: 'string', budgeted_amount: 'number', description: 'string?' },
        response: { id: 'uuid', project_id: 'uuid', budgeted_amount: 100000 },
      },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Content, Email Campaigns, Surveys',
    endpoints: [
      {
        method: 'GET',
        path: '/api/content-items.php',
        description: 'รายการ content (บทความ, social, etc.)',
        auth: 'Bearer <token>',
        query: { status: 'draft|published|scheduled?', content_type: 'article|social_post|email?' },
        response: [{ id: 'uuid', title: 'string', content_type: 'article', status: 'published' }],
      },
      {
        method: 'GET',
        path: '/api/email-campaigns.php',
        description: 'รายการ email campaigns',
        auth: 'Bearer <token>',
        query: { id: 'uuid?', status: 'draft|scheduled|sent?' },
        response: [{ id: 'uuid', name: 'string', status: 'draft', recipient_count: 0 }],
      },
      {
        method: 'POST',
        path: '/api/email-campaigns.php?action=send',
        description: 'ส่ง campaign ทันที',
        auth: 'Bearer <token>',
        body: { id: 'uuid' },
        response: { sent: true, count: 150 },
      },
      {
        method: 'GET',
        path: '/api/surveys.php',
        description: 'รายการ survey templates',
        auth: 'Bearer <token>',
        query: { id: 'uuid?' },
        response: [{ id: 'uuid', title: 'string', question_count: 5 }],
      },
      {
        method: 'GET',
        path: '/api/marketing-attribution.php',
        description: 'รายงาน attribution per lead source',
        auth: 'Bearer <token>',
        query: { period: 'number (days, default 365)' },
        response: [{ lead_source: 'bni', leads: 12, won: 3, revenue: 450000 }],
      },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    description: 'Automation Rules, Workflows, Recurring Tasks',
    endpoints: [
      {
        method: 'GET',
        path: '/api/automation.php',
        description: 'รายการ automation rules',
        auth: 'Bearer <token>',
        query: { project_id: 'uuid?', trigger: 'string?' },
        response: [{ id: 'uuid', name: 'string', trigger: 'task_status_changed', is_active: 1 }],
      },
      {
        method: 'POST',
        path: '/api/automation.php',
        description: 'สร้าง automation rule',
        auth: 'Bearer <token>',
        body: { name: 'string', trigger: 'string', conditions: 'object?', actions: 'array' },
        response: { id: 'uuid', name: 'string' },
      },
      {
        method: 'GET',
        path: '/api/workflows.php',
        description: 'รายการ workflow templates',
        auth: 'Bearer <token>',
        response: [{ id: 'uuid', name: 'string', steps: [] }],
      },
      {
        method: 'GET',
        path: '/api/recurring-tasks.php',
        description: 'รายการ recurring tasks',
        auth: 'Bearer <token>',
        response: [{ id: 'uuid', title: 'string', recurrence_rule: 'weekly', next_due: 'YYYY-MM-DD' }],
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI / Chat',
    description: 'AI Chat, SQL Query, Task Intelligence',
    endpoints: [
      {
        method: 'POST',
        path: '/api/chat.php',
        description: 'ส่งข้อความหา AI (ผ่าน provider ที่ configured)',
        auth: 'Bearer <token>',
        body: { model: 'string', messages: [{ role: 'user|system|assistant', content: 'string' }] },
        response: { choices: [{ message: { role: 'assistant', content: 'string' } }] },
      },
      {
        method: 'POST',
        path: '/api/query.php',
        description: 'รัน SELECT SQL query ต่อฐานข้อมูลของ tenant (AI เท่านั้น)',
        auth: 'Bearer <token>',
        body: { sql: 'SELECT ... WHERE tenant_id = :tenant_id' },
        response: { data: [{}] },
        note: 'รองรับเฉพาะ SELECT — :tenant_id inject อัตโนมัติ',
      },
      {
        method: 'GET',
        path: '/api/task-intelligence.php?project_id=<uuid>',
        description: 'AI วิเคราะห์ความเสี่ยงของโครงการ',
        auth: 'Bearer <token>',
        response: [{ task_id: 'uuid', risk_level: 'high', reason: 'string' }],
      },
      {
        method: 'GET',
        path: '/api/ai-settings.php',
        description: 'ดู AI provider + model ที่ใช้งานอยู่',
        auth: 'Bearer <token>',
        response: { provider: 'openai|anthropic|...', model: 'string', features: {} },
      },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Users, Roles, Settings, Custom Fields (admin เท่านั้น)',
    endpoints: [
      {
        method: 'GET',
        path: '/api/users.php',
        description: 'รายการผู้ใช้ทั้งหมดในองค์กร',
        auth: 'Bearer <token>',
        response: [{ id: 'uuid', display_name: 'string', email: 'string', role_label: 'string', is_active: 1 }],
      },
      {
        method: 'POST',
        path: '/api/users.php',
        description: 'สร้างผู้ใช้ใหม่ (admin)',
        auth: 'Bearer <token>',
        body: { email: 'string', display_name: 'string', password: 'string', role_id: 'number?' },
        response: { id: 'uuid', email: 'string' },
      },
      {
        method: 'GET',
        path: '/api/roles.php',
        description: 'รายการ roles + สิทธิ์เมนู (admin)',
        auth: 'Bearer <token>',
        response: [{ id: 1, label: 'Developer', permissions: ['projects', 'tasks'] }],
      },
      {
        method: 'GET',
        path: '/api/custom-fields.php',
        description: 'Custom fields ที่กำหนดเอง',
        auth: 'Bearer <token>',
        query: { project_id: 'uuid?' },
        response: [{ id: 'uuid', name: 'string', field_type: 'text|number|date|select', is_required: 0 }],
      },
      {
        method: 'GET',
        path: '/api/settings.php',
        description: 'ตั้งค่าองค์กร (company_settings)',
        auth: 'Bearer <token>',
        response: { company_name: 'string', timezone: 'Asia/Bangkok', fiscal_year_start: 1 },
      },
    ],
  },
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  POST: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  PUT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ data }: { data: unknown }) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return (
    <div className="relative">
      <pre className="bg-slate-950 text-slate-100 p-3 rounded-md text-xs overflow-x-auto leading-relaxed">
        {text}
      </pre>
      <CopyButton text={text} />
    </div>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <Badge className={cn('font-mono text-xs shrink-0 w-14 justify-center', METHOD_COLORS[ep.method])}>
          {ep.method}
        </Badge>
        <code className="text-sm font-mono text-foreground flex-1 truncate">{ep.path}</code>
        <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-xs">{ep.description}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4 bg-muted/20">
          <p className="text-sm text-muted-foreground">{ep.description}</p>

          {ep.auth && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Authorization</p>
              <code className="text-xs bg-muted px-2 py-1 rounded">{ep.auth}</code>
            </div>
          )}

          {ep.query && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Query Parameters</p>
              <div className="space-y-1">
                {Object.entries(ep.query).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <code className="text-blue-600 dark:text-blue-400 w-32 shrink-0">{k}</code>
                    <span className="text-muted-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.body && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Request Body</p>
              <CodeBlock data={ep.body} />
            </div>
          )}

          {ep.response && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Response</p>
              <CodeBlock data={ep.response} />
            </div>
          )}

          {ep.note && (
            <div className="flex gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
              <span className="text-amber-500 text-sm shrink-0">⚠️</span>
              <p className="text-xs text-amber-800 dark:text-amber-300">{ep.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quotation Guide rendered as structured sections ──────────────────────────
const QUOTATION_GUIDE_SECTIONS = [
  {
    title: '1. เข้าสู่ระบบ / รับ Token',
    note: 'เก็บ data.token ไว้ใช้ใน request ถัดไปทั้งหมด',
    curl: `curl -s -X POST http://localhost:8080/api/auth/login.php \\
  -H "Content-Type: application/json" \\
  -d '{"email":"your@email.com","password":"yourpassword"}'`,
    response: `{"data":{"token":"eyJhbGciOiJIUzI1NiJ9...","user":{"id":"uuid","tenant_id":"uuid"}}}`,
  },
  {
    title: '2. ขอเลขที่ใบเสนอราคาถัดไป',
    note: 'เลขนี้ไม่ถูก reserve — ต้อง POST ทันทีก่อน request อื่นจะขอเลขเดิม',
    curl: `curl -s http://localhost:8080/api/next-quotation-number.php \\
  -H "Authorization: Bearer <TOKEN>"`,
    response: `{"data":{"next_number":"QT-202606-0001","sequence":1}}`,
  },
  {
    title: '3. สร้างใบเสนอราคา (POST)',
    note: 'Required: company_id, quotation_number, valid_until, items (อย่างน้อย 1)',
    curl: `curl -s -X POST http://localhost:8080/api/quotations.php \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "company_id": "uuid-บริษัท",
    "quotation_number": "QT-202606-0001",
    "subject": "ใบเสนอราคาระบบ ERP สำหรับโรงงาน",
    "valid_until": "2026-07-31",
    "issue_date": "2026-06-19",
    "status": "draft",
    "total_amount": 150000,
    "discount": 0,
    "tax": 10500,
    "grand_total": 160500,
    "payment_terms": "มัดจำ 30% ชำระเมื่อส่งมอบ 70%",
    "notes": "ราคานี้มีผลภายใน 30 วัน",
    "opportunity_id": "uuid (optional)",
    "customer_id": "uuid (optional)",
    "items": [
      {"item_name":"พัฒนาระบบ Phase 1","description":"วิเคราะห์และออกแบบ","quantity":1,"unit":"งาน","unit_price":80000,"total_price":80000},
      {"item_name":"พัฒนาระบบ Phase 2","description":"พัฒนาและทดสอบ","quantity":1,"unit":"งาน","unit_price":70000,"total_price":70000}
    ]
  }'`,
    response: `HTTP 201\n{"data":{"quotation_id":"uuid","quotation_number":"QT-202606-0001","subject":"...","status":"draft","grand_total":160500,"item_count":2,"items":[...]}}`,
  },
  {
    title: '4. ดูรายการใบเสนอราคา (GET list)',
    curl: `# ดูทั้งหมด
curl -s "http://localhost:8080/api/quotations.php" \\
  -H "Authorization: Bearer <TOKEN>"

# กรองตาม company / opportunity / status
curl -s "http://localhost:8080/api/quotations.php?company_id=<UUID>&status=draft" \\
  -H "Authorization: Bearer <TOKEN>"`,
    response: `{"data":[{"quotation_id":"uuid","quotation_number":"QT-202606-0001","subject":"...","grand_total":160500,"status":"draft","item_count":2}]}`,
  },
  {
    title: '5. ดูรายละเอียด + รายการสินค้า (GET single)',
    curl: `curl -s "http://localhost:8080/api/quotations.php?id=<QUOTATION_UUID>" \\
  -H "Authorization: Bearer <TOKEN>"`,
    response: `{"data":{"quotation_id":"uuid","quotation_number":"QT-202606-0001","subject":"...","total_amount":150000,"tax":10500,"grand_total":160500,"company_name":"...","items":[{"item_name":"Phase 1","quantity":1,"unit_price":80000}]}}`,
  },
  {
    title: '6. แก้ไขใบเสนอราคา (PUT — partial update)',
    note: 'ถ้าส่ง items → รายการเดิมทั้งหมดจะถูกแทนที่',
    curl: `# เปลี่ยน status เป็น sent
curl -s -X PUT "http://localhost:8080/api/quotations.php?id=<UUID>" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"sent","subject":"หัวข้อใหม่"}'`,
    response: `{"data":{"quotation_id":"uuid","status":"sent","subject":"หัวข้อใหม่","updated_at":"2026-06-19 15:00:00"}}`,
  },
  {
    title: '7. ลบใบเสนอราคา (DELETE)',
    curl: `curl -s -X DELETE "http://localhost:8080/api/quotations.php?id=<UUID>" \\
  -H "Authorization: Bearer <TOKEN>"`,
    response: `{"data":{"message":"ลบใบเสนอราคาสำเร็จ"}}`,
  },
  {
    title: '8. AI สร้างรายการอัตโนมัติจาก Template + Brief',
    note: 'ต้องตั้งค่า AI Provider ใน Admin → AI Settings | ไม่ save อัตโนมัติ — ต้อง POST ต่อ',
    curl: `curl -s -X POST "http://localhost:8080/api/quotations.php?action=ai-generate" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"template_id":"uuid-template","brief":"ระบบ ERP โรงงาน 200 user 6 เดือน รวมฝึกอบรม"}'`,
    response: `{"data":{"items":[{"item_name":"License ERP","quantity":200,"unit":"user","unit_price":500,"total_price":100000}],"discount":0,"tax":21000,"payment_terms":"มัดจำ 30%"}}`,
  },
  {
    title: '9. AI สร้างรายการจาก Opportunity',
    note: 'ไม่ save อัตโนมัติ — ต้อง POST ต่อ',
    curl: `curl -s -X POST "http://localhost:8080/api/quotations.php?action=ai-fill" \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"opportunity_id":"uuid-opportunity","template_id":"uuid (optional)"}'`,
    response: `{"data":{"items":[{"item_name":"บริการพัฒนา","quantity":1,"unit_price":100000,"total_price":100000}]}}`,
  },
];

function QuotationGuide() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          คู่มือ API ใบเสนอราคา
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Base URL: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">http://localhost:8080/api</code>
          &nbsp;· Auth: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">Authorization: Bearer &lt;token&gt;</code>
          &nbsp;· ไฟล์คู่มือฉบับเต็ม: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">docs/api-quotation.md</code>
        </p>
      </div>
      <Separator />

      {/* Error codes */}
      <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Error Codes</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[['201','สร้างสำเร็จ'],['400','ข้อมูลไม่ครบ'],['401','Token หมดอายุ'],['404','ไม่พบข้อมูล']].map(([code,label]) => (
            <div key={code} className="flex gap-2 items-center">
              <Badge variant="outline" className="font-mono text-xs">{code}</Badge>
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {QUOTATION_GUIDE_SECTIONS.map((sec, i) => (
        <div key={i} className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b">
            <p className="font-semibold text-sm">{sec.title}</p>
            {sec.note && <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">⚠️ {sec.note}</p>}
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">cURL</p>
              <CodeBlock data={sec.curl} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Response</p>
              <CodeBlock data={sec.response} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ApiDocsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('auth');
  const [showGuide, setShowGuide] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return CATEGORIES.flatMap(cat =>
      cat.endpoints
        .filter(ep => ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q) || ep.method.toLowerCase().includes(q))
        .map(ep => ({ ...ep, _cat: cat.label }))
    );
  }, [search]);

  const currentCat = CATEGORIES.find(c => c.id === activeCategory);
  const totalEndpoints = CATEGORIES.reduce((s, c) => s + c.endpoints.length, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-4 max-w-6xl mx-auto">
          <Button variant="outline" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Code className="h-5 w-5" />
              API Reference
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalEndpoints} endpoints · REST · Bearer JWT · Base: <code className="bg-muted px-1 rounded">/api</code>
            </p>
          </div>
          <div className="relative w-64 hidden sm:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="ค้นหา endpoint..."
              value={search}
              onChange={e => { setSearch(e.target.value); if (e.target.value) setShowGuide(false); }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden max-w-6xl mx-auto w-full">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 border-r hidden md:block">
          <ScrollArea className="h-full py-3">
            <div className="space-y-0.5 px-2">
              {/* Guide button */}
              <button
                onClick={() => { setShowGuide(true); setSearch(''); }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                  showGuide && !search
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="font-medium flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  คู่มือ Quotation
                </div>
                <div className="text-xs opacity-60 mt-0.5">9 ขั้นตอน + cURL</div>
              </button>

              <div className="mx-3 my-1 border-t" />

              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setShowGuide(false); setSearch(''); }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    activeCategory === cat.id && !search && !showGuide
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="font-medium">{cat.label}</div>
                  <div className="text-xs opacity-60 mt-0.5">{cat.endpoints.length} endpoints</div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-4 max-w-3xl">
              {showGuide && !filtered ? (
                <QuotationGuide />
              ) : filtered ? (
                <>
                  <p className="text-sm text-muted-foreground">พบ {filtered.length} endpoint สำหรับ "<strong>{search}</strong>"</p>
                  {filtered.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">ไม่พบ endpoint ที่ตรงกัน</div>
                  ) : (
                    filtered.map((ep, i) => (
                      <div key={i}>
                        <p className="text-xs text-muted-foreground mb-1">{ep._cat}</p>
                        <EndpointCard ep={ep} />
                      </div>
                    ))
                  )}
                </>
              ) : currentCat ? (
                <>
                  <div>
                    <h2 className="text-lg font-semibold">{currentCat.label}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{currentCat.description}</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {currentCat.endpoints.map((ep, i) => (
                      <EndpointCard key={i} ep={ep} />
                    ))}
                  </div>
                </>
              ) : null}

              {/* Auth note */}
              {!filtered && activeCategory === 'auth' && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm space-y-2">
                  <p className="font-medium">การใช้งาน JWT Token</p>
                  <p className="text-muted-foreground text-xs">ทุก endpoint (ยกเว้น login) ต้องส่ง header:</p>
                  <CodeBlock data="Authorization: Bearer <token>" />
                  <p className="text-muted-foreground text-xs">Token ได้จาก POST /api/auth.php และเก็บใน localStorage (key: <code>flowstack_token</code>)</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
