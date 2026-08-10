# UI/UX Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve mobile responsiveness, Thai-language consistency, and navigation flow across the entire Flowstack application by building shared components first, then applying them globally.

**Architecture:** Component-First approach — create 5 shared files (`labels.ts`, `useConfirm.tsx`, `PageBreadcrumb.tsx`, `ScrollableKanban.tsx`) then apply them to ~51 existing files across 6 phases. Each phase is independently testable.

**Tech Stack:** React 18, TypeScript, shadcn/ui (AlertDialog, Breadcrumb), TanStack React Query, Tailwind CSS

---

## 🟢 สถานะการ Implement (อัปเดต 2026-05-14)

| งาน | สถานะ |
|-----|--------|
| `src/lib/labels.ts` สร้าง + apply 13 ไฟล์ | ✅ เสร็จ |
| `src/hooks/useConfirm.tsx` สร้าง + wire ConfirmProvider ใน App.tsx | ✅ เสร็จ |
| useConfirm apply ทุกไฟล์ (AdminPage, 16 pages, 3 admin panels, MyTasksView, TaskDetailSheet) | ✅ เสร็จ |
| `src/components/PageBreadcrumb.tsx` สร้าง + integrate ใน PageShell | ✅ เสร็จ |
| PageBreadcrumb/PageShell breadcrumbs ใน detail pages ทั้งหมด | ✅ เสร็จ |
| `src/components/ScrollableKanban.tsx` สร้าง + apply SalesPage, Index, Marketing | ✅ เสร็จ |
| copyToClipboard ใน SendSurveyDialog + SurveyPage | ✅ เสร็จ |
| TypeScript check `tsc --noEmit` | ✅ ผ่านสะอาด |

**แผนนี้ implement ครบ 100% แล้ว**

---

### Task 1: Create Centralized Labels (`src/lib/labels.ts`)

**Files:**
- Create: `src/lib/labels.ts`

- [ ] **Step 1: Create `src/lib/labels.ts` with all shared label constants**

```typescript
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
};

// Quotation status (QuotationDetailPage, QuotationsPage)
export const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: 'ฉบับร่าง',
  sent: 'ส่งแล้ว',
  accepted: 'อนุมัติ',
  rejected: 'ปฏิเสธ',
  expired: 'หมดอายุ',
};

// Support ticket status (SupportPage)
export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'เปิด',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิด',
};

// Support ticket priority (SupportPage)
export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  critical: 'วิกฤต',
  high: 'สูง',
  medium: 'ปานกลาง',
  low: 'ต่ำ',
};

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

// Survey priority (SurveyResponseDetailDialog, SurveyResponseViewer)
export const SURVEY_PRIORITY_LABELS: Record<string, string> = {
  critical: 'วิกฤต',
  high: 'สูง',
  medium: 'ปานกลาง',
  low: 'ต่ำ',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/labels.ts
git commit -m "feat: add centralized Thai label constants (labels.ts)"
```

---

### Task 2: Apply labels.ts to CreateOpportunityDialog

**Files:**
- Modify: `src/components/CreateOpportunityDialog.tsx:45-52`

- [ ] **Step 1: Replace STAGE_OPTIONS with import from labels.ts**

```diff
-const STAGE_OPTIONS = [
-  { value: 'lead', label: 'Lead' },
-  { value: 'qualified', label: 'Qualified' },
-  { value: 'proposal', label: 'Proposal' },
-  { value: 'negotiation', label: 'Negotiation' },
-  { value: 'won', label: 'Won' },
-  { value: 'lost', label: 'Lost' },
-];
+import { STAGE_LABELS } from '@/lib/labels';
```

Replace `STAGE_OPTIONS` usage at line 207:
```diff
-{STAGE_OPTIONS.map((option) => (
-  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
+{Object.entries(STAGE_LABELS).map(([value, label]) => (
+  <SelectItem key={value} value={value}>{label}</SelectItem>
 ))}
```

Also replace `ROLE_OPTIONS` (lines 54-57) with `ROLE_LABELS`:
```diff
-const ROLE_OPTIONS = [
-  { value: 'member', label: 'สมาชิก' },
-  { value: 'lead', label: 'หัวหน้าทีม' },
-];
+import { ROLE_LABELS } from '@/lib/labels';
```

