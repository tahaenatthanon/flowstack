# Task Intelligence — Design Spec
Date: 2026-05-14

## Overview

A new `/task-intelligence` page with 3 tabs: Assessment, Data Quality, and Validation Rules. Solves two problems: (1) no task evaluation report for analysis, and (2) duplicate/messy data entry across projects. Also includes a Team Calendar migration tool to consolidate fragmented internal projects (e.g., KTN Meeting/Research/Internal Routine) into the existing `base_calendar` project.

Must not conflict with existing schema for `tasks`, `projects`, or `timesheet_entries`.

---

## Architecture

### New Page
- Route: `/task-intelligence`
- Menu key: `task_intelligence` (add to `ALL_MENU_KEYS` in `api/auth.php` and `NAV_GROUPS` in `AppSidebar.tsx`)
- Permission: Admin sees all projects/users; PM sees only projects where `manager_id = user_id`

### New API Endpoints
```
api/task-intelligence.php
  GET ?action=assessment&project_id=&user_id=&date_from=&date_to=
  GET ?action=duplicates&project_id=
  GET ?action=quality&project_id=
  GET ?action=migrate_preview&project_ids=   (Admin only)
  POST ?action=migrate                        (Admin only)

api/validation-rules.php
  GET                  → list rules
  POST                 → create rule
  PUT ?id=             → update rule
  DELETE ?id=          → delete rule
```

