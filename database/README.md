# Flowstack — Project Management & Business SaaS

ระบบจัดการโปรเจกต์และธุรกิจครบวงจรสำหรับองค์กรไทย  
**Stack:** PHP 8 + MariaDB (XAMPP) · React 18 + TypeScript + Vite · TanStack Query · shadcn-ui · Tailwind CSS

---

## Quick Start

```bash
pnpm dev      # dev server → http://localhost:8080
pnpm build    # production build → dist/
pnpm lint     # ESLint
pnpm test     # Vitest
```

**Backend:** XAMPP → `http://localhost/flowstack/api/`  
**DB:** MariaDB — source of truth: `database/schema.sql`

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (React 18 + TS + Vite)                │
│  HashRouter · AppSidebar · TopNav · ChatWidget  │
│  30+ Pages · shadcn-ui · TanStack Query         │
│  apiFetch() → Authorization: Bearer <JWT>       │
├─────────────────────────────────────────────────┤
│  Backend (PHP 8)                                │
│  api/*.php — REST-style, 80+ endpoints          │
│  requireAuth() → JWT verify → tenant_id         │
│  getDB() → PDO → MariaDB                        │
│  jsonResponse() / jsonError()                   │
├─────────────────────────────────────────────────┤
│  MariaDB — 76 tables, UUID PKs                  │
│  Multi-tenant: tenant_id ทุก entity table       │
└─────────────────────────────────────────────────┘
```

### Routing

ใช้ **HashRouter** เพื่อ compatibility กับ subdirectory `/flowstack`  
Route guards: `PermissionRoute` (login + menuKey) · `ProtectedRoute` (login only) · `AuthRoute` (redirect ถ้า login แล้ว)

### Key Conventions

| Convention | Detail |
|---|---|
| Primary Keys | `CHAR(36)` UUID — `generateUUID()` in PHP |
| Multi-tenancy | `tenant_id` บนทุก entity table |
| JWT | Bearer token เก็บใน `localStorage` key: `flowstack_token` |
| UI Language | **Thai** ทุก label/button/message — code identifiers ใช้ English |
| Empty Select | ใช้ `"__none__"` แทน `""` ใน shadcn `<Select.Item>` |
| Timestamps | `DATETIME` — `created_at` / `updated_at` |
| Data Fetching | TanStack Query — staleTime 5 min, gcTime 10 min, no refetch on focus |
| Page Shell | ทุก page ใช้ `<PageShell>` + `<PageBreadcrumb>` เป็น template มาตรฐาน |

---

## Project Map

```
src/App.tsx                    Router + PermissionRoute guards
src/components/                Shared UI components
src/components/ui/             shadcn-ui primitives (do not edit)
src/pages/                     Feature pages (36 pages)
src/hooks/                     TanStack Query + Auth hooks
src/lib/                       Business logic (projectUtils, exportUtils, ...)
api/                           PHP backend endpoints
api/auth/                      login, logout, me, signup, refresh
api/lib/                       Shared PHP libs (customer-tiering, publish-dispatch)
api/views/                     SQL view proxies
api/cron/                      Scheduled jobs
database/schema.sql            Full DB schema (source of truth)
database/migrations/           YYYY_MM_DD_HHMMSS_description.sql
docs/                          Specs, PRD, KPI config, CRM strategy
uploads/support/               Ticket file attachments
```

---

## Authentication & Authorization

**API:** `api/auth/login.php` · `api/auth/signup.php` · `api/auth/me.php` · `api/auth/logout.php` · `api/auth/refresh.php`  
**Tables:** `users` · `user_email_aliases` · `tenant_users` · `tenants` · `roles` · `role_menu_permissions` · `login_rate_limits` · `user_activity_logs`

### Flow

```
Signup:  POST /api/auth/signup.php
  → สร้าง user + tenant (plan=trial, status=active)
  → ผูก user เป็น admin ใน tenant_users (is_admin=1)
  → ตรวจซ้ำ email ทั้ง users.email + user_email_aliases.alias_email

Login:   POST /api/auth/login.php
  → ค้นหา email ใน users.email UNION user_email_aliases.alias_email
  → rate limit: IP-based 10 ครั้ง / 15 นาที (login_rate_limits)
  → สร้าง JWT { user_id, tenant_id, is_admin, exp }
  → บันทึก user_activity_logs (action=login)

Every request:
  requireAuth() → verifyToken() → $userId, $tenantId, $isAdmin
  hasPermission(menuKey):
    is_admin=1   → bypass ทุก permission
    is_active=0  → ปฏิเสธทั้งหมด
    ตรวจ role_menu_permissions JOIN tenant_users → menuKey

Logout:  POST /api/auth/logout.php
  → บันทึก user_activity_logs (action=logout)
  → Frontend: removeToken() + clear state + redirect /auth
```

### Roles & Permissions

- `is_admin=1` — bypass ทุก permission check
- `is_active=0` — disable account ทันที
- Frontend: `PermissionRoute menuKey="..."` ใน `App.tsx`
- Backend: `requireAuth()` + `requireAdmin()` ใน `api/auth.php`
- Sidebar: กรอง menu items ด้วย `hasPermission(menuKey)` จาก `useAuth()`
- Email aliases: login ได้ด้วย alias หลายอีเมล

---

## Module Index

| # | Module | Route | menuKey |
|---|--------|-------|---------|
| 1 | Dashboard | `/` | `home` |
| 2 | Projects | `/projects`, `/project/:id` | `projects` |
| 3 | Recurring Tasks | `/recurring-tasks` | `projects` |
| 4 | Timesheet | `/timesheet` | `timesheet` |
| 5 | Team Calendar | `/calendar` | `calendar` |
| 6 | Goals & OKR | `/goals` | `goals` |
| 7 | Budget | `/budget` | `budget` |
| 8 | Automation | `/automation` | `automation` |
| 9 | Companies & CRM | `/companies` | `companies` |
| 10 | Sales Pipeline | `/sales`, `/sales/:id` | `sales` |
| 11 | Surveys | `/surveys`, `/survey/public/:token` | `sales` / public |
| 12 | Quotations | `/quotations` | `quotations` |
| 13 | Revenue | `/revenue` | `revenue` |
| 14 | Helpdesk | `/support` | `support` |
| 15 | Knowledge Base | `/knowledge-base` | `support` |
| 16 | Content Management | `/content` | `marketing` |
| 17 | Content Planner | `/content-planner` | `marketing` |
| 18 | Email Campaigns | `/campaigns` | `marketing` |
| 19 | Campaign Analytics | `/campaign-analytics` | `marketing` |
| 20 | Marketing / Send Email | `/marketing` | `marketing` |
| 21 | ImpactOS | `/impactos` | `analytics` |
| 22 | Task Intelligence | `/task-intelligence` | `task_intelligence` |
| 23 | Analytics | `/analytics` | `analytics` |
| 24 | Resource Dashboard | `/resources` | `resources` |
| 25 | Admin | `/admin` | `admin` |
| 26 | Export | `/export` | `admin` |
| 27 | Inbox | `/inbox` | `inbox` |
| 28 | Profile | `/profile` | (login only) |
| 29 | Help / API Docs | `/help`, `/api-docs` | (login only) |

**Public routes (no login):** `/auth` · `/survey/public/:token`  
**Redirects:** `/reports` → `/analytics` · `/recurring-tasks` → `/timesheet`

---

## Module Details

---

### 1. Dashboard (`/`)

**API:** `api/projects.php` · `api/opportunities.php` · `api/quotations.php` · `api/companies.php`  
**Tables:** `projects` · `sales_opportunities` · `quotations` · `companies` · `tasks`

```
ตัวชี้วัดภาพรวม: จำนวนโปรเจกต์, Won deals, ใบเสนอราคา, บริษัท
กราฟวงกลม: สัดส่วนสถานะโปรเจกต์
กราฟแท่ง: ยอดขาย Won รายเดือน
รายการโปรเจกต์ล่าสุด + Opportunities ล่าสุด
กรองตามปี / ช่วงวันที่กำหนดเอง
  Won deals → กรองด้วย actual_close_date (fallback: expected_close_date)
```

---

### 2. Projects (`/projects`, `/project/:id`)

**API:** `api/projects.php` · `api/tasks.php` · `api/subtasks.php` · `api/project-members.php` · `api/task-dependencies.php` · `api/chat.php` · `api/capacity.php`  
**Tables:** `projects` · `tasks` · `project_members` · `task_dependencies` · `task_history` · `task_validation_rules` · `view_settings`  
**Hooks:** `useProjects.ts` · `useTasks.ts`

#### Project

```
Project Status: on-track | at-risk | delayed | completed
Fields: name, description, start_date, end_date, budget_hours, hourly_rate, project_value
สร้างโปรเจกต์:
  → สร้าง calendar_event อัตโนมัติ (synced กับ project dates)
  → เพิ่ม creator เป็น project_member
  → kind='base_calendar': Base Calendar ปรากฏเป็นตัวเลือกแรกใน ProjectCombobox
```

#### Task

```
Status:   pending → in-progress → completed | overdue | cancelled
Priority: low / medium / high / urgent
Task type: อ่านจาก company_settings.task_type_catalog (admin จัดการได้)

Business rules:
  - งานวันเดียว: estimated_hours ≤ 16
  - งานหลายวัน: estimated_hours = estimated_days × 8
  - บันทึก task_history ทุกการเปลี่ยนแปลง
  - Pause/Resume: paused_at, paused_by, pause_reason
  - Auto Timeline Shift: end_date เลยกำหนด → ขยับงานถัดไปอัตโนมัติ

Task Validation Rules (task_validation_rules):
  - rule_type=block → ห้ามสร้างถ้าไม่ผ่านเงื่อนไข
  - rule_type=warn  → สร้างได้แต่แจ้งเตือน
```

#### Subtask

```
parent_task_id → tree structure หลายชั้น (recursive)
is_subtask=1, level คำนวณจาก parent
อัปเดต subtask → คำนวณ progress ของ parent ใหม่

Hours rollup:
  มี subtask  → actual_hours = SUM(subtask.actual_hours)
  ไม่มี subtask → actual_hours = ค่าของ task เอง
  KPI/ImpactOS ใช้ leaf tasks เท่านั้น (ไม่นับซ้ำ parent+child)
```

#### Task Dependencies

```
task_dependencies: blocked_task_id, blocking_task_id
relation_type: finish-to-start
reason_code: URGENT_INSERT / CUSTOMER_REQUEST / TECHNICAL_BLOCKER / ฯลฯ
impact_days: จำนวนวันที่ได้รับผลกระทบ
เมื่อ blocking task เสร็จ → แจ้งเตือน blocked task
```

#### Views (4 มุมมองต่อโปรเจกต์)

```
Kanban Board   — drag-and-drop ข้ามคอลัมน์ status
Gantt Chart    — timeline + dependencies
Calendar View  — filter ตามประเภทงาน, โปรเจกต์, คน
Spreadsheet    — inline edit, sort, filter
view_settings  — จำ preference ต่อ user ต่อ project
```

#### AI Features

```
AI WBS Generator:
  POST /api/chat.php (action=generate_wbs)
  → รับชื่อโปรเจกต์ → AI สร้าง task tree → บันทึก tasks + subtasks

Ad-hoc Impact Simulation (src/lib/projectUtils.ts):
  → หางานที่ assignee คนเดียวกัน overlap กับช่วงวันที่ใหม่
  → คำนวณ delay ที่เกิดขึ้นแต่ละงาน
  → แสดง: จำนวนงานกระทบ, จำนวนโปรเจกต์กระทบ, วันที่เลื่อนสูงสุด
```

#### Capacity Check

```
GET /api/capacity.php?user_id=...&start_date=...&end_date=...&estimated_hours=...
  → ใช้ calendar_events (holiday/leave) เป็น source of truth
  → รองรับ calendar_overrides (swap วันหยุด/วันทำงาน)
  → warning ถ้าชั่วโมงเกิน capacity จริง
```

---

### 3. Recurring Tasks (`/recurring-tasks`)

**API:** `api/recurring-tasks.php`  
**Tables:** `recurring_tasks` · `tasks`  
**Note:** Route `/recurring-tasks` redirect ไป `/timesheet` ใน App.tsx แต่ feature ยังมีอยู่ผ่าน RecurringTasksPage

```
Fields: title, description, priority, assignee, estimated_days, task_type
frequency: daily / weekly / monthly / quarterly / yearly
interval_count: ทุก N รอบ
start_date, end_date (ถ้ามี), max_occurrences (จำนวนสูงสุด)
next_occurrence: คำนวณอัตโนมัติ
instance_count: นับจำนวนที่สร้างแล้ว
is_active: เปิด/ปิด template

การทำงาน:
  Cron/Manual trigger → อ่าน recurring_tasks ที่ next_occurrence <= now()
  → สร้าง task ใหม่ตาม template
  → อัปเดต next_occurrence, instance_count
  Run Manual: สั่งสร้างงานทันทีโดยไม่ต้องรอ cron
```

---

### 4. Timesheet (`/timesheet`)

**API:** `api/tasks.php` · `api/subtasks.php` · `api/timesheet.php` (legacy adapter) · `api/timesheet-batch.php`  
**Tables:** `tasks` · `projects`

```
ชั่วโมงบันทึกใน actual_hours บน task/subtask โดยตรง
  มี subtask  → ชั่วโมงรวมจาก SUM(subtask.actual_hours)
  ไม่มี subtask → ชั่วโมงจาก task โดยตรง

Batch Update (api/timesheet-batch.php):
  → อัปเดตชั่วโมงหลาย task พร้อมกัน
  → ใช้สำหรับ bulk timesheet entry

สรุปชั่วโมง:
  → กรองตามช่วงวันที่และผู้ใช้
  → สรุปรายสัปดาห์ / รายเดือน
  → นับเฉพาะ leaf tasks (ไม่นับซ้ำ parent+child)
  → แสดง view ตามโปรเจกต์ หรือตามผู้ใช้

Hours Rollup (api/task-hours-rollup.php):
  → recompute actual_hours ของ parent tasks จาก children
  → ใช้เมื่อต้องการ sync ข้อมูลใหม่
```

---

### 5. Team Calendar (`/calendar`)

**API:** `api/calendar.php`  
**Tables:** `calendar_events` · `calendar_overrides` · `tasks` · `projects` · `company_settings`  
**Source of truth:** วันหยุด (`holiday`) + วันลา (`leave`) ต้องเก็บใน `calendar_events` เสมอ

```
GET /api/calendar.php?start=...&end=...&project_id=...&user_id=...
  → ดึง calendar_events + tasks รวมกัน
  → กรอง project_id: Base Calendar (kind='base_calendar') หรือโปรเจกต์เฉพาะ
  → กรอง user_id: assignee_user_id / created_by
  → Parent task inclusion: งานลูกที่อยู่ในช่วง → ดึง parent มาด้วยเสมอ

event_type  — อ่านจาก company_settings.calendar_event_type_catalog
task_type   — อ่านจาก company_settings.task_type_catalog
Backend validate ตาม catalog เดียวกัน

Calendar Event:
  title, event_type, start_at, end_at, all_day, description
  status: confirmed / tentative / cancelled
  holiday → sync กับทุก user ใน tenant

Calendar Overrides:
  → สลับวันทำงาน/วันหยุด แบบ per-user หรือ per-tenant
  → ใช้ใน capacity calculation

ปุ่ม "เพิ่ม ▾":
  1. นัดหมาย  → สร้าง calendar_event
  2. งานโปรเจค → CreateTaskDialog (บังคับเลือกโปรเจกต์ รวม Base Calendar)

Filter Bar (compact, one row):
  type pills: ประชุม / ลา / วันหยุด / อื่นๆ / งานปกติ / วิจัย / งานแทรก / onsite / OT
  dropdown: โปรเจกต์ (Base Calendar + list) | คน (active users)
  รีเซ็ต: คืนค่าทั้งหมด
```

---

### 6. Goals & OKR (`/goals`)

**API:** `api/goals.php`  
**Tables:** `goals` · `goal_tasks`

```
goal_type: objective / key_result / kpi / milestone
parent_goal_id: hierarchy (Objective → Key Results → KPIs)
target_value, current_value, unit: % | บาท | จำนวน
weight: น้ำหนักสำหรับ KPI framework
status: draft → active → completed / cancelled / at_risk / on_hold
progress = (current_value / target_value) × 100

goal_tasks: เชื่อม task กับ goal
  contribution_percentage: สัดส่วนที่ task นี้มีต่อ goal
  เมื่อ task เสร็จ → อัปเดต current_value ของ goal
```

---

### 7. Budget (`/budget`)

**API:** `api/budget.php`  
**Tables:** `budget_items`

```
Fields: project_id, category, description, quantity, unit_price, planned_cost, actual_cost
category: labor / material / equipment / travel / software / general / other
status: planned → committed → actual / cancelled

สรุปงบรายโปรเจกต์:
  → planned vs actual vs committed
  → กราฟแท่งแยกหมวดหมู่
  → กราฟวงกลมสัดส่วน
```

---

### 8. Automation (`/automation`)

**API:** `api/automation.php` · `api/automation-fire.php`  
**Tables:** `automation_rules` · `automation_executions`

```
trigger_type:
  task_created / task_updated / task_deleted / status_changed /
  priority_changed / assignee_changed / due_date_approaching /
  due_date_passed / subtask_completed / dependency_resolved

trigger_conditions (JSON): เงื่อนไขเพิ่มเติม
actions (JSON): assign / notify / เปลี่ยน status / ฯลฯ
is_active: เปิด/ปิดรายกฎ

Flow:
  สร้าง/อัปเดต task → tasks.php เรียก automation-fire.php
  → ตรวจ automation_rules ที่ active และ trigger_type ตรง
  → Execute actions → บันทึก automation_executions
  → อัปเดต last_triggered, trigger_count
```

---

### 9. Companies & CRM (`/companies`)

**API:** `api/companies.php` · `api/customers.php` · `api/contacts.php` · `api/business-card-scan.php` · `api/company-enrich.php` · `api/company-lookup.php` · `api/customer-activities.php` · `api/customer-tiers.php`  
**Tables:** `companies` · `customers` · `customer_activities`

#### Company

```
Fields: name, address, phone, email, website, tax_id, logo_url,
        business_type, company_size, founded_year, is_active
```

#### Contact (Customer)

```
Fields: first_name, last_name, email, phone, position, company_id,
        is_primary_contact, is_active
ป้องกันซ้ำ: email + phone ภายในบริษัทเดียวกัน
```

#### Company Lookup & Enrich

```
api/company-lookup.php:
  → ค้นหาบริษัทจากชื่อหรือ tax_id ก่อนสร้างใหม่ (ป้องกันซ้ำ)

api/company-enrich.php:
  → ดึงข้อมูลเพิ่มเติมของบริษัทจาก external source
  → เติม business_type, company_size, address ที่ขาด
```

#### AI Business Card Scan

```
POST /api/business-card-scan.php (multipart/form-data)
  → รองรับ jpg/png/webp (≤ 8MB)
  → โมเดลจาก company_settings.ai_cardscan_model_id
  → ส่งกลับ parsed_data + field_confidence + candidates + match_reason
  → normalized company matching (ลดผลจากช่องว่าง/สัญลักษณ์)
  → preview + แก้ไขก่อนบันทึก
  → บันทึก card_scan_success / card_scan_failed ลง user_activity_logs
```

#### Customer Tiering (api/lib/customer-tiering.php)

```
tiers (5 กลุ่ม):
  1. Partner          — ยอดซื้อสูงมาก + ความสัมพันธ์ส่วนตัว → VIP Care
  2. High-Value Regular — ยอดซื้อสูงต่อเนื่อง + ความสัมพันธ์ธุรกิจดี → Loyalty
  3. High Potential   — กำลังซื้อสูง + เริ่มสร้างความสัมพันธ์ → Nurturing
  4. Transactional    — ยอดซื้อปานกลาง + ความสัมพันธ์ทั่วไป → Efficiency
  5. Low Volume       — ยอดซื้อน้อย + ความสัมพันธ์ห่าง → Automation

คำนวณจาก RFM: Recency, Frequency, Monetary (12 เดือนย้อนหลัง)
  Sales Volume: sales_opportunities (Won) + quotations + projects (value)
  Relationship: customer_activities, user_activity_logs (visit/meeting/dinner)
AI ประเมินซ้ำทุกเดือน — ตรวจจับ "ดาวรุ่ง" (High Potential rising) และ "At Risk"
```

#### Customer Activities

```
activity_type: email_sent / email_opened / email_clicked /
               campaign_created / group_added / survey_sent /
               email_replied / email_bounced
reference_id: ชี้ไปยัง campaign หรือ survey
details (JSON): ข้อมูลเพิ่มเติม
```

---

### 10. Sales Pipeline (`/sales`, `/sales/:id`)

**API:** `api/opportunities.php` · `api/sales-activities.php` · `api/opportunity-members.php` · `api/sales-activity-eval.php`  
**Tables:** `sales_opportunities` · `sales_activities` · `opportunity_members` · `sales_pipeline_summary` (view)

```
Stages: lead → qualified → proposal → negotiation → won / lost

Kanban drag-and-drop:
  ลากไป won/lost → บันทึก actual_close_date = now()
  ลากกลับ        → ล้าง actual_close_date

Opportunity Fields:
  company_id, customer_id, name, description, value, probability,
  expected_close_date, actual_close_date, lead_source,
  competitor_info, notes, assigned_to

opportunity_members: role = owner / member
sales_activities: email / call / meeting / note / quotation_sent / other

Won → Auto Conversion:
  → สร้าง customer (ถ้ายังไม่มี)
  → สร้าง project + project_members
```

#### Sales Activity Eval (api/sales-activity-eval.php)

```
GET /api/sales-activity-eval.php?start_date=...&end_date=...&company_id=...
→ ประเมินผลการขายและ engagement รายบริษัท:
    emails_sent, emails_opened, emails_clicked, emails_bounced
    open_rate, click_rate
    ca_total (customer activities), sa_total (sales activities)
    opp_count, opp_won, opp_lost, opp_value, win_rate
    engagement_score
→ summary: companies_total, avg_open_rate, avg_click_rate, win_rate
```

---

### 11. Surveys (`/surveys`, `/survey/public/:token`)

**API:** `api/surveys.php` · `api/survey-scoring.php` · `api/survey-public.php`  
**Tables:** `survey_templates` · `survey_questions` · `survey_responses` · `survey_answers`

```
question_type: yes_no / scale_1_5 / multiple_choice / text
weight, is_critical, critical_bonus ต่อคำถาม
options_json: multiple_choice แต่ละ option มีคะแนน

ส่งแบบสอบถาม:
  → สร้าง survey_responses (opportunity_id / company_id)
  → สร้าง token → /survey/public/:token (ไม่ต้อง login)

Scoring (api/survey-scoring.php):
  yes_no:          yes=100%, no=0% (หรือกลับกัน)
  scale_1_5:       1=0% → 5=100%
  multiple_choice: คะแนนตาม options
  รวมด้วย weighted average (normalized weights = 100%)
  critical questions: ได้ bonus เมื่อคะแนนต่ำ
  → pain_point_score, pain_priority

AI suggest-weights: AI แนะนำน้ำหนักคำถาม
```

---

### 12. Quotations (`/quotations`)

**API:** `api/quotations.php` · `api/quotation-templates.php` · `api/next-quotation-number.php`  
**Tables:** `quotations` · `quotation_items` · `quotation_sequences`

```
quotation_number: QUO-YYYYMM-NNNN
  → quotation_sequences (period_key, last_number) → นับ +1 ต่อเดือน
status: draft → sent → approved / rejected / expired

Line Items: item_name, description, quantity, unit_price, discount

Price Formula:
  item.total    = quantity × unit_price
  subtotal      = Σ(item.total)
  discount_amt  = subtotal × discount%
  tax_amount    = (subtotal - discount_amt) × tax%
  grand_total   = subtotal - discount_amt + tax_amount

Export PDF: quotation + items + company_settings (logo, tax_id, bank info)

Quotation Templates:
  → บันทึก template ที่ใช้บ่อย
  → โหลด template → แก้ไข → สร้างใบจริง
```

---

### 13. Revenue (`/revenue`)

**API:** `api/opportunities.php` · `api/projects.php` · `api/companies.php`  
**Tables:** `projects` · `sales_opportunities` · `project_payments` · `companies`

```
Tab Overview:       ยอดรวม Won, payment status distribution, กราฟรายเดือน
Tab Projects:       payment_status: pending / partial / paid / overdue
Tab Opportunities:  Won deals — มูลค่า, วันปิดจริง, บริษัท
Tab Companies:      Top 10 บริษัทเรียงตามมูลค่ารายได้รวม
กรองตามปี / ช่วงวันที่
Export CSV
```

---

### 14. Helpdesk (`/support`)

**API:** `api/support-tickets.php` · `api/support-contracts.php` · `api/support-upload.php`  
**Tables:** `support_tickets` · `support_ticket_comments` · `support_contracts` · `support_attachments`

```
ticket_number: TKT-YYYYMMDD-NNN
type:     incident / request / problem / change
priority: critical / high / medium / low
SLA:      critical=2h · high=4h · medium=8h · low=24h
channel:  phone / email / walk-in / line / system
status:   open → in-progress → pending → resolved → closed

Tracking: first_response_at, resolved_at, closed_at
CSAT: csat_score, csat_comment
comment_type: internal (staff only) / external (customer visible)
แนบไฟล์: uploads/support/ via support-upload.php
resolution_note, timesheet_id (เชื่อมกับ timesheet)

Inbox Notification:
  สร้าง/โอน ticket → สร้าง inbox_messages ให้ผู้รับผิดชอบ

Support Contracts:
  type: hardware / software / ma / support / other
  status auto-check: active / expiring (< renewal_alert_days) / expired / cancelled
  แจ้งเตือนสัญญาใกล้หมดอายุทุกครั้งที่ GET
```

---

### 15. Knowledge Base (`/knowledge-base`)

**API:** `api/knowledge-base.php`  
**Tables:** `knowledge_base`

```
Fields: title, content, category, is_starred, views
category: บัญชีผู้ใช้ / การตั้งค่าระบบ / การใช้งาน / ทั่วไป
is_starred: ปักหมุดบทความสำคัญ
views: นับการเข้าดู (auto-increment)
ค้นหาตามชื่อบทความ
```

---

### 16. Content Management (`/content`)

**API:** `api/content-items.php` · `api/content-publish.php` · `api/brand-content.php` · `api/ai-insights.php`  
**Tables:** `content_items` · `brand_contexts` · `content_skills` · `content_triggers` · `publish_channels` · `content_publish_queue` · `content_global_settings` · `content_posting_analytics`  
**Hooks:** `useContent.ts`

#### 5 Tabs

```
1. ผลงานทั้งหมด  — ContentListTab: CRUD content items
2. กำหนดการโพสต์ — ScheduleOverviewPanel: ดู queue + overdue banner
3. Knowledge Base — BrandContextTab: file_type = brand_md / sop_md / custom
                    → ใช้เป็น context สำหรับ AI generation
4. Skills & Triggers — SkillsTriggerTab:
     Content Skills: name, content_type, system_prompt, steps (JSON)
     Content Triggers: command → skill_id (is_active toggle)
5. ตั้งค่า AI — AISettingsTab: model สำหรับ text/image/video generation
```

#### Content Item Fields

```
title, content_type, body (LONGTEXT), status: draft / published / archived
platform, scheduled_at, published_at
source: manual / ai_generated / imported
skill_id (FK → content_skills)
```

#### Publish Queue

```
POST /api/content-publish.php (action=schedule)
  → content_id, channels[], scheduled_at
  → สร้าง content_publish_queue (status=pending)

Cron: api/cron/publish-scheduler.php + api/lib/publish-dispatch.php
  → ทุก 60 วิ อ่าน pending ที่ scheduled_at ≤ now()
  → ส่งไป platform → status: processing → sent / failed
  → retry_count, error_msg

action=send_now    → ส่งทันที
action=overdue_count → นับ pending ที่เลยกำหนด (แสดง banner)
```

#### Publish Platforms

`wordpress` · `wix` · `custom` · `facebook` · `lineoa` · `instagram` · `tiktok` · `linkedin` · `twitter`  
credentials_encrypted: API keys เข้ารหัสใน DB

#### AI Insights (api/ai-insights.php)

```
→ วิเคราะห์ performance ของ content ที่โพสต์แล้ว
→ แนะนำ content strategy จาก posting_analytics
→ ใช้ ai_analyst_model_id จาก company_settings
```

---

### 17. Content Planner (`/content-planner`)

**API:** `api/brand-content.php` (planner section)  
**Tables:** `content_plans` · `content_plan_items`

```
plan_type: weekly / monthly / quarterly / yearly
week_start: วันที่เริ่มต้น
trigger_command: คำสั่ง trigger AI
skill_id, brand_context_ids (JSON)
status: draft → approved → published

AI สร้าง Content Plan:
  → จาก trigger_command → AI generate แผน
  → สร้าง content_plan_items:
      day_label, topic, caption, image_brief, platform
  → ai_raw_output เก็บ AI response ดิบ

มุมมองปฏิทิน: ตารางวัน × platform
```

---

### 18. Email Campaigns (`/campaigns`) & Marketing (`/marketing`)

**API:** `api/email-campaigns.php` · `api/email-groups.php` · `api/content-to-campaign.php` · `api/track-open.php` · `api/track-click.php` · `api/report-email.php` · `api/mail-settings.php` · `api/webhook-email.php`  
**Tables:** `email_campaigns` · `email_campaign_recipients` · `email_groups` · `email_group_members` · `email_tracking` · `email_link_clicks`  
**Hooks:** `useMarketing.ts`

#### Campaign Flow

```
สร้างแคมเปญ (/marketing):
  → sender_name, sender_email, subject, body_html (Rich Text Editor)
  → เลือก email_groups เป็น recipients
  → schedule: ส่งทันที หรือตั้งเวลา scheduled_at
  → status: draft → scheduled → sending → sent / cancelled

Email Groups (api/email-groups.php):
  → CRUD groups + email_group_members (customer_id → email)

AI Content → Email:
  POST /api/content-to-campaign.php (action=to-campaign)
  → แปลง content_item เป็น email campaign body_html
  → เชื่อม source_content_id
```

#### Tracking

```
Open Tracking:  pixel img ฝังในอีเมล → GET /api/track-open.php
Click Tracking: redirect ผ่าน GET /api/track-click.php → บันทึก email_link_clicks
email_tracking status: queued → sent → delivered → bounced / failed
บันทึก: opened_at, clicked_at, ip_address, user_agent
สถิติ: total_sent, total_opens, total_clicks, open_rate, click_rate
```

#### Campaign Analytics (`/campaign-analytics`)

```
GET /api/campaign-analytics.php
  → ภาพรวมทุกแคมเปญ: open rate, click rate, bounce rate
  → กราฟเปรียบเทียบแคมเปญ
  → timeline การส่ง
  → Top performing campaigns
  → กรองตามช่วงวันที่
```

#### Report Email (Scheduled Reports)

```
api/report-email.php:
  → ส่งรายงานสรุปทาง email แบบ scheduled (daily/weekly)
  → ประกอบด้วย: project status, task summary, SLA status
  → recipients: กำหนดในระบบ settings
```

#### Inbound Webhook (api/webhook-email.php)

```
POST /api/webhook-email.php:
  → รับ inbound email จาก mail service provider
  → parse sender, subject, body
  → สร้าง support ticket หรือ inbox message อัตโนมัติ
  → แนบ email thread ไว้ใน ticket
```

#### Mail Settings (api/mail-settings.php)

```
GET/PUT /api/mail-settings.php:
  → SMTP: host, port, encryption, username, password
  → sender_name, sender_email (default)
  → test connection: ส่ง test email
  → เก็บใน company_settings
```

---

### 19. ImpactOS (`/impactos`)

**API:** `api/impactos.php` · `api/kpi-weights.php` · `api/ai-insights.php` · `api/benchmark.php`  
**Tables:** `tasks` · `chat_messages` · `chat_sessions` · `users` · `kpi_weight_configs`  
**Views:** `cross_project_impact`

#### 11 Tabs

```
CEO / Overview / Departments  →  ?view=ceo|overview|departments
KPI Ranking / Dev             →  ?view=leaderboard|dev
Sales / Support               →  ?view=sales|support
Quality / Customer            →  ?view=quality|customer
AI Analysis (per-user)        →  ?view=ai_analysis  (ต้องตั้งค่า AI Provider)
AI Insights (system-wide)     →  api/ai-insights.php
Benchmark                     →  api/benchmark.php
```

#### KPI 4 แกนหลัก (P / Q / A / S)

```
P — Production:    leaf task actual_hours / 160 × 100  (ปริมาณงาน)
Q — Quality/Speed: (on_time_tasks / total_completed) × 100  (ตรงเวลา)
A — AI Adoption:   min(chat_count / median_chat × 100, 100)  (ใช้ AI)
S — Synergy:       (team_tasks / total_tasks) × 100  (ทำงานเป็นทีม)

KPI = P×p_weight + Q×q_weight + A×a_weight + S×s_weight
ผลรวม weight ต้อง = 100 เสมอ
```

#### Default Weights รายแผนก

| แผนก | P | Q | A | S |
|---|---|---|---|---|
| Development | 40% | 30% | 10% | 20% |
| Sales | 20% | 40% | 20% | 20% |
| Support | 30% | 30% | 10% | 30% |
| Management | 20% | 20% | 30% | 30% |

```
เกรด: A+(≥90) / A(≥80) / B+(≥70) / B(≥60) / C(≥50) / D(<50)

Leaf Task Rule:
  มี subtask  → นับชั่วโมงรวมจาก subtask เท่านั้น
  ไม่มี subtask → นับ actual_hours ของงานโดยตรง

Quality — Interrupted Proxy:
  วัดจากงานที่มี paused_at IS NOT NULL (ถูก interrupt)
  ไม่ใช่ rework จาก QA reject

KPI Weights (api/kpi-weights.php):
  GET    → ดู config ทั้งหมด
  POST   ?action=seed → seed default 4 แผนก
  PUT    ?id=xxx → แก้ไข weight รายแผนก
  ดึง weight ตาม users.position → fallback: 25/25/25/25

AI Analysis (per-user):
  → KPI ทั้ง 4 แกน + งานเสร็จ + ชั่วโมง + revenue contribution
  → AI วิเคราะห์ → { summary, strengths, weaknesses, recommendations }
  → ใช้ company_settings.ai_analyst_model_id

Benchmark Dashboard (api/benchmark.php):
  เปรียบเทียบกับ reference อุตสาหกรรม:
  ส่งงานตรงเวลา 75% | SLA Compliance 85% | Email Open Rate 22%
  Win Rate 30% | ปิดโปรเจกต์สำเร็จ 70% | แก้ Ticket เฉลี่ย 12h
  (ค่า reference ปรับแก้ได้ใน benchmark.php)

Cross-project Impact:
  → cross_project_impact SQL view
  → blocking/blocked chains ข้ามโปรเจกต์
```

---

### 20. Task Intelligence (`/task-intelligence`)

**API:** `api/task-intelligence.php`

```
Tab Assessment:
  → health metrics: on-time, overdue, completed, in-progress, pending
  → hours diff: estimated vs actual
  → กรองตามปี/ช่วงวันที่

Tab Quality:
  → missing fields: งานที่ขาดข้อมูลจำเป็น (no assignee, no dates)
  → anomalies: end_date < start_date, estimated_hours = 0
  → zombie tasks: ไม่มี activity นานเกินกำหนด

Tab Duplicates:
  → fuzzy match หางานชื่อคล้ายกันในโปรเจกต์เดียวกัน

Tab Migration:
  GET  ?action=migrate_preview → preview งานที่จะย้าย
  POST ?action=migrate          → ย้าย task + subtasks ข้ามโปรเจกต์ (admin only)
```

---

### 21. Analytics (`/analytics`)

**API:** `api/projects.php` · `api/opportunities.php` · `api/quotations.php` · `api/companies.php`  
**Tables:** `projects` · `tasks` · `sales_opportunities` · `quotations` · `companies`

```
ครอบคลุม: โปรเจกต์, งาน, โอกาสขาย, ใบเสนอราคา, บริษัท, timesheet
กรองตามปี
กราฟแท่ง / เส้น / วงกลม หลายมิติ
Export CSV: Projects, Tasks, Opportunities, Quotations, Timesheet
```

---

### 22. Resource Dashboard (`/resources`)

**API:** `api/tasks.php` (resource views) · `api/views/resource-workload.php`  
**Tables:** `tasks` · `projects` · `resource_workload` (SQL view)

```
ภาพรวมภาระงานของทีม:
  → aggregate assignee workload ต่อวัน (resource_workload view)
  → จำนวนโปรเจกต์, จำนวนงาน, active tasks ต่อคน
  → ตรวจสอบความหนาแน่นงาน: ใครมากเกิน/น้อยเกิน
  → กราฟภาระงานรายสัปดาห์/รายเดือน
```

---

### 23. Admin (`/admin`)

**API:** `api/settings.php` · `api/users.php` · `api/roles.php` · `api/ai-providers.php` · `api/ai-models.php` · `api/ai-settings.php` · `api/personas.php` · `api/chat.php` · `api/chat-history.php` · `api/activity-logs.php` · `api/data-quality-stats.php` · `api/query.php` · `api/work-type-catalog.php` · `api/custom-fields.php` · `api/agent-keys.php` · `api/backup.php` · `api/client-errors-list.php`  
**Tables:** `users` · `roles` · `role_menu_permissions` · `company_settings` · `ai_providers` · `ai_models` · `ai_personas` · `user_persona_preference` · `chat_sessions` · `chat_messages` · `user_activity_logs` · `user_email_aliases` · `custom_fields` · `task_custom_field_values`

#### User & Role Management

```
Users (api/users.php):
  สร้าง/แก้ไข → users + tenant_users + email aliases
  is_admin=1: bypass ทั้งหมด
  is_active=0: disable account ทันที
  email aliases: เพิ่ม/ลบ alias (login ได้หลาย email)
  dropdown ทั้งระบบ: /users.php?active_only=1 (เฉพาะ active)

Roles (api/roles.php):
  CRUD roles → กำหนด role_menu_permissions
  many-to-many: role_id × menu_key
  checkbox per module ในหน้า admin
```

#### System Settings (api/settings.php)

```
company_name, logo_url, address, tax_id, currency
bank_info: bank name, account number, account name
SMTP: host, port, encryption, username, password, sender_name, sender_email
App Base URL: ใช้สำหรับ link ในอีเมล (เช่น http://platform.ktnbs.com:8080/flowstack)
Quotation config: prefix (QUO-), running_number format, validity_days, tax_rate
```

#### Work Type Catalog (api/work-type-catalog.php)

```
task_type_catalog: เพิ่ม/แก้ไข/ปิดใช้งาน task types
  → ค่าที่อนุญาตใน tasks.task_type
  → default: งานปกติ / research / weekend_work / adhoc / ฯลฯ

calendar_event_type_catalog: เพิ่ม/แก้ไข/ปิดใช้งาน event types
  → ค่าที่อนุญาตใน calendar_events.event_type
  → default: holiday / leave / meeting / onsite / ot / other

Backend validate ตาม catalog นี้ใน tasks.php + calendar.php
```

#### Custom Fields (api/custom-fields.php)

```
entity_type: task / project / company / customer
field_type: text / number / date / select / checkbox / textarea
field_name, label, options (JSON สำหรับ select)
is_required, is_active
ค่าของ custom fields เก็บใน task_custom_field_values
```

#### AI Provider Management

```
CRUD /api/ai-providers.php:
  name, display_name, api_base_url, icon
  api_key_encrypted: เก็บเข้ารหัสใน DB
  test connection: POST ?action=test → ส่ง test request

AI Models /api/ai-models.php:
  model_id, context_window, max_output_tokens
  pricing: input_price_per_1k, output_price_per_1k
  capabilities: supports_vision, supports_streaming, supports_function_calling

Feature Model Assignment (api/ai-settings.php → company_settings):
  ai_chat_model_id       — AI chat widget
  ai_content_text_model_id  — content generation (text)
  ai_content_image_model_id — content generation (image)
  ai_content_video_model_id — content generation (video)
  ai_cardscan_model_id   — business card scan
  ai_analyst_model_id    — AI insights + analytics

ai_chat_context_prompt: system-level context สำหรับ AI chat ทั้งองค์กร
```

#### AI Chat (ChatWidget + Admin)

```
POST /api/chat.php:
  → messages array (role: user/assistant/system)
  → resolveAICreds() → หา provider + model จาก company_settings
  → callKiloAI() → proxy ไป AI backend
  → บันทึก chat_sessions + chat_messages
  → รองรับ table_data (JSON) ใน response (แสดงเป็นตาราง)
  → system prompt: schema context + persona + ai_chat_context_prompt

ChatWidget (ChatWidget.tsx):
  → Floating AI chat widget ปรากฏทุกหน้า
  → ดึง chat history per session
  → รองรับ markdown + table rendering

Chat History (api/chat-history.php):
  GET ?action=sessions     → รายการ sessions
  GET ?action=messages&session_id=... → โหลดข้อความย้อนหลัง
  POST action=save_report  → บันทึกรายงาน AI
  GET ?action=reports      → รายการรายงาน AI ของ tenant
  DELETE ?action=report&id → ลบรายงาน
```

#### AI Personas (api/personas.php)

```
Fields: name, avatar_emoji, description, personality
data_scope: personal / team / admin
is_default: persona เริ่มต้นของระบบ
user_persona_preference: แต่ละ user เลือก persona ที่ต้องการ
ส่งผลต่อ personality ของ AI ใน chat
```

#### SQL Query Tool

```
POST /api/query.php (admin only):
  → รัน SELECT queries โดยตรงบน DB
  → Block: DELETE / DROP / INSERT / ALTER / TRUNCATE / GRANT / REVOKE
  → Auto-inject tenant_id parameter (ป้องกัน cross-tenant access)
```

#### Data Quality (api/data-quality-stats.php)

```
GET:
  → completeness check: projects ไม่มี budget, tasks ไม่มี assignee/dates
  → orphan data detection

POST:
  → sync project stats: recompute actual_hours, actual_progress
  → bulk update projects/tasks ที่มีข้อมูลผิด
```

#### Activity Logs (api/activity-logs.php)

```
actions: login / logout / create / update / delete / card_scan_success / ...
กรอง: user_id, action, date range
pagination
```

#### Client Error Tracking (api/client-errors.php + api/client-errors-list.php)

```
api/client-errors.php (POST):
  → รับ error report จาก frontend (JS errors, uncaught exceptions)
  → บันทึก: error_message, stack_trace, url, user_agent, user_id

api/client-errors-list.php (GET, admin only):
  → ดูรายการ errors ทั้งหมด
  → กรองตาม severity, date range, user
  → ใช้ debug frontend issues ในระบบ production
```

#### Agent API Keys (api/agent-keys.php + api/agent-auth.php)

```
Agent API Keys (api/agent-keys.php):
  → สร้าง API keys สำหรับ external agents / automation scripts
  → Fields: name, key_prefix, permissions (JSON), expires_at, is_active
  → last_used_at: tracking การใช้งาน

Agent Auth (api/agent-auth.php):
  → Verify agent API key (แยกจาก JWT user auth)
  → permissions: กำหนด endpoint ที่ agent เข้าได้
  → ใช้สำหรับ AI agents, webhook handlers, external integrations
```

#### DB Backup (api/backup.php)

```
GET /api/backup.php (admin only):
  → dump MariaDB ทั้ง tenant
  → ดาวน์โหลดเป็น .sql file
```

---

### 24. Export (`/export`)

**API:** `api/export.php`

```
Entity: บริษัท / ลูกค้า / โปรเจกต์ / งาน / งานย่อย / โอกาสขาย
Format: CSV / JSON
ดาวน์โหลดผ่าน browser ทันที

Import (api/import.php):
  → bulk import จาก Excel (.xlsx)
  → entity: companies / customers / contacts
  → validation + error report ก่อน commit
```

---

### 25. Inbox (`/inbox`)

**API:** `api/inbox.php`  
**Tables:** `inbox_messages`

```
type: ticket / message / notification / email
priority: low / medium / high / critical
sender_name, sender_email, subject, preview

การจัดการ:
  is_read: auto mark as read เมื่อเปิด
  is_starred: ปักหมุด
  mark all as read
  delete

unread count badge: poll ทุก 60 วินาที

ส่งข้อความ:
  → เลือกผู้รับจาก users ใน tenant เดียวกัน
  → สร้าง inbox_messages ให้ผู้รับ

Auto-create inbox messages:
  → มอบหมาย task → inbox message ถึง assignee
  → โอน support ticket → inbox message ถึงผู้รับผิดชอบใหม่
```

---

### 26. Profile (`/profile`)

**API:** `api/profile.php`  
**Tables:** `users` · `notification_settings`

```
1. รูปโปรไฟล์:   JPEG/PNG/GIF/WebP (max 2MB), multipart POST
2. ข้อมูลส่วนตัว: display_name, position → PUT /api/profile.php
3. เปลี่ยนรหัสผ่าน: current + new (min 6 chars) + confirm
4. ข้อมูลบัญชี (readonly): email, role, status, email aliases

5. AI Secretary Briefing (notification_settings):
   briefing_time: เวลาส่งสรุปประจำวัน (HH:MM)
   channels: email / Line OA / Telegram
     Line:     line_user_id (เริ่มด้วย U...)
     Telegram: telegram_chat_id

   Dispatch (api/notification-dispatch.php):
     cron ทุก 7 นาที → หา users ที่ briefing_time ตรง ±7 นาที
     สร้าง briefing จาก:
       - overdue tasks (งานเลยกำหนด)
       - today's tasks (งานวันนี้)
       - upcoming deadlines (งานที่กำลังจะถึง)
     ส่งผ่าน Line Messaging API / Telegram Bot / Email (SMTP)
     บันทึก notification_log (channel, status, sent_at, error)
```

---

### 27. Global Search

**Component:** `GlobalSearch.tsx` · **Shortcut:** `Ctrl+K` / `Cmd+K`

```
ค้นหาข้าม entity: โปรเจกต์, งาน, บริษัท, โอกาสขาย
Debounced search (หน่วงเวลาพิมพ์)
ผลลัพธ์แยกตามประเภท
คลิกที่ผลลัพธ์ → navigate ไปยังหน้านั้น
```

---

## Database Tables (76 tables)

| Group | Tables |
|---|---|
| **Auth** | `users` `user_email_aliases` `tenant_users` `tenants` `roles` `role_menu_permissions` `login_rate_limits` `user_activity_logs` |
| **Projects** | `projects` `tasks` `project_members` `task_dependencies` `task_history` `task_validation_rules` `recurring_tasks` `view_settings` |
| **Calendar** | `calendar_events` `calendar_overrides` |
| **Goals** | `goals` `goal_tasks` |
| **Budget** | `budget_items` |
| **Automation** | `automation_rules` `automation_executions` |
| **CRM** | `companies` `customers` `customer_activities` `sales_opportunities` `opportunity_members` `sales_activities` |
| **Quotations** | `quotations` `quotation_items` `quotation_sequences` |
| **Support** | `support_tickets` `support_ticket_comments` `support_contracts` `support_attachments` |
| **Knowledge** | `knowledge_base` |
| **Surveys** | `survey_templates` `survey_questions` `survey_responses` `survey_answers` |
| **Content** | `content_items` `content_plans` `content_plan_items` `brand_contexts` `content_skills` `content_triggers` `publish_channels` `content_publish_queue` `content_global_settings` `content_posting_analytics` |
| **Email** | `email_campaigns` `email_campaign_recipients` `email_groups` `email_group_members` `email_tracking` `email_link_clicks` |
| **AI** | `ai_providers` `ai_models` `ai_personas` `user_persona_preference` `chat_sessions` `chat_messages` |
| **Settings** | `company_settings` `settings` `custom_fields` `task_custom_field_values` `notification_settings` `notification_log` |
| **Inbox** | `inbox_messages` |
| **Payments** | `project_payments` |
| **SQL Views** | `resource_workload` `cross_project_impact` `project_with_company_customer` `quotation_summary` `sales_pipeline_summary` |

---

## Menu Keys

| menuKey | Routes |
|---|---|
| `home` | `/` |
| `projects` | `/projects` `/project/:id` `/recurring-tasks` |
| `timesheet` | `/timesheet` |
| `calendar` | `/calendar` |
| `goals` | `/goals` |
| `budget` | `/budget` |
| `automation` | `/automation` |
| `companies` | `/companies` |
| `sales` | `/sales` `/sales/:id` `/surveys` |
| `quotations` | `/quotations` |
| `revenue` | `/revenue` |
| `support` | `/support` `/knowledge-base` |
| `marketing` | `/content` `/content-planner` `/campaigns` `/campaign-analytics` `/marketing` |
| `analytics` | `/impactos` `/analytics` |
| `reports` | `/reports` (→ redirect `/analytics`) |
| `task_intelligence` | `/task-intelligence` |
| `admin` | `/admin` `/export` |
| `inbox` | `/inbox` |
| `resources` | `/resources` |

---

## Key Business Rules

| Rule | Detail |
|---|---|
| Task atomicity | งานวันเดียว: `estimated_hours` ≤ 16 |
| Hours formula | งานหลายวัน: `estimated_hours = estimated_days × 8` |
| Hours rollup | KPI/ImpactOS ใช้ leaf tasks เท่านั้น (ไม่นับ parent ที่มี subtask) |
| Impact Score | `min((leaf_hours / 160) × 100, 100)` |
| Project status | `on-track` · `at-risk` · `delayed` · `completed` |
| Task status | `pending` · `in-progress` · `completed` · `overdue` · `cancelled` |
| Quotation number | `QUO-YYYYMM-NNNN` — auto-increment ต่อเดือน |
| Ticket number | `TKT-YYYYMMDD-NNN` |
| SLA | critical=2h · high=4h · medium=8h · low=24h |
| Rate limit (login) | 10 ครั้ง / 15 นาที per IP |
| Ticket upload | `uploads/support/` via `support-upload.php` |
| Avatar | JPEG/PNG/GIF/WebP ≤ 2MB |
| Card scan | jpg/png/webp ≤ 8MB |
| Password | min 6 characters |
| Tenant plan | `trial` (default on signup) |
| Routing | HashRouter — subdirectory `/flowstack` compatibility |

---

## Adding a New Page

1. สร้าง `src/pages/NewPage.tsx` — ใช้ `<PageShell>` + `<PageBreadcrumb>` เป็น template
2. เพิ่ม `lazy(() => import('./pages/NewPage'))` ใน `src/App.tsx`
3. เพิ่ม `<Route path="..." element={<PermissionRoute menuKey="..."><NewPage /></PermissionRoute>} />`
4. เพิ่ม item ใน `NAV_GROUPS` ใน `src/components/AppSidebar.tsx`
5. เพิ่ม menuKey ใน `ALL_MENU_KEYS` ใน `api/auth.php`

---

## Adding a New API Endpoint

```php
<?php
require_once 'config.php';   // getDB(), jsonResponse(), jsonError(), getMethod()
require_once 'auth.php';     // requireAuth(), requireAdmin()

$user   = requireAuth();     // หยุดถ้าไม่มี / invalid token
$db     = getDB();
$method = getMethod();       // GET / POST / PUT / DELETE

if ($method === 'GET') {
    // SELECT + jsonResponse($rows)
}
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    // INSERT + jsonResponse(['id' => $newId])
}
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    // UPDATE WHERE id=? AND tenant_id=?
}
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    // DELETE WHERE id=? AND tenant_id=?
}

jsonError('Method not allowed', 405);
```

**Rules:**
- Always scope queries ด้วย `tenant_id` — ห้าม cross-tenant access
- ใช้ prepared statements เสมอ
- Return `jsonError('message', 4xx)` สำหรับ validation errors

---

## Database Migration

```bash
# 1. สร้างไฟล์
# database/migrations/YYYY_MM_DD_HHMMSS_description.sql

# 2. รัน
mysql -u root flowstack < database/migrations/<filename>.sql

# 3. ตรวจสอบ
mysql -u root -e "DESCRIBE flowstack.<table>;"
```

---

## Development Rules

1. **NO MAGIC** — behavior ต้องชัดเจนและตรวจสอบได้ ไม่มี hidden side effects
2. **VERIFY BEFORE DONE** — รัน lint/build/test ก่อนบอกว่าเสร็จ
3. **DISSENT** — ถ้า instruction ดูผิดหรือเสี่ยง ให้บอกก่อนทำ
4. **SCOPE DRIFT** — ทำเฉพาะที่ถูกขอ ไม่เพิ่มฟีเจอร์หรือ refactor นอก scope
5. **READ BEFORE WRITE** — อ่านไฟล์ก่อนแก้เสมอ
6. **BACKUP BEFORE DELETE** — ไม่ลบโดยไม่มี backup หรือ confirmation
7. **TEST BEFORE COMMIT** — ทดสอบก่อน commit ทุกครั้ง

---

*27 modules · 36 routes · 19 menuKeys · 76 tables · 80+ API endpoints*  
*อัปเดต: 28 พฤษภาคม 2569*