Replace usage of ROLE_OPTIONS similarly.

- [ ] **Step 2: Build check — verify no TS errors**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CreateOpportunityDialog.tsx
git commit -m "refactor: use centralized STAGE_LABELS and ROLE_LABELS in CreateOpportunityDialog"
```

---

### Task 3: Apply labels.ts to SalesPage

**Files:**
- Modify: `src/pages/SalesPage.tsx:28-30`

Replace the hardcoded STAGES array `label` references with `STAGE_LABELS`.

- [ ] **Step 1: Import STAGE_LABELS and use it for stage labels**

Add import at top:
```diff
+import { STAGE_LABELS } from '@/lib/labels';
```

Replace the label strings in the STAGES array. The current pattern has hardcoded labels like `label: 'Lead'`, `label: 'Qualified'`, etc. Change each:
```diff
-{ value: 'lead', label: 'Lead', ... },
-{ value: 'qualified', label: 'Qualified', ... },
-{ value: 'proposal', label: 'Proposal', ... },
-{ value: 'negotiation', label: 'Negotiation', ... },
-{ value: 'won', label: 'Won', ... },
-{ value: 'lost', label: 'Lost', ... },
+{ value: 'lead', label: STAGE_LABELS.lead, ... },
+{ value: 'qualified', label: STAGE_LABELS.qualified, ... },
+{ value: 'proposal', label: STAGE_LABELS.proposal, ... },
+{ value: 'negotiation', label: STAGE_LABELS.negotiation, ... },
+{ value: 'won', label: STAGE_LABELS.won, ... },
+{ value: 'lost', label: STAGE_LABELS.lost, ... },
```

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/SalesPage.tsx
git commit -m "refactor: use centralized STAGE_LABELS in SalesPage"
```

---

### Task 4: Apply labels.ts to ImpactOSPage

**Files:**
- Modify: `src/pages/ImpactOSPage.tsx:90-94,704-708`

- [ ] **Step 1: Replace local STAGE_TH and STAGE_TH2 with STAGE_LABELS**

```diff
+import { STAGE_LABELS, PROJECT_STATUS_LABELS } from '@/lib/labels';
+
 const STAGE_TH: Record<string, string> = {
-  lead: 'Lead',
-  qualified: 'Qualified',
-  proposal: 'Proposal',
-  negotiation: 'Negotiation',
-  won: 'Won',
-  lost: 'Lost',
+  ...STAGE_LABELS,
 };
```

