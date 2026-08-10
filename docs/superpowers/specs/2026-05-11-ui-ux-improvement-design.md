# UI/UX Improvement Design

**Date:** 2026-05-11
**Status:** Approved
**Scope:** ทั่วทั้งระบบ (System-wide)
**Approach:** Component-First

## Overview

Improve mobile responsiveness, Thai-language consistency, and navigation flow across the entire Flowstack application by building shared components and patterns first, then applying them globally.

---

## Section 1: Centralized Thai Labels (`src/lib/labels.ts`)

### Problem

Hardcoded Thai label objects are duplicated across ~15 files. Some labels are inconsistent (e.g., different files use slightly different translations for the same status). Adding a new status requires hunting down every file.

### Solution

Single source of truth: `src/lib/labels.ts` exporting typed constants.

### Constants

```ts
// Stage labels for sales opportunities
export const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'ข้อเสนอ',
  negotiation: 'เจรจาต่อรอง',
  won: 'ชนะดีล',
  lost: 'แพ้ดีล',
};

// Project status labels
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  on_hold: 'พักไว้',
  cancelled: 'ยกเลิก',
  planning: 'วางแผน',
};

// Priority labels
export const PRIORITY_LABELS: Record<string, string> = {
  critical: 'วิกฤต',
  high: 'สูง',
  medium: 'ปานกลาง',
  low: 'ต่ำ',
};

// Task status labels
export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: '待ทำ',
  in_progress: 'กำลังทำ',
  review: 'ตรวจสอบ',
  done: 'เสร็จ',
};

// Quotation status labels
export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: 'ฉบับร่าง',
  sent: 'ส่งแล้ว',
  accepted: 'อนุมัติ',
  rejected: 'ปฏิเสธ',
  expired: 'หมดอายุ',
};

// Support ticket status labels
export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'เปิด',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิด',
};

// Support ticket priority labels
export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  critical: 'วิกฤต',
  high: 'สูง',
  medium: 'ปานกลาง',
  low: 'ต่ำ',
};
```

### Affected Files (~15)

`SalesPage.tsx`, `ProjectsPage.tsx`, `CreateOpportunityDialog.tsx`, `CreateProjectDialog.tsx`, `CreateTaskDialog.tsx`, `EditProjectDialog.tsx`, `SupportPage.tsx`, `TaskBoardPage.tsx`, `CreateQuotationDialog.tsx`, `QuotationDetailPage.tsx`, `CreateTimesheetDialog.tsx`, `CrossProjectImpactView.tsx`, `ImpactSimulationDialog.tsx`, `InsertAdHocTaskDialog.tsx`, `CustomerActivityTimeline.tsx`

---

## Section 2: `useConfirm()` Hook (replaces `window.confirm()`)

### Problem

~20 locations use `window.confirm()` which breaks the app's visual consistency (browser-native dialog in a custom-styled app) and provides no customization (title, variant, custom buttons).

### Solution

`useConfirm()` hook backed by `<AlertDialog>` from shadcn/ui.

### API

```ts
// src/hooks/useConfirm.tsx

interface ConfirmOptions {
  title?: string;           // default: 'ยืนยันการดำเนินการ'
  description?: string;     // default: ''
  confirmLabel?: string;    // default: 'ยืนยัน'
  cancelLabel?: string;     // default: 'ยกเลิก'
  variant?: 'default' | 'destructive';  // default: 'default'
}

function useConfirm(): {
  confirm: (options?: ConfirmOptions) => Promise<boolean>;
  ConfirmDialog: React.ReactNode;  // render in JSX
}
```

### Usage

```tsx
const { confirm, ConfirmDialog } = useConfirm();

async function handleDelete() {
  const ok = await confirm({
    title: 'ลบโปรเจกต์นี้?',
    description: 'ข้อมูลทั้งหมดจะหายไป ไม่สามารถกู้คืนได้',
    variant: 'destructive',
  });
  if (!ok) return;
  // proceed with delete
}

return (
  <>
    {ConfirmDialog}
    {/* rest of component */}
  </>
);
```

### Provider

Wrap `<App>` with `<ConfirmProvider>` in `src/App.tsx` so the hook's state is managed globally.

```
src/App.tsx
  <QueryClientProvider>
    <ConfirmProvider>        ← new
      <BrowserRouter>
        ...
      </BrowserRouter>
    </ConfirmProvider>
  </QueryClientProvider>
```

