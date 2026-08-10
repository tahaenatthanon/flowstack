# Database Analysis Report - FlowStack

## Executive Summary

The Flowstack database has undergone significant improvements to support enterprise-grade project management. This report tracks the status of structural recommendations.

## 📊 Implementation Status (As of June 9, 2026)

| Recommendation | Status | Implementation Detail |
| :--- | :--- | :--- |
| **UUID Primary Keys** | ✅ Complete | All tables use `CHAR(36)` for IDs. |
| **Soft Deletes** | ✅ Complete | `deleted_at` field added to `projects`, `tasks`, `users`, etc. |
| **Project Progress Tracking** | ✅ Complete | `progress_percentage` in `tasks` — hours-weighted (SUM completed_hours / SUM total_hours). |
| **Timesheet Integration** | ✅ Complete | Hour logging uses `tasks` with `is_subtask=1`. No separate timesheet table. |
| **Resource Workload** | ✅ Complete | `capacity.php` API handles per-user capacity with schedule + holiday + leave + override. |
| **Audit Fields** | ✅ Complete | `created_at` and `updated_at` timestamps present on major tables. |
| **Foreign Keys** | ⚠️ Partial | Many relationships exist via logic but lack formal `FOREIGN KEY` constraints in SQL. |
| **Indexing** | ⚠️ Ongoing | Basic indexes present; performance optimization needed for large datasets. |
| **KPI Weight Config** | ✅ Complete | `kpi_weight_configs` table stores P/Q/A/S weights per department. |
| **Calendar Overrides** | ✅ Complete | `calendar_overrides` stores per-user exceptions — override_work now applies leave deduction. |
| **Content Plan Items** | ✅ Complete | `content_plan_items` manages the content planner calendar items. |
| **Custom Fields** | ✅ Complete | `custom_fields` and `custom_field_values` for per-entity extensible metadata. |
| **Campaign Analytics** | ✅ Complete | `campaign_analytics` tracks email campaign open/click/bounce metrics. |
| **Agent API Keys** | ✅ Complete | `agent_api_keys` for external agent token management. |
| **Tenant Timezone** | ✅ Complete | `company_settings.timezone` (IANA, default `Asia/Bangkok`) — used by `capacity.php`. |
| **Work Schedules** | ✅ Complete | `work_schedules` + `work_schedule_days` + `user_work_schedules` for per-user schedule. |

## 🛠️ Critical Schema Areas

### 1. Unified Task & Timesheet System
The system uses a recursive `tasks` table for both project tasks and hour logging.
- `parent_task_id`: Links subtasks to their parent work item (WBS tree).
- `is_subtask`: Flag (1 = hour-log entry, 0 = WBS task).
- `actual_hours`: Time spent. Parent auto-rolled-up from children via `recalcTaskHoursFromChildrenUnified()`.
- `progress_percentage`: Hours-weighted completion — `SUM(completed estimated_hours) / SUM(all estimated_hours)`. Fallback to count-based when no hours set. Excludes `cancelled` tasks from both numerator and denominator.
- ⚠️ No `uq_task_dedup` unique constraint — it was dropped (blocked valid UPDATE operations).

### 1.1 Calendar Source-of-Truth (Holiday/Leave)
- Official company holidays and user leaves are stored in `calendar_events` (`event_type='holiday'|'leave'`).
- Capacity/effective-hours calculations should use `calendar_events` as primary source.
- `company_holidays` and `user_leaves` may exist for compatibility/fallback, but are not the primary source when `calendar_events` data is present.

### 2. Project Lifecycle
Projects now support:
- `original_end_date`: Tracks deadline shifts.
- `payment_status`: Links delivery to revenue.
- `budget_hours` vs `actual_hours`: Direct profitability tracking.

### 3. KPI / ImpactOS Tables

- **`kpi_weight_configs`**: Stores P/Q/A/S axis weights per department (`position` field). Admin-editable. Must sum to 100. Fallback = 25/25/25/25 if department not found.
- Leaf Task Rule: ImpactOS hours count only tasks without children (leaf nodes) to prevent parent+child double-counting.

### 4. Calendar Tables

- **`calendar_events`**: Source-of-truth for company holidays (`event_type='holiday'`) and user leaves (`event_type='leave'`). Used for capacity calculation.
- **`calendar_overrides`**: Per-user exceptions — swap days, half-days. `override_type='work'` still deducts approved leave. `override_type='off'` forces 0h regardless.
- Task fields `task_type='holiday'|'leave'` are legacy/fallback only; `calendar_events` is authoritative.
- **`work_schedules` / `work_schedule_days`**: Tenant-level schedules (which days, how many hours). `work_schedule_days.is_working` + `work_hours` per day-of-week.
- **`user_work_schedules`**: Links a user to a specific schedule (overrides tenant default).
- Priority for resolving a user's schedule: user schedule → tenant default → hardcoded Mon-Fri 8h.

### 5. Marketing / Content Tables

- **`content_plan_items`**: Items on the content planner calendar — linked to channel, status, assignee, publish date.
- **`campaign_analytics`**: Per-campaign metrics (opens, clicks, bounces, unsubscribes) from email sends.

### 6. Custom Fields

- **`custom_fields`**: Field definitions scoped to entity type (project, company, task, etc.) and tenant.
- **`custom_field_values`**: Per-entity field values with JSON-compatible storage.

### 7. Agent API

- **`agent_api_keys`**: API keys for external agents/integrations. Supports scoped access, expiry, and per-tenant isolation.

## 🚀 Future Recommendations

1. **Formalize Constraints:** Add `CONSTRAINT` blocks to `schema.sql` for referential integrity at the DB level.
2. **View Optimization:** The `project_with_company_customer` view is helpful; create more views for complex reporting (e.g., `revenue_projection_view`).
3. **Index Audit:** Ensure composite indexes on `(tenant_id, assignee_user_id, start_date, end_date)` and `(tenant_id, project_id, status)` as tasks table grows.
4. **Async Rollup:** `recalcTaskHoursFromChildrenUnified()` is currently synchronous recursive. For deep trees with many concurrent users, consider a background queue.

---
*Updated June 9, 2026 — adds timezone, work_schedules, hours-weighted progress, uq_task_dedup removal, transaction rollup*