Do the same for `STAGE_TH2` at line 704. Keep STAGE_COLOR and STAGE_COLOR2 local (they're color mappings, not labels).

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/ImpactOSPage.tsx
git commit -m "refactor: use centralized STAGE_LABELS in ImpactOSPage"
```

---

### Task 5: Apply labels.ts to EditProjectDialog

**Files:**
- Modify: `src/components/EditProjectDialog.tsx:24-29`

- [ ] **Step 1: Replace STATUS_OPTIONS and ROLE_OPTIONS**

```diff
+import { PROJECT_STATUS_LABELS, ROLE_LABELS } from '@/lib/labels';
+
-const STATUS_OPTIONS = [
-  { value: 'on-track', label: 'ตามแผน' },
-  { value: 'at-risk', label: 'มีความเสี่ยง' },
-  { value: 'delayed', label: 'ล่าช้า' },
-  { value: 'completed', label: 'เสร็จแล้ว' },
-];
-
-const ROLE_OPTIONS = [
-  { value: 'member', label: 'สมาชิก' },
-  { value: 'lead', label: 'หัวหน้าทีม' },
-];
```

Replace STATUS_OPTIONS usage at line 195:
```diff
-{STATUS_OPTIONS.map((option) => (
-  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
+{Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
+  <SelectItem key={value} value={value}>{label}</SelectItem>
 ))}
```

Replace ROLE_OPTIONS usage similarly.

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/EditProjectDialog.tsx
git commit -m "refactor: use centralized PROJECT_STATUS_LABELS and ROLE_LABELS in EditProjectDialog"
```

---

### Task 6: Apply labels.ts to Index.tsx (project pipeline)

**Files:**
- Modify: `src/pages/Index.tsx:1862-1865`

- [ ] **Step 1: Import and use PROJECT_STATUS_LABELS**

```diff
+import { PROJECT_STATUS_LABELS } from '@/lib/labels';
```

Replace the hardcoded label strings in the pipeline columns array (lines 1862-1865) with values from PROJECT_STATUS_LABELS:
```diff
-{ value: 'on-track',  label: 'ตามแผน',       ... },
-{ value: 'at-risk',  label: 'มีความเสี่ยง',   ... },
-{ value: 'delayed',  label: 'ล่าช้า',        ... },
-{ value: 'completed', label: 'เสร็จแล้ว',     ... },
+{ value: 'on-track',  label: PROJECT_STATUS_LABELS['on-track'],  ... },
+{ value: 'at-risk',  label: PROJECT_STATUS_LABELS['at-risk'],   ... },
+{ value: 'delayed',  label: PROJECT_STATUS_LABELS['delayed'],    ... },
+{ value: 'completed', label: PROJECT_STATUS_LABELS['completed'],  ... },
```

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Index.tsx
git commit -m "refactor: use centralized PROJECT_STATUS_LABELS in Index pipeline"
```

---

### Task 7: Apply labels.ts to CreateTaskDialog

**Files:**
- Modify: `src/components/CreateTaskDialog.tsx:59-63`

- [ ] **Step 1: Replace STATUS_OPTIONS with TASK_STATUS_LABELS**

```diff
+import { TASK_STATUS_LABELS } from '@/lib/labels';
+
-const STATUS_OPTIONS = [
-  { value: 'pending',     label: 'รอดำเนินการ' },
-  { value: 'in-progress', label: 'กำลังดำเนินการ' },
-  { value: 'completed',   label: 'เสร็จแล้ว' },
-];
```

Replace usage at line 275:
```diff
-{STATUS_OPTIONS.map((opt) => (
-  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
+{Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
+  <SelectItem key={value} value={value}>{label}</SelectItem>
 ))}
```

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CreateTaskDialog.tsx
git commit -m "refactor: use centralized TASK_STATUS_LABELS in CreateTaskDialog"
```

---

### Task 8: Apply labels.ts to RecurringTasksPage

**Files:**
- Modify: `src/pages/RecurringTasksPage.tsx:44-67`

- [ ] **Step 1: Replace PRIORITY_LABELS and PRIORITY_COLORS with import from labels.ts**

```diff
+import { PRIORITY_LABELS } from '@/lib/labels';
+
-const PRIORITY_LABELS: Record<string, string> = {
-  critical: 'วิกฤต',
-  high: 'สูง',
-  medium: 'ปานกลาง',
-  low: 'ต่ำ',
-};
```

Keep `PRIORITY_COLORS`, `FREQ_LABELS`, and `DAY_LABELS` local (they're specific to this page's UI or not shared across 3+ files).

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/RecurringTasksPage.tsx
git commit -m "refactor: use centralized PRIORITY_LABELS in RecurringTasksPage"
```

---

### Task 9: Apply labels.ts to survey components (SurveyResponseDetailDialog, SurveyResponseViewer)

**Files:**
- Modify: `src/components/SurveyResponseDetailDialog.tsx:119-120`
- Modify: `src/components/SurveyResponseViewer.tsx:6`

- [ ] **Step 1: Replace PRIORITY_LABEL in SurveyResponseDetailDialog.tsx**

```diff
+import { SURVEY_PRIORITY_LABELS } from '@/lib/labels';
+
-const PRIORITY_LABEL: Record<string, string> = { critical: 'วิกฤต', high: 'สูง', medium: 'ปานกลาง', low: 'ต่ำ' };
```

Replace all `PRIORITY_LABEL[...]` references with `SURVEY_PRIORITY_LABELS[...]`.

- [ ] **Step 2: Replace PRIORITY_CONFIG in SurveyResponseViewer.tsx**

```diff
+import { SURVEY_PRIORITY_LABELS } from '@/lib/labels';
+
-const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
-  critical: { label: 'วิกฤต', className: '...' },
-  high: { label: 'สูง', className: '...' },
-  medium: { label: 'ปานกลาง', className: '...' },
-  low: { label: 'ต่ำ', className: '...' },
-};
```

Replace labels with `SURVEY_PRIORITY_LABELS[key]`. Keep `className` values local.

- [ ] **Step 3: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SurveyResponseDetailDialog.tsx src/components/SurveyResponseViewer.tsx
git commit -m "refactor: use centralized SURVEY_PRIORITY_LABELS in survey components"
```

---

### Task 10: Apply labels.ts to CustomerActivityTimeline

**Files:**
- Modify: `src/components/CustomerActivityTimeline.tsx:30-39`

- [ ] **Step 1: Replace TYPE_CONFIG with CUSTOMER_ACTIVITY_LABELS**

```diff
+import { CUSTOMER_ACTIVITY_LABELS } from '@/lib/labels';
```

Replace the `label` values in `TYPE_CONFIG` (lines 31-39):
```diff
 const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
-  email_sent:     { label: 'ส่งอีเมล',        icon: Send,           color: '...' },
-  email_opened:   { label: 'เปิดอีเมล',        icon: Mail,           color: '...' },
-  ...
+  email_sent:     { label: CUSTOMER_ACTIVITY_LABELS.email_sent,     icon: Send,           color: '...' },
+  email_opened:   { label: CUSTOMER_ACTIVITY_LABELS.email_opened,   icon: Mail,           color: '...' },
+  ...
 };
```

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CustomerActivityTimeline.tsx
git commit -m "refactor: use centralized CUSTOMER_ACTIVITY_LABELS in CustomerActivityTimeline"
```

---

### Task 11: Create useConfirm hook (`src/hooks/useConfirm.tsx`)

**Files:**
- Create: `src/hooks/useConfirm.tsx`

- [ ] **Step 1: Create the hook with context provider**

```tsx
// src/hooks/useConfirm.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

interface ConfirmState extends Required<ConfirmOptions> {
  open: boolean;
  resolve: (value: boolean) => void;
}

const DEFAULT_OPTIONS: Omit<ConfirmState, 'resolve' | 'open'> = {
  title: 'ยืนยันการดำเนินการ',
  description: '',
  confirmLabel: 'ยืนยัน',
  cancelLabel: 'ยกเลิก',
  variant: 'default',
};

interface ConfirmContextValue {
  confirm: (options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...DEFAULT_OPTIONS,
        ...options,
        open: true,
        resolve,
      });
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    if (state) {
      state.resolve(value);
      setState(null);
    }
  }, [state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={!!state} onOpenChange={(open) => { if (!open) handleClose(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state?.title}</AlertDialogTitle>
            {state?.description && (
              <AlertDialogDescription>{state.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleClose(false)}>
              {state?.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleClose(true)}
              className={state?.variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {state?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}
```

- [ ] **Step 2: Validate the file compiles by running build**

```bash
pnpm build 2>&1 | head -20
```

Expected: No errors related to `useConfirm.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useConfirm.tsx
git commit -m "feat: add useConfirm hook with ConfirmProvider (AlertDialog-based)"
```

---

### Task 12: Wire ConfirmProvider in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add ConfirmProvider to the component tree**

Find the outermost provider wrapper in App.tsx and nest ConfirmProvider inside it but outside the router:

```diff
+import { ConfirmProvider } from '@/hooks/useConfirm';
+
 // Inside the return:
+<ConfirmProvider>
   <BrowserRouter>
     ...
   </BrowserRouter>
+</ConfirmProvider>
```

Note: App.tsx may use HashRouter — match what's already there.

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire ConfirmProvider in App.tsx"
```

---

### Task 13: Replace confirm() with useConfirm in AdminPage

**Files:**
- Modify: `src/pages/AdminPage.tsx` — 15 instances of `confirm()`

- [ ] **Step 1: Add useConfirm hook and replace all confirm() calls**

```diff
+import { useConfirm } from '@/hooks/useConfirm';
+
 function AdminPage() {
+  const { confirm } = useConfirm();
```

Replace each `confirm('ข้อความ...')` with `await confirm({ description: 'ข้อความ...' })`:

Example — line 363:
```diff
-if (!confirm('ต้องการลบผู้ใช้นี้?')) return;
+const ok = await confirm({ title: 'ลบผู้ใช้', description: 'ต้องการลบผู้ใช้นี้?', variant: 'destructive' });
+if (!ok) return;
```

Apply the same pattern to all 15 instances, adjusting `title`, `description`, and `variant` per context. For destructive deletions, use `variant: 'destructive'`.

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "refactor: replace window.confirm with useConfirm in AdminPage"
```

---

### Task 14: Replace confirm() with useConfirm in remaining pages (~16 files)

**Files:** All files with `confirm()` calls from the audit.

File list and instance counts:
- `src/pages/CompaniesPage.tsx` (2 instances, lines 369, 381)
- `src/pages/SalesPage.tsx` (2 instances, lines 590, 820)
- `src/pages/SalesDetailPage.tsx` (2 instances, lines 326, 370)
- `src/pages/Index.tsx` (2 instances, lines 599, 1274)
- `src/pages/MarketingPage.tsx` (3 instances, lines 411, 427, 492)
- `src/pages/TimesheetPage.tsx` (2 instances, lines 322, 358)
- `src/pages/AutomationPage.tsx` (1 instance, line 213)
- `src/pages/ContentPlannerPage.tsx` (1 instance, line 268)
- `src/pages/CampaignsPage.tsx` (1 instance, line 113)
- `src/pages/GoalsPage.tsx` (1 instance, line 114)
- `src/pages/InboxPage.tsx` (1 instance, line 50)
- `src/pages/KnowledgeBasePage.tsx` (1 instance, line 129)
- `src/pages/RecurringTasksPage.tsx` (1 instance, line 276)
- `src/components/admin/EmailAliasesPanel.tsx` (1 instance, line 136)
- `src/components/admin/CustomFieldsPanel.tsx` (1 instance, line 146)
- `src/components/admin/AISettingsPanel.tsx` (1 instance, line 342)
- `src/components/content/tabs/SkillsTriggerTab.tsx` (2 instances, lines 351, 410)

- [ ] **Step 1: Replace confirm() in each file**

Pattern for each file:

1. Add `import { useConfirm } from '@/hooks/useConfirm';`
2. Add `const { confirm } = useConfirm();` in the component body
3. Replace each `confirm('...')` with `await confirm(...)`:

For simple delete confirmations (one-liner pattern):
```diff
-onClick={() => { if (confirm('ยืนยันลบ?')) deleteMut.mutate(id); }}
+onClick={async () => { if (await confirm({ title: 'ลบรายการ', description: 'ยืนยันลบ?', variant: 'destructive' })) deleteMut.mutate(id); }}
```

For validate-then-return pattern:
```diff
-if (!confirm('ต้องการลบ X?')) return;
+const ok = await confirm({ title: 'ลบ X', variant: 'destructive' });
+if (!ok) return;
```

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit each batch**

```bash
git add src/pages/CompaniesPage.tsx src/pages/SalesPage.tsx src/pages/SalesDetailPage.tsx \
        src/pages/Index.tsx src/pages/MarketingPage.tsx src/pages/TimesheetPage.tsx \
        src/pages/AutomationPage.tsx src/pages/ContentPlannerPage.tsx src/pages/CampaignsPage.tsx \
        src/pages/GoalsPage.tsx src/pages/InboxPage.tsx src/pages/KnowledgeBasePage.tsx \
        src/pages/RecurringTasksPage.tsx src/components/admin/EmailAliasesPanel.tsx \
        src/components/admin/CustomFieldsPanel.tsx src/components/admin/AISettingsPanel.tsx \
        src/components/content/tabs/SkillsTriggerTab.tsx
git commit -m "refactor: replace window.confirm with useConfirm across all pages"
```

---

### Task 15: Create PageBreadcrumb component

**Files:**
- Create: `src/components/PageBreadcrumb.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/PageBreadcrumb.tsx
import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbItemData {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItemData[];
}

export default function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <div className="mb-4">
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const isCurrent = item.isCurrent ?? isLast;

            return (
              <BreadcrumbItem key={index}>
                {isCurrent ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : item.href ? (
                  <BreadcrumbLink asChild>
                    <Link to={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
                {!isLast && <BreadcrumbSeparator />}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PageBreadcrumb.tsx
git commit -m "feat: add PageBreadcrumb component wrapping shadcn/ui Breadcrumb"
```

---

### Task 16: Add breadcrumbs to detail pages (~8 pages)

**Files:**
- `src/pages/ProjectDetail.tsx`
- `src/pages/SalesDetailPage.tsx`
- `src/pages/CompanyDetail.tsx` (or CompaniesPage detail section)
- `src/pages/QuotationDetailPage.tsx` (or QuotationsPage detail section)
- `src/pages/TaskDetailPage.tsx` (or wherever task detail renders)
- `src/pages/TimesheetPage.tsx`
- `src/pages/SupportPage.tsx` (detail/ticket view)
- Customer detail (in CompaniesPage or separate)

- [ ] **Step 1: Add breadcrumb to ProjectDetail.tsx**

```diff
+import PageBreadcrumb from '@/components/PageBreadcrumb';
```

In the header section (near line 158), add before the `<h1>`:
```tsx
<PageBreadcrumb items={[
  { label: 'Projects', href: '/#/' },
  { label: project?.name ?? '...', isCurrent: true },
]} />
```

- [ ] **Step 2: Add breadcrumb to SalesDetailPage.tsx**

```diff
+import PageBreadcrumb from '@/components/PageBreadcrumb';
```

Add before the title:
```tsx
<PageBreadcrumb items={[
  { label: 'Sales', href: '/#/sales' },
  { label: opportunity?.opportunity_name ?? '...', isCurrent: true },
]} />
```

- [ ] **Step 3: Add breadcrumbs to remaining pages**

| Page | Items |
|---|---|
| CompanyDetail | `[{ label: 'Companies', href: '/#/companies' }, { label: company.name, isCurrent: true }]` |
| QuotationDetail | `[{ label: 'Quotations', href: '/#/quotations' }, { label: quotation.quotation_number, isCurrent: true }]` |
| TimesheetPage | `[{ label: 'Timesheet', isCurrent: true }]` |
| Support Ticket Detail | `[{ label: 'Support', href: '/#/support' }, { label: ticket.title, isCurrent: true }]` |
| Customer Detail | `[{ label: 'Companies', href: '/#/companies' }, { label: company.name, href: '/#/companies/:id' }, { label: customerName, isCurrent: true }]` |

For each page: import PageBreadcrumb, add `<PageBreadcrumb items={[...]} />` before the page title.

- [ ] **Step 4: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProjectDetail.tsx src/pages/SalesDetailPage.tsx ...
git commit -m "feat: add PageBreadcrumb to detail pages for navigation context"
```

---

### Task 17: Create ScrollableKanban component

**Files:**
- Create: `src/components/ScrollableKanban.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/ScrollableKanban.tsx
import { useRef, useState, useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function ScrollableKanban({ children, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // sentinel refs for fade detection
  const leftSentinelRef = useRef<HTMLDivElement>(null);
  const rightSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const check = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    };

    container.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();

    // observe children count changes to re-check
    const mo = new MutationObserver(check);
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      container.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      mo.disconnect();
    };
  }, [children]);

  const scroll = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (!container) return;
    const amount = container.clientWidth * 0.6;
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="relative group">
      {/* Fade left */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-background to-transparent z-10 rounded-l-lg" />
      )}
      {/* Fade right */}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent z-10 rounded-r-lg" />
      )}

      {/* Scroll left button (desktop) */}
      {canScrollLeft && (
        <Button
          variant="outline"
          size="icon"
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full shadow hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* Scroll right button (desktop) */}
      {canScrollRight && (
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full shadow hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      <div
        ref={containerRef}
        className={cn(
          'flex overflow-x-auto gap-4 pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20',
          'snap-x snap-mandatory md:snap-none',
          '-webkit-overflow-scrolling-touch',
          className,
        )}
      >
        <div ref={leftSentinelRef} className="w-px shrink-0" />
        {children}
        <div ref={rightSentinelRef} className="w-px shrink-0" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ScrollableKanban.tsx
git commit -m "feat: add ScrollableKanban with fade edges and scroll buttons"
```

---

### Task 18: Apply ScrollableKanban to kanban pages (~4 pages)

**Files:**
- `src/pages/SalesPage.tsx` — pipeline view (line 1463)
- `src/pages/Index.tsx` — project board view (line 1860)
- `src/pages/MarketingPage.tsx` — campaign kanban (line 1194)

- [ ] **Step 1: Wrap SalesPage pipeline kanban**

```diff
+import ScrollableKanban from '@/components/ScrollableKanban';
```

Replace the outer div at line 1463:
```diff
-<div className="flex overflow-x-auto gap-4 pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible sm:pb-0">
+<ScrollableKanban className="sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible sm:pb-0">
   {STAGES.map((stage) => {
     // ... existing column code
   })}
-</div>
+</ScrollableKanban>
```

- [ ] **Step 2: Wrap Index.tsx project board kanban**

```diff
+import ScrollableKanban from '@/components/ScrollableKanban';
```

Replace the outer div at line 1860:
```diff
-<div className="flex overflow-x-auto gap-4 pb-4">
+<ScrollableKanban>
   {columns.map(({ value, label, headerBg, headerText, border, cardBorder, dropHighlight }) => {
     // ... existing column code
   })}
-</div>
+</ScrollableKanban>
```

- [ ] **Step 3: Wrap MarketingPage campaign kanban**

```diff
+import ScrollableKanban from '@/components/ScrollableKanban';
```

Replace the outer div at line 1194:
```diff
-<div className="flex gap-2 overflow-x-auto pb-2">
+<ScrollableKanban className="gap-2">
   {campaign columns}
-</div>
+</ScrollableKanban>
```

- [ ] **Step 4: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/SalesPage.tsx src/pages/Index.tsx src/pages/MarketingPage.tsx
git commit -m "feat: wrap kanban boards with ScrollableKanban"
```

---

### Task 19: Fix SendSurveyDialog copy button — use copyToClipboard

**Files:**
- Modify: `src/components/SendSurveyDialog.tsx:39-43`

- [ ] **Step 1: Replace direct navigator.clipboard usage**

```diff
-import { Copy, CheckCheck } from 'lucide-react';
+import { Copy, CheckCheck } from 'lucide-react';
+import { copyToClipboard } from '@/components/content/views/CopyButton';
```

Replace handleCopy function:
```diff
-async function handleCopy() {
-  if (!publicUrl) return;
-  await navigator.clipboard.writeText(publicUrl);
-  setCopied(true);
-  setTimeout(() => setCopied(false), 2000);
-}
+function handleCopy() {
+  if (!publicUrl) return;
+  copyToClipboard(publicUrl);
+  setCopied(true);
+  setTimeout(() => setCopied(false), 2000);
+}
```

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SendSurveyDialog.tsx
git commit -m "fix: use copyToClipboard in SendSurveyDialog for HTTP fallback support"
```

---

### Task 20: Fix SurveyPage.tsx clipboard usage

**Files:**
- Modify: `src/pages/SurveyPage.tsx:58-59`

- [ ] **Step 1: Replace inline clipboard logic with copyToClipboard**

```diff
+import { copyToClipboard } from '@/components/content/views/CopyButton';
+
-// Remove the local fallbackCopy function if present
...
-if (navigator.clipboard?.writeText) {
-  navigator.clipboard.writeText(url).catch(() => fallbackCopy(url));
-}
+copyToClipboard(url);
```

Remove any local `fallbackCopy` function definition if it exists in this file.

- [ ] **Step 2: Build check**

```bash
pnpm build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/SurveyPage.tsx
git commit -m "fix: use centralized copyToClipboard in SurveyPage"
```

---

### Task 21: Final verification

- [ ] **Step 1: Full build**

```bash
pnpm build
```

Expected: No TypeScript errors, successful production build.

- [ ] **Step 2: Lint check**

```bash
pnpm lint
```

Expected: No new lint errors (pre-existing issues are OK).

- [ ] **Step 3: Run tests**

```bash
pnpm test -- --run
```

Expected: All tests pass. No regressions.

- [ ] **Step 4: Final commit (if any fixes from verification)**

```bash
git commit -m "chore: fix build/lint issues from UI/UX improvement rollout"
```
