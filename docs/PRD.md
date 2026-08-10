# Product Requirements Document (PRD)
# Flowstack — Thai Business Management SaaS

**Version:** 1.1  
**Date:** May 28, 2026  
**Status:** Living Document  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Target Users & Personas](#3-target-users--personas)
4. [Technical Architecture](#4-technical-architecture)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Feature Modules](#6-feature-modules)
   - [6.1 Dashboard](#61-dashboard----menukey-home)
   - [6.2 Project Management](#62-project-management----menukey-projects)
   - [6.3 Timesheet](#63-timesheet----menukey-timesheet)
   - [6.4 Goals & OKR](#64-goals--okr----menukey-goals)
   - [6.5 Budget](#65-budget----menukey-budget)
   - [6.6 Automation](#66-automation----menukey-automation)
   - [6.7 Recurring Tasks](#67-recurring-tasks----menukey-projects)
   - [6.8 Companies & CRM](#68-companies--crm----menukey-companies)
   - [6.9 Sales Pipeline](#69-sales-pipeline----menukey-sales)
   - [6.10 Quotations](#610-quotations----menukey-quotations)
   - [6.11 Revenue](#611-revenue----menukey-revenue)
   - [6.12 Helpdesk / Support](#612-helpdesk--support----menukey-support)
   - [6.13 Knowledge Base](#613-knowledge-base----menukey-support)
   - [6.14 Content Management](#614-content-management----menukey-marketing)
   - [6.15 Content Planner](#615-content-planner----menukey-marketing)
   - [6.16 Email Campaigns](#616-email-campaigns----menukey-marketing)
   - [6.17 Email Marketing](#617-email-marketing----menukey-marketing)
   - [6.18 ImpactOS](#618-impactos----menukey-analytics)
   - [6.19 Analytics](#619-analytics----menukey-analytics)
   - [6.20 Reports](#620-reports----menukey-reports)
   - [6.21 Admin Panel](#621-admin-panel----menukey-admin)
   - [6.22 Data Quality](#622-data-quality----menukey-admin)
   - [6.23 Data Export](#623-data-export----menukey-admin)
   - [6.24 Inbox](#624-inbox----menukey-inbox)
   - [6.25 User Profile](#625-user-profile)
   - [6.26 Global Search](#626-global-search)
   - [6.27 Surveys](#627-surveys----menukey-sales)
   - [6.28 AI Provider Management](#628-ai-provider-management)
7. [Business Rules & Constraints](#7-business-rules--constraints)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Data Model Summary](#9-data-model-summary)
10. [API Endpoint Reference](#10-api-endpoint-reference)

---

## 1. Executive Summary

Flowstack is a Thai-language, all-in-one business management SaaS platform designed for Thai SMEs and mid-market organizations. It unifies project management, CRM, sales pipeline, helpdesk, marketing automation, HR performance analytics, and AI-assisted content creation into a single cohesive workspace.

The platform is built on a PHP + MariaDB backend (XAMPP-compatible) with a React 18 + TypeScript + Vite frontend, offering a responsive single-page application accessible from any modern browser.

**Core Value Proposition:**
- Eliminate siloed tools by combining PM, CRM, Sales, Support, and Marketing into one platform
- Thai-first UI and workflows optimized for Thai business culture
- AI-powered productivity features (WBS generation, content creation, KPI analysis)
- Transparent performance management via the ImpactOS framework

---

## 2. Product Vision & Goals

### Vision

To be the operating system for Thai businesses — enabling teams to plan work, track performance, manage relationships, and communicate all from one platform, with AI as a built-in productivity layer.

### Strategic Goals

1. **Operational Visibility:** Give managers real-time visibility into project progress, team workload, and business performance
2. **Accountability Culture:** Replace vague task tracking with atomic, time-boxed work units and transparent KPI scoring
3. **Revenue Intelligence:** Connect sales pipeline, quotations, and project delivery to provide a complete revenue picture
4. **Customer Success:** Track the full customer lifecycle from lead to support contract with tiered relationship management
5. **AI-First Workflows:** Integrate AI into planning (WBS), writing (content), analysis (KPI), and support (ticket resolution)

### Success Metrics

- Average project on-time delivery rate > 80%
- Timesheet logging compliance > 90% of business days
- Support SLA adherence > 95%
- User adoption across all core modules within 60 days of onboarding

---

## 3. Target Users & Personas

### Persona 1: Project Manager (ผู้จัดการโปรเจกต์)
- Manages 3–10 concurrent projects with cross-functional teams
- **Needs:** Gantt charts, task dependencies, resource workload visibility, risk flagging
- **Pain points:** Tasks dragged without updates, unclear ad-hoc impact, missing timesheets

### Persona 2: Sales Executive (เซลล์)
- Manages 20–50 deal opportunities across multiple companies
- **Needs:** Kanban pipeline, activity logging, quotation generation, win-rate analytics
- **Pain points:** Manual spreadsheet tracking, no visibility into deal history

### Persona 3: Support Engineer (วิศวกรซัพพอร์ต)
- Handles 10–30 tickets per day with SLA commitments
- **Needs:** Ticket queue, SLA timer, contract entitlement check, knowledge base
- **Pain points:** SLA breaches from unclear priorities, no escalation visibility

### Persona 4: Business Owner / C-Level (ผู้บริหาร)
- Needs executive dashboard, revenue overview, KPI scorecards, team performance
- **Pain points:** Fragmented reports from multiple tools, delayed data

### Persona 5: Marketing Coordinator (ผู้ประสานงานการตลาด)
- Manages content calendar, email campaigns, social publishing
- **Needs:** Content planner, AI content generation, campaign analytics
- **Pain points:** Manual cross-channel publishing, no content performance tracking

### Persona 6: System Administrator (ผู้ดูแลระบบ)
- Configures users, roles, permissions, AI providers, SMTP
- **Needs:** Full admin panel, audit logs, data quality monitoring
- **Pain points:** No central admin console, permission management by code change

---

## 4. Technical Architecture

### Stack Overview

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| State / Cache | TanStack React Query v5 |
| UI Components | shadcn-ui (Radix UI primitives + Tailwind CSS) |
| Routing | React Router v6 (HashRouter for subdirectory compatibility) |
| Backend | PHP 8.2 — no framework, pure HTTP dispatch |
| Database | MariaDB 11.5.2 (InnoDB, utf8mb4_unicode_ci) |
| Auth | JWT (stored in localStorage) |
| File Storage | Local filesystem (`uploads/support/`) |
| Dev Server | XAMPP on Windows; Vite dev server on :8080 |

### Backend API Pattern

Every PHP endpoint follows this pattern:

```php
requireAuth();          // Validate JWT, set $userId
$db = getDB();          // PDO connection
$method = getMethod();  // HTTP verb

if ($method === 'GET')    { /* ... */ jsonResponse($data); }
if ($method === 'POST')   { /* ... */ jsonResponse($result); }
if ($method === 'PUT')    { /* ... */ jsonResponse($result); }
if ($method === 'DELETE') { /* ... */ jsonResponse(['success' => true]); }

jsonError('message', 400); // Error response
```

### Frontend Data Pattern

- All server state managed via React Query hooks in `src/hooks/`
- Mutations call `queryClient.invalidateQueries([key])` on success
- No Redux/Zustand — server state is the single source of truth
- Cache: `staleTime=5min`, `gcTime=10min`, `refetchOnWindowFocus=false`

### Routing & Permission Guards

| Guard | Condition | Behavior on fail |
|---|---|---|
| `ProtectedRoute` | User is logged in | Redirect to `/auth` |
| `PermissionRoute menuKey="..."` | Logged in + has menuKey | Redirect to `/` |
| Public | None | Accessible without auth |

Public routes: `/auth`, `/survey/public/:token`

### Database Conventions

| Convention | Rule |
|---|---|
| Primary keys | `CHAR(36)` UUID — PHP `generateUUID()` |
| Soft deletes | `deleted_at DATETIME NULL` |
| Timestamps | `created_at`, `updated_at DATETIME` — `ON UPDATE current_timestamp()` |
| Foreign keys | `ON DELETE CASCADE` or `ON DELETE SET NULL` |
| Encoding | `utf8mb4_unicode_ci` throughout |

### Stored Procedures

| Procedure | Purpose |
|---|---|
| `sp_calculate_task_progress(p_task_id)` | Recursively rolls up subtask completion into parent `progress_percentage` |
| `sp_update_dependent_tasks(p_completed_task_id)` | Auto-shifts downstream task `end_date` when predecessor is delayed |

---

## 5. Authentication & Authorization

### JWT Authentication

- **Login:** `POST /api/auth.php` — accepts email + password, returns JWT + user object
- **Token:** Sent on every request as `Authorization: Bearer {JWT}`
- **Validation:** `requireAuth()` in PHP validates signature and expiry on every protected endpoint
- **User object:** Contains `id`, `name`, `email`, `is_admin`, `permissions[]`

### Role-Based Access Control (RBAC)

- Roles stored in `roles` table
- Per-role menu access in `role_menu_permissions` table
- Permission granularity: per-menu-key (not per-CRUD action)
- `is_admin=1` on user record → bypasses ALL menu permission checks
- `is_active=0` → login rejected regardless of role

### Menu Keys & Route Protection

| menuKey | Module | Protected Routes |
|---|---|---|
| `home` | Dashboard | `/` |
| `projects` | Project Management | `/projects`, `/project/:id`, `/recurring-tasks` |
| `timesheet` | Timesheet | `/timesheet` |
| `goals` | Goals & OKR | `/goals` |
| `automation` | Automation | `/automation` |
| `budget` | Budget | `/budget` |
| `companies` | CRM / Companies | `/companies` |
| `sales` | Sales Pipeline | `/sales`, `/sales/:id`, `/surveys` |
| `quotations` | Quotations | `/quotations` |
| `revenue` | Revenue | `/revenue` |
| `resources` | Resources | `/resources` |
| `analytics` | Analytics + ImpactOS | `/analytics`, `/impactos` |
| `reports` | Reports | `/reports` |
| `marketing` | Marketing + Content | `/marketing`, `/campaigns`, `/content`, `/content-planner` |
| `support` | Helpdesk + KB | `/support`, `/knowledge-base` |
| `inbox` | Inbox | `/inbox` |
| `admin` | Admin Panel | `/admin`, `/data-quality`, `/export` |

---

## 6. Feature Modules

---

### 6.1 Dashboard (`/`) — menuKey: `home`

**Purpose:** Provide a real-time executive snapshot of business health across projects, sales, and operations.

**Features:**

| Feature | Detail |
|---|---|
| KPI Cards | Total projects, active projects, Won deal count, quotation count, company count |
| Date Filter | Year selector or custom range; instant reset |
| Won Sales Date Logic | Use `actual_close_date`; fallback to `expected_close_date` if null |
| Project Status Pie Chart | Distribution across planning / active / on-hold / completed / cancelled |
| Monthly Revenue Bar Chart | Won deal value by month for selected year |
| Recent Projects | List with status badge and progress % |
| Recent Opportunities | List with stage chip and deal value |

**Data Sources:** `projects`, `sales_opportunities`, `quotations`, `companies`

---

### 6.2 Project Management (`/projects`, `/project/:id`) — menuKey: `projects`

**Purpose:** Full lifecycle project and task management with multi-view visualization, dependency tracking, and AI-assisted planning.

#### Project List (`/projects`)

- CRUD: create, edit, soft-delete projects
- Filter by status; search by project name
- Progress bar: calculated from subtask completion via `sp_calculate_task_progress`
- View project members inline

#### Project Detail — Four Views

| View | Description |
|---|---|
| **Kanban** | Drag tasks across status columns (planning / in progress / done / etc.) |
| **Gantt Chart** | Horizontal timeline with dependency arrows between tasks |
| **Calendar** | Monthly/weekly calendar with tasks plotted by start/end date |
| **Spreadsheet (Table)** | Editable grid view with inline field editing |

#### Task Management

**Task Fields:**

| Field | Type | Notes |
|---|---|---|
| title | VARCHAR | Required |
| description | TEXT | Markdown supported |
| assignee_id | UUID FK | Required |
| priority | ENUM | low / medium / high / urgent |
| start_date | DATE | Required |
| end_date | DATE | Required |
| estimated_hours | DECIMAL | Auto-calculated for multi-day tasks |
| status | ENUM | planning / in_progress / review / completed / cancelled |
| task_type | ENUM | normal / weekend_work / meeting / holiday / leave (compatibility) |
| progress_percentage | INT | 0–100, rolled up from subtasks |

**Hours Calculation Rules:**

| Condition | Behavior |
|---|---|
| `start_date = end_date` (single day) | User-editable field; default = 8h |
| `start_date ≠ end_date` (multi-day) | Auto-calculated: `days_span × 8h`; field is read-only with blue banner |

> **Rationale:** Prevents "blanket task" abuse — a task spanning Mon–Wed is always 24h, not whatever the employee writes.

**Task Types:**

| Type | Use Case |
|---|---|
| `normal` | Standard project work |
| `holiday` | Compatibility value in tasks (official company holiday should be stored in `calendar_events`) |
| `leave` | Compatibility value in tasks (official leave should be stored in `calendar_events`) |
| `weekend_work` | Actual work performed on a swap/weekend day |
| `meeting` | Internal company meeting |

> **Calendar Rule:** company holidays and user leaves use `calendar_events` (`event_type='holiday'|'leave'`) as source-of-truth for capacity calculation.

**Subtasks:** Unlimited hierarchy depth (`parent_task_id` self-reference on `tasks` table)

**Pause / Resume:** Log pause reason and timestamp in `task_history`; prevents phantom "in-progress" tasks

#### Task Dependencies

- Table: `task_dependencies` (task_id, depends_on_task_id, auto_shift_dates)
- Relationship type: Finish-to-Start only
- When `auto_shift_dates=1`: stored procedure `sp_update_dependent_tasks` shifts downstream `end_date` when predecessor is delayed

#### AI Features

| Feature | Description |
|---|---|
| **AI WBS Generator** | Enter project name → AI returns structured task breakdown → one-click import into project |
| **Ad-hoc Impact Simulation** | Add unplanned task → system shows delay ripple across all dependent tasks and same-assignee tasks in other projects |

#### Additional Features

- **Project Members:** Add/remove users from project; controls task assignment dropdown visibility
- **Task History:** Full field-level change audit trail per task (who, what, when)
- **Atomic Task Rule:** Maximum 16 estimated hours per task

---

### 6.3 Timesheet (`/timesheet`) — menuKey: `timesheet`

**Purpose:** Accurate daily hour logging linked to tasks, enabling efficiency ratio calculation and resource cost analysis.

**Features:**

- Log `actual_hours` per task per day (entries, not days)
- Every entry must reference a valid Task ID
- Filter by date range (week / month / custom) and user
- Weekly and monthly hour summaries with totals
- Batch update for multiple entries via `api/timesheet-batch.php`
- Non-admin users see only their own entries; admins see all

**Key Table:** `timesheet_entries`

| Field | Type | Notes |
|---|---|---|
| id | CHAR(36) | UUID PK |
| user_id | CHAR(36) | FK → users |
| task_id | CHAR(36) | FK → tasks, required |
| project_id | CHAR(36) | FK → projects |
| log_date | DATE | The date work was performed |
| actual_hours | DECIMAL(4,2) | Hours logged (e.g. 2.5, 8.0) |
| note | TEXT | Optional work description |

---

### 6.4 Goals & OKR (`/goals`) — menuKey: `goals`

**Purpose:** Structured goal-setting and progress tracking using the OKR framework with four goal types.

**Goal Types:**

| Type | Description |
|---|---|
| **Objective** | Top-level strategic goal (qualitative) |
| **Key Result** | Measurable outcome under an Objective |
| **KPI** | Key performance indicator with numeric target |
| **Milestone** | Binary achievement checkpoint (done/not done) |

**Fields:** title, description, type, parent_goal_id, target_value, current_value, unit (%, ฿, count, etc.), start_date, end_date, status, owner_id

**Status Values:** in_progress / completed / at_risk / paused / cancelled

**Features:**

- Auto progress bar: `(current_value / target_value) × 100`
- Hierarchical tree display: Objective → Key Results → KPIs
- Filter by type, status, owner, date range
- Inline current_value update

---

### 6.5 Budget (`/budget`) — menuKey: `budget`

**Purpose:** Project-level budget planning and variance tracking with category-level breakdown.

**Categories:** labor / materials / equipment / travel / software / general / other

**Item Status:** planned / committed / actual / cancelled

**Features:**

- Create budget items linked to specific projects
- Summary section: total planned vs actual vs committed + variance
- Bar chart: spending breakdown by category
- Pie chart: allocation proportions
- Color-coded variance indicators (over budget = red)

**Key Table:** `budget_items`

| Field | Notes |
|---|---|
| project_id | FK → projects |
| category | ENUM of 7 categories |
| planned_amount | Budget target |
| actual_amount | Actual spend |
| committed_amount | Committed but not yet spent |
| status | planned / committed / actual / cancelled |

---

### 6.6 Automation (`/automation`) — menuKey: `automation`

**Purpose:** No-code workflow automation via trigger-action rules to reduce manual follow-up.

**Rule Structure:** One Trigger Event + one or more Actions

**Trigger Events:**

| Event | Description |
|---|---|
| task_created | New task added to any project |
| task_updated | Any task field changed |
| task_deleted | Task soft-deleted |
| status_changed | Task status changes to specified value |
| priority_changed | Task priority changed |
| assignee_changed | Task reassigned to different user |
| due_date_approaching | N days before end_date (configurable) |
| task_overdue | end_date passed, status not completed |
| subtask_completed | Child task marked complete |
| dependency_resolved | Predecessor task completed |

**Actions (examples):** Send inbox notification, change task status, assign to user, send email alert

**Rule Management:** Enable/disable individual rules; rules stored as JSON conditions + actions

**Key Table:** `automation_rules` (id, name, trigger_event, trigger_conditions JSON, actions JSON, is_active)

---

### 6.7 Recurring Tasks (`/recurring-tasks`) — menuKey: `projects`

**Purpose:** Template-based automatic task generation for repetitive, scheduled work.

**Frequencies:** daily / weekly / biweekly / monthly / quarterly / yearly

**Configuration Options:**

| Option | Description |
|---|---|
| day_of_week | For weekly/biweekly (Mon–Sun) |
| day_of_month | For monthly (1–31) |
| end_date | When recurrence stops |
| due_date_offset | Days after generation date to set as end_date |
| assignee_id | Default assignee for generated tasks |
| project_id | Target project |
| priority | Default priority |
| estimated_hours | Default hours |

**Features:**

- Track instance count (how many tasks have been generated)
- Manual run: create next instance immediately on demand
- Pause/resume template without deleting it

---

### 6.8 Companies & CRM (`/companies`) — menuKey: `companies`

**Purpose:** Customer and company relationship management with AI-powered tiered engagement strategy.

#### Companies

- Fields: name, industry, website, phone, address, tax_id, tier, note
- CRUD + soft delete
- Search by name or branch

#### Contacts / Customers

- Fields: first_name, last_name, email, phone, position, company_id
- Link contacts to parent company
- CRUD per company

#### Customer Tiering (5 Levels)

| Tier | Definition | Strategy |
|---|---|---|
| **Partner** | Very high spend + personal relationship | VIP Care: maximum privileges, personal gifts, deep consultation, exclusive pricing |
| **High-Value Regular** | Consistently high spend + good business relationship | Loyalty: early access, priority queue, discount program, rewards |
| **High Potential** | High buying capacity + relationship being built | Nurturing: regular useful content, visits, meals |
| **Transactional** | Medium spend + normal relationship | Efficiency: fast, reliable, easy ordering system |
| **Low Volume** | Low spend + distant relationship | Automation: self-service, minimal personal time investment |

**80/20 Rule:** Focus primary effort on Partner and High-Value Regular (20% of customers, ~80% of revenue)

#### Customer Activity Tracking

- Activity types: call / email / meeting / visit / dinner / note / proposal
- Log per company or contact with timestamp
- Email tracking stats (from campaigns): `email_sent`, `email_opened`, `email_clicked`

#### AI Tiering Analysis

- Uses RFM model (Recency, Frequency, Monetary) with 12-month lookback
- Data sources: `sales_opportunities` (Won deals), `quotations`, `projects` (value)
- Relationship scoring from `customer_activities` (visit/dinner = high intimacy) and `chat_history`
- Monthly re-evaluation to detect "rising star" (High Potential moving up) and "at-risk" customers

---

### 6.9 Sales Pipeline (`/sales`, `/sales/:id`) — menuKey: `sales`

**Purpose:** Full sales cycle management from lead generation to deal close, with pipeline visualization and team activity tracking.

#### Pipeline Board (`/sales`)

- Kanban columns by stage: **Lead → Qualified → Proposal → Negotiation → Won → Lost**
- Drag-and-drop deal cards between stage columns
- Stage move logic:
  - Moving to **Won** or **Lost**: auto-set `actual_close_date = NOW()`
  - Moving **back** from Won/Lost: clear `actual_close_date`
- Year filter: uses `actual_close_date` for closed deals; fallback `expected_close_date`
- Views: Kanban / Table / List
- Sort: by value (desc), date, or name

#### Deal Management

**Opportunity Fields:**

| Field | Type | Notes |
|---|---|---|
| title | VARCHAR | Deal name |
| company_id | UUID FK | Required |
| owner_id | UUID FK | Assigned salesperson |
| stage | ENUM | lead/qualified/proposal/negotiation/won/lost |
| value | DECIMAL | Expected deal value (฿) |
| expected_close_date | DATE | Forecasted close |
| actual_close_date | DATE | Auto-set on won/lost |
| notes | TEXT | Internal notes |

#### Sales Activities

- Log per-deal interactions: call / email / meeting / note / proposal / follow_up / other
- Fields: type, subject, description, contact_name, occurred_at
- Full activity history timeline per deal

#### Analytics Tab

| Metric | Calculation |
|---|---|
| Stage Funnel | Count of deals per stage as funnel chart |
| Win Rate | `Won / (Won + Lost) × 100` |
| Total Won Value | Sum of value for Won deals in period |
| Active Deals | Count of deals not in Won/Lost |
| Sales Activity Score | Team member activity frequency per company (via `api/sales-activity-eval.php`) |

**Key Tables:** `sales_opportunities`, `sales_activities`, `customer_activities`

---

### 6.10 Quotations (`/quotations`) — menuKey: `quotations`

**Purpose:** Professional quotation creation with automatic sequential numbering and PDF export.

**Auto-Number Format:** `QUO-YYYYMM-NNNN` — sequential counter resets per month

**Quotation Fields:**

| Field | Notes |
|---|---|
| number | Auto-generated `QUO-YYYYMM-NNNN` |
| company_id | FK → companies (required) |
| opportunity_id | FK → sales_opportunities (optional) |
| issue_date | DATE |
| valid_until | DATE — expiry date for customer |
| status | draft / sent / accepted / rejected / cancelled |
| subtotal | Calculated from line items |
| tax_amount | Total tax |
| discount_amount | Global discount |
| total_amount | Final payable amount |

**Line Items (quotation_items):**

| Field | Notes |
|---|---|
| description | Item/service description |
| quantity | Numeric |
| unit_price | Per-unit price (฿) |
| unit | Unit label (ชั่วโมง, ชิ้น, etc.) |
| tax_rate | % tax applied |
| discount | % discount per line |
| line_total | Calculated total for this line |

**Features:** PDF export, link to Opportunity, full status lifecycle

**Key Tables:** `quotations`, `quotation_items`

---

### 6.11 Revenue (`/revenue`) — menuKey: `revenue`

**Purpose:** Multi-dimensional revenue reporting connecting opportunities, projects, and company performance.

**Tabs:**

| Tab | Content |
|---|---|
| **Overview** | Total Won value card, payment status distribution pie chart, monthly revenue bar chart |
| **Projects** | Table: project name, contract value, payment_status (unpaid / partial / paid) |
| **Opportunities** | Table: Won deals with value and actual_close_date |
| **Companies** | Top 10 companies ranked by total revenue contributed |

**Filters:** Year selector, custom date range

**Payment Status Field:** Stored on `projects.payment_status` (unpaid / partial / paid)

---

### 6.12 Helpdesk / Support (`/support`) — menuKey: `support`

**Purpose:** ITIL-aligned ticket management system with SLA enforcement and support contract entitlement validation.

#### Support Tickets

**Creation Channels:** phone / email / walk-in / LINE / system

**Ticket Fields:**

| Field | Notes |
|---|---|
| title | Short issue description |
| description | Full detail |
| type | Incident / Service Request / Problem / Change |
| priority | critical / high / medium / low |
| status | open → in_progress → pending → resolved → closed |
| company_id | FK → companies |
| contact_id | FK → customers (disabled until company selected) |
| assignee_id | FK → users |
| channel | Creation channel |
| sla_due_at | Calculated from creation + SLA hours |
| resolved_at | Timestamp when status set to resolved |

**SLA Definition:**

| Priority | Resolution Target |
|---|---|
| Critical | 2 hours |
| High | 4 hours |
| Medium | 8 hours |
| Low | 24 hours |

**Status Flow:** open → in_progress → pending → resolved → closed

**Features:**
- Internal comments (team-only visibility, `is_internal=true`)
- File attachments via `api/support-upload.php` → stored in `uploads/support/`
- Auto inbox notification sent to assignee on ticket create or transfer
- SLA countdown timer visible on ticket detail

#### Support Contracts

**Contract Types:** Hardware MA / Software MA / Maintenance / Support / Other

**Fields:** company_id, contract_number, type, start_date, end_date, value, notes, status

**Auto-Status Logic:**

| Condition | Status |
|---|---|
| Today between start_date and end_date, > 30 days remaining | active |
| Today between start_date and end_date, ≤ 30 days remaining | expiring |
| Today past end_date | expired |
| Manually cancelled | cancelled |

**Features:**
- Warning banner displayed for expiring contracts on load
- Link contract to ticket for entitlement validation before work begins

#### AI Support Assistant

- Analyzes ticket description + past ticket history + knowledge base articles
- Suggests top 3 probable resolutions with confidence indicators
- Available as collapsible sidebar panel in ticket detail view

**Key Tables:** `support_tickets`, `support_ticket_comments`, `support_contracts`, `support_ticket_files`

---

### 6.13 Knowledge Base (`/knowledge-base`) — menuKey: `support`

**Purpose:** Internal FAQ and documentation repository for the support team and end users.

**Article Fields:**

| Field | Notes |
|---|---|
| title | Article heading |
| content | Markdown-formatted body |
| category | user_accounts / system_settings / usage / general |
| is_starred | Pinned to top of list |
| author_id | FK → users |
| views | View count (auto-incremented on open) |

**Features:**
- Full-text search by title and content
- Star/pin important articles to top of list
- View count tracking per article
- CRUD restricted to admin/support role users

---

### 6.14 Content Management (`/content`) — menuKey: `marketing`

**Purpose:** AI-assisted brand content creation with multi-channel scheduling and publishing.

**Content Item Types:** article / image / video / caption

**Content Item Fields:**

| Field | Notes |
|---|---|
| title | Content piece name |
| type | article / image / video / caption |
| content_body | Main text or prompt |
| platform | Target social/web platform |
| status | draft / scheduled / published |
| channel_id | FK → publish channel |
| scheduled_at | Publish datetime |
| published_at | Actual publish timestamp |

**Brand Context:**
- Upload brand guideline documents (Markdown format)
- Upload SOPs and product information files
- All brand context injected as AI system context during generation

**Content Skills:**
- Reusable AI generation workflows
- Fields: skill_name, system_prompt, steps (JSON array of sequential prompt steps)

**AI Content Generation:**
- Generates: captions, long-form articles, image briefs
- Uses brand context + selected content skill as system prompt
- Model selectable per generation request

**Image Generation:**
- Supports external image generation provider
- Configurable base URL + model ID per admin settings
- Returns image URL inserted into content item

**Publish Channels:**

| Platform | Type |
|---|---|
| WordPress | Blog/CMS |
| Wix | Website builder |
| Facebook | Social |
| LINE OA | Messaging |
| Instagram | Social |
| TikTok | Video social |
| LinkedIn | Professional |
| Twitter/X | Microblog |

**Scheduled Publishing:** Executed via `api/cron-publish.php` (OS cron or manual trigger)

---

### 6.15 Content Planner (`/content-planner`) — menuKey: `marketing`

**Purpose:** Weekly editorial calendar for systematic content planning across platforms.

**Features:**
- 7-day grid view with weekly navigation (previous/next week)
- Per-day, per-platform planning slot: platform, topic, caption, image_brief, status
- AI trigger command to generate a full week's content plan automatically
- Calendar overview: all scheduled content items in one view
- Status per slot: draft / ready / published

---

### 6.16 Email Campaigns (`/campaigns`) — menuKey: `marketing`

**Purpose:** Campaign performance monitoring and management dashboard.

**Campaign Stats per Card:**

| Metric | Description |
|---|---|
| recipients_count | Total recipients in group |
| sent_count | Successfully sent emails |
| opened_count | Unique opens tracked |
| clicked_count | Unique link clicks tracked |
| open_rate | `opened_count / sent_count × 100` |
| click_rate | `clicked_count / sent_count × 100` |

**Status Values:** draft / scheduled / sending / sent / cancelled

**Features:**
- Campaign list with performance metric cards
- Status badge with color coding
- Direct link to `/marketing` to create a new campaign

---

### 6.17 Email Marketing (`/marketing`) — menuKey: `marketing`

**Purpose:** Full email marketing platform — template management, audience segmentation, and campaign delivery with tracking.

**Email Templates:**

| Field | Notes |
|---|---|
| name | Internal template name |
| subject | Email subject line |
| from_name | Display sender name |
| from_email | Sender address |
| html_body | Full HTML email content |
| preview_text | Pre-header preview text |

**Email Groups:** Named audience segments with individual email member entries or links to customer records

**Email Aliases:** Multiple sending identities (display name + email address)

**Campaign Creation Flow:**
1. Select template
2. Select recipient group
3. Select sending alias
4. Choose: send now OR schedule for future datetime

**Event Tracking:**

| Event | Mechanism |
|---|---|
| Open | Transparent 1×1 pixel image via `api/track-open.php` |
| Click | Link replacement + redirect via `api/track-click.php` |

**Webhook:** `api/webhook-email.php` ingests bounce and complaint events from email delivery provider

---

### 6.18 ImpactOS (`/impactos`) — menuKey: `analytics`

**Purpose:** Individual and team KPI performance management system using a weighted 4-axis framework derived from operational data.

#### KPI 4-Axis Framework (P / Q / A / S)

| Axis | Name | Measurement | Formula |
|---|---|---|---|
| **P** | Production | Leaf task actual_hours this period | `min(hours / 160 × 100, 100)` |
| **Q** | Quality / Speed | % tasks completed on or before `end_date` | `(on_time / total_completed) × 100` |
| **A** | AI Adoption | Chat message count normalized by tenant median | `min(count / median × 100, 100)` |
| **S** | Synergy | % tasks in projects with > 1 member | `(team_tasks / total_tasks) × 100` |

**Combined KPI:** `KPI = P×p_weight + Q×q_weight + A×a_weight + S×s_weight`  
Weights come from `kpi_weight_configs` by `users.position`; fallback = 25/25/25/25.

**Leaf Task Rule:** If a task has subtasks → count only subtask hours (not parent). Prevents parent+child double-counting.

#### Departmental Weight Configuration (admin-configurable via Admin → KPI Weights)

| Department | P (Production) | Q (Quality) | A (AI Adoption) | S (Synergy) |
|---|---|---|---|---|
| Development | 40% | 30% | 10% | 20% |
| Sales | 20% | 40% | 20% | 20% |
| Support | 30% | 30% | 10% | 30% |
| Management / Admin | 20% | 20% | 30% | 30% |

> All four weights must sum to 100. Stored in `kpi_weight_configs` table.

#### Grading Scale

| Grade | Score |
|---|---|
| A+ | ≥ 90 |
| A  | ≥ 80 |
| B+ | ≥ 70 |
| B  | ≥ 60 |
| C  | ≥ 50 |
| D  | < 50 |

#### 11 Dashboard Tabs

| Tab | View param | Content |
|---|---|---|
| CEO Overview | `ceo` | High-level KPI summary across all users |
| Overview | `overview` | Period KPI per user with grade |
| Departments | `departments` | Aggregated KPI by department |
| KPI Ranking | `leaderboard` | Ranked leaderboard with revenue contribution |
| Dev | `dev` | Development team detailed breakdown |
| Sales | `sales` | Sales team with deal/revenue metrics |
| Support | `support` | Support team with ticket/SLA metrics |
| Quality | `quality` | On-time delivery + interrupted task ("defect") rate |
| Customer | `customer` | Customer-facing performance metrics |
| AI Analysis | `ai_analysis` | Per-user AI-generated narrative (requires AI provider) |
| AI Insights | *(ai-insights.php)* | System-wide AI-generated insights |
| Benchmark | *(benchmark.php)* | Company metrics vs industry reference values |

#### Benchmark Reference Values

| Metric | Reference | Source |
|---|---|---|
| On-time delivery | 75% | PM industry standard |
| SLA compliance | 85% | ITIL framework |
| Project completion | 70% | PMI benchmark |
| Avg ticket resolution | 12h | Help Desk Institute |
| Email open rate | 22% | Mailchimp industry data |
| Sales win rate | 30% | HubSpot B2B benchmark |

#### AI Analysis (per-user)

Requires AI provider configured in Admin → AI Settings. Uses `company_settings.ai_analyst_model_id` (fallback: `openai/gpt-4o-mini`). Returns JSON: `{ summary, strengths[], weaknesses[], recommendations[] }`.

#### Quality Dashboard Notes

"Defect Rate" measures tasks with `paused_at IS NOT NULL` — a proxy for work interruption rate, not traditional rework/QA defects.

#### Ad-hoc Task Management

Adding an ad-hoc task via `InsertAdHocTaskDialog` triggers instant Impact Simulation: shows count of affected tasks and projects before saving. Stored with `task_type='ad_hoc'` and dependency reason code.

---

### 6.19 Analytics (`/analytics`) — menuKey: `analytics`

**Purpose:** Data exploration and CSV export across all major business entities.

**Overview Cards:** Projects count, tasks count, opportunities count, quotations count, companies count, total logged hours

**Chart Types:** Bar (trends over time), Line (time series), Pie (distribution/proportion)

**Dimensions Available:**
- Projects: by status, by month created
- Tasks: by priority, by assignee, by completion rate
- Opportunities: by stage, by value range
- Quotations: by status, by month
- Timesheet: by user, by project, by week

**Filter:** Year selector

**CSV Export (direct download):**

| Export | Content |
|---|---|
| Projects | All project fields |
| Tasks | All task fields including progress |
| Opportunities | All deal fields |
| Quotations | Header fields (not line items) |
| Timesheet | Entries with task and user |

---

### 6.20 Reports (`/reports`) — menuKey: `reports`

**Purpose:** Operational reports for resource planning and delivery performance analysis.

#### Report 1: Resource Workload

- Matrix: user × week → `actual_hours` vs `estimated_hours`
- Color coding: over-capacity (red), near-optimal (amber), healthy (green), underutilized (gray)
- Helps identify over-allocated team members before escalation

#### Report 2: Project Profitability

- Table: project → total budget_hours vs actual_hours → variance (hours and %)
- Shows which projects consumed more/less time than planned

#### Report 3: SLA Report

- Metrics: total tickets, resolved on-time, SLA breached, resolution rate
- Breakdown by priority level (critical / high / medium / low)
- Time period filter (week / month / quarter)

---

### 6.21 Admin Panel (`/admin`) — menuKey: `admin`

**Purpose:** Centralized system administration — users, roles, configuration, and monitoring.

#### User Management

| Action | Details |
|---|---|
| Create user | name, email, password, role, department, is_admin flag |
| Edit user | All fields except password (separate reset flow) |
| Disable account | Set `is_active=0` — blocks login immediately |
| Reset password | Admin sets new password for user |

#### Role Management

- Create/edit named roles
- Per-role: toggle access ON/OFF for each menu key
- Assign roles to users

#### Admin Task View

- Displays ALL tasks system-wide (bypasses ownership filter)
- Subtask tree: expandable hierarchy
- Inline status toggle, edit fields, soft-delete

#### Admin Overview

| Stat | Source |
|---|---|
| Total users | `users WHERE is_active=1` |
| Total projects | `projects WHERE deleted_at IS NULL` |
| Total tasks | `tasks WHERE deleted_at IS NULL` |
| Open tickets | `support_tickets WHERE status IN ('open','in_progress','pending')` |

#### System Settings

**SMTP Configuration:**

| Setting | Notes |
|---|---|
| host | SMTP server hostname |
| port | 465 / 587 |
| encryption | TLS / SSL |
| username | Auth username |
| password | Auth password (stored encrypted) |
| from_name | Display name for outgoing mail |
| from_email | Sender email address |

**AI Provider Configuration:**

| Field | Notes |
|---|---|
| name | Provider display name |
| type | openai-compatible / anthropic / groq |
| base_url | API endpoint URL |
| api_key | Write-only; never returned to frontend |

**AI Model Catalog:**
- 100+ pre-loaded models from: OpenAI, Anthropic, Google, Meta, DeepSeek, Mistral, Qwen, and others
- Capability flags: `supports_vision`, `supports_streaming`, `supports_function_calling`, `supports_tool_calling`
- Pricing: `input_price_per_1k`, `output_price_per_1k` (USD per 1,000 tokens)

#### Activity Logs

Full audit trail of system actions:

| Field | Notes |
|---|---|
| user_id | Who performed the action |
| action | create / update / delete / login / etc. |
| entity_type | Table name (tasks, projects, tickets, etc.) |
| entity_id | UUID of affected record |
| old_value | Previous state (JSON) |
| new_value | New state (JSON) |
| ip_address | Client IP |
| created_at | UTC timestamp |

Filter: by user, action type, entity type, date range

---

### 6.22 Data Quality (`/data-quality`) — menuKey: `admin`

**Purpose:** Automated data completeness and integrity monitoring.

**Checks Performed:**

| Check | Severity |
|---|---|
| Projects without start/end dates | High |
| Tasks without assignees | High |
| Tasks without estimated_hours | Medium |
| Companies without any contacts | Medium |
| Opportunities without expected_close_date | Medium |
| Timesheet entries without task link | High |
| Support tickets without company | High |

**Display:** Issue list grouped by entity type, with severity badge, affected record count, and link to filter that entity list

---

### 6.23 Data Export (`/export`) — menuKey: `admin`

**Purpose:** Bulk data export for reporting, backups, and external analysis tools.

**Supported Entities:** Companies, Customers (contacts), Projects, Tasks, Subtasks, Sales Opportunities

**Formats:** CSV, JSON

**Delivery:** Direct browser download — no email, no cloud storage

---

### 6.24 Inbox (`/inbox`) — menuKey: `inbox`

**Purpose:** Internal notification center for task assignments, ticket transfers, and system-generated alerts.

**Message Types:** ticket / message / notification / email

**Priority Levels:** low / medium / high / critical

**Features:**

| Feature | Detail |
|---|---|
| Auto mark-as-read | Triggered when message is opened |
| Star / pin | Toggle important messages to top |
| Delete | Permanent remove from inbox |
| Unread badge | Count shown in sidebar navigation header |
| Filter | All / Unread / Starred |

**Automatic Notification Triggers:**

| Trigger | Recipient |
|---|---|
| Task assigned to user | Assignee |
| Support ticket created and assigned | Assignee |
| Support ticket transferred | New assignee |
| System alerts | Configured recipients |

**Key Table:** `inbox_messages`

| Field | Notes |
|---|---|
| user_id | FK → users (recipient) |
| type | ticket / message / notification / email |
| priority | low / medium / high / critical |
| subject | Short subject line |
| body | Full message content |
| is_read | Boolean — auto-set true on open |
| is_starred | Boolean — user toggle |
| related_entity_type | e.g. "tasks", "support_tickets" |
| related_entity_id | UUID of linked record |

---

### 6.25 User Profile (`/profile`)

**Purpose:** Personal account settings and application preferences.

**Features:**

| Feature | Detail |
|---|---|
| Edit identity | full_name, job_title, email |
| Upload avatar | Image file stored and served from uploads |
| Change password | Requires current password for verification |
| Theme preference | Light / Dark — persisted per user |

---

### 6.26 Global Search

**Purpose:** Cross-entity instant search accessible from anywhere in the application.

**Searchable Entities:** Projects, Tasks, Companies, Sales Opportunities

**Access Methods:**
- Keyboard shortcut: `Cmd+K` / `Ctrl+K`
- Search button in sidebar navigation

**Behavior:**
- Results grouped by entity type
- Instant results as user types (debounced)
- Click any result to navigate directly to that record

---

### 6.27 Surveys (`/surveys`) — menuKey: `sales`

**Purpose:** Customer satisfaction and feedback collection via shareable, publicly accessible survey links.

**Survey Templates:**

| Field | Notes |
|---|---|
| title | Survey display name |
| description | Introduction text shown to respondent |
| questions | JSON array of question objects |

**Question Types:** multiple_choice / rating (1–5 or 1–10) / text (free-form)

**Scoring:** Weighted points per answer choice; total score computed per response

**Survey Distribution:**

- Generate unique public token per send (UUID-based)
- Public URL: `/survey/public/:token` — no login required
- Link visible in customer / deal timeline

**Response Tracking:**

| Feature | Detail |
|---|---|
| Respondent info | Name, email, company (collected in form) |
| Per-question answers | Stored in `survey_response_items` |
| Score calculation | Computed via `api/survey-scoring.php` |
| Response dashboard | View all responses per survey template |
| Export | Download response data |

**Key Tables:** `survey_templates`, `survey_questions`, `survey_responses`, `survey_response_items`

---

### 6.28 AI Provider Management

**Purpose:** Centralized configuration for all AI capabilities used throughout the platform.

**Provider Configuration:**

| Field | Notes |
|---|---|
| name | Display name (e.g. "OpenAI", "Local Ollama") |
| type | openai-compatible / anthropic / groq |
| base_url | API endpoint (default or custom/self-hosted) |
| api_key | Encrypted at rest; write-only from frontend |

**Model Registry:**

- 100+ pre-loaded models from: OpenAI, Anthropic, Google Gemini, Meta Llama, DeepSeek, Mistral, Qwen, AllenAI, and others
- Admin can add custom models
- Fields: `model_id`, `name`, `context_window`, `max_output_tokens`, `input_price_per_1k`, `output_price_per_1k`, capability flags

**Per-Feature Model Assignment:**

| Feature | Selectable in Admin |
|---|---|
| WBS Generation | Yes |
| Content Generation | Yes |
| AI Insights / ImpactOS | Yes |
| Support Ticket Analysis | Yes |
| Image Generation | Yes (separate image provider config) |

**Global Instructions:**
- System-level prompt prefix applied to all AI content generation requests
- Configurable from Admin → System Settings → AI Settings

---

## 7. Business Rules & Constraints

### Task Management Rules

| # | Rule |
|---|---|
| 1 | **Atomicity:** No task may exceed 16 estimated hours (2 working days). Long tasks must be split into per-activity subtasks. |
| 2 | **No Blanket Support Tasks:** Tasks named "Support รายเดือน" or similar are prohibited. Each support case must be 1 task. |
| 3 | **Multi-Day Hours:** `estimated_hours = days_span × 8`. Auto-calculated and read-only on the UI. |
| 4 | **Single-Day Hours:** User-editable; default = 8h. |
| 5 | **task_type Values:** `normal` \| `weekend_work` \| `meeting` (primary) + `holiday` \| `leave` (compatibility) |
| 6 | **Internal Project:** Use "KTN Operations [Year]" for non-client work only. No duplicate project names allowed. |

### Timesheet Rules

| # | Rule |
|---|---|
| 7 | All time entries are in hours (`actual_hours`), never in days. |
| 8 | Every timesheet entry must reference a valid Task ID. |
| 9 | Non-admin users can only view and edit their own entries. |

### Sales Rules

| # | Rule |
|---|---|
| 10 | Quotation number format: `QUO-YYYYMM-NNNN` — sequential counter resets per calendar month. |
| 11 | Sales stage order: `lead` → `qualified` → `proposal` → `negotiation` → `won` / `lost` |
| 12 | `actual_close_date` is auto-set when stage changes to `won` or `lost`; cleared when moved back. |
| 13 | Revenue date filtering uses `actual_close_date`; fallback to `expected_close_date` when null. |

### Support Rules

| # | Rule |
|---|---|
| 14 | SLA times from ticket creation: critical=2h, high=4h, medium=8h, low=24h. |
| 15 | Support contract status auto-checked on page load; warning displayed at < 30 days to expiry. |
| 16 | Customer contact dropdown is disabled until a company is selected on the ticket form. |

### Performance & Accountability Rules

| # | Rule |
|---|---|
| 17 | Tasks with no status change for 3+ consecutive business days are automatically marked `stagnant`. |
| 18 | Any issue report must include a "Proposed Solution" field — problem-only reports are not accepted. |
| 19 | Ad-hoc (unplanned) tasks must be inserted via the designated "Add Ad-hoc Task" dialog to auto-log impact evidence. |

### CRM Rules

| # | Rule |
|---|---|
| 20 | Customer tiers: Partner > High-Value Regular > High Potential > Transactional > Low Volume |
| 21 | AI re-evaluates customer tier monthly using 12-month RFM data. |

### Authorization Rules

| # | Rule |
|---|---|
| 22 | Users with `is_admin=1` bypass all menu permission checks. |
| 23 | Users with `is_active=0` cannot log in regardless of role. |
| 24 | All data entities are scoped by `tenant_id` for multi-tenancy isolation. |

---

## 8. Non-Functional Requirements

### Performance

| Requirement | Target |
|---|---|
| React Query staleTime | 5 minutes |
| React Query gcTime | 10 minutes |
| API list queries | < 500ms response |
| API simple lookups | < 200ms response |
| Initial page load (LAN) | < 3 seconds |
| `refetchOnWindowFocus` | Disabled (better UX on tab switching) |

### Security

| Requirement | Implementation |
|---|---|
| JWT validation | Server-side on every protected request via `requireAuth()` |
| AI API key protection | Write-only; never returned in API responses |
| File upload validation | MIME type + file size checked before accepting |
| SQL injection prevention | PDO prepared statements throughout all PHP endpoints |
| Password storage | bcrypt hash — never stored plaintext |
| OWASP Top 10 | Addressed via prepared statements, JWT, input validation, HTTPS |

### Reliability

| Requirement | Implementation |
|---|---|
| Soft deletes | All major entities have `deleted_at`; no hard deletes in normal operation |
| Data consistency | Stored procedures for progress and date-shift calculations |
| Timezone handling | Timestamps stored in UTC; displayed in Asia/Bangkok (UTC+7) |
| Retry on failure | React Query `retry: 1` for failed requests |

### Usability

| Requirement | Detail |
|---|---|
| Language | All UI text in Thai (ภาษาไทย) throughout the frontend |
| Responsive design | Tailwind CSS breakpoints (mobile → tablet → desktop) |
| Theme | Light/dark mode toggle per user preference |
| Accessibility | Keyboard navigation via Radix UI primitives (shadcn-ui) |
| Global search | Available from any page via `Ctrl+K` / `Cmd+K` |

### Maintainability

| Requirement | Rule |
|---|---|
| No magic | Explicit, readable code; no hidden side effects |
| Schema migrations | Any DB schema change creates a migration file in `database/migrations/` named by `YYYYMMDD_HHMMSS_description.sql` |
| PHP API structure | One file per resource; HTTP verb dispatch pattern |
| Frontend components | shadcn-ui primitives from `src/components/ui/` only (do not modify) |
| Type safety | TypeScript strict mode throughout frontend |

### Current Infrastructure Constraints

| Constraint | Note |
|---|---|
| Database | Single MariaDB instance (XAMPP) — no read replicas |
| File storage | Local filesystem — no CDN or object storage |
| Cron jobs | Manual trigger or OS task scheduler against `api/cron-publish.php` |
| Deployment | XAMPP on Windows — not containerized |

---

## 9. Data Model Summary

### Core Tables

| Table | Purpose | Key Fields |
|---|---|---|
| `users` | User accounts | id, name, email, password_hash, role_id, department, is_admin, is_active, avatar |
| `roles` | Permission roles | id, name |
| `role_menu_permissions` | Menu access per role | role_id, menu_key, can_access |
| `companies` | Customer companies | id, name, industry, website, tier, tax_id, deleted_at |
| `customers` | Company contacts | id, company_id, first_name, last_name, email, phone, position |
| `customer_activities` | CRM interaction log | id, company_id, customer_id, type, subject, description, occurred_at |
| `projects` | Projects | id, title, status, start_date, end_date, payment_status, progress_percentage, deleted_at |
| `project_members` | Project team roster | project_id, user_id, role |
| `tasks` | Tasks & subtasks | id, project_id, parent_task_id, title, status, priority, task_type, assignee_id, start_date, end_date, estimated_hours, original_end_date, auto_shifted, progress_percentage, deleted_at |
| `task_dependencies` | Task relationships | task_id, depends_on_task_id, auto_shift_dates, deleted_at |
| `task_history` | Task change audit | task_id, field_name, old_value, new_value, changed_by, created_at |
| `timesheet_entries` | Hour logs | id, user_id, task_id, project_id, log_date, actual_hours, note |
| `sales_opportunities` | Sales deals/leads | id, title, company_id, owner_id, stage, value, expected_close_date, actual_close_date, deleted_at |
| `sales_activities` | Deal interaction log | id, opportunity_id, user_id, type, subject, description, occurred_at |
| `quotations` | Quotation headers | id, number, company_id, opportunity_id, status, subtotal, tax_amount, discount_amount, total_amount, issue_date, valid_until |
| `quotation_items` | Quotation line items | id, quotation_id, description, quantity, unit_price, unit, tax_rate, discount, line_total |
| `support_tickets` | Help desk tickets | id, title, type, priority, status, company_id, contact_id, assignee_id, channel, sla_due_at, resolved_at |
| `support_ticket_comments` | Ticket notes | id, ticket_id, user_id, body, is_internal, created_at |
| `support_ticket_files` | Ticket attachments | id, ticket_id, filename, filepath, file_size, mime_type |
| `support_contracts` | MA / support contracts | id, company_id, contract_number, type, start_date, end_date, value, status |
| `budget_items` | Budget line items | id, project_id, category, description, planned_amount, actual_amount, committed_amount, status |
| `goals` | OKR / KPI goals | id, title, type, parent_goal_id, target_value, current_value, unit, start_date, end_date, status, owner_id |
| `automation_rules` | Workflow automation | id, name, trigger_event, trigger_conditions (JSON), actions (JSON), is_active |
| `recurring_tasks` | Recurring templates | id, template_name, project_id, frequency, config (JSON), next_run_at, instance_count, is_active |
| `inbox_messages` | Notifications | id, user_id, type, priority, subject, body, is_read, is_starred, related_entity_type, related_entity_id |
| `ai_providers` | AI service config | id, name, type, base_url, api_key (encrypted) |
| `ai_models` | AI model registry | id, provider_id, model_id, name, context_window, max_output_tokens, input_price_per_1k, output_price_per_1k, capability flags, status |
| `email_campaigns` | Email campaigns | id, name, template_id, group_id, alias_id, status, scheduled_at, sent_at, stats |
| `email_templates` | Email HTML templates | id, name, subject, from_name, from_email, html_body, preview_text |
| `email_groups` | Recipient groups | id, name |
| `email_aliases` | Sending identities | id, display_name, email |
| `content_items` | Content pieces | id, title, type, content_body, platform, status, channel_id, scheduled_at, published_at |
| `survey_templates` | Survey forms | id, title, description, questions (JSON), created_by |
| `survey_responses` | Survey submissions | id, survey_id, token, respondent_info (JSON), score, submitted_at |
| `survey_response_items` | Per-question answers | id, response_id, question_id, answer, points |
| `user_activity_logs` | System audit trail | id, user_id, action, entity_type, entity_id, old_value (JSON), new_value (JSON), ip_address, created_at |

---

## 10. API Endpoint Reference

All endpoints are under the `/api/` directory. Authentication required via `Authorization: Bearer {JWT}` header (except `/api/survey-public.php` and `/api/auth.php`).

| Endpoint | Methods | Purpose |
|---|---|---|
| `auth.php` | POST | Login, logout, token validation |
| `profile.php` | GET, PUT | Current user profile |
| `users.php` | GET, POST, PUT, DELETE | User CRUD (admin) |
| `roles.php` | GET, POST, PUT, DELETE | Role and permission management |
| `projects.php` | GET, POST, PUT, DELETE | Project CRUD |
| `project-members.php` | GET, POST, DELETE | Project team management |
| `tasks.php` | GET, POST, PUT, DELETE | Task CRUD + status change |
| `subtasks.php` | GET, POST, PUT, DELETE | Subtask operations |
| `task-dependencies.php` | GET, POST, DELETE | Task dependency management |
| `task-history.php` | GET | Task field change log |
| `timesheet.php` | GET, POST, PUT, DELETE | Timesheet entry CRUD |
| `timesheet-batch.php` | POST | Bulk timesheet update |
| `recurring-tasks.php` | GET, POST, PUT, DELETE | Recurring task templates; POST `?action=run` to generate |
| `goals.php` | GET, POST, PUT, DELETE | OKR goal CRUD |
| `budget.php` | GET, POST, PUT, DELETE | Budget item CRUD |
| `automation.php` | GET, POST, PUT, DELETE | Automation rule CRUD |
| `automation-fire.php` | POST | Manually fire an automation rule |
| `companies.php` | GET, POST, PUT, DELETE | Company CRUD |
| `contacts.php` | GET, POST, PUT, DELETE | Contact / customer CRUD |
| `customers.php` | GET, POST, PUT, DELETE | Customer management |
| `customer-activities.php` | GET, POST, DELETE | CRM activity log |
| `customer-email-stats.php` | GET | Email tracking stats per customer |
| `company-enrich.php` | POST | AI-powered company data enrichment |
| `company-lookup.php` | GET | Company search / lookup by name |
| `opportunities.php` | GET, POST, PUT, DELETE | Sales opportunity CRUD |
| `opportunity-members.php` | GET, POST, DELETE | Deal team members |
| `sales-activities.php` | GET, POST, PUT, DELETE | Sales activity log |
| `sales-activity-eval.php` | GET | Team sales activity scoring |
| `quotations.php` | GET, POST, PUT, DELETE | Quotation CRUD |
| `next-quotation-number.php` | GET | Generate next QUO-YYYYMM-NNNN number |
| `support-tickets.php` | GET, POST, PUT, DELETE | Ticket CRUD; POST `?action=comment` for internal notes |
| `support-contracts.php` | GET, POST, PUT, DELETE | Support contract CRUD |
| `support-upload.php` | POST | Upload file attachment to ticket |
| `knowledge-base.php` | GET, POST, PUT, DELETE | Knowledge base article CRUD |
| `inbox.php` | GET, PUT, DELETE | Inbox message management |
| `content-items.php` | GET, POST, PUT, DELETE | Content item CRUD |
| `brand-content.php` | GET, POST, PUT | Brand context document management |
| `content-to-campaign.php` | POST | Publish content item to a channel |
| `cron-publish.php` | POST | Trigger scheduled content publishing |
| `email-campaigns.php` | GET, POST, PUT, DELETE | Email campaign CRUD |
| `email-groups.php` | GET, POST, PUT, DELETE | Recipient group management |
| `email-aliases.php` | GET, POST, PUT, DELETE | Sending alias management |
| `mail-settings.php` | GET, PUT | SMTP configuration |
| `track-open.php` | GET | Email open pixel tracker (public) |
| `track-click.php` | GET | Email click redirect tracker (public) |
| `webhook-email.php` | POST | Inbound email event webhook |
| `surveys.php` | GET, POST, PUT, DELETE | Survey template CRUD |
| `survey-responses.php` | GET, POST | Survey response management |
| `survey-scoring.php` | GET | Calculate/retrieve response scores |
| `survey-public.php` | GET, POST | Public survey form (no auth required) |
| `impactos.php` | GET | KPI scores + cross-project impact analysis |
| `ai-providers.php` | GET, POST, PUT, DELETE | AI provider configuration |
| `ai-models.php` | GET, POST, PUT, DELETE | AI model registry |
| `ai-settings.php` | GET, PUT | Global AI settings (default model, instructions) |
| `ai-insights.php` | POST | Submit query for AI analysis |
| `chat.php` | GET, POST | AI chat session messages |
| `chat-history.php` | GET, DELETE | Chat history management |
| `admin-overview.php` | GET | Admin dashboard system statistics |
| `activity-logs.php` | GET | System-wide audit log |
| `settings.php` | GET, PUT | General application settings |
| `export.php` | GET | Data export — CSV or JSON |
| `backup.php` | POST | Trigger database backup |
| `import.php` | POST | Import data from CSV/JSON |
| `data-quality-stats.php` | GET | Data completeness check results |
| `custom-fields.php` | GET, POST, PUT, DELETE | Custom field definitions |
| `upload.php` | POST | General purpose file upload |
| `query.php` | POST | Admin direct SQL query runner |

---

*This document reflects the system as of **May 11, 2026**.*  
*Source of truth: codebase at `c:\xampp\htdocs\flowstack`*  
*Key files: `database/schema.sql`, `src/App.tsx`, `docs/features.md`, `api/*.php`*

*Update this document whenever a new module is added or an existing module changes significantly.*
