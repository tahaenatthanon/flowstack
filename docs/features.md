# Flowstack — รายการฟีเจอร์และ System Flow

ระบบจัดการโปรเจกต์และธุรกิจสำหรับองค์กรไทย (Project Management & CRM SaaS)
Stack: PHP 8 + MariaDB (XAMPP), React 18 + TypeScript + Vite, TanStack Query, shadcn-ui, Tailwind CSS

---

## สารบัญ

1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [Authentication & Authorization](#1-authentication--authorization)
3. [Dashboard](#2-dashboard-)
4. [การจัดการโปรเจกต์](#3-การจัดการโปรเจกต์-projects-projectid)
5. [บันทึกชั่วโมงทำงาน](#4-บันทึกชั่วโมงทำงาน-tasksubtask-model)
6. [งานที่ทำซ้ำ](#5-งานที่ทำซ้ำ-recurring-tasks)
7. [ปฏิทินทีม](#6-ปฏิทินทีม-calendar)
8. [เป้าหมาย & OKR](#7-เป้าหมาย--okr-goals)
9. [งบประมาณ](#8-งบประมาณ-budget)
10. [ระบบอัตโนมัติ](#9-ระบบอัตโนมัติ-automation)
11. [บริษัทและลูกค้า](#10-บริษัทและลูกค้า-companies)
12. [ไปป์ไลน์การขาย](#11-ไปป์ไลน์การขาย-sales-salesid)
13. [แบบสอบถาม](#12-แบบสอบถาม-surveys)
14. [ใบเสนอราคา](#13-ใบเสนอราคา-quotations)
15. [รายงานรายได้](#14-รายงานรายได้-revenue)
16. [ศูนย์ช่วยเหลือ](#15-ศูนย์ช่วยเหลือ-support)
17. [ฐานความรู้](#16-ฐานความรู้-knowledge-base)
18. [Content Management](#17-content-management-content)
19. [ปฏิทินคอนเทนต์](#18-ปฏิทินคอนเทนต์-content-planner)
20. [แคมเปญอีเมล](#19-แคมเปญอีเมล-campaigns)
21. [สร้าง & ส่งอีเมล](#20-สร้าง--ส่งอีเมล-marketing)
22. [ImpactOS](#21-impactos-impactos)
23. [Task Intelligence](#22-task-intelligence-task-intelligence)
24. [วิเคราะห์ข้อมูล](#23-วิเคราะห์ข้อมูล-analytics)
25. [รายงาน](#24-รายงาน-reports)
26. [ผู้ดูแลระบบ](#25-ผู้ดูแลระบบ-admin)
27. [ส่งออกข้อมูล](#26-ส่งออกข้อมูล-export)
28. [Inbox](#27-inbox-inbox)
29. [โปรไฟล์ผู้ใช้](#28-โปรไฟล์ผู้ใช้-profile)
30. [Global Search](#29-global-search)
31. [AI Provider Management](#30-ai-provider-management)
32. [Resource Dashboard](#31-resource-dashboard-resources)
33. [API Docs & Help](#32-api-docs--help)
34. [สรุป Menu Keys](#สรุป-menu-keys-และ-permission)

---

## ภาพรวมระบบ

```
┌────────────────────────────────────────────────────────────┐
│                    Frontend (React 18 + TS)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐             │
│  │ AppSidebar│  │  TopNav  │  │ GlobalSearch │             │
│  └──────────┘  └──────────┘  └──────────────┘             │
│  ┌────────────────────────────────────────────┐            │
│  │          PageShell + Page Content          │            │
│  │  (30+ Pages, shadcn-ui, TanStack Query)    │            │
│  └────────────────────────────────────────────┘            │
│  ┌────────────────────────────────────────────┐            │
│  │   Hooks Layer (useAuth, useProjects, ...)  │            │
│  └────────────────────────────────────────────┘            │
│  ┌────────────────────────────────────────────┐            │
│  │      apiFetch() → JWT Bearer Token         │            │
│  └────────────────────────────────────────────┘            │
├────────────────────────────────────────────────────────────┤
│                    Backend (PHP 8)                         │
│  ┌────────────────────────────────────────────┐            │
│  │  api/*.php (40+ endpoints, REST-style)     │            │
│  │  requireAuth() → JWT verify → tenant_id    │            │
│  │  getDB() → PDO → MariaDB                   │            │
│  │  jsonResponse() / jsonError()              │            │
│  └────────────────────────────────────────────┘            │
├────────────────────────────────────────────────────────────┤
│              MariaDB (76 tables, UUID PKs)                 │
│  Multi-tenant via tenant_id on every entity table          │
└────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
ผู้ใช้ → Login Page → POST /api/auth/login.php
  → ตรวจสอบ email + password (users + user_email_aliases)
  → Rate limiting (login_rate_limits: 10 attempts / 15 min)
  → หา tenant ผ่าน tenant_users
  → สร้าง JWT token (payload: user_id, tenant_id, is_admin)
  → บันทึก activity log (user_activity_logs)
  → Frontend เก็บ token ใน localStorage (key: flowstack_token)

ทุก API request:
  → apiFetch() อ่าน token จาก localStorage
  → แนบ Authorization: Bearer <token>
  → requireAuth() ใน PHP verify JWT
  → ดึง tenant_id, user_id, is_admin จาก token
  → ตรวจสอบ permission ตาม menuKey
```

### Permission Flow

```
User Login → JWT token (user_id, tenant_id, is_admin)
  → useAuth() เก็บ permissions[] จาก API
  → hasPermission(menuKey) ตรวจสอบ:
      is_admin=1 → bypass ทุก permission
      is_active=0 → ปฏิเสธทั้งหมด
      มี menuKey ใน permissions[] → อนุญาต
  → Frontend: PermissionRoute guard ใน App.tsx
  → Backend: requireAuth() + requireAdmin() ใน PHP
  → Menu items ใน sidebar กรองตาม hasPermission()
```

---

## 1. Authentication & Authorization

| Element | Detail |
|---------|--------|
| **Routes** | `/auth` (AuthRoute, redirects to `/` if logged in) |
| **Pages** | `AuthPage.tsx` (login form) |
| **API** | `api/auth/login.php`, `api/auth/signup.php`, `api/auth/me.php`, `api/auth/logout.php` |
| **Tables** | `users`, `user_email_aliases`, `tenant_users`, `tenants`, `roles`, `role_menu_permissions`, `login_rate_limits`, `user_activity_logs` |
| **menuKey** | none (public + protected routes) |

### System Flow

```
ลงทะเบียน:
  POST /api/auth/signup.php
  → สร้าง user ใน users
  → สร้าง tenant ใน tenants (plan=trial, status=active)
  → ผูก user เป็น admin ใน tenant_users (is_admin=1)
  → ตรวจสอบ email ซ้ำทั้ง users.email และ user_email_aliases.alias_email

เข้าสู่ระบบ:
  POST /api/auth/login.php
  → ค้นหา email ใน users.email UNION user_email_aliases.alias_email
  → ตรวจสอบ password_hash ด้วย password_verify()
  → Rate limit: IP-based, สูงสุด 10 ครั้งใน 15 นาที (login_rate_limits)
  → หา tenant_id จาก tenant_users
  → สร้าง JWT: { user_id, tenant_id, is_admin, exp }
  → บันทึก user_activity_logs (action=login)

ตรวจสอบสิทธิ์ทุก request:
  requireAuth() → verifyToken() → decode JWT
  → $userId, $tenantId, $isAdmin
  → hasPermission(menuKey):
      is_admin=1 → true
      ตรวจสอบ role_menu_permissions JOIN tenant_users
      menuKey ต้องตรงกับสิทธิ์ที่ role กำหนด

ออกจากระบบ:
  POST /api/auth/logout.php
  → บันทึก user_activity_logs (action=logout)
  → Frontend: removeToken(), clear state, redirect to /auth
```

---

## 2. Dashboard (`/`)

| Element | Detail |
|---------|--------|
| **Route** | `/` (PermissionRoute, menuKey=`home`) |
| **Page** | `HomePage.tsx` |
| **API** | `api/projects.php`, `api/opportunities.php`, `api/quotations.php`, `api/companies.php` |
| **Tables** | `projects`, `sales_opportunities`, `quotations`, `companies`, `tasks` |

### System Flow

```
โหลด Dashboard:
  → GET projects.php (นับตาม status)
  → GET opportunities.php (ยอด Won, กรองตาม actual_close_date)
  → GET quotations.php (นับตาม status)
  → GET companies.php (นับทั้งหมด)

ตัวกรองปี:
  → เลือกปีหรือช่วงวันที่กำหนดเอง
  → รีเซตตัวกรองได้
  → Won deals กรองด้วย actual_close_date (fallback expected_close_date)

การแสดงผล:
  → ตัวชี้วัดภาพรวม: จำนวนโปรเจกต์, Won deals, ใบเสนอราคา, บริษัท
  → กราฟวงกลม: สัดส่วนสถานะโปรเจกต์
  → กราฟแท่ง: ยอดขาย Won รายเดือน
  → รายการโปรเจกต์ล่าสุด (status + progress %)
  → รายการ Opportunities ล่าสุด (stage + มูลค่า)
```

---

## 3. การจัดการโปรเจกต์ (`/projects`, `/project/:id`)

| Element | Detail |
|---------|--------|
| **Routes** | `/projects`, `/project/:id` (PermissionRoute, menuKey=`projects`) |
| **Pages** | `ProjectsPage.tsx`, `ProjectDetailPage.tsx` |
| **API** | `api/projects.php`, `api/tasks.php`, `api/subtasks.php`, `api/chat.php`, `api/task-intelligence.php` |
| **Tables** | `projects`, `tasks`, `project_members`, `task_dependencies`, `task_history`, `task_validation_rules`, `view_settings` |
| **Hooks** | `useProjects.ts`, `useTasks.ts` |

### System Flow — สร้างโปรเจกต์

```
สร้างโปรเจกต์:
  POST /api/projects.php
  → รับ name, description, start_date, end_date, budget_hours, hourly_rate, project_value
  → ตรวจสอบ total_budget vs project_value (warning ถ้าเกิน)
  → สร้าง project (UUID, tenant_id, status=on-track)
  → สร้าง calendar_event อัตโนมัติ (event_type=other, synced กับ project dates)
  → เพิ่ม creator เป็น project_member
```

### System Flow — จัดการงาน (Task)

```
สร้างงาน:
  POST /api/tasks.php
  → รับ project_id, title, priority (low/medium/high/urgent), start_date, end_date, estimated_hours
  → ตรวจสอบ task_validation_rules:
      - rule_type=block: ห้ามสร้างถ้าไม่ผ่านเงื่อนไข
      - rule_type=warn: สร้างได้แต่แจ้งเตือน
  → สร้าง task (UUID, status=pending)
  → Trigger automation rules (ถ้ามี)

อัปเดตงาน:
  PUT /api/tasks.php
  → เปลี่ยน status: pending → in-progress → completed
  → เมื่อ status=completed: บันทึก completed_date, อัปเดต progress_percentage
  → Pause/Resume: บันทึก paused_at, paused_by, pause_reason
  → Auto Timeline Shift: เมื่อ end_date เลยกำหนด, ขยับงานถัดไปอัตโนมัติ
  → บันทึก task_history ทุกการเปลี่ยนแปลง

งานย่อย (Subtasks):
  POST /api/subtasks.php
  → parent_task_id ชี้ไปยัง task หลัก
  → is_subtask=1, level คำนวณอัตโนมัติจาก parent
  → เมื่ออัปเดต subtask → คำนวณ progress ของ parent ใหม่
  → รองรับ tree structure หลายชั้น (recursive)

Task Dependencies:
  → task_dependencies table: blocked_task_id, blocking_task_id
  → ประเภทความสัมพันธ์: finish-to-start
  → reason_code: URGENT_INSERT, CUSTOMER_REQUEST, TECHNICAL_BLOCKER, etc.
  → เมื่อ blocking task เสร็จ → แจ้งเตือน blocked task

AI WBS Generator:
  POST /api/chat.php (action=generate_wbs)
  → รับชื่อโปรเจกต์ → AI สร้างโครงสร้างงาน (task tree)
  → สร้าง tasks + subtasks อัตโนมัติในโปรเจกต์

Ad-hoc Impact Simulation:
  → src/lib/projectUtils.ts: calculateImpactSimulation()
  → จำลองผลกระทบเมื่อเพิ่มงานแทรก:
      - หางานที่ assignee คนเดียวกันที่ overlap กับช่วงวันที่ใหม่
      - คำนวณ delay ที่เกิดขึ้นกับแต่ละงาน
      - Aggregate ผลกระทบต่อโปรเจกต์
  → แสดงผล: จำนวนงานที่กระทบ, จำนวนโปรเจกต์ที่กระทบ, วันที่เลื่อนสูงสุด

มุมมองโปรเจกต์:
  → Kanban Board: drag-and-drop tasks ข้ามคอลัมน์ status
  → Gantt Chart: แสดง timeline + dependencies
  → Calendar View: ดู tasks ในปฏิทิน พร้อม filter ตามประเภทงาน โปรเจกต์ และคน
  → Spreadsheet (Table): แก้ไข inline, จัดเรียง, กรอง
  → view_settings: จำ preference มุมมองต่อ user ต่อ project

Project Validation:
  → บังคับเลือกโปรเจกต์ทุกครั้งทั้งสร้างและแก้ไขงาน (CreateTaskDialog, TaskDetailSheet)
  → Base Calendar (Team Calendar): kind='base_calendar' ปรากฏเป็นตัวเลือกแรกใน ProjectCombobox ทุกหน้าจอ
  → Project 필터ในปฏิทิน: รองรับเลือก Base Calendar หรือโปรเจกต์ปกติ
```

---

## 4. บันทึกชั่วโมงทำงาน (Task/Subtask Model)

| Element | Detail |
|---------|--------|
| **Route** | ใช้ข้อมูลจากงานหลัก + งานย่อย (หน้า `/timesheet` เป็น legacy UI) |
| **Page** | `TimesheetPage.tsx` |
| **API** | `api/tasks.php`, `api/subtasks.php`, `api/capacity.php` |
| **Tables** | `tasks`, `projects`, `work_schedules`, `work_schedule_days`, `user_work_schedules`, `calendar_events`, `calendar_overrides`, `company_settings` |

### System Flow

```
บันทึกเวลา/ชั่วโมง:
  → บันทึกลง task/subtask โดยตรง (child task: parent_task_id != NULL)
  → ค่าชั่วโมงจริงใช้ actual_hours
  → กรณีมี subtask: ใช้ผลรวมชั่วโมงจาก subtask (rollup อัตโนมัติ)
  → กรณีไม่มี subtask: ใช้ชั่วโมงจาก task นั้นโดยตรง
  → rollup ทั้งชุดอยู่ใน DB transaction (ป้องกัน race condition)

สรุปชั่วโมง:
  → กรองตามช่วงวันที่และผู้ใช้
  → สรุปชั่วโมงรวมรายสัปดาห์ / รายเดือน
  → ใช้ชั่วโมงจาก leaf tasks เท่านั้น (ไม่นับซ้ำ parent+child)
  → เลือกผู้ใช้เฉพาะที่ active (is_active=1)

การคำนวณ estimated_hours (multi-day tasks):
  1. มี assignee → GET /api/capacity.php → total_capacity (ถูกต้องตามจริง)
     รองรับ: custom work schedule, วันหยุดบริษัท, การลา, calendar override
  2. ไม่มี assignee → workingHours() JS helper (skip Sat/Sun เท่านั้น)
  → params debounce 400ms ก่อนยิง API (กัน spam)
```

### Decision Tree: ชั่วโมงประมาณ vs ชั่วโมงจริง

```mermaid
flowchart TD
  A[เริ่มจาก Task หนึ่งรายการ] --> B{มี Subtask ที่ไม่ถูกลบหรือไม่}
  B -- ไม่มี --> C[แสดง/คำนวณจาก Task เอง]
  B -- มี --> D[แสดง/คำนวณจากผลรวม Subtask]

  C --> C1[Actual = task.actual_hours]
  C --> C2[Estimated = capacity.php → total_capacity]

  D --> D1[Actual = SUM(subtask.actual_hours)]
  D --> D2[Estimated = SUM(subtask.estimated_hours)]

  E[ตอนอัปเดต Parent] --> F{จำนวนลูก > 0}
  F -- ใช่ --> G[parent.actual_hours = SUM(child.actual_hours)]
  F -- ไม่ใช่ --> H[parent.actual_hours = ค่าเดิมของ parent]

  I[ตอนคำนวณ KPI/ImpactOS] --> J[นับเฉพาะ Leaf Tasks]
  J --> K{เป็น Leaf หรือไม่}
  K -- ไม่ใช่ --> L[ไม่นับ]
  K -- ใช่ --> M[รวม actual_hours]
```

เงื่อนไขบังคับ (Business Rules):
- งานวันเดียว (start_date = end_date) ห้าม estimated_hours > `company_settings.max_task_hours` (default 16)
- งานหลายวัน: estimated_hours คำนวณจาก capacity.php (วันทำงานจริงตาม schedule + holiday + leave)
- KPI ชั่วโมงรวม ใช้ leaf tasks เท่านั้น เพื่อไม่ให้นับซ้ำ parent+child

### Progress Calculation (Hours-Weighted)

```
progress = SUM(estimated_hours ของงานที่ completed)
           ─────────────────────────────────────────  × 100
           SUM(estimated_hours ของงานทั้งหมด)

ยกเว้น: status='cancelled' ไม่นับทั้ง numerator และ denominator
fallback: ถ้าไม่มีใครกรอก estimated_hours → count-based
edge case: ไม่มี subtask เลย → progress = 0 (ไม่ crash)
```

สูตรสำคัญ:
- Impact Score: `impact_score = min((leaf_hours / 160) × 100, 100)`

---

## 5. งานที่ทำซ้ำ (`/recurring-tasks`)

| Element | Detail |
|---------|--------|
| **Route** | `/recurring-tasks` (PermissionRoute, menuKey=`projects`) |
| **Page** | `RecurringTasksPage.tsx` |
| **API** | `api/tasks.php` (recurring actions) |
| **Tables** | `recurring_tasks`, `tasks` |

### System Flow

```
สร้าง recurring template:
  POST /api/tasks.php (action=create_recurring)
  → รับ title_template, description_template, recurrence_pattern
  → ความถี่: daily / weekly / biweekly / monthly / quarterly / yearly / custom
  → กำหนด repeat_interval, repeat_until, repeat_count
  → กำหนด assignee_template (ใครรับผิดชอบ)

การสร้างงานอัตโนมัติ:
  → Cron/Manual trigger → อ่าน recurring_tasks ที่ next_generation <= now
  → สร้าง task ใหม่ตาม template
  → อัปเดต last_generated, next_generation
  → นับ instance_count

Run Manual:
  → สั่งสร้างงานทันทีโดยไม่ต้องรอ cron
```

---

## 6. ปฏิทินทีม (`/calendar`)

| Element | Detail |
|---------|--------|
| **Route** | `/calendar` (PermissionRoute, menuKey=`calendar`) |
| **Page** | `CalendarPage.tsx` |
| **Components** | `TaskCalendarView.tsx` (project tab), `ProjectFilterSelect.tsx` |
| **API** | `api/calendar.php` |
| **Tables** | `calendar_events`, `tasks`, `projects` |
| **Hooks** | `useBaseCalendar.js` |

**Source of truth:** วันหยุดบริษัท (`holiday`) และวันลา (`leave`) ให้เก็บใน `calendar_events` เป็นหลัก

### System Flow — ดูปฏิทิน

```
โหลดปฏิทิน:
  GET /api/calendar.php?start=...&end=...&project_id=...&user_id=...
  → ดึง calendar_events (นัดหมาย/วันลา/วันหยุด) + tasks (งานจากโปรเจกต์) รวมกัน
  → Tasks: เพิ่ม t.assignee, t.assignee_user_id ใน response
  → กรองตาม project_id: เลือก Base Calendar (ปฏิทินทีม) หรือโปรเจกต์เฉพาะ
  → กรองตาม user_id: ดูงานของสมาชิกทีมที่กำหนด (filter ทั้ง e.created_by และ t.assignee_user_id/t.user_id)
  → Parent task inclusion: งานลูกที่อยู่ในช่วงจะดึง parent มาด้วยเสมอ (แม้ parent อยู่นอกช่วง)
```

### System Flow — Filter Bar

```
Filter Bar (บรรทัดเดียว, compact):
  แสดง: [ประชุม] [ลา] [วันหยุด] [อื่นๆ] [งานปกติ] [วิจัย] [งานแทรก] [วันหยุด] [onsite] [OT] รีเซ็ต
   โปรเจค: [dropdown — ทั้งหมด / Base Calendar / โปรเจกต์]  คน: [dropdown — ทุกคน / active users]

  → Toggle type pill: แสดง/ซ่อน event type นั้น
  → รีเซ็ต: คืนค่าทั้งหมด
  → โปรเจค dropdown: ใช้ ProjectFilterSelect (Base Calendar รวมอยู่ในรายการ)
  → คน dropdown: ใช้ ProjectFilterSelect ดึงจาก /users.php?active_only=1
  → FullCalendar ใช้ eventOrder="sortOrder" เพื่อจัด parent ก่อน subtask
```

### System Flow — สร้าง/แก้ไข Event

```
เพิ่มนัดหมาย/งาน (ปุ่ม "เพิ่ม ▾"):
  → DropdownMenu: 2 ตัวเลือก
      1. "นัดหมาย" → เปิด Create Dialog (calendar_events)
      2. "งานโปรเจค" → เปิด CreateTaskDialog
  → ทั้งคู่ใช้ ProjectCombobox ที่รวม Base Calendar เป็นตัวเลือกแรก

สร้าง Calendar Event:
  POST /api/calendar.php
  → รับ title, event_type (อ่านค่าที่อนุญาตจาก company_settings.calendar_event_type_catalog), start_at, end_at
  → all_day flag, description
  → ไม่ต้องเลือก project_id (นัดหมายไม่ขึ้นกับโปรเจกต์)
  → status: confirmed / tentative / cancelled

สร้าง Task จาก Calendar:
  → เปิด CreateTaskDialog (externalOpen pattern)
  → บังคับเลือกโปรเจกต์ (รวม Base Calendar)
  → task_type อ่านจาก company_settings.task_type_catalog (admin ปรับเพิ่ม/ปิดได้)

Centralized Type Governance:
  → แหล่งกลางอยู่ที่ company_settings: task_type_catalog, calendar_event_type_catalog
  → Backend บังคับ validate ตาม catalog เดียวกันใน /api/tasks.php และ /api/calendar.php
  → หน้า Admin มีแท็บ "ประเภทงาน/ปฏิทิน" สำหรับเพิ่ม/แก้ไข/ปิดใช้งานตัวเลือก

แก้ไข Event:
  PUT /api/calendar.php → อัปเดต fields
  DELETE → soft-delete (status=cancelled)
  → ถ้าเป็น holiday: sync กับทุก user ใน tenant

ตรวจ Capacity ก่อนบันทึก Task/Subtask:
  GET /api/capacity.php?user_id=...&start_date=...&end_date=...&estimated_hours=...
  → ใช้ calendar_events (holiday/leave) เป็นหลัก
  → รองรับ calendar_overrides สำหรับสลับวันหยุด/วันทำงาน
  → ถ้าชั่วโมงเกิน capacity จริง: ส่ง warning ให้ React แสดงผลทันที
```

### Task Calendar View (Tab ปฏิทินในหน้าโปรเจกต์)

```
TaskCalendarView component:
  → ชุด filter เดียวกับ CalendarPage: type pills + โปรเจค dropdown + คน dropdown
  → เมื่อมี projectId prop: ซ่อนโปรเจค dropdown (scoped แล้ว)
  → Filter + ปุ่ม "เพิ่ม ▾" อยู่ในบรรทัดเดียวกัน
  → คลิกที่ event → เปิด TaskDetailSheet (tasks) หรือแสดงรายละเอียด (calendar events)
  → ใช้ RANGE_START=2019, RANGE_END=2030 (fixed wide range)
```

---

## 7. เป้าหมาย & OKR (`/goals`)

| Element | Detail |
|---------|--------|
| **Route** | `/goals` (PermissionRoute, menuKey=`goals`) |
| **Page** | `GoalsPage.tsx` |
| **API** | `api/goals.php` (in tasks.php pattern) |
| **Tables** | `goals`, `goal_tasks` |

### System Flow

```
สร้างเป้าหมาย:
  → goal_type: objective / key_result / kpi / milestone
  → กำหนด target_value, current_value, unit (%, บาท, จำนวน)
  → กำหนด weight (น้ำหนักสำหรับ KPI framework)
  → status: draft → active → completed / cancelled / at_risk / on_hold
  → parent_goal_id รองรับ hierarchy (Objective → Key Results)

Progress:
  → progress_percentage = (current_value / target_value) * 100
  → goal_tasks: เชื่อมโยง task กับ goal พร้อม contribution_percentage
  → เมื่อ task เสร็จ → อัปเดต current_value ของ goal
```

---

## 8. งบประมาณ (`/budget`)

| Element | Detail |
|---------|--------|
| **Route** | `/budget` (PermissionRoute, menuKey=`budget`) |
| **Page** | `BudgetPage.tsx` |
| **API** | `api/projects.php` (budget sections) |
| **Tables** | `budget_items` |

### System Flow

```
สร้างรายการงบ:
  → category: labor / material / equipment / travel / software / general / other
  → status: planned → committed → actual / cancelled
  → planned_cost, actual_cost, quantity, unit_price

สรุปงบ:
  → รวม budget ตามโปรเจกต์: ตั้งไว้ (planned) vs ใช้จริง (actual) vs ผูกพัน (committed)
  → กราฟแท่งแยกหมวดหมู่, กราฟวงกลมสัดส่วน
```

---

## 9. ระบบอัตโนมัติ (`/automation`)

| Element | Detail |
|---------|--------|
| **Route** | `/automation` (PermissionRoute, menuKey=`automation`) |
| **Page** | `AutomationPage.tsx` |
| **API** | `api/tasks.php` (fires automation via `automation-fire.php`) |
| **Tables** | `automation_rules`, `automation_executions` |

### System Flow

```
สร้างกฎ:
  → trigger_type: task_created / task_updated / task_deleted / status_changed /
                  priority_changed / assignee_changed / due_date_approaching /
                  due_date_passed / subtask_completed / dependency_resolved
  → trigger_conditions (JSON): เงื่อนไขเพิ่มเติม
  → actions (JSON): สิ่งที่ทำเมื่อ trigger ตรง (assign, notify, เปลี่ยน status, ฯลฯ)
  → is_active: เปิด/ปิดรายกฎ

การทำงาน:
  → ทุกครั้งที่มีการสร้าง/อัปเดต task → tasks.php เรียก automation-fire.php
  → ตรวจสอบ automation_rules ที่ active และ trigger_type ตรง
  → Execute actions → บันทึก automation_executions
  → อัปเดต last_triggered, trigger_count
```
   
---

## 10. บริษัทและลูกค้า (`/companies`)

| Element | Detail |
|---------|--------|
| **Route** | `/companies` (PermissionRoute, menuKey=`companies`) |
| **Page** | `CompaniesPage.tsx` |
| **API** | `api/companies.php`, `api/customers.php`, `api/business-card-scan.php` |
| **Tables** | `companies`, `customers`, `customer_activities`, `user_activity_logs` |

### System Flow

```
จัดการบริษัท:
  CRUD /api/companies.php
  → name, address, phone, email, website, tax_id, logo_url
  → business_type, company_size, founded_year
  → is_active toggle
  → ค้นหาจากชื่อหรือสาขา

จัดการลูกค้า:
  CRUD /api/customers.php
  → first_name, last_name (optional), email, phone, position
  → company_id FK → companies
  → is_primary_contact (กำหนดผู้ติดต่อหลักของบริษัท)
  → is_active toggle
  → ป้องกันข้อมูลซ้ำระดับ API (email และ phone ภายในบริษัทเดียวกัน)

สแกนนามบัตรด้วย AI Vision:
  POST /api/business-card-scan.php (multipart/form-data)
  → รองรับไฟล์ jpg/png/webp (<= 8MB)
  → อ่านข้อมูลจากนามบัตรด้วยโมเดลใน company_settings.ai_cardscan_model_id
  → ส่งกลับ parsed data + field_confidence + candidates + match_reason
  → preview/แก้ไขก่อนบันทึกได้จากหน้า Companies
  → บันทึกแบบ "ยืนยันและบันทึก" หรือ "บันทึกและเพิ่มผู้ติดต่ออีกคน"
  → ตรวจจับบริษัทด้วย normalized matching (ลดผลจากช่องว่าง/สัญลักษณ์)
  → บันทึกกิจกรรม card_scan_success / card_scan_failed ลง user_activity_logs

Customer Tiering:
  → ระบบจัดระดับลูกค้าจากประวัติธุรกรรม:
      - Partner: มูลค่าสูง + ต่อเนื่อง
      - High-Value: มูลค่าสูง
      - Regular: ปกติ
      - Occasional: นานๆ ครั้ง
      - Low-Volume: มูลค่าต่ำ
  → customer_activities ติดตามทุกกิจกรรมที่เกี่ยวข้อง

กิจกรรมลูกค้า:
  → activity_type: email_sent / email_opened / email_clicked /
                    campaign_created / group_added / survey_sent
  → reference_id เชื่อมโยงกับ campaign หรือ survey
  → details (JSON) เก็บข้อมูลเพิ่มเติม
```

---

## 11. ไปป์ไลน์การขาย (`/sales`, `/sales/:id`)

| Element | Detail |
|---------|--------|
| **Routes** | `/sales`, `/sales/:id` (PermissionRoute, menuKey=`sales`) |
| **Pages** | `SalesPage.tsx`, `SalesDetailPage.tsx` |
| **API** | `api/opportunities.php`, `api/sales-activities.php` |
| **Tables** | `sales_opportunities`, `sales_activities`, `opportunity_members`, `sales_pipeline_summary` (view) |

### System Flow — Pipeline

```
Kanban Board:
  → stages: lead → qualified → proposal → negotiation → won / lost
  → drag-and-drop การ์ดข้าม stage
  → เมื่อลากไป won/lost → บันทึก actual_close_date = now()
  → เมื่อลากกลับจาก won/lost → ล้าง actual_close_date

กรองปี:
  → Won deals: กรองตาม actual_close_date (fallback expected_close_date)
  → Open deals: กรองตาม expected_close_date

Sales Detail:
  → company_id, customer_id, name, description, value, probability
  → expected_close_date, actual_close_date
  → assigned_to (FK users), lead_source, competitor_info, notes
  → opportunity_members: team members พร้อม role (owner/member)

Sales Activities:
  CRUD /api/sales-activities.php
  → activity_type: email / call / meeting / note / quotation_sent / other
  → subject, description, activity_date
  → โชว์ประวัติกิจกรรมรายดีล

Customer Activities Tab:
  → ติดตาม email_sent, email_opened, email_clicked จากแคมเปญ
  → ดึงจาก customer_activities

Won → Auto Conversion:
  → เมื่อ stage เปลี่ยนเป็น "won":
      - สร้าง customer จากข้อมูลใน opportunity (ถ้ายังไม่มี)
      - สร้าง project พร้อม project_members
```

---

## 12. แบบสอบถาม (`/surveys`)

| Element | Detail |
|---------|--------|
| **Routes** | `/surveys` (PermissionRoute, menuKey=`sales`), `/survey/public/:token` (public) |
| **Pages** | `SurveyPage.tsx`, `SurveyPublicPage.tsx` |
| **API** | `api/surveys.php`, `api/survey-scoring.php` (helper) |
| **Tables** | `survey_templates`, `survey_questions`, `survey_responses`, `survey_answers` |

### System Flow

```
สร้างแบบสอบถาม:
  POST /api/surveys.php
  → สร้าง survey_templates + survey_questions
  → question_type: yes_no / scale_1_5 / multiple_choice / text
  → แต่ละคำถามกำหนด weight, is_critical, critical_bonus
  → options_json สำหรับ multiple_choice (แต่ละ option มีคะแนน)
  → AI suggest-weights: ใช้ AI แนะนำน้ำหนักคำถาม

ส่งแบบสอบถาม:
  → สร้าง survey_responses สำหรับ opportunity/company
  → สร้าง token สำหรับ public access
  → ผู้รับกรอกผ่าน /survey/public/:token (ไม่ต้อง login)

การให้คะแนน:
  → api/survey-scoring.php: calculateScore()
  → yes_no: yes=100%, no=0% (หรือกลับกันตาม options)
  → scale_1_5: แปลงเป็น % (1=0%, 5=100%)
  → multiple_choice: คะแนนตามที่กำหนดใน options
  → รวมคะแนนด้วย weighted average (normalized weights = 100%)
  → critical questions: ได้ bonus เพิ่มเมื่อคะแนนต่ำ
  → ผลลัพธ์: pain_point_score, pain_priority
```

---

## 13. ใบเสนอราคา (`/quotations`)

| Element | Detail |
|---------|--------|
| **Route** | `/quotations` (PermissionRoute, menuKey=`quotations`) |
| **Page** | `QuotationsPage.tsx` |
| **API** | `api/quotations.php` |
| **Tables** | `quotations`, `quotation_items`, `quotation_sequences` |

### System Flow

```
สร้างใบเสนอราคา:
  POST /api/quotations.php
  → สร้าง quotation_number อัตโนมัติ: QUO-YYYYMM-NNNN
      - อ่าน quotation_sequences (period_key, last_number)
      - นับ +1 ต่อเดือน
  → line items: item_name, description, quantity, unit_price, discount
  → status: draft → sent → approved / rejected / expired
  → เชื่อมโยงกับ company_id, opportunity_id, customer_id

คำนวณราคา:
  → item.total_price = quantity × unit_price
  → subtotal = sum(item.total_price)
  → discount_amount = subtotal × discount%
  → tax_amount = (subtotal - discount) × tax%
  → grand_total = subtotal - discount + tax

Export PDF:
  → ดึง quotation + items + company settings
  → สร้าง PDF พร้อมโลโก้บริษัท, เลขที่, วันที่, รายการ, ราคารวม
```

---

## 14. รายงานรายได้ (`/revenue`)

| Element | Detail |
|---------|--------|
| **Route** | `/revenue` (PermissionRoute, menuKey=`revenue`) |
| **Page** | `RevenuePage.tsx` |
| **API** | `api/opportunities.php`, `api/projects.php`, `api/companies.php` |
| **Tables** | `projects`, `sales_opportunities`, `companies`, `project_payments` |

### System Flow

```
Tab Overview:
  → ยอดรวม Won, payment status distribution
  → กราฟรายเดือน: มูลค่า Won deals รายเดือน

Tab Projects:
  → ตารางโปรเจกต์: มูลค่า + payment_status (pending/partial/paid/overdue)
  → กรองตามปีและช่วงวันที่

Tab Opportunities:
  → ตาราง Won deals: มูลค่า, วันปิดจริง, บริษัท

Tab Companies:
  → Top 10 บริษัทเรียงตามมูลค่ารายได้รวม
```

---

## 15. ศูนย์ช่วยเหลือ (`/support`)

| Element | Detail |
|---------|--------|
| **Route** | `/support` (PermissionRoute, menuKey=`support`) |
| **Page** | `SupportPage.tsx` |
| **API** | `api/support-tickets.php`, `api/support-contracts.php`, `api/support-upload.php` |
| **Tables** | `support_tickets`, `support_ticket_comments`, `support_contracts`, `support_attachments` |

### System Flow

```
สร้าง Ticket:
  POST /api/support-tickets.php
  → สร้าง ticket_number: TKT-YYYYMMDD-NNN
  → type: incident / request / problem / change
  → priority: critical / high / medium / low
  → SLA auto-assign: critical=2h, high=4h, medium=8h, low=24h
  → channel: phone / email / walk-in / line / system
  → status: open → in-progress → pending → resolved → closed
  → แนบไฟล์ผ่าน support-upload.php (uploads/support/)

Update Ticket:
  → เพิ่ม comment (internal/external)
  → เปลี่ยน status, assigned_to, priority
  → ติดตาม SLA: first_response_at, resolved_at, closed_at
  → resolution_note, timesheet_id (เชื่อมกับการบันทึกเวลา)
  → CSAT: csat_score + csat_comment

Support Contracts:
  CRUD /api/support-contracts.php
  → type: hardware / software / ma / support / other
  → ตรวจสอบ status อัตโนมัติ:
      - active: ยังไม่หมดอายุ
      - expiring: ใกล้หมดอายุ (< renewal_alert_days)
      - expired: หมดอายุแล้ว
      - cancelled: ยกเลิก
  → แจ้งเตือนสัญญาใกล้หมดอายุทุกครั้งที่ GET

Inbox Notification:
  → เมื่อสร้างหรือโอน ticket → สร้าง inbox_messages ให้ผู้รับผิดชอบ
```

---

## 16. ฐานความรู้ (`/knowledge-base`)

| Element | Detail |
|---------|--------|
| **Route** | `/knowledge-base` (PermissionRoute, menuKey=`support`) |
| **Page** | `KnowledgeBasePage.tsx` |
| **API** | `api/support-tickets.php` (knowledge base section) |
| **Tables** | `knowledge_base` |

### System Flow

```
จัดการบทความ:
  → สร้าง/แก้ไข/ลบ บทความ FAQ
  → category: บัญชีผู้ใช้, การตั้งค่าระบบ, การใช้งาน, ทั่วไป
  → is_starred: ปักหมุดบทความสำคัญ
  → views: นับจำนวนการเข้าดู
  → ค้นหาตามชื่อบทความ
```

---

## 17. Content Management (`/content`)

| Element | Detail |
|---------|--------|
| **Route** | `/content` (PermissionRoute, menuKey=`marketing`) |
| **Page** | `ContentPage.tsx` |
| **API** | `api/content-items.php`, `api/content-publish.php`, `api/brand-content.php` |
| **Tables** | `content_items`, `content_plans`, `brand_contexts`, `content_skills`, `content_triggers`, `publish_channels`, `content_publish_queue`, `content_global_settings` |
| **Hooks** | `useContent.ts` (~20 hooks) |

### System Flow — ภาพรวม Content

```
Content Page มี 5 Tabs:
  1. ผลงานทั้งหมด (ContentListTab)
  2. กำหนดการโพสต์ (ScheduleOverviewPanel)
  3. Knowledge Base (BrandContextTab)
  4. Skills & Triggers (SkillsTriggerTab)
  5. ตั้งค่า AI (AISettingsTab)

ปุ่มบนสุด:
  → "สร้างคอนเทนต์" (QuickCreateDialog) — สร้าง content เดี่ยว
  → "Batch สร้าง" (BatchGenerateDialog) — AI สร้าง content จำนวนมาก
  → Overdue banner: แจ้งเตือนเมื่อมีโพสต์เลยกำหนดส่ง
```

### System Flow — Knowledge Base & Skills

```
Brand Context (Knowledge Base):
  CRUD /api/brand-content.php
  → file_type: brand_md (brand guideline) / sop_md (SOP) / custom
  → content (LONGTEXT Markdown) + parsed_data (JSON)
  → ใช้เป็น context สำหรับ AI content generation

Content Skills:
  CRUD /api/brand-content.php
  → name, content_type, system_prompt
  → steps (JSON): ขั้นตอนการสร้าง content
  → AI ใช้ skill นี้เป็น prompt template

Content Triggers:
  CRUD /api/brand-content.php
  → command (คำสั่ง trigger), skill_id (เชื่อมกับ content_skills)
  → is_active toggle
  → เมื่อ user พิมพ์ command → ระบบเรียก skill ที่เกี่ยวข้อง
```

### System Flow — Publish Channels & Scheduling

```
Publish Channels:
  CRUD /api/brand-content.php
  → platform: wordpress / wix / custom / facebook / lineoa /
              instagram / tiktok / linkedin / twitter
  → endpoint_url, credentials_encrypted (เก็บ API keys เข้ารหัส)
  → is_active toggle

Content Publish Queue:
  POST /api/content-publish.php (action=schedule)
  → รับ content_id, channels[], scheduled_at
  → ตรวจสอบ: content ต้อง status=published, channels ต้อง active
  → สร้าง content_publish_queue records (status=pending)
  → Cron processor: api/cron-publish.php
      - ทุก 60 วิ อ่าน records status=pending ที่ scheduled_at <= now
      - ส่ง content ไปยัง platform ผ่าน API
      - status: pending → processing → sent / failed
      - error_msg + retry_count เมื่อส่งไม่สำเร็จ

Send Now:
  POST /api/content-publish.php (action=send_now)
  → ส่ง content ไป channel ทันที ไม่ต้องรอ schedule

Overdue Monitor:
  GET /api/content-publish.php (action=overdue_count)
  → นับ records status=pending ที่ scheduled_at < now
  → แสดง banner เตือนในหน้า Content
```

---

## 18. ปฏิทินคอนเทนต์ (`/content-planner`)

| Element | Detail |
|---------|--------|
| **Route** | `/content-planner` (PermissionRoute, menuKey=`marketing`) |
| **Page** | `ContentPlannerPage.tsx` |
| **API** | `api/brand-content.php` (planner section) |
| **Tables** | `content_plans`, `content_plan_items` |

### System Flow

```
สร้าง Content Plan:
  POST /api/brand-content.php
  → plan_type: weekly / monthly / quarterly / yearly
  → week_start (วันที่เริ่ม) + plan_start, plan_end
  → trigger_command: คำสั่ง trigger
  → skill_id, brand_context_ids (JSON)
  → status: draft → approved → published

AI สร้าง Content Plan:
  → จาก trigger_command → AI สร้างแผน content
  → สร้าง content_plan_items: day_label, topic, caption, image_brief, platform
  → ai_raw_output เก็บบันทึก AI response ดิบ

แผนรายสัปดาห์:
  → ตารางวัน x platform
  → กำหนด platform, topic, caption, image_brief ต่อวัน
  → ดู schedule ทั้งหมดในปฏิทิน
```

---

## 19. แคมเปญอีเมล (`/campaigns`)

| Element | Detail |
|---------|--------|
| **Route** | `/campaigns` (PermissionRoute, menuKey=`marketing`) |
| **Page** | `CampaignsPage.tsx` |
| **API** | `api/content-to-campaign.php` |
| **Tables** | `email_campaigns`, `email_campaign_recipients`, `email_tracking`, `email_link_clicks` |
| **Hooks** | `useMarketing.ts` |

### System Flow

```
รายการแคมเปญ:
  → แสดงทุกแคมเปญ: ชื่อ, subject, status, สถิติ
  → สถิติ: total_sent, total_opens, total_clicks
  → status: draft → scheduled → sending → sent / cancelled
  → ลิงก์ไปสร้างแคมเปญใหม่ที่ /marketing

Tracking:
  → Open tracking: embedding pixel ในอีเมล
  → Click tracking: redirect links ผ่าน tracking URL
  → email_tracking: สถานะ queued → sent → delivered → bounced/failed
  → บันทึก opened_at, clicked_at, ip_address, user_agent
```

---

## 20. สร้าง & ส่งอีเมล (`/marketing`)

| Element | Detail |
|---------|--------|
| **Route** | `/marketing` (PermissionRoute, menuKey=`marketing`) |
| **Page** | `MarketingPage.tsx` |
| **API** | `api/content-to-campaign.php`, `api/brand-content.php` |
| **Tables** | `email_campaigns`, `email_groups`, `email_group_members`, `email_tracking`, `customers` |
| **Hooks** | `useMarketing.ts` |

### System Flow

```
สร้างแคมเปญ:
  → กำหนด sender_name, sender_email, subject, body_html
  → เลือก email_groups เป็น recipients
  → schedule: ส่งทันทีหรือตั้งเวลา (scheduled_at)
  → status flow: draft → scheduled → sending → sent

Email Groups:
  CRUD /api/brand-content.php
  → name, description
  → email_group_members: customer_id → email

AI Content → Email:
  POST /api/content-to-campaign.php (action=to-campaign)
  → นำ content_item มาแปลงเป็น email campaign
  → คัดลอก article content เป็น campaign body_html
  → เชื่อมโยง source_content_id

Email Aliases:
  → จัดการผ่าน admin (user_email_aliases)
  → ใช้ login หรือส่งอีเมลแทน email หลักได้
```

---

## 21. ImpactOS (`/impactos`)

| Element | Detail |
|---------|--------|
| **Route** | `/impactos` (PermissionRoute, menuKey=`analytics`) |
| **Page** | `ImpactOSPage.tsx` |
| **API** | `api/impactos.php`, `api/kpi-weights.php`, `api/ai-insights.php`, `api/benchmark.php` |
| **Tables** | `tasks`, `chat_messages`, `chat_sessions`, `users`, `kpi_weight_configs` |
| **Views** | `cross_project_impact` |

### System Flow

```
11 Tabs ใน ImpactOSPage:
  CEO / Overview / Departments  →  ?view=ceo|overview|departments
  KPI Ranking / Dev             →  ?view=leaderboard|dev
  Sales / Support               →  ?view=sales|support
  Quality / Customer            →  ?view=quality|customer
  AI Analysis (per-user)        →  ?view=ai_analysis
  AI Insights (system-wide)     →  api/ai-insights.php
  Benchmark                     →  api/benchmark.php
```

### KPI 4 แกนหลัก (P / Q / A / S)

```
P — Production:    min(leaf_actual_hours / 160 × 100, 100)
Q — Quality/Speed: (on_time_completed / total_completed) × 100
A — AI Adoption:   min(chat_count / tenant_median × 100, 100)
S — Synergy:       (tasks_in_team_projects / total_tasks) × 100

KPI Final = P×p_weight + Q×q_weight + A×a_weight + S×s_weight
ผลรวม weight ต้อง = 100

เกรด: A+(≥90) · A(≥80) · B+(≥70) · B(≥60) · C(≥50) · D(<50)
```

### Default Weights รายแผนก (kpi_weight_configs)

| แผนก | P | Q | A | S |
|---|---|---|---|---|
| Development | 40% | 30% | 10% | 20% |
| Sales | 20% | 40% | 20% | 20% |
| Support | 30% | 30% | 10% | 30% |
| Management | 20% | 20% | 30% | 30% |

fallback ถ้าไม่มี config ของแผนกนั้น: 25/25/25/25

### Leaf Task Rule

```
มี subtask  → P นับจาก SUM(subtask.actual_hours) เท่านั้น
ไม่มี subtask → P นับจาก task.actual_hours โดยตรง
ป้องกันนับซ้ำ parent + child
```

### KPI Weights API

```
GET    /api/kpi-weights.php              — ดู config ทั้งหมด
POST   /api/kpi-weights.php?action=seed  — seed default 4 แผนก
PUT    /api/kpi-weights.php?id=xxx       — แก้ weight รายแผนก
```

### AI Analysis (per-user, ?view=ai_analysis)

```
→ ส่ง KPI ทั้ง 4 แกน + งานเสร็จ + ชั่วโมง + revenue contribution ให้ AI
→ ใช้ company_settings.ai_analyst_model_id
→ Response: { summary, strengths, weaknesses, recommendations }
```

### AI Insights (api/ai-insights.php)

```
→ วิเคราะห์ performance ระดับระบบ (system-wide)
→ แนะนำกลยุทธ์จาก content posting_analytics และ KPI trends
```

### Benchmark Dashboard (api/benchmark.php)

```
เปรียบเทียบ tenant กับค่า reference อุตสาหกรรม:
  ส่งงานตรงเวลา   75%   (PM industry standard)
  SLA Compliance  85%   (ITIL)
  ปิดโปรเจกต์     70%   (PMI)
  แก้ Ticket      12 h  (Help Desk Institute)
  Email Open Rate 22%   (Mailchimp)
  Win Rate        30%   (HubSpot B2B)
ค่า reference ปรับแก้ได้ใน benchmark.php (ไม่ใช่ external API)
```

### Cross-project Impact

```
→ cross_project_impact SQL view
→ วิเคราะห์ blocking/blocked chains ข้ามโปรเจกต์
→ แสดงงานที่ล่าช้าและผลกระทบต่อโปรเจกต์อื่น
```

### Quality Dashboard — Interrupted Proxy

```
"Defect Rate" วัดจากงานที่ถูก interrupt (paused_at IS NOT NULL)
ไม่ใช่ rework จาก QA reject — ใช้เป็น proxy ของการถูกขัดจังหวะ
```

---

## 22. Task Intelligence (`/task-intelligence`)

| Element | Detail |
|---------|--------|
| **Route** | `/task-intelligence` (PermissionRoute, menuKey=`task_intelligence`) |
| **Page** | `TaskIntelligencePage.tsx` |
| **API** | `api/task-intelligence.php` |
| **Tables** | `tasks`, `projects` |

### System Flow

```
Assessment Tab:
  GET /api/task-intelligence.php?action=assessment
  → Health metrics: on-time count, overdue count, completed, in-progress, pending
  → Hours diff: estimated_hours vs actual_hours
  → กรองตามปี/ช่วงวันที่

Quality Tab:
  GET /api/task-intelligence.php?action=quality
  → Missing fields: งานที่ขาดข้อมูลจำเป็น
  → Anomalies: งานที่มีวันสิ้นสุดก่อนวันเริ่ม, estimated_hours = 0, ฯลฯ
  → Zombie tasks: งานที่ไม่มี activity นานเกินกำหนด

Duplicates Tab:
  GET /api/task-intelligence.php?action=duplicates
  → Fuzzy match หางานที่ซ้ำซ้อน (ชื่อคล้ายกันในโปรเจกต์เดียวกัน)

Migration:
  GET ?action=migrate_preview → preview งานที่จะย้ายระหว่างโปรเจกต์
  POST ?action=migrate → ย้าย task + subtasks ไปอีกโปรเจกต์ (admin only)
```

---

## 23. วิเคราะห์ข้อมูล (`/analytics`)

| Element | Detail |
|---------|--------|
| **Route** | `/analytics` (PermissionRoute, menuKey=`analytics`) |
| **Page** | `AnalyticsPage.tsx` |
| **API** | `api/projects.php`, `api/opportunities.php`, `api/quotations.php`, `api/companies.php` |
| **Tables** | `projects`, `tasks`, `sales_opportunities`, `quotations`, `companies`, `timesheet_entries` |

### System Flow

```
ภาพรวม:
  → โปรเจกต์, งาน, โอกาสขาย, ใบเสนอราคา, บริษัท, timesheet
  → กรองตามปี
  → กราฟแท่ง/เส้น/วงกลมหลายมิติ

Export CSV:
  → Projects, Tasks, Opportunities, Quotations, Timesheet
  → ดาวน์โหลดผ่าน browser
```

---

## 24. รายงาน (`/reports`)

| Element | Detail |
|---------|--------|
| **Route** | `/reports` (PermissionRoute, menuKey=`reports`) |
| **Page** | `ReportsPage.tsx` |
| **API** | `api/tasks.php` (report mode), `api/support-tickets.php` |
| **Tables** | `tasks`, `projects`, `support_tickets` |

### System Flow

```
Resource Workload:
  → ภาระงานต่อคนต่อสัปดาห์ (actual vs estimated hours)
  → resource_workload SQL view aggregating assignee workloads

Project Profitability:
  → budget hours vs actual hours รายโปรเจกต์
  → project_value - (actual_hours × hourly_rate)

SLA Report:
  → อัตราการแก้ไขทันเวลา vs เกิน SLA
  → แยกตาม priority, assignee, ช่วงเวลา
```

---

## 25. ผู้ดูแลระบบ (`/admin`)

| Element | Detail |
|---------|--------|
| **Route** | `/admin` (PermissionRoute, menuKey=`admin`) |
| **Page** | `AdminPage.tsx` |
| **API** | `api/settings.php`, `api/ai-providers.php`, `api/ai-settings.php`, `api/chat.php`, `api/chat-history.php`, `api/activity-logs.php`, `api/data-quality-stats.php`, `api/query.php` |
| **Tables** | `users`, `roles`, `role_menu_permissions`, `tenant_users`, `company_settings`, `ai_providers`, `ai_models`, `chat_sessions`, `chat_messages`, `chat_reports`, `user_activity_logs`, `user_email_aliases` |

### System Flow — User Management

```
สร้าง/แก้ไข User:
  → สร้าง users record + tenant_users link
  → กำหนด role_id → สิทธิ์ตาม role_menu_permissions
  → is_admin=1 → bypass ทุก permission
  → is_active=0 → disable account
  → email aliases: เพิ่ม/ลบ alias สำหรับ login
  → เลือกผู้ใช้ใน dropdown ทั้งระบบ: กรองเฉพาะ active users (useUsers → /users.php?active_only=1)

Role Management:
  → สร้าง role → กำหนดชื่อ, label
  → เลือก menu_key permissions (checkbox per menu module)
  → role_menu_permissions: many-to-many (role_id, menu_key)
```

### System Flow — Admin Overview & Tools

```
Admin Overview:
  → สรุปสถิติระบบ: users, projects, tasks, tickets counts
  → Admin Task View: ดู/แก้ไข/ลบ tasks ทั้งหมดในระบบ

System Settings:
  GET/PUT /api/settings.php
  → company_name, logo, tax_id, currency, bank info
  → quotation config: prefix, running_number, format
  → SMTP settings (สำหรับส่ง email)

AI Provider Management:
  CRUD /api/ai-providers.php
  → name, api_base_url, api_key_encrypted (เข้ารหัส)
  → AI models: model_id, name, context_window, pricing
  → test connection: POST ?action=test

AI Feature Settings:
  GET/PUT /api/ai-settings.php
  → เลือก model ต่อ use-case:
      ai_chat_model_id, ai_content_text_model_id,
      ai_content_image_model_id, ai_content_video_model_id,
      ai_cardscan_model_id, ai_analyst_model_id
  → ตั้งค่า `ai_chat_context_prompt` เพื่อกำหนดบริบทการทำงานของผู้ช่วย AI ระดับองค์กร
  → เก็บใน company_settings

Flowstack AI Chat + Reports:
  GET /api/chat.php?action=models
  POST /api/chat.php
  → แชทผู้ช่วย AI โดยใช้ system prompt จาก schema + persona + ai_chat_context_prompt

  GET /api/chat-history.php?action=sessions
  GET /api/chat-history.php?action=messages&session_id=...
  → โหลด session และข้อความย้อนหลัง

  POST /api/chat-history.php (action=save_report)
  GET /api/chat-history.php?action=reports
  DELETE /api/chat-history.php?action=report&id=...
  → บันทึก/ดึงรายงาน AI ทั้งหมดของผู้ใช้ใน tenant เดียวกัน
  → รองรับเก็บเนื้อหารายงานและ table_data สำหรับเปิดดูซ้ำ

Activity Logs:
  GET /api/activity-logs.php
  → ประวัติการใช้งานระบบ: login, logout, create, update, delete
  → กรองตาม user, action, วันที่
  → pagination

SQL Query Tool:
  POST /api/query.php (admin only)
  → รัน SELECT queries โดยตรง
  → Security: block DELETE, DROP, INSERT, ALTER, TRUNCATE, GRANT, REVOKE
  → Auto-inject tenant_id parameter

Data Quality:
  GET /api/data-quality-stats.php
  → ตรวจสอบ completeness: projects ไม่มี budget, tasks ไม่มี assignee
  → Sync project stats: recompute actual_hours, actual_progress
  → Bulk update: projects, tasks แก้ไขหลายรายการพร้อมกัน
```

---

## 26. ส่งออกข้อมูล (`/export`)

| Element | Detail |
|---------|--------|
| **Route** | `/export` (PermissionRoute, menuKey=`admin`) |
| **Page** | `ExportPage.tsx` |
| **API** | `api/projects.php`, `api/tasks.php` (export modes) |
| **Tables** | `companies`, `customers`, `projects`, `tasks`, `sales_opportunities` |

### System Flow

```
Export:
  → เลือก entity: บริษัท, ลูกค้า, โปรเจกต์, งาน, งานย่อย, โอกาสขาย
  → เลือกรูปแบบ: CSV หรือ JSON
  → ดาวน์โหลดผ่าน browser ทันที
```

---

## 27. Inbox (`/inbox`)

| Element | Detail |
|---------|--------|
| **Route** | `/inbox` (PermissionRoute, menuKey=`inbox`) |
| **Page** | `InboxPage.tsx` |
| **API** | `api/inbox.php` |
| **Tables** | `inbox_messages` |

### System Flow

```
รับข้อความ:
  → type: ticket / message / notification / email
  → priority: low / medium / high / critical
  → sender_name, sender_email, subject, preview

การแจ้งเตือน:
  → มอบหมายงาน: inbox message ส่งให้ assignee
  → โอน ticket: inbox message ส่งให้ผู้รับผิดชอบใหม่
  → notification ทั่วไปจากระบบ

การจัดการ:
  → is_read: อ่าน/ยังไม่อ่าน (auto mark as read เมื่อเปิด)
  → is_starred: ปักหมุดข้อความสำคัญ
  → mark all as read
  → ลบข้อความ
  → unread count: แสดง badge ใน sidebar (poll ทุก 60 วินาที)

ส่งข้อความ:
  → เลือกผู้รับจากรายชื่อ users ใน tenant
  → สร้าง inbox_messages ให้ผู้รับ
```

---

## 28. โปรไฟล์ผู้ใช้ (`/profile`)

| Element | Detail |
|---------|--------|
| **Route** | `/profile` (ProtectedRoute, login required) |
| **Page** | `ProfilePage.tsx` |
| **API** | `api/profile.php` |
| **Tables** | `users`, `notification_settings` |

### System Flow

```
Profile Page มี 5 Sections:

1. รูปโปรไฟล์:
   → อัปโหลด avatar (JPEG/PNG/GIF/WebP, max 2MB)
   → uploadAvatar() → multipart form POST
   → แสดง preview ทันที

2. ข้อมูลส่วนตัว:
   → display_name, position
   → PUT /api/profile.php

3. เปลี่ยนรหัสผ่าน:
   → current_password, new_password (min 6 chars), confirm_password
   → POST /api/profile.php (action=change_password)

4. ข้อมูลบัญชี (readonly):
   → email, role, status
   → email aliases (ถ้ามี)

5. การแจ้งเตือน (AI Secretary Briefing):
   → briefing_time: เวลาส่งสรุปประจำวัน
   → ช่องทาง: email, Line OA, Telegram
   → Line: line_user_id (U...)
   → Telegram: telegram_chat_id
   → บันทึกใน notification_settings

Notification Dispatch:
   → cron เรียก api/notification-dispatch.php ทุก 7 นาที
   → หา users ที่ briefing_time ตรงกับเวลาปัจจุบัน ±7 นาที
   → สร้าง daily briefing จาก overdue tasks, today's tasks, upcoming deadlines
   → ส่งผ่าน Line Messaging API, Telegram Bot, Email
   → บันทึก notification_log (channel, status, error)
```

---

## 29. Global Search

| Element | Detail |
|---------|--------|
| **Component** | `GlobalSearch.tsx` |
| **Shortcut** | `Ctrl+K` / `Cmd+K` |
| **API** | multiple endpoints (search across entities) |

### System Flow

```
เปิด Search:
  → Ctrl+K หรือคลิกปุ่ม "ค้นหา" ใน sidebar
  → Modal dialog พร้อม input ค้นหา

ค้นหาข้าม entity:
  → โปรเจกต์, งาน, บริษัท, โอกาสขาย
  → Debounced search (หน่วงเวลาพิมพ์)
  → ผลลัพธ์แยกตามประเภท
  → คลิกที่ผลลัพธ์ → นำทางไปยังหน้านั้น
```

---

## 30. AI Provider Management

| Element | Detail |
|---------|--------|
| **Page** | `AdminPage.tsx` (AI Settings tab) |
| **API** | `api/ai-providers.php`, `api/ai-settings.php`, `api/chat.php`, `api/personas.php` |
| **Tables** | `ai_providers`, `ai_models`, `company_settings`, `ai_personas`, `user_persona_preference` |

### System Flow

```
AI Providers:
  CRUD /api/ai-providers.php
  → provider: name, display_name, api_base_url, icon
  → api_key_encrypted: เก็บเข้ารหัสใน DB
  → test connection: ส่ง request ทดสอบไปที่ API
  → models: จัดการ AI models ต่อ provider
      - model_id, context_window, max_output_tokens
      - pricing: input_price_per_1k, output_price_per_1k
      - capabilities: supports_vision, supports_streaming, supports_function_calling

Feature Model Assignment:
  → เลือก model สำหรับแต่ละ feature:
      chat, content_text, content_image, content_video, cardscan, analyst
  → เก็บใน company_settings

AI Chat:
  POST /api/chat.php
  → รับ messages array (role: user/assistant/system)
  → resolveAICreds(): อ่าน provider + model จาก company_settings
  → callKiloAI(): proxy request ไป AI backend
  → บันทึก chat_sessions + chat_messages
  → รองรับ table_data (JSON) ใน response

AI Personas:
  CRUD /api/personas.php
  → name, avatar_emoji, description, personality
  → data_scope: personal / team / admin
  → is_default: persona เริ่มต้นของระบบ
  → user_persona_preference: ผู้ใช้เลือก persona ที่ต้องการ
```

---

## 31. Resource Dashboard (`/resources`)

| Element | Detail |
|---------|--------|
| **Route** | `/resources` (PermissionRoute, menuKey=`resources`) |
| **Page** | `ResourceDashboard.tsx` |
| **API** | `api/tasks.php` (resource views) |
| **Tables** | `resource_workload` (view), `tasks`, `projects` |

### System Flow

```
Resource Overview:
  → ภาพรวมภาระงานของทีม
  → resource_workload view: aggregate assignee workload ต่อวัน
  → จำนวนโปรเจกต์, จำนวนงาน, active tasks ต่อคน
```

---

## 32. API Docs & Help

| Route | Page | Guard |
|-------|------|-------|
| `/api-docs` | `ApiDocsPage.tsx` | ProtectedRoute |
| `/help` | `HelpPage.tsx` | ProtectedRoute |

- **API Docs**: แสดงใน TopNav เฉพาะ admin, ลิงก์ไป `/api-docs`
- **Help Page**: คู่มือการใช้งานทั่วไป

---

## สรุป Menu Keys และ Permission

| menuKey | โมดูล | Routes |
|---------|-------|--------|
| `home` | Dashboard | `/` |
| `projects` | โปรเจกต์, งานที่ทำซ้ำ | `/projects`, `/project/:id`, `/recurring-tasks` |
| `timesheet` | บันทึกชั่วโมง | `/timesheet` |
| `calendar` | ปฏิทินทีม | `/calendar` |
| `goals` | เป้าหมาย & OKR | `/goals` |
| `budget` | งบประมาณ | `/budget` |
| `automation` | ระบบอัตโนมัติ | `/automation` |
| `companies` | บริษัทและลูกค้า | `/companies` |
| `sales` | ไปป์ไลน์การขาย, แบบสอบถาม | `/sales`, `/sales/:id`, `/surveys` |
| `quotations` | ใบเสนอราคา | `/quotations` |
| `revenue` | รายงานรายได้ | `/revenue` |
| `support` | Helpdesk, ฐานความรู้ | `/support`, `/knowledge-base` |
| `marketing` | Content, แคมเปญ, อีเมล | `/content`, `/content-planner`, `/campaigns`, `/campaign-analytics`, `/marketing` |
| `analytics` | ImpactOS, วิเคราะห์ข้อมูล | `/impactos`, `/analytics` |
| `reports` | รายงาน | `/reports` |
| `task_intelligence` | ประเมินผลงาน | `/task-intelligence` |
| `admin` | ผู้ดูแลระบบ, ส่งออก | `/admin`, `/export` |
| `inbox` | กล่องข้อความ | `/inbox` |
| `resources` | Resource Dashboard | `/resources` |

### Routes ไม่ต้องใช้ menuKey (login only)

| Route | Page |
|-------|------|
| `/profile` | โปรไฟล์ผู้ใช้ |
| `/help` | คู่มือการใช้งาน |
| `/api-docs` | API Documentation (visible เฉพาะ admin ใน TopNav) |

### Routes สาธารณะ

| Route | Page |
|-------|------|
| `/auth` | หน้า login/signup |
| `/survey/public/:token` | แบบสอบถามสาธารณะ |

---

## Database Summary

76 tables ใน MariaDB, ใช้ UUID (CHAR(36)) เป็น Primary Key, multi-tenant แยกด้วย `tenant_id` ทุกตาราง

| กลุ่ม | ตาราง |
|------|-------|
| Auth | `users`, `user_email_aliases`, `tenant_users`, `tenants`, `roles`, `role_menu_permissions`, `login_rate_limits`, `user_activity_logs` |
| Projects | `projects`, `tasks`, `project_members`, `task_dependencies`, `task_history`, `task_validation_rules`, `recurring_tasks`, `view_settings` |
| Calendar | `calendar_events` |
| Goals | `goals`, `goal_tasks` |
| Budget | `budget_items` |
| Automation | `automation_rules`, `automation_executions` |
| CRM | `companies`, `customers`, `customer_activities`, `sales_opportunities`, `opportunity_members`, `sales_activities`, `sales_pipeline_summary` (view) |
| Quotations | `quotations`, `quotation_items`, `quotation_sequences`, `quotation_summary` (view) |
| Support | `support_tickets`, `support_ticket_comments`, `support_contracts`, `support_attachments` |
| Knowledge | `knowledge_base` |
| Surveys | `survey_templates`, `survey_questions`, `survey_responses`, `survey_answers` |
| Content | `content_plans`, `content_items`, `brand_contexts`, `content_skills`, `content_triggers`, `publish_channels`, `content_schedules`, `content_publish_queue`, `content_global_settings`, `content_posting_analytics` |
| Email | `email_campaigns`, `email_campaign_recipients`, `email_groups`, `email_group_members`, `email_tracking`, `email_link_clicks` |
| AI | `ai_providers`, `ai_models`, `ai_personas`, `user_persona_preference`, `chat_sessions`, `chat_messages` |
| Settings | `company_settings`, `settings`, `custom_fields`, `task_custom_field_values`, `notification_settings`, `notification_log` |
| Inbox | `inbox_messages` |
| Payments | `project_payments` |
| Views | `resource_workload`, `cross_project_impact`, `project_with_company_customer`, `quotation_summary` |

---

## 33. Campaign Analytics (`/campaign-analytics`)

| Element | Detail |
|---------|--------|
| **Route** | `/campaign-analytics` (PermissionRoute, menuKey=`marketing`) |
| **Page** | `CampaignAnalyticsPage.tsx` |
| **API** | `api/campaign-analytics.php` |
| **Tables** | `email_campaigns`, `email_tracking`, `email_link_clicks` |

### System Flow

```
GET /api/campaign-analytics.php
  → ภาพรวมทุกแคมเปญ: open rate, click rate, bounce rate
  → กราฟเปรียบเทียบแคมเปญ
  → timeline การส่ง
  → Top performing campaigns
  → กรองตามช่วงวันที่
```

---

## 34. Sales Activity Evaluation

| Element | Detail |
|---------|--------|
| **API** | `api/sales-activity-eval.php` |
| **Tables** | `sales_activities`, `customer_activities`, `email_tracking`, `sales_opportunities`, `companies` |

### System Flow

```
GET /api/sales-activity-eval.php?start_date=...&end_date=...&company_id=...
→ ประเมินผลการขายและ engagement รายบริษัท:
    emails_sent / opened / clicked / bounced
    open_rate, click_rate
    ca_total (customer activities), sa_total (sales activities by type)
    opp_count, opp_won, opp_lost, opp_value, win_rate
    engagement_score (composite)
→ summary: companies_total, avg_open_rate, avg_click_rate, win_rate
ใช้ใน Sales Detail page (Customer Activities tab)
```

---

## 35. Agent API System

| Element | Detail |
|---------|--------|
| **API** | `api/agent-keys.php`, `api/agent-auth.php` |
| **Tables** | (agent_api_keys — in users context) |

### System Flow

```
Agent API Keys (api/agent-keys.php):
  → สร้าง API keys สำหรับ external agents / automation scripts
  → Fields: name, key_prefix, permissions (JSON), expires_at, is_active
  → last_used_at: tracking การใช้งาน

Agent Auth (api/agent-auth.php):
  → Verify agent API key (แยกจาก JWT user auth)
  → permissions: กำหนด endpoint ที่ agent เข้าถึงได้
  → ใช้สำหรับ AI agents, webhook handlers, external integrations
```

---

## 36. Company Intelligence

| Element | Detail |
|---------|--------|
| **API** | `api/company-enrich.php`, `api/company-lookup.php` |

### System Flow

```
Company Lookup (api/company-lookup.php):
  → ค้นหาบริษัทจากชื่อหรือ tax_id ก่อนสร้างใหม่
  → normalized matching: ลด false duplicates จากช่องว่าง/สัญลักษณ์
  → ป้องกันข้อมูลซ้ำในระบบ

Company Enrich (api/company-enrich.php):
  → เติมข้อมูล business_type, company_size, address ที่ขาด
  → ดึงจาก external data source หรือ AI inference
```

---

## 37. Client Error Tracking

| Element | Detail |
|---------|--------|
| **API** | `api/client-errors.php` (POST), `api/client-errors-list.php` (GET) |

### System Flow

```
POST /api/client-errors.php:
  → รับ error report จาก frontend (JS errors, uncaught exceptions)
  → บันทึก: error_message, stack_trace, url, user_agent, user_id, timestamp

GET /api/client-errors-list.php (admin only):
  → ดูรายการ errors ทั้งหมด
  → กรองตาม severity, date range, user
  → ใช้ debug frontend issues ในระบบ production
```

---

## 38. Inbound Email Webhook

| Element | Detail |
|---------|--------|
| **API** | `api/webhook-email.php` |

### System Flow

```
POST /api/webhook-email.php:
  → รับ inbound email จาก mail service provider
  → parse sender, subject, body, attachments
  → สร้าง support ticket หรือ inbox message อัตโนมัติ
  → แนบ email thread ไว้ใน ticket
```

---

## 39. Scheduled Report Email

| Element | Detail |
|---------|--------|
| **API** | `api/report-email.php` |

### System Flow

```
→ ส่งรายงานสรุปทาง email แบบ scheduled (daily/weekly)
→ ประกอบด้วย: project status, task summary, SLA compliance
→ recipients: กำหนดใน settings
```

---

## 40. Custom Fields

| Element | Detail |
|---------|--------|
| **API** | `api/custom-fields.php` |
| **Tables** | `custom_fields`, `task_custom_field_values` |

### System Flow

```
entity_type: task / project / company / customer
field_type: text / number / date / select / checkbox / textarea
field_name, label, options (JSON สำหรับ select)
is_required, is_active

ค่าของ custom field เก็บใน task_custom_field_values
  entity_id → custom_field_id → value
```

---

## Database Summary (Updated)

76+ tables ใน MariaDB, UUID (CHAR(36)) PKs, multi-tenant via `tenant_id`

| กลุ่ม | ตาราง |
|------|-------|
| Auth | `users` `user_email_aliases` `tenant_users` `tenants` `roles` `role_menu_permissions` `login_rate_limits` `user_activity_logs` |
| Projects | `projects` `tasks` `project_members` `task_dependencies` `task_history` `task_validation_rules` `recurring_tasks` `view_settings` |
| Calendar | `calendar_events` `calendar_overrides` |
| Goals | `goals` `goal_tasks` |
| Budget | `budget_items` |
| Automation | `automation_rules` `automation_executions` |
| CRM | `companies` `customers` `customer_activities` `sales_opportunities` `opportunity_members` `sales_activities` |
| Quotations | `quotations` `quotation_items` `quotation_sequences` |
| Support | `support_tickets` `support_ticket_comments` `support_contracts` `support_attachments` |
| Knowledge | `knowledge_base` |
| Surveys | `survey_templates` `survey_questions` `survey_responses` `survey_answers` |
| Content | `content_items` `content_plans` `content_plan_items` `brand_contexts` `content_skills` `content_triggers` `publish_channels` `content_publish_queue` `content_global_settings` `content_posting_analytics` |
| Email | `email_campaigns` `email_campaign_recipients` `email_groups` `email_group_members` `email_tracking` `email_link_clicks` |
| AI | `ai_providers` `ai_models` `ai_personas` `user_persona_preference` `chat_sessions` `chat_messages` |
| KPI | `kpi_weight_configs` |
| Settings | `company_settings` `settings` `custom_fields` `task_custom_field_values` `notification_settings` `notification_log` |
| Inbox | `inbox_messages` |
| Payments | `project_payments` |
| Views | `resource_workload` `cross_project_impact` `project_with_company_customer` `quotation_summary` `sales_pipeline_summary` |

---

## สรุป Menu Keys และ Permission (Updated)

| menuKey | โมดูล | Routes |
|---------|-------|--------|
| `home` | Dashboard | `/` |
| `projects` | โปรเจกต์, Recurring Tasks | `/projects`, `/project/:id`, `/recurring-tasks` |
| `timesheet` | บันทึกชั่วโมง | `/timesheet` |
| `calendar` | ปฏิทินทีม | `/calendar` |
| `goals` | เป้าหมาย & OKR | `/goals` |
| `budget` | งบประมาณ | `/budget` |
| `automation` | ระบบอัตโนมัติ | `/automation` |
| `companies` | บริษัทและลูกค้า | `/companies` |
| `sales` | ไปป์ไลน์การขาย, แบบสอบถาม | `/sales`, `/sales/:id`, `/surveys` |
| `quotations` | ใบเสนอราคา | `/quotations` |
| `revenue` | รายงานรายได้ | `/revenue` |
| `support` | Helpdesk, ฐานความรู้ | `/support`, `/knowledge-base` |
| `marketing` | Content, แคมเปญ, อีเมล | `/content`, `/content-planner`, `/campaigns`, `/campaign-analytics`, `/marketing` |
| `analytics` | ImpactOS, วิเคราะห์ | `/impactos`, `/analytics` |
| `reports` | รายงาน | `/reports` (redirect → `/analytics`) |
| `task_intelligence` | ประเมินผลงาน | `/task-intelligence` |
| `admin` | ผู้ดูแลระบบ, ส่งออก | `/admin`, `/export` |
| `inbox` | กล่องข้อความ | `/inbox` |
| `resources` | Resource Dashboard | `/resources` |

### Routes ไม่ต้องใช้ menuKey (login only)
- `/profile` — โปรไฟล์ผู้ใช้
- `/help` — คู่มือการใช้งาน
- `/api-docs` — API Documentation (visible เฉพาะ admin)

### Routes สาธารณะ
- `/auth` — Login/Signup
- `/survey/public/:token` — แบบสอบถามสาธารณะ

---

*ปรับปรุงล่าสุด: 28 พฤษภาคม 2569*
*ครอบคลุม 40 modules, 36 routes, 19 menuKeys, 76+ database tables, 80+ API endpoints*
*การเปลี่ยนแปลงหลัก: ImpactOS KPI แก้เป็น 4 แกน P/Q/A/S, เพิ่ม Campaign Analytics, Sales Activity Eval, Agent API, Company Intelligence, Client Error Tracking, Webhook Email, Report Email, Custom Fields, calendar_overrides, kpi_weight_configs*
