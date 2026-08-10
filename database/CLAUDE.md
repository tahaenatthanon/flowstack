# CLAUDE.md

Thai-language project management SaaS: PHP + MariaDB backend on XAMPP, React 18 + TypeScript + Vite frontend.

## Project map

- `src/App.tsx` - Router, PermissionRoute guards, route definitions
- `src/components/` - UI components (AppSidebar, DashboardLayout)
- `src/components/ui/` - shadcn-ui primitives (do not edit)
- `src/pages/` - Feature pages (Home, Projects, Sales, Support, etc.)
- `src/hooks/` - React Query and Auth hooks
- `src/lib/` - Business logic and utilities
- `api/` - PHP backend endpoints (auth, projects, tasks, support, etc.)
- `database/schema.sql` - Full DB schema (source of truth)
- `docs/` - Specialized documentation (features, database, guides)
- `uploads/support/` - Attachment storage

<important if="you need to run commands to build, test, lint, or start the dev server">

| Command | What it does |
|---|---|
| `pnpm dev` | Start Vite dev server on :8080 |
| `pnpm build` | Production build to `dist/` |
| `pnpm lint` | ESLint check |
| `pnpm test` | Run Vitest tests |

</important>

<important if="you are adding a new page or route">
- Add import and `<Route>` in `src/App.tsx`
- Wrap with `<PermissionRoute menuKey="...">` or `<ProtectedRoute>`
- Add menu item to `NAV_GROUPS` in `src/components/AppSidebar.tsx`
- Add `menuKey` to `ALL_MENU_KEYS` in `api/auth.php`
- Menu keys: `home`, `projects`, `sales`, `quotations`, `companies`, `revenue`, `resources`, `timesheet`, `reports`, `analytics`, `marketing`, `goals`, `automation`, `budget`, `support`, `admin`
- ⚠️ menuKey `timesheet` ยังคงใช้ชื่อเดิมในโค้ด แต่ UI แสดงเป็น "บันทึกชั่วโมง" — ไม่มีแนวคิด "timesheet" ในระบบอีกต่อไป ทุกอย่างเป็น task และ subtask
</important>

<important if="you are working with authentication, permissions, or user roles">
- `api/auth.php`: `requireAuth()` (JWT), `requireAdmin($db, $userId)`, `getUserPermissions($db, $userId, $isAdmin)`
- `is_admin=1` bypasses checks; `is_active=0` disables account
- Permissions: `roles` and `role_menu_permissions` tables
- Frontend: `useAuth()` hook for `user.permissions[]` and `hasPermission(menuKey)`
</important>

<important if="you are working with the database schema or writing SQL">
- Source of truth: `database/schema.sql`
- PKs: `CHAR(36)` UUID (use `generateUUID()` in PHP)
- Timestamps: `created_at`, `updated_at` (DATETIME)
- FKs: `ON DELETE CASCADE` or `SET NULL`
- Key tables: `users`, `roles`, `companies`, `projects`, `tasks`, `sales_opportunities`, `quotations`, `support_tickets`
- ไม่มีตาราง `timesheet_entries` — การบันทึกชั่วโมงคือ `tasks` ที่มี `is_subtask=1` (subtask)
</important>

<important if="you are building or editing API endpoints in api/">
- Call `requireAuth()` first; use `getDB()` for connection; `getMethod()` for verb
- Return: `jsonResponse($data)`, Error: `jsonError('message', $code)`
- Dispatch via HTTP verbs (no framework)
- Ownership: non-admins see only their own tasks/subtasks
- Uploads: use `api/support-upload.php` for `uploads/support/`
</important>

<important if="you are adding or modifying React components, forms, or UI">
- **Language: All user-facing text (labels, buttons, messages, placeholders) must be in Thai. Component names, props, and code identifiers remain in English.**
- Use `shadcn-ui` primitives from `src/components/ui/`
- `<Select.Item>`: use `"__none__"` instead of `""` for empty values
- Data fetching: TanStack React Query (invalidate keys after mutations)
- Styling: Tailwind CSS, use `cn()` from `src/lib/utils.ts`
</important>

<important if="you are working on the Helpdesk / Support module">
- Tickets: `api/support-tickets.php` (CRUD + `?action=comment`)
- Contracts: `api/support-contracts.php` (auto-updates status)
- SLA: critical=2h, high=4h, medium=8h, low=24h (computed via `sla_hours`)
- Customer dropdown: disable until company is selected
- See `docs/features.md` for full module details
</important>