### New Database Table
```sql
CREATE TABLE task_validation_rules (
  id           CHAR(36) PRIMARY KEY,
  tenant_id    CHAR(36) NOT NULL,
  rule_type    ENUM('warn','block') NOT NULL,
  condition_field    VARCHAR(64) NOT NULL,
  condition_operator VARCHAR(16) NOT NULL,  -- eq, gt, lt, gte, lte, duplicate
  condition_value    VARCHAR(255),
  message_th   VARCHAR(512) NOT NULL,
  is_active    TINYINT(1) DEFAULT 1,
  created_by   CHAR(36),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

Migration file: `database/migrations/2026_05_14_000000_create_task_validation_rules.sql`

### Validation Integration
Rules fire inside `api/tasks.php` on POST and PUT — before INSERT/UPDATE. Response on violation:
- `warn`: `{ "warning": "...", "data": {...} }` — client shows toast, allows save
- `block`: `jsonError('message', 422)` — client shows error, blocks save

---

## Tab 1: Assessment (ประเมินผล)

**Filters:** project (dropdown), assignee (dropdown), date range  
**PM restriction:** project dropdown limited to projects where `manager_id = current_user_id`

| Metric | Calculation |
|--------|-------------|
| % tasks เสร็จตรงเวลา | COUNT(completed_date ≤ end_date) / COUNT(completed) |
| % tasks ล่าช้า | COUNT(end_date < TODAY AND status ≠ completed) / COUNT(all active) |
| Avg hours deviation | AVG((actual_hours - estimated_hours) / estimated_hours) — excludes tasks with estimated_hours = 0 |
| Workload per person | SUM(actual_hours) GROUP BY assignee_user_id, joined to users.name |
| Task velocity | COUNT(completed) per week, rolling 4 weeks |

Display: summary cards at top, bar chart for workload, line chart for velocity, table for task-level drill-down.

---

## Tab 2: Data Quality (คุณภาพข้อมูล)

Four detection categories, each shown as a collapsible section with count badge:

### 1. Duplicates
- Match: same `title` (fuzzy ≥ 80% similarity via PHP similar_text), same `assignee_user_id`, overlapping date range (`start_date`/`end_date`)
- Scope: across all projects in tenant (not just within one project)
- Action: link to each task for manual review

### 2. Missing Fields
Tasks missing any of: `estimated_hours`, `assignee_user_id`, `end_date`  
Excludes compatibility task_type: holiday, leave (official holiday/leave records are in `calendar_events`)

### 3. Hour Anomalies
- `actual_hours > 16` on a single task
- SUM(actual_hours) > 24 per person per day (across all tasks/timesheet entries)

### 4. Zombie Tasks
- `status = in-progress` AND no `task_history` record in last 14 days AND `end_date < TODAY - 3`

**Per-item actions:** "ไปแก้ไข" button → opens task in project context

### Project Consolidation Tool (Admin only)
- Detects projects with same name prefix (e.g., "KTN ") belonging to same tenant
- Shows grouped list with task counts
- "Merge into Team Calendar" button → confirmation dialog showing what will move
- On confirm: runs migration (see Migration section)

---

## Tab 3: Validation Rules (Admin only)

Table of rules with toggle (active/inactive), type badge (warn/block), condition, and message.

Default rules seeded on migration:

| Condition | Type | Message (TH) |
|-----------|------|--------------|
| title duplicate in same project + assignee + date overlap | warn | "พบ task ที่อาจซ้ำกัน กรุณาตรวจสอบ" |
| actual_hours > 16 | block | "ไม่สามารถบันทึกชั่วโมงเกิน 16 ชั่วโมงต่อ task" |
| SUM daily hours > 24 per user | block | "ชั่วโมงรวมของวันนี้เกิน 24 ชั่วโมง" |
| assignee_user_id is null | warn | "task ยังไม่มีผู้รับผิดชอบ" |
| estimated_hours is null | warn | "task ยังไม่มีชั่วโมงประมาณ" |
| end_date < start_date | block | "วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น" |

Admin can add custom rules, toggle any rule, or change warn↔block. Cannot delete seeded rules (is_system flag).

---

## Team Calendar Migration

**Trigger:** "Merge into Team Calendar" in Data Quality tab (Admin only)

**Steps (atomic transaction):**
1. Identify `base_calendar` project for tenant (`kind = 'base_calendar'`)
2. Fetch all tasks from selected projects (non-deleted)
3. Map task_type per source project:
   - `*Meeting*` → keep as `meeting`
   - `*Research*` → keep as `research`
   - `*Routine*` / `*Internal*` → set to `task`
4. `UPDATE tasks SET project_id = [base_calendar_id]` for all matched tasks
5. Subtasks, goal_tasks, task_dependencies, budget_items follow via task_id — no change needed
6. Log each moved task in `task_history` (action='migrated', field='project_id', old_value, new_value)
7. Soft-delete source projects (`SET deleted_at = NOW()`)

**Rollback:** Not automatic — migration is logged in task_history so Admin can manually revert if needed. Soft-delete means projects are recoverable.

---

## Permission Summary

| Feature | Admin | PM | Member |
|---------|-------|----|--------|
| Assessment (all projects) | ✅ | ❌ | ❌ |
| Assessment (own projects) | ✅ | ✅ | ❌ |
| Data Quality view | ✅ | ✅ (own) | ❌ |
| Project Consolidation tool | ✅ | ❌ | ❌ |
| Validation Rules management | ✅ | ❌ | ❌ |
| Validation warnings/blocks (on save) | ✅ | ✅ | ✅ |

---

## What Is Not Changing

- Schema of `tasks`, `projects`, `timesheet_entries` — read-only from this feature
- Existing `data-quality-stats.php` — remains as-is, not replaced
- Existing Reports, Analytics, Timesheet pages — no changes
- `base_calendar` protection (`is_protected=1`) — migration only adds tasks, does not modify project metadata

---

## Files to Create / Modify

| Action | File |
|--------|------|
| CREATE | `api/task-intelligence.php` |
| CREATE | `api/validation-rules.php` |
| CREATE | `src/pages/TaskIntelligencePage.tsx` |
| CREATE | `database/migrations/2026_05_14_000000_create_task_validation_rules.sql` |
| MODIFY | `api/tasks.php` — add validation rule check on POST/PUT |
| MODIFY | `api/auth.php` — add `task_intelligence` to ALL_MENU_KEYS |
| MODIFY | `src/App.tsx` — add route |
| MODIFY | `src/components/AppSidebar.tsx` — add menu item |