### Affected Files (~20)

Every file using `window.confirm()` — `SalesPage.tsx`, `ProjectsPage.tsx`, `TaskBoardPage.tsx`, `SupportPage.tsx`, `CompaniesPage.tsx`, `CustomersPage.tsx`, `TimesheetPage.tsx`, `QuotationsPage.tsx`, plus dialogs like `CreateProjectDialog.tsx`, `EditProjectDialog.tsx`, etc.

---

## Section 3: Breadcrumb Navigation (`<PageBreadcrumb>`)

### Problem

Deep pages (`/#/projects/:id`, `/#/sales/:id`, `/#/timesheet`) have no breadcrumb. Users must remember their path or use the sidebar to navigate back.

### Solution

Reusable `<PageBreadcrumb>` wrapping shadcn/ui `<Breadcrumb>`.

### API

```tsx
// src/components/PageBreadcrumb.tsx

interface BreadcrumbItem {
  label: string;
  href?: string;      // if omitted, rendered as current page (not a link)
  isCurrent?: boolean; // explicit override
}

<PageBreadcrumb items={[
  { label: 'Sales', href: '/#/sales' },
  { label: opportunity.name, isCurrent: true },
]} />
```

### Pages to update (~8)

| Page | Breadcrumb |
|---|---|
| `ProjectDetailPage` | Projects → ชื่อโปรเจกต์ |
| `SalesDetailPage` | Sales → ชื่อ opportunity |
| `CompanyDetail` | Companies → ชื่อบริษัท |
| `QuotationDetail` | Quotations → เลขใบเสนอราคา |
| `TaskDetailPage` | Projects → ชื่อโปรเจกต์ → ชื่อ task |
| `TimesheetPage` | Timesheet (standalone) |
| `CustomerDetail` | Companies → ชื่อบริษัท → ชื่อลูกค้า |
| `SupportTicketDetail` | Support → ชื่อ ticket |

---

## Section 4: Mobile Kanban Scroll Wrapper (`<ScrollableKanban>`)

### Problem

Kanban boards (Sales pipeline, Task board, Support board) overflow horizontally on mobile with no scroll indicator. Scrolling is not smooth on iOS.

### Solution

`<ScrollableKanban>` wrapper with visual scroll affordances.

### API

```tsx
// src/components/ScrollableKanban.tsx
<ScrollableKanban>
  {/* existing kanban columns */}
</ScrollableKanban>
```

### Features

- `overflow-x: auto` with `scroll-snap-type: x mandatory`
- `-webkit-overflow-scrolling: touch` for iOS
- `scrollbar-thin` for styled scrollbar
- Fade gradients on left/right edges using IntersectionObserver on sentinel elements
- Arrows on desktop (`hidden md:flex`) for click-to-scroll

### Pages to update (~4)

`SalesPage` (Pipeline view), `ProjectsPage` (Board view), `SupportPage` (Board view), `TaskBoardPage` (Board view)

---

## Section 5: Misc Bug Fixes

1. **`SendSurveyDialog.tsx`**: uses `navigator.clipboard.writeText()` directly, no HTTP fallback → switch to `copyToClipboard()` from `CopyButton.tsx`
2. **Dialog state reset**: ensure form dialogs reset internal state when closed (some already do, audit ~5 dialogs)
3. **Mobile sidebar auto-close**: verify sidebar closes on link click in mobile view (check `AppSidebar.tsx`)

---

## Rollout Plan

| Phase | What | New Files | Files Modified |
|---|---|---|---|
| 1 | Create shared components | 5 (`labels.ts`, `useConfirm.tsx`, `ConfirmProvider`, `PageBreadcrumb.tsx`, `ScrollableKanban.tsx`) | 1 (`App.tsx` for provider) |
| 2 | Apply labels.ts | 0 | ~15 |
| 3 | Apply useConfirm | 0 | ~20 |
| 4 | Apply PageBreadcrumb | 0 | ~8 |
| 5 | Apply ScrollableKanban | 0 | ~4 |
| 6 | Misc fixes | 0 | ~3 |

**Total:** 5 new files, ~51 files modified.

---

## Testing

- Each component is independently testable (pure function / controlled state)
- `useConfirm` should have a unit test for resolve/reject flow
- Visual regression: check each page on mobile viewport (375px) and desktop (1280px)
- Copy button: test on HTTP (non-secure context) that `execCommand('copy')` fallback works