<important if="you are working on sales, quotations, or revenue">
- Stages: `lead` → `qualified` → `proposal` → `negotiation` → `won/lost`
- Quotations: `QUO-YYYYMM-NNNN` (see `api/opportunities.php`)
- Payment status on `projects` links to revenue
</important>

<important if="you are working on project calculations or impact analysis">
- Logic: `src/lib/projectUtils.ts` (`calculateProjectReport`)
- Task dependencies: `task_dependencies` table
- Ad-hoc tasks: trigger impact simulation (see `InsertAdHocTaskDialog.tsx`)
</important>

<important if="you are working with the calendar or scheduling meetings">
- **ปฏิทินทีม vs ปฏิทินบริษัท — ห้ามสับสน:**
  - **ปฏิทินทีม** = PROJECT ชื่อ "ปฏิทินทีม" ในตาราง `tasks` — ใช้สำหรับ นัดประชุม, นัดหมาย, วันลา ของทีม
  - **ปฏิทินบริษัท** = ตาราง `calendar_events` — ใช้สำหรับ วันหยุดบริษัท, event ระดับองค์กร เท่านั้น
- **Meeting/Leave → ปฏิทินทีม (task):** เมื่อ user ต้องการสร้างนัดประชุม นัดหมาย หรือลาหยุด ให้สร้างเป็น `task` ใน project "ปฏิทินทีม" (`task_type='meeting'` หรือ `task_type='leave'`) เสมอ — ห้ามสร้างเป็น `calendar_event`
- **calendar_events:** ใช้ได้เฉพาะ `event_type='holiday'` หรือ `event_type='other'` สำหรับ company-wide announcements
- `api/work-type-catalog.php`: `getAllowedCalendarEventTypes()` คืน `meeting, leave, holiday, other` แต่ AI chat ควรสร้าง meeting/leave เป็น task ใน "ปฏิทินทีม" เท่านั้น
</important>

<important if="you are creating or managing tasks, subtasks, or discussing project issues">
- **Task Atomicity:** Tasks MUST NOT exceed 16 hours. Break "Support" or long tasks into specific activity-based subtasks.
- **Hourly Logging:** Timesheet entries must be recorded in hours (`actual_hours`), not days.
- **Weekend/Swap:** Use `task_type='weekend_work'` in project "ปฏิทินทีม" for actual weekend effort recorded as tasks.
- **Type Catalogs:** Allowed `task_type` and `calendar_events.event_type` must come from `company_settings` catalogs (`task_type_catalog`, `calendar_event_type_catalog`) and be managed from Admin settings.
- **Status Updates:** Always prompt for or update task/project status to prevent "stagnation".
- **Solution First:** When a technical or system issue is raised, you MUST propose a concrete solution (Proposed Solution) instead of just stating the problem.
- **Departmental Analysis:** When analyzing performance, use the weighted KPI framework in `docs/kpi-config.md` (e.g., Dev weights vs. Sales weights).
- **Customer Tiering:** Use transaction history and activity logs to analyze and recommend customer tiers (Partner, High-Value, etc.) as defined in `docs/crm-strategy.md`.
- **Reference:** See `docs/impact-os.md`, `docs/kpi-config.md`, and `docs/crm-strategy.md` for full workflow and logic.
</important>

## Development Rules

1. **NO MAGIC** — All behavior must be explicit and traceable. No hidden side effects.
2. **VERIFY BEFORE DONE** — Run lint/build/test before marking any task complete.
3. **DISSENT** — If an instruction seems wrong or risky, say so before executing.
4. **SCOPE DRIFT** — Do only what was asked. Don't add features or refactor outside the task scope.
5. **EXPLICIT ASSUMPTIONS** — State any assumptions clearly (e.g., a table exists, a field is optional).
6. **READ BEFORE WRITE** — Always read the file before editing; check existing code before writing new code.
7. **BACKUP BEFORE DELETE** — Never delete without a backup or confirmation.
8. **TEST BEFORE COMMIT** — Always test before committing; be careful with git commands.

## Database Migrations

Every schema change (ALTER TABLE, CREATE TABLE, DROP TABLE, etc.) must:
1. Create a migration file in `database/migrations/` named `YYYY_MM_DD_HHMMSS_description.sql`
2. Execute the SQL immediately against the local MariaDB via `mysql -u root flowstack < database/migrations/<filename>.sql`
3. Verify the change applied correctly (e.g., `SHOW COLUMNS FROM <table>` or `DESCRIBE <table>`)
4. If execution fails, fix the SQL in the migration file and re-run until it succeeds