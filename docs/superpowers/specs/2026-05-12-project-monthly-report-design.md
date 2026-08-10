# Project Monthly / Yearly Report — Design Spec

**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** Projects page (`#/projects`) — per-project report Sheet with monthly/yearly views and email sending

> **Current-State Addendum (2026-05-20):**
> - เอกสารนี้เป็น design spec เชิง historical
> - โมเดลปัจจุบันใช้ leaf tasks แทน timesheet แยก และใช้ `calendar_events` เป็น source-of-truth สำหรับ `holiday`/`leave`
> - ถ้าทำรายงานใหม่ ให้คำนวณชั่วโมงจาก leaf tasks และอ้างอิงวันลา/วันหยุดจาก `calendar_events`

---

## 1. Entry Point

Add a **"สรุปรายงาน"** button (FileText icon, size `sm`, variant `outline`) to the action row of each project in:
- **Table row** (`Index.tsx` → project table row hover actions)
- **Project card** (`Index.tsx` → card actions menu)

Clicking the button sets `reportProject` state (the full project object) which triggers the Sheet to open.

---

## 2. Component: `ProjectReportSheet`

New file: `src/components/ProjectReportSheet.tsx`

### Props
```typescript
interface ProjectReportSheetProps {
  project: any | null;       // null = closed
  onClose: () => void;
}
```

### Layout
```
Sheet (side="right", className="w-full sm:max-w-3xl overflow-y-auto")
  SheetHeader
    Project name + status badge
    Tab switcher: "รายเดือน" | "รายปี"
    Year Select (current year default)
    Month Select (only visible on รายเดือน tab)

  SheetContent (scrollable, printable div#report-content)
    <ReportHeader />       — project meta row (dates, manager)
    <StatCards />          — 3 summary cards
    <TaskProgressSection /> — task table for period
    <HoursSection />       — actual vs estimated hours by task_type
    <MonthlyBreakdown />   — (รายปี tab only) monthly summary table

  SheetFooter
    Button "พิมพ์ / Export PDF"   → window.print()
    Button "ส่งอีเมลรายงาน"       → opens EmailDialog
    Button "ปิด"
```

---

## 3. Data Fetching

Inside `ProjectReportSheet`, use existing hooks:

| Data | Hook | Filter |
|------|------|--------|
| Tasks in period | `useAllTasks({ per_page: 5000, year_from, year_to })` filtered client-side to `project_id` | start_date or end_date overlaps selected period |
| Leaf task entries | ใช้ข้อมูลจาก tasks (leaf-only) filtered by `project_id` + date overlap in selected period | date in selected period |

**Period calculation:**
- **รายเดือน:** `dateFrom = YYYY-MM-01`, `dateTo = YYYY-MM-last-day`
- **รายปี:** `dateFrom = YYYY-01-01`, `dateTo = YYYY-12-31`

---

## 4. Report Sections Detail

### 4a. Stat Cards (3 cards)
| Card | Data |
|------|------|
| สถานะโปรเจกต์ | `status` badge + `start_date` → `end_date` |
| ความคืบหน้า | `calculateProjectReport(project, allTasks).completionPercentage` + progress bar |
| สถานะงาน | completed / in-progress / overdue / pending counts |

### 4b. ตารางความคืบหน้างาน (tasks in period)
Columns: ชื่องาน · ผู้รับผิดชอบ · สถานะ · วันกำหนด · % คืบหน้า  
Filter: `task.project_id === project.id` AND `(start_date <= dateTo AND end_date >= dateFrom)`  
Exclude: parent rows ที่มีลูก (นับเฉพาะ leaf tasks เพื่อตัดการนับซ้ำ)

### 4c. ชั่วโมงงาน (leaf tasks in period)
- Total actual hours vs total estimated hours
- Bar or row breakdown by `task_type`: งานปกติ / ประชุม / onsite / OT
- Source: tasks (leaf-only) filtered to `project_id` + date in period
- หมายเหตุ: วันลา/วันหยุดให้อ่านจาก `calendar_events` (event_type: leave/holiday)

### 4d. Monthly Breakdown (รายปี tab only)
Table with 12 rows (Jan–Dec):

| เดือน | ชั่วโมงจริง | งานเสร็จ | งานใหม่ |
|------|------------|---------|---------|

Computed by grouping leaf tasks by month (+ calendar_events for leave/holiday context when needed).

---

## 5. Print / Export PDF

```typescript
const handlePrint = () => window.print();
```

Add `<style>` tag with `@media print` rules:
- Hide Sheet chrome (header buttons, footer, sidebar)
- Show only `#report-content`
- Set font size, page margins

---

## 6. Email Dialog

Sub-component `ReportEmailDialog`:
```typescript
interface ReportEmailDialogProps {
  open: boolean;
  onClose: () => void;
  project: any;
  reportHtml: string;   // innerHTML of #report-content
  periodLabel: string;  // "มกราคม 2026" or "2026"
}
```

Fields:
- **To:** text input — pre-filled from `project.customer_email` (if available via company/customer join)
- **Subject:** `รายงานโปรเจกต์ ${project.name} — ${periodLabel}` (editable)
- **Note:** small textarea for extra message

On submit: `POST /api/notification-dispatch.php` with `{ to, subject, html_body: reportHtml, note }`  
If `notification-dispatch.php` doesn't support direct SMTP send, fall back to `POST /api/query.php?action=send_report_email` (new action).

---

## 7. API Changes

### Option A (preferred): Extend `api/notification-dispatch.php`
Add `action=send_email` handler:
```php
// POST body: { to, subject, html_body, note }
// Uses existing SMTP config from company_settings table
```

### Option B: New endpoint `api/report-email.php`
Standalone SMTP sender — simpler but adds a file.

**Decision:** Use Option A (extend notification-dispatch.php).

---

## 8. Files Changed / Created

| File | Change |
|------|--------|
| `src/components/ProjectReportSheet.tsx` | New — Sheet + all sub-sections |
| `src/pages/Index.tsx` | Add `reportProject` state, "สรุปรายงาน" button in table row + card actions, render `<ProjectReportSheet>` |
| `api/notification-dispatch.php` | Add `send_email` action using SMTP config |
| `src/index.css` | Add `@media print` rules |

No new routes. No new DB tables.

---

## 9. Out of Scope

- Saving reports to DB
- Scheduling automated reports
- Multi-project aggregate reports
- Chart images in email (email shows tabular data only)
