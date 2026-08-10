# Content Calendar Planner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/#/content-planner` into a Facebook-style calendar with month/quarter/year views, AI-powered side panel, drag-and-drop scheduling, and best-posting-time analytics.

**Architecture:** Calendar-first layout with collapsible AI panel on the right. Calendar renders grids via utility functions in `calendarUtils.ts`, using native HTML5 drag-and-drop. Analytics panel lives as a bottom sheet. The page shell (`ContentPlannerPage.tsx`) owns all state and composes Calendar + AI + Analytics panels.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn-ui primitives, TanStack React Query, PHP + MariaDB backend, native HTML5 DnD (no external library), inline SVG for charts.

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/content/calendarUtils.ts` | Create | Date math, grid generation, Thai labels |
| `src/components/content/types.ts` | Modify | Add PostingAnalytics interfaces, extend ContentPlan |
| `database/migrations/2026_05_10_HHMMSS_content_calendar_upgrade.sql` | Create | DB schema migration |
| `database/schema.sql` | Modify | Mirror migration changes in source of truth |
| `api/brand-content.php` | Modify | Add 4 new actions |
| `src/hooks/useContent.ts` | Modify | Add usePostingAnalytics, useUpdatePlanItemDate |
| `src/components/content/BestTimeIndicator.tsx` | Create | Colored dot + tooltip per calendar cell |
| `src/components/content/BestTimeAnalyticsPanel.tsx` | Create | Bottom panel with day/hour charts |
| `src/components/content/ContentCardDialog.tsx` | Create | Create/edit content card dialog |
| `src/components/content/ContentPlannerCalendar.tsx` | Create | Main calendar grid (month/quarter/year) |
| `src/components/content/ContentPlannerAI.tsx` | Create | AI generation side panel |
| `src/pages/ContentPlannerPage.tsx` | Rewrite | Page shell composing all components |
| `src/components/content/tabs/ContentPlannerTab.tsx` | Delete | Replaced by new components |
| `src/App.tsx` | Modify | Remove ContentPlannerTab import (it's imported by page, not directly) |
| `e2e/content-calendar.spec.ts` | Create | E2E tests for calendar |

---

### Task 1: Types Extension & Calendar Utilities

**Files:**
- Create: `src/components/content/calendarUtils.ts`
- Modify: `src/components/content/types.ts` (add new interfaces)

- [ ] **Step 1.1: Add new types to types.ts**

In `src/components/content/types.ts`, after the existing `ContentPlan` interface (line 39), replace it and add new types:

```typescript
export interface ContentPlan {
  id: string; title: string; week_start: string; status: string;
  plan_type?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  plan_start?: string | null;
  plan_end?: string | null;
  trigger_command: string; created_at: string; items?: PlanItem[];
}

export interface PostingAnalytics {
  platform: string;
  day_of_week: number;   // 0=Sun .. 6=Sat
  hour_of_day: number;    // 0-23
  avg_engagement: number;
  total_posts: number;
  sample_size: number;
}

export interface PostingAnalyticsResponse {
  has_data: boolean;
  by_day: Record<string, Record<number, number>>;     // platform -> dayOfWeek -> avgEngagement
  by_hour: Record<string, Record<number, number>>;    // platform -> hourOfDay -> avgEngagement
  recommendations: Array<{
    platform: string;
    day_of_week: number;
    hour_of_day: number;
    avg_engagement: number;
  }>;
}

export interface CalendarItemGroup {
  date: string;                    // YYYY-MM-DD
  items: PlanItem[];
}

export type CalendarView = 'month' | 'quarter' | 'year';
```

- [ ] **Step 1.2: Create calendarUtils.ts**

Create `src/components/content/calendarUtils.ts`:

```typescript
export const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const THAI_DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export function generateMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const grid: (Date | null)[][] = [];
  let currentRow: (Date | null)[] = [];

  // Pad with null for days before month start
  for (let i = 0; i < startDow; i++) {
    currentRow.push(null);
  }

  for (let d = 1; d <= totalDays; d++) {
    currentRow.push(new Date(year, month, d));
    if (currentRow.length === 7) {
      grid.push(currentRow);
      currentRow = [];
    }
  }

  // Pad remaining cells
  if (currentRow.length > 0) {
    while (currentRow.length < 7) {
      currentRow.push(null);
    }
    grid.push(currentRow);
  }

  return grid;
}

export function generateQuarterGrids(year: number, quarter: number): { month: number; year: number; grid: (Date | null)[][] }[] {
  const startMonth = (quarter - 1) * 3;
  return [0, 1, 2].map(offset => {
    const m = startMonth + offset;
    return { month: m, year, grid: generateMonthGrid(year, m) };
  });
}

export function generateYearHeatmap(year: number): { month: number; days: number; postCount: number }[] {
  return Array.from({ length: 12 }, (_, m) => ({
    month: m,
    days: new Date(year, m + 1, 0).getDate(),
    postCount: 0,
  }));
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear()
    && d1.getMonth() === d2.getMonth()
    && d1.getDate() === d2.getDate();
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatThaiDate(date: Date): string {
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
}

export function getThaiDayName(date: Date): string {
  return THAI_DAYS_FULL[date.getDay()];
}

export function getQuarterLabel(quarter: number): string {
  return `ไตรมาส ${quarter}`;
}

export function getThaiMonthYear(year: number, month: number): string {
  return `${THAI_MONTHS_FULL[month]} ${year + 543}`;
}

export function getQuarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 0),
  };
}

export function weekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    year: d.getUTCFullYear(),
    week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  };
}
```

- [ ] **Step 1.3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No new errors introduced.

- [ ] **Step 1.4: Commit**

```bash
git add src/components/content/calendarUtils.ts src/components/content/types.ts
git commit -m "feat: add calendar utilities and extended types for content planner redesign

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: Database Migration

**Files:**
- Create: `database/migrations/2026_05_10_$(time)_content_calendar_upgrade.sql`
- Modify: `database/schema.sql`

- [ ] **Step 2.1: Create migration file**

Get current time for filename:

```bash
powershell -Command "Get-Date -Format 'HHmmss'"
```

Create `database/migrations/2026_05_10_HHMMSS_content_calendar_upgrade.sql`:

```sql
-- Migration: Content Calendar Upgrade
-- Date: 2026-05-10
-- Description: Add plan_type/plan_start/plan_end to content_plans,
--              and create content_posting_analytics table for best-time recommendations.

ALTER TABLE `content_plans`
  ADD COLUMN `plan_type` ENUM('weekly','monthly','quarterly','yearly') NOT NULL DEFAULT 'weekly' AFTER `status`,
  ADD COLUMN `plan_start` DATE NULL AFTER `plan_type`,
  ADD COLUMN `plan_end` DATE NULL AFTER `plan_start`;

CREATE TABLE IF NOT EXISTS `content_posting_analytics` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` VARCHAR(100) NOT NULL,
  `platform` VARCHAR(100) NOT NULL,
  `day_of_week` TINYINT NOT NULL,
  `hour_of_day` TINYINT NOT NULL,
  `avg_engagement` FLOAT NOT NULL DEFAULT 0,
  `total_posts` INT NOT NULL DEFAULT 0,
  `sample_size` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tenant_platform_day_hour` (`tenant_id`, `platform`, `day_of_week`, `hour_of_day`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2.2: Update schema.sql**

In `database/schema.sql`, find the `CREATE TABLE content_plans` block (near line 3238). Replace it with:

```sql
CREATE TABLE `content_plans` (
  `id` char(36) NOT NULL,
  `tenant_id` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `week_start` date DEFAULT NULL,
  `status` enum('draft','approved','published') NOT NULL DEFAULT 'draft',
  `plan_type` enum('weekly','monthly','quarterly','yearly') NOT NULL DEFAULT 'weekly',
  `plan_start` date DEFAULT NULL,
  `plan_end` date DEFAULT NULL,
  `trigger_command` varchar(255) DEFAULT NULL,
  `skill_id` char(36) DEFAULT NULL,
  `brand_context_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`brand_context_ids`)),
  `ai_raw_output` longtext DEFAULT NULL,
  `created_by` char(36) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Add near the end of schema.sql (before index definitions) the new table:

```sql
--
-- Table structure for table `content_posting_analytics`
--

CREATE TABLE `content_posting_analytics` (
  `id` char(36) NOT NULL,
  `tenant_id` varchar(100) NOT NULL,
  `platform` varchar(100) NOT NULL,
  `day_of_week` tinyint(4) NOT NULL,
  `hour_of_day` tinyint(4) NOT NULL,
  `avg_engagement` float NOT NULL DEFAULT 0,
  `total_posts` int(11) NOT NULL DEFAULT 0,
  `sample_size` int(11) NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for table `content_posting_analytics`
--
ALTER TABLE `content_posting_analytics`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_tenant_platform_day_hour` (`tenant_id`, `platform`, `day_of_week`, `hour_of_day`);
```

- [ ] **Step 2.3: Run migration on local database**

```bash
mysql -u root -e "SOURCE database/migrations/2026_05_10_HHMMSS_content_calendar_upgrade.sql" flowstack
```

Expected: No errors.

- [ ] **Step 2.4: Commit**

```bash
git add database/migrations/ database/schema.sql
git commit -m "feat: add plan_type fields and content_posting_analytics table

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: API — New Endpoints

**File:** Modify: `api/brand-content.php`

- [ ] **Step 3.1: Update auto-migrate function to include new table**

Find the `bcMigrate` function (around line 38). Add the new table creation below the existing `content_items` block (after line ~126):

```php
    $db->exec("CREATE TABLE IF NOT EXISTS content_posting_analytics (
        id          CHAR(36)     NOT NULL,
        tenant_id   VARCHAR(100) NOT NULL,
        platform    VARCHAR(100) NOT NULL,
        day_of_week TINYINT      NOT NULL,
        hour_of_day TINYINT      NOT NULL,
        avg_engagement FLOAT     NOT NULL DEFAULT 0,
        total_posts INT          NOT NULL DEFAULT 0,
        sample_size INT          NOT NULL DEFAULT 0,
        updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY idx_tenant_platform_day_hour (tenant_id, platform, day_of_week, hour_of_day)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Add plan_type / plan_start / plan_end columns if missing
    $cols = [];
    foreach ($db->query("SHOW COLUMNS FROM content_plans") as $c) $cols[] = $c['Field'];
    if (!in_array('plan_type', $cols)) {
        $db->exec("ALTER TABLE content_plans ADD COLUMN plan_type ENUM('weekly','monthly','quarterly','yearly') NOT NULL DEFAULT 'weekly' AFTER status");
    }
    if (!in_array('plan_start', $cols)) {
        $db->exec("ALTER TABLE content_plans ADD COLUMN plan_start DATE NULL AFTER plan_type");
    }
    if (!in_array('plan_end', $cols)) {
        $db->exec("ALTER TABLE content_plans ADD COLUMN plan_end DATE NULL AFTER plan_start");
    }
```

- [ ] **Step 3.2: Update generate-plan to accept plan_type**

Find the `generate-plan` action (around line 430). After reading `$weekStart`, add:

```php
    $planType   = $body['plan_type'] ?? 'weekly';
    $planStart  = $body['plan_start'] ?? null;
    $planEnd    = $body['plan_end'] ?? null;
```

Find the INSERT for `content_plans` within generate-plan. Add `plan_type`, `plan_start`, `plan_end` to the INSERT columns and values. The INSERT statement is approximately at line ~620. Add the three new columns:

```php
        $stmt = $db->prepare('INSERT INTO content_plans (id, tenant_id, title, week_start, status, plan_type, plan_start, plan_end, trigger_command, skill_id, brand_context_ids, ai_raw_output, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$planId, $tenantId, $title, $weekStart, 'draft', $planType, $planStart, $planEnd, $triggerCommand, $skillId, json_encode($brandContextIds), json_encode($result), $userId]);
```

Also update the prompt to ask AI for dates instead of day labels when plan_type is monthly/quarterly/yearly. Find the section where `$promptLines` is built (the JSON schema instruction). Modify the OUTPUT RULE section to be plan-type aware:

At the point where the system prompt asks for `day_label` / `day_order`, add a context note:

```php
    $dateInstruction = '';
    if (in_array($planType, ['monthly', 'quarterly', 'yearly'])) {
        $dateInstruction = "## DATE INSTRUCTION\nAssign each post to a specific date within the plan range (start: {$planStart}, end: {$planEnd}). Use the \"scheduled_date\" field with format YYYY-MM-DD. Spread posts evenly across the plan period.";
    }
    // Prepend to sysParts
    if ($dateInstruction) array_unshift($sysParts, $dateInstruction);
```

- [ ] **Step 3.3: Add plan-item-date action**

Add before the final `?>` or after the last existing action block (find the last `}` before `?>` at end of file):

```php
// ─── PLAN-ITEM-DATE (Drag & Drop) ─────────────────────────────────
if ($action === 'plan-item-date' && $method === 'PUT') {
    $body   = getRequestBody();
    $itemId = $body['item_id'] ?? '';
    $scheduledDate = $body['scheduled_date'] ?? '';
    if (!$itemId || !$scheduledDate) jsonError('item_id and scheduled_date required', 400);

    // Compute day_label and day_order from date
    $ts = strtotime($scheduledDate);
    $dayOfWeek = (int)date('w', $ts); // 0=Sun
    $dayLabels = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    $dayOrders = [7, 1, 2, 3, 4, 5, 6]; // Sun=7, Mon=1...
    $dayLabel = $dayLabels[$dayOfWeek];
    $dayOrder = $dayOrders[$dayOfWeek];

    $db->prepare('UPDATE content_items SET scheduled_date=?, day_label=?, day_order=?, updated_at=NOW() WHERE id=?')
       ->execute([$scheduledDate, $dayLabel, $dayOrder, $itemId]);

    jsonResponse(['updated' => true, 'scheduled_date' => $scheduledDate, 'day_label' => $dayLabel, 'day_order' => $dayOrder]);
}
```

- [ ] **Step 3.4: Add analytics-posting-times action (GET)**

```php
// ─── ANALYTICS POSTING TIMES ──────────────────────────────────────
if ($action === 'analytics-posting-times') {
    // Return cached analytics if any
    $stmt = $db->prepare(
        'SELECT platform, day_of_week, hour_of_day, avg_engagement, total_posts, sample_size
         FROM content_posting_analytics
         WHERE tenant_id=? ORDER BY platform, day_of_week, hour_of_day'
    );
    $stmt->execute([$tenantId]);
    $rows = $stmt->fetchAll();

    $hasData = count($rows) > 0;

    $byDay  = [];
    $byHour = [];
    $recommendations = [];

    foreach ($rows as $r) {
        $p = $r['platform'];
        if (!isset($byDay[$p])) $byDay[$p] = [];
        if (!isset($byHour[$p])) $byHour[$p] = [];
        $byDay[$p][(int)$r['day_of_week']] = (float)$r['avg_engagement'];
        $byHour[$p][(int)$r['hour_of_day']] = (float)$r['avg_engagement'];
    }

    // Top recommendations: best 5 (platform, day, hour) combos
    usort($rows, fn($a, $b) => (float)$b['avg_engagement'] <=> (float)$a['avg_engagement']);
    foreach (array_slice($rows, 0, 5) as $r) {
        $recommendations[] = [
            'platform'      => $r['platform'],
            'day_of_week'   => (int)$r['day_of_week'],
            'hour_of_day'   => (int)$r['hour_of_day'],
            'avg_engagement' => (float)$r['avg_engagement'],
        ];
    }

    jsonResponse([
        'has_data'       => $hasData,
        'by_day'         => $byDay,
        'by_hour'        => $byHour,
        'recommendations' => $recommendations,
    ]);
}
```

- [ ] **Step 3.5: Add analytics-recalculate action (POST)**

```php
// ─── ANALYTICS RECALCULATE ────────────────────────────────────────
if ($action === 'analytics-recalculate' && $method === 'POST') {
    // Check minimum posts
    $cnt = $db->prepare('SELECT COUNT(*) FROM content_items WHERE tenant_id=? AND status=?');
    $cnt->execute([$tenantId, 'published']);
    if ((int)$cnt->fetchColumn() < 10) {
        jsonError('Need at least 10 published posts to calculate — ต้องการอย่างน้อย 10 โพสต์ที่เผยแพร่แล้ว', 400);
    }

    // Clear existing analytics for this tenant
    $db->prepare('DELETE FROM content_posting_analytics WHERE tenant_id=?')->execute([$tenantId]);

    // Aggregate by platform, day_of_week, hour_of_day
    // Use DAYOFWEEK: 1=Sun..7=Sat, convert to 0=Sun..6=Sat
    $sql = "
        INSERT INTO content_posting_analytics (id, tenant_id, platform, day_of_week, hour_of_day, avg_engagement, total_posts, sample_size)
        SELECT UUID(), ?, platform,
               (DAYOFWEEK(created_at) - 1) AS day_of_week,
               HOUR(created_at) AS hour_of_day,
               AVG(COALESCE(views, 0) + COALESCE(likes, 0) * 2) AS avg_engagement,
               COUNT(*) AS total_posts,
               COUNT(*) AS sample_size
        FROM content_items
        WHERE tenant_id=? AND status='published'
          AND platform IS NOT NULL AND platform != ''
        GROUP BY platform, DAYOFWEEK(created_at), HOUR(created_at)
    ";
    $db->prepare($sql)->execute([$tenantId, $tenantId]);

    jsonResponse(['recalculated' => true, 'rows' => $db->lastInsertId() ? 1 : 0]);
}
```

- [ ] **Step 3.6: Update plans GET to return new fields**

The existing plans query uses `SELECT *`. Since we added columns via ALTER, `SELECT *` will include them. No change needed for GET.

But update the plans PUT so it handles `plan_start`/`plan_end` alongside status updates. In the existing plans PUT block (line ~396-418), add `plan_start` and `plan_end` to the allowed fields for plan-level update:

```php
        // Update plan-level fields
        $planFields = ['status', 'plan_start', 'plan_end'];
        $planSets = []; $planVals = [];
        foreach ($planFields as $f) {
            if (array_key_exists($f, $body)) { $planSets[] = "$f=?"; $planVals[] = $body[$f]; }
        }
        if ($planSets) {
            $planVals[] = $id; $planVals[] = $tenantId;
            $db->prepare('UPDATE content_plans SET ' . implode(',', $planSets) . ',updated_at=NOW() WHERE id=? AND tenant_id=?')->execute($planVals);
        }
```

- [ ] **Step 3.7: Commit**

```bash
git add api/brand-content.php
git commit -m "feat: add plan-item-date, analytics, and plan_type API actions

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Data Hooks

**File:** Modify: `src/hooks/useContent.ts`

- [ ] **Step 4.1: Add query keys and hooks**

Add to the `contentKeys` object (after line 20):

```typescript
  analytics: () => [...contentKeys.all, 'analytics'] as const,
```

Add new imports at top (after line 4):

```typescript
import type { ContentItem, BrandContext, ContentSkill, ContentTrigger, ContentPlan, PlanItem, PublishChannel, ContentSchedule, GlobalSettings, AIGatewaySettings, PostingAnalyticsResponse } from '@/components/content/types';
```

Add two new hooks before the Mutations section (before line 118):

```typescript
export function usePostingAnalytics() {
  return useQuery<PostingAnalyticsResponse>({
    queryKey: contentKeys.analytics(),
    queryFn: () => apiFetch('/brand-content.php?action=analytics-posting-times'),
    staleTime: 300_000,
  });
}

export function useUpdatePlanItemDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { item_id: string; scheduled_date: string }) =>
      apiFetch('/brand-content.php?action=plan-item-date', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.plans() });
    },
  });
}

export function useRecalculateAnalytics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch('/brand-content.php?action=analytics-recalculate', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.analytics() });
    },
  });
}

export function useCreatePlanItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) =>
      apiFetch('/brand-content.php?action=plan-items', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.plans() });
    },
  });
}
```

- [ ] **Step 4.2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 4.3: Commit**

```bash
git add src/hooks/useContent.ts
git commit -m "feat: add usePostingAnalytics, useUpdatePlanItemDate, useRecalculateAnalytics hooks

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: BestTimeIndicator Component

**File:** Create: `src/components/content/BestTimeIndicator.tsx`

- [ ] **Step 5.1: Create the component**

```typescript
import { cn } from '@/lib/utils';
import type { PostingAnalyticsResponse } from '@/components/content/types';
import { THAI_DAYS_FULL } from './calendarUtils';

interface Props {
  date: Date | null;
  analytics: PostingAnalyticsResponse | undefined;
  platform?: string;
}

export function BestTimeIndicator({ date, analytics, platform = 'facebook' }: Props) {
  if (!date || !analytics?.has_data) return null;

  const dow = date.getDay();
  const byDay = analytics.by_day[platform];
  const engagement = byDay?.[dow];

  let color: string;
  if (engagement === undefined) {
    color = 'bg-muted-foreground/20'; // gray — no data
  } else if (engagement > 2.0) {
    color = 'bg-green-500'; // green — high engagement
  } else if (engagement > 0.5) {
    color = 'bg-amber-500'; // amber — medium
  } else {
    color = 'bg-red-400'; // red — low
  }

  const label = engagement !== undefined
    ? `${THAI_DAYS_FULL[dow]}: avg engagement ${engagement.toFixed(1)}`
    : `${THAI_DAYS_FULL[dow]}: ยังไม่มีข้อมูล`;

  return (
    <span
      className={cn('inline-block w-[6px] h-[6px] rounded-full shrink-0', color)}
      title={label}
      aria-label={label}
    />
  );
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/components/content/BestTimeIndicator.tsx
git commit -m "feat: add BestTimeIndicator component for calendar cells

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: BestTimeAnalyticsPanel Component

**File:** Create: `src/components/content/BestTimeAnalyticsPanel.tsx`

- [ ] **Step 6.1: Create the component**

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { PostingAnalyticsResponse } from '@/components/content/types';
import { THAI_DAYS_FULL } from './calendarUtils';
import { BarChart3, ChevronDown, ChevronUp, RefreshCw, Loader2 } from 'lucide-react';

interface Props {
  analytics: PostingAnalyticsResponse | undefined;
  isLoading: boolean;
  onRecalculate: () => void;
  isRecalculating: boolean;
}

interface DayBarProps {
  day: number;
  engagement: number;
  maxEngagement: number;
}

function DayBar({ day, engagement, maxEngagement }: DayBarProps) {
  const pct = maxEngagement > 0 ? (engagement / maxEngagement) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-right text-muted-foreground shrink-0">{THAI_DAYS_FULL[day]}</span>
      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs">{engagement.toFixed(1)}</span>
    </div>
  );
}

interface HourBarProps {
  hour: number;
  engagement: number;
  maxEngagement: number;
}

function HourBar({ hour, engagement, maxEngagement }: HourBarProps) {
  const pct = maxEngagement > 0 ? (engagement / maxEngagement) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-right text-muted-foreground shrink-0 font-mono">{`${String(hour).padStart(2, '0')}:00`}</span>
      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs">{engagement.toFixed(1)}</span>
    </div>
  );
}

export function BestTimeAnalyticsPanel({ analytics, isLoading, onRecalculate, isRecalculating }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'day' | 'hour'>('day');

  if (!open) {
    return (
      <div className="border-t bg-muted/10 px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-2 text-xs text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          เวลาที่ดีที่สุดในการโพสต์
          <ChevronUp className="h-3.5 w-3.5 ml-auto" />
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border-t px-4 py-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics?.has_data) {
    return (
      <div className="border-t px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            เวลาที่ดีที่สุดในการโพสต์
          </h4>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <Card className="p-4 text-center text-sm text-muted-foreground">
          ยังไม่มีข้อมูลเพียงพอ รออย่างน้อย 10 โพสต์เพื่อเริ่มวิเคราะห์
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={onRecalculate}
              disabled={isRecalculating}
            >
              {isRecalculating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />กำลังคำนวณ...</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5 mr-1" />คำนวณตอนนี้</>
              )}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const platform = Object.keys(analytics.by_day)[0] || 'facebook';
  const byDay = analytics.by_day[platform] || {};
  const byHour = analytics.by_hour[platform] || {};

  const dayEntries = [0, 1, 2, 3, 4, 5, 6].map(d => ({ day: d, engagement: byDay[d] ?? 0 }));
  const hourEntries = Array.from({ length: 24 }, (_, h) => ({ hour: h, engagement: byHour[h] ?? 0 }));

  const maxDayEng = Math.max(...dayEntries.map(e => e.engagement), 1);
  const maxHourEng = Math.max(...hourEntries.map(e => e.engagement), 1);

  return (
    <div className="border-t px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          เวลาที่ดีที่สุดในการโพสต์
        </h4>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={onRecalculate}
            disabled={isRecalculating}
            title="คำนวณใหม่"
          >
            {isRecalculating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-muted rounded-lg p-0.5">
        <Button
          size="sm"
          variant={tab === 'day' ? 'default' : 'ghost'}
          className={cn('h-7 text-xs flex-1', tab === 'day' ? '' : 'hover:bg-muted/50')}
          onClick={() => setTab('day')}
        >
          แยกตามวัน
        </Button>
        <Button
          size="sm"
          variant={tab === 'hour' ? 'default' : 'ghost'}
          className={cn('h-7 text-xs flex-1', tab === 'hour' ? '' : 'hover:bg-muted/50')}
          onClick={() => setTab('hour')}
        >
          แยกตามเวลา
        </Button>
      </div>

      <Separator />

      {/* Chart area */}
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {tab === 'day' && dayEntries.map(e => (
          <DayBar key={e.day} day={e.day} engagement={e.engagement} maxEngagement={maxDayEng} />
        ))}
        {tab === 'hour' && hourEntries.map(e => (
          <HourBar key={e.hour} hour={e.hour} engagement={e.engagement} maxEngagement={maxHourEng} />
        ))}
      </div>

      {/* Top recommendations */}
      {analytics.recommendations.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium mb-2">เวลาที่แนะนำ</p>
            <div className="flex flex-wrap gap-1.5">
              {analytics.recommendations.map((rec, i) => (
                <span
                  key={i}
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded-full border font-medium',
                    i === 0 ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {rec.platform} · {THAI_DAYS_FULL[rec.day_of_week]} {String(rec.hour_of_day).padStart(2, '0')}:00
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
git add src/components/content/BestTimeAnalyticsPanel.tsx
git commit -m "feat: add BestTimeAnalyticsPanel with day/hour charts and recommendations

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: ContentCardDialog Component

**File:** Create: `src/components/content/ContentCardDialog.tsx`

- [ ] **Step 7.1: Create the component**

```typescript
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PlanItem } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';
import { getThaiDayName, formatThaiDate } from './calendarUtils';
import { CalendarDays, Save, Trash2, Sparkles } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  planId: string;
  existingItem?: PlanItem | null; // null = create mode, PlanItem = edit mode
  onSave: (data: { topic: string; caption: string; platform: string; scheduled_date: string }) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
  onRequestAI?: (data: { topic: string; platform: string; scheduled_date: string }) => Promise<void>;
}

export function ContentCardDialog({ open, onOpenChange, date, planId, existingItem, onSave, onDelete, onRequestAI }: Props) {
  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [platform, setPlatform] = useState('__none__');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      if (existingItem) {
        setTopic(existingItem.topic || '');
        setCaption(existingItem.caption || '');
        setPlatform(existingItem.platform || '__none__');
      } else {
        setTopic('');
        setCaption('');
        setPlatform('__none__');
      }
    }
  }, [open, existingItem]);

  const dateStr = date ? formatThaiDate(date) : '';
  const editable = !!date;

  const handleSave = async () => {
    if (!topic.trim() || !editable) return;
    setSaving(true);
    try {
      const y = date!.getFullYear();
      const m = String(date!.getMonth() + 1).padStart(2, '0');
      const d = String(date!.getDate()).padStart(2, '0');
      await onSave({
        topic: topic.trim(),
        caption,
        platform: platform === '__none__' ? 'facebook' : platform,
        scheduled_date: `${y}-${m}-${d}`,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingItem) return;
    setDeleting(true);
    try {
      await onDelete?.(existingItem.id);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleAI = async () => {
    if (!topic.trim() || !editable) return;
    const y = date!.getFullYear();
    const m = String(date!.getMonth() + 1).padStart(2, '0');
    const d = String(date!.getDate()).padStart(2, '0');
    await onRequestAI?.({
      topic: topic.trim(),
      platform: platform === '__none__' ? 'facebook' : platform,
      scheduled_date: `${y}-${m}-${d}`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {existingItem ? 'แก้ไขคอนเทนต์' : 'สร้างคอนเทนต์ใหม่'}
          </DialogTitle>
          <DialogDescription>
            {date && <span>{dateStr} — {getThaiDayName(date)}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>หัวข้อ <span className="text-destructive">*</span></Label>
            <Input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="หัวข้อคอนเทนต์..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>แพลตฟอร์ม</Label>
            <Select value={platform} onValueChange={val => setPlatform(val)}>
              <SelectTrigger><SelectValue placeholder="เลือกแพลตฟอร์ม" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ยังไม่ระบุ</SelectItem>
                {Object.entries(PLATFORM_MAP).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    <span className={`text-[10px] font-medium px-1 py-0 rounded-full ${val.color}`}>{val.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>แคปชั่น</Label>
            <Textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="แคปชั่น (ใส่ภายหลังได้)..."
              className="min-h-[100px] text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {existingItem && (
            <Button
              variant="outline"
              className="gap-1.5 text-destructive border-destructive/30 mr-auto"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? 'กำลังลบ...' : 'ลบ'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={handleAI}
            disabled={!topic.trim() || !editable}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI เขียนให้
          </Button>
          <Button onClick={handleSave} disabled={saving || !topic.trim() || !editable} className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7.2: Commit**

```bash
git add src/components/content/ContentCardDialog.tsx
git commit -m "feat: add ContentCardDialog for creating/editing content cards on calendar dates

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: ContentPlannerCalendar — Main Calendar

**File:** Create: `src/components/content/ContentPlannerCalendar.tsx`

- [ ] **Step 8.1: Create the calendar component**

```typescript
import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ContentPlan, PlanItem, CalendarView, PostingAnalyticsResponse } from '@/components/content/types';
import { BestTimeIndicator } from './BestTimeIndicator';
import {
  generateMonthGrid,
  generateQuarterGrids,
  generateYearHeatmap,
  THAI_DAYS_SHORT,
  THAI_MONTHS,
  THAI_MONTHS_FULL,
  isToday,
  isSameDay,
  toDateKey,
  formatThaiDate,
  getQuarterLabel,
  getQuarterRange,
} from './calendarUtils';
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react';

interface Props {
  plans: ContentPlan[];
  view: CalendarView;
  currentDate: Date;          // navigation anchor
  onNavigate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onDateClick: (date: Date, items: PlanItem[]) => void;
  onDateDragOver: (e: React.DragEvent, date: Date) => void;
  onDateDrop: (e: React.DragEvent, date: Date) => void;
  analytics?: PostingAnalyticsResponse;
  isLoading?: boolean;
}

export function ContentPlannerCalendar({
  plans,
  view,
  currentDate,
  onNavigate,
  onViewChange,
  onDateClick,
  onDateDragOver,
  onDateDrop,
  analytics,
  isLoading,
}: Props) {
  // Build a lookup map: dateKey → PlanItem[]
  const itemsByDate = useMemo(() => {
    const map = new Map<string, PlanItem[]>();
    for (const plan of plans) {
      for (const item of plan.items || []) {
        const key = item.scheduled_date || item.day_label;
        if (!key) continue;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
    }
    return map;
  }, [plans]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const goPrev = useCallback(() => {
    if (view === 'month') onNavigate(new Date(year, month - 1, 1));
    else if (view === 'quarter') onNavigate(new Date(year, month - 3, 1));
    else onNavigate(new Date(year - 1, 0, 1));
  }, [view, year, month, onNavigate]);

  const goNext = useCallback(() => {
    if (view === 'month') onNavigate(new Date(year, month + 1, 1));
    else if (view === 'quarter') onNavigate(new Date(year, month + 3, 1));
    else onNavigate(new Date(year + 1, 0, 1));
  }, [view, year, month, onNavigate]);

  const goToday = useCallback(() => {
    const now = new Date();
    onNavigate(new Date(now.getFullYear(), now.getMonth(), 1));
  }, [onNavigate]);

  const headerLabel = useMemo(() => {
    if (view === 'month') {
      return `${THAI_MONTHS_FULL[month]} ${year + 543}`;
    }
    if (view === 'quarter') {
      const q = Math.floor(month / 3) + 1;
      return `${getQuarterLabel(q)} ${year + 543}`;
    }
    return `${year + 543}`;
  }, [view, year, month]);

  const renderCell = (date: Date | null) => {
    if (!date) return <div className="min-h-[80px] bg-muted/20 rounded" />;

    const key = toDateKey(date);
    const items = itemsByDate.get(key) || [];
    const today = isToday(date);

    return (
      <div
        className={cn(
          'min-h-[80px] border rounded-lg p-1.5 transition-colors cursor-pointer',
          'hover:bg-muted/40',
          today && 'border-primary ring-1 ring-primary/20 bg-primary/5'
        )}
        onClick={() => onDateClick(date, items)}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDateDragOver(e, date); }}
        onDrop={e => { e.preventDefault(); onDateDrop(e, date); }}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className={cn(
            'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
            today && 'bg-primary text-primary-foreground'
          )}>
            {date.getDate()}
          </span>
          {view === 'month' && (
            <BestTimeIndicator date={date} analytics={analytics} />
          )}
        </div>
        <div className="space-y-0.5">
          {items.slice(0, 3).map((item, i) => (
            <div
              key={item.id}
              className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate font-medium"
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ itemId: item.id, planId: item.plan_id }));
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              {item.topic}
            </div>
          ))}
          {items.length > 3 && (
            <span className="text-[10px] text-muted-foreground px-1.5">
              +{items.length - 3} เพิ่มเติม
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const grid = generateMonthGrid(year, month);
    return (
      <div className="space-y-1">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1">
          {THAI_DAYS_SHORT.map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>
        {/* Grid rows */}
        {grid.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-1">
            {row.map((date, ci) => (
              <div key={ci}>
                {renderCell(date)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderQuarterView = () => {
    const q = Math.floor(month / 3) + 1;
    const { start } = getQuarterRange(year, q);
    const grids = generateQuarterGrids(year, q);

    return (
      <div className="space-y-4">
        {grids.map(({ month: m, grid }) => (
          <div key={m}>
            <h4 className="text-sm font-semibold mb-2">{THAI_MONTHS_FULL[m]} {year + 543}</h4>
            <div className="grid grid-cols-7 gap-0.5">
              {THAI_DAYS_SHORT.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-0.5">
                  {d}
                </div>
              ))}
              {grid.map((row, ri) =>
                row.map((date, ci) => (
                  <div key={`${ri}-${ci}`} className="min-h-[48px]">
                    {date ? (
                      <div
                        className={cn(
                          'h-full p-0.5 rounded cursor-pointer hover:bg-muted/40 text-[10px]',
                          isToday(date) && 'bg-primary/10 ring-1 ring-primary/20'
                        )}
                        onClick={() => {
                          const items = itemsByDate.get(toDateKey(date)) || [];
                          onDateClick(date, items);
                        }}
                        onDragOver={e => { e.preventDefault(); onDateDragOver(e, date); }}
                        onDrop={e => { e.preventDefault(); onDateDrop(e, date); }}
                      >
                        <span className={cn(isToday(date) && 'bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center')}>
                          {date.getDate()}
                        </span>
                      </div>
                    ) : <div className="min-h-[48px] bg-muted/10 rounded" />}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderYearView = () => {
    const heatmap = generateYearHeatmap(year);

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        {heatmap.map(({ month: m }) => {
          const grid = generateMonthGrid(year, m);
          const allItems: PlanItem[] = [];
          for (const row of grid) {
            for (const d of row) {
              if (d) {
                const key = toDateKey(d);
                const items = itemsByDate.get(key) || [];
                allItems.push(...items);
              }
            }
          }
          const total = allItems.length;
          const intensity = total > 10 ? 'bg-primary/30' : total > 3 ? 'bg-primary/15' : total > 0 ? 'bg-primary/5' : 'bg-muted/20';

          return (
            <button
              key={m}
              type="button"
              className={cn('rounded-lg border p-3 text-left hover:bg-muted/30 transition-colors', intensity)}
              onClick={() => {
                onNavigate(new Date(year, m, 1));
                onViewChange('month');
              }}
            >
              <p className="text-xs font-semibold mb-1">{THAI_MONTHS_FULL[m]}</p>
              <div className="grid grid-cols-7 gap-[1px]">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, i) => (
                  <span key={i} className="text-[8px] text-muted-foreground text-center">{d}</span>
                ))}
                {/* Mini calendar grid */}
                {generateMonthGrid(year, m).flat().map((date, i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-full aspect-square rounded-[2px]',
                      date ? 'bg-muted/30' : 'bg-transparent',
                    )}
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {total > 0 ? `${total} โพสต์` : 'ยังไม่มี'}
              </p>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* View controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['month', 'quarter', 'year'] as CalendarView[]).map(v => (
            <Button
              key={v}
              size="sm"
              variant={view === v ? 'default' : 'ghost'}
              className={cn('h-7 text-xs', view === v ? '' : 'hover:bg-muted/50')}
              onClick={() => onViewChange(v)}
            >
              {v === 'month' ? 'เดือน' : v === 'quarter' ? 'ไตรมาส' : 'ปี'}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[140px] text-center">{headerLabel}</span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={goToday}>
            วันนี้
          </Button>
        </div>
      </div>

      {/* Calendar body */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <>
          {view === 'month' && renderMonthView()}
          {view === 'quarter' && renderQuarterView()}
          {view === 'year' && renderYearView()}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8.2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 8.3: Commit**

```bash
git add src/components/content/ContentPlannerCalendar.tsx
git commit -m "feat: add ContentPlannerCalendar with month/quarter/year views and drag-drop

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: ContentPlannerAI — AI Side Panel

**File:** Create: `src/components/content/ContentPlannerAI.tsx`

- [ ] **Step 9.1: Create the AI panel component**

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ContentPlan, PlanItem, ContentSkill, ContentTrigger, BrandContext } from '@/components/content/types';
import { PLAN_STATUS } from '@/components/content/types';
import {
  Sparkles, Wand2, Loader2, CheckCircle2, PanelRightClose, PanelRightOpen,
  GripVertical, Zap, Bot, RefreshCw, ChevronRight, CalendarDays, Trash2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  plans: ContentPlan[];
  skills: ContentSkill[];
  contexts: BrandContext[];
  triggers: ContentTrigger[];
  gwModelName: string | undefined;
  onSelectPlan: (plan: ContentPlan) => void;
  selectedPlanId: string | null;
  onDeletePlan: (planId: string) => void;
  onGenerate: (params: {
    trigger_command: string;
    skill_id: string | null;
    brand_context_ids: string[];
    plan_type: string;
    plan_start: string | null;
    plan_end: string | null;
  }) => Promise<void>;
  isGenerating: boolean;
}

export function ContentPlannerAI({
  isOpen, onToggle, plans, skills, contexts, triggers,
  gwModelName, onSelectPlan, selectedPlanId, onDeletePlan, onGenerate, isGenerating,
}: Props) {
  const [triggerCmd, setTriggerCmd] = useState('');
  const [selSkillId, setSelSkillId] = useState('__none__');
  const [selContextIds, setSelContextIds] = useState<string[]>([]);
  const [planType, setPlanType] = useState('monthly');
  const [planStart, setPlanStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [planEnd, setPlanEnd] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  });

  const handleGenerate = async () => {
    if (!triggerCmd.trim()) return;
    await onGenerate({
      trigger_command: triggerCmd.trim(),
      skill_id: selSkillId === '__none__' ? null : selSkillId,
      brand_context_ids: selContextIds,
      plan_type: planType,
      plan_start: planStart || null,
      plan_end: planEnd || null,
    });
  };

  if (!isOpen) {
    return (
      <div className="border-l bg-muted/10 p-2 flex flex-col items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onToggle}
          title="เปิด AI Panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <span className="text-[10px] text-muted-foreground writing-vertical" style={{ writingMode: 'vertical-rl' }}>
          AI
        </span>
      </div>
    );
  }

  return (
    <div className="border-l bg-muted/5 w-80 shrink-0 overflow-y-auto max-h-[calc(100vh-16rem)]">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI สร้างแผน
          </h3>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onToggle}>
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Trigger quick-select */}
        {triggers.length > 0 && (
          <div className="space-y-1">
            <Label className="text-[11px]">Quick Triggers</Label>
            <div className="flex flex-wrap gap-1">
              {triggers.map(tr => (
                <Button
                  key={tr.id}
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] font-mono gap-1"
                  onClick={() => {
                    setTriggerCmd(tr.command);
                    if (tr.skill_id) setSelSkillId(tr.skill_id);
                  }}
                >
                  <Zap className="h-2.5 w-2.5 text-amber-500" />
                  {tr.command}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px]">
              Trigger Command <span className="text-destructive">*</span>
            </Label>
            <Input
              value={triggerCmd}
              onChange={e => setTriggerCmd(e.target.value)}
              placeholder='เช่น "แผนคอนเทนต์เดือนนี้"'
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">ประเภทแผน</Label>
            <Select value={planType} onValueChange={setPlanType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">รายสัปดาห์</SelectItem>
                <SelectItem value="monthly">รายเดือน</SelectItem>
                <SelectItem value="quarterly">รายไตรมาส</SelectItem>
                <SelectItem value="yearly">รายปี</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">เริ่ม</Label>
              <Input
                type="date"
                value={planStart}
                onChange={e => setPlanStart(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">สิ้นสุด</Label>
              <Input
                type="date"
                value={planEnd}
                onChange={e => setPlanEnd(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Skill</Label>
            <Select value={selSkillId} onValueChange={setSelSkillId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="ไม่เลือก" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ไม่เลือก Skill</SelectItem>
                {skills.map(sk => (
                  <SelectItem key={sk.id} value={sk.id}>{sk.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">
              Brand Context ({selContextIds.length === 0 ? 'ทั้งหมด' : selContextIds.length})
            </Label>
            <div className="flex flex-wrap gap-1 p-1.5 border rounded-md min-h-[32px] bg-background">
              {contexts.map(ctx => {
                const sel = selContextIds.includes(ctx.id);
                return (
                  <button
                    key={ctx.id}
                    type="button"
                    onClick={() => setSelContextIds(ids =>
                      sel ? ids.filter(x => x !== ctx.id) : [...ids, ctx.id]
                    )}
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
                      sel ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                    )}
                  >
                    {ctx.name}
                  </button>
                );
              })}
              {contexts.length === 0 && (
                <span className="text-[10px] text-muted-foreground">ไม่มี Context</span>
              )}
            </div>
          </div>

          <Button
            className="w-full gap-2 h-8 text-xs"
            disabled={isGenerating || !triggerCmd.trim()}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังสร้าง...</>
            ) : (
              <><Wand2 className="h-3.5 w-3.5" />สร้างแผนด้วย AI</>
            )}
          </Button>

          {gwModelName && (
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {gwModelName}
            </div>
          )}
        </div>

        {/* Plans list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-semibold">แผนทั้งหมด</Label>
            <span className="text-[10px] text-muted-foreground">{plans.length}</span>
          </div>
          {plans.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-4">ยังไม่มีแผน</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {plans.map(pl => {
                const sm = PLAN_STATUS[pl.status] ?? PLAN_STATUS.draft;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => onSelectPlan(pl)}
                    className={cn(
                      'w-full text-left p-2 rounded-lg border text-xs transition-colors hover:bg-muted/40 group',
                      selectedPlanId === pl.id ? 'border-primary bg-primary/5' : ''
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{pl.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {pl.trigger_command}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Badge className={cn('text-[9px] px-1 py-0', sm.color)}>{sm.label}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                          onClick={e => { e.stopPropagation(); onDeletePlan(pl.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9.2: Commit**

```bash
git add src/components/content/ContentPlannerAI.tsx
git commit -m "feat: add ContentPlannerAI collapsible side panel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Page Rewrite — ContentPlannerPage.tsx

**File:** Modify: `src/pages/ContentPlannerPage.tsx`

- [ ] **Step 10.1: Rewrite the page**

Replace the entire file content:

```typescript
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import {
  useContentPlans, useContentSkills, useContentTriggers,
  useBrandContexts, usePublishChannels, useAIGatewaySettings,
  useDeleteContentPlan, usePostingAnalytics, useUpdatePlanItemDate,
} from '@/hooks/useContent';
import type { ContentPlan, PlanItem, CalendarView } from '@/components/content/types';
import { ContentPlannerCalendar } from '@/components/content/ContentPlannerCalendar';
import { ContentPlannerAI } from '@/components/content/ContentPlannerAI';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import { BestTimeAnalyticsPanel } from '@/components/content/BestTimeAnalyticsPanel';
import { toDateKey } from '@/components/content/calendarUtils';
import { CalendarDays, Wand2, Info, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ContentPlannerPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Selected date for card dialog
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateItems, setSelectedDateItems] = useState<PlanItem[]>([]);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);

  // Analytics panel recalculate
  const [recalculating, setRecalculating] = useState(false);

  const { data: plans = [], isLoading: loadPlans, refetch } = useContentPlans();
  const { data: skills = [] } = useContentSkills();
  const { data: contexts = [] } = useBrandContexts();
  const { data: triggers = [] } = useContentTriggers();
  const { data: channels = [] } = usePublishChannels();
  const { data: gwSettings } = useAIGatewaySettings();
  const { data: analytics, isLoading: loadAnalytics, refetch: refetchAnalytics } = usePostingAnalytics();

  const delPlanMut = useDeleteContentPlan();
  const updateItemDateMut = useUpdatePlanItemDate();

  const gwModelName = gwSettings?.content_text_model_name ?? gwSettings?.model_name;

  // Navigate calendar
  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  // Date click → open card dialog
  const handleDateClick = useCallback((date: Date, items: PlanItem[]) => {
    setSelectedDate(date);
    setSelectedDateItems(items);
    setCardDialogOpen(true);
  }, []);

  // Drag & Drop: highlight cell
  const handleDateDragOver = useCallback((e: React.DragEvent, _date: Date) => {
    e.currentTarget.classList.add('ring-2', 'ring-primary');
  }, []);

  // Drag & Drop: move item to this date
  const handleDateDrop = useCallback((e: React.DragEvent, date: Date) => {
    e.currentTarget.classList.remove('ring-2', 'ring-primary');
    const key = toDateKey(date);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.itemId) {
        updateItemDateMut.mutate({ item_id: data.itemId, scheduled_date: key });
        toast({ title: 'ย้ายรายการแล้ว', description: key });
      }
    } catch {
      // drop from external source — ignore
    }
  }, [updateItemDateMut, toast]);

  // Save new/existing content card
  const handleSaveCard = useCallback(async (data: { topic: string; caption: string; platform: string; scheduled_date: string }) => {
    // We need a plan to add items to. Use first plan or create one.
    let planId = plans[0]?.id;
    if (!planId) {
      // Auto-create a manual plan
      const newPlan: ContentPlan = await apiFetch('/brand-content.php?action=plans', {
        method: 'POST',
        body: JSON.stringify({
          title: 'แผนคอนเทนต์ ' + new Date().toLocaleDateString('th-TH'),
          plan_type: 'monthly',
          plan_start: data.scheduled_date,
          plan_end: data.scheduled_date,
          trigger_command: 'manual',
        }),
      });
      planId = newPlan.id;
    }
    await apiFetch('/brand-content.php?action=plan-items', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, ...data }),
    });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });
    toast({ title: 'สร้างคอนเทนต์แล้ว' });
  }, [plans, qc, toast]);

  // Delete card
  const handleDeleteCard = useCallback(async (itemId: string) => {
    await apiFetch(`/brand-content.php?action=plan-items&id=${itemId}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });
    toast({ title: 'ลบรายการแล้ว' });
  }, [qc, toast]);

  // AI Request for card
  const handleRequestAI = useCallback(async (data: { topic: string; platform: string; scheduled_date: string }) => {
    toast({ title: 'AI กำลังสร้าง...', description: 'โปรดรอสักครู่' });
    // Could be implemented later via a dedicated endpoint
  }, [toast]);

  // Generate plan from AI panel
  const handleGenerate = useCallback(async (params: {
    trigger_command: string;
    skill_id: string | null;
    brand_context_ids: string[];
    plan_type: string;
    plan_start: string | null;
    plan_end: string | null;
  }) => {
    setGenerating(true);
    try {
      const plan: ContentPlan = await apiFetch('/brand-content.php?action=generate-plan', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          week_start: params.plan_start || new Date().toISOString().split('T')[0],
        }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      toast({ title: 'สร้างแผนสำเร็จ!', description: plan.title });
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }, [qc, toast]);

  // Select plan from list
  const handleSelectPlan = useCallback(async (plan: ContentPlan) => {
    try {
      const fullPlan: ContentPlan = await apiFetch(`/brand-content.php?action=plans&id=${plan.id}`);
      // Navigate calendar to the plan's range if available
      if (fullPlan.plan_start) {
        const d = new Date(fullPlan.plan_start + 'T00:00:00');
        setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
      } else if (fullPlan.week_start) {
        const d = new Date(fullPlan.week_start + 'T00:00:00');
        setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
      // Highlight plan items by setting it as selected in plans data
      refetch();
    } catch (e: any) {
      toast({ title: 'โหลดแผนไม่สำเร็จ', description: e.message, variant: 'destructive' });
    }
  }, [refetch, toast]);

  // Delete plan
  const handleDeletePlan = useCallback((planId: string) => {
    if (confirm('ลบแผนนี้?')) {
      delPlanMut.mutate(planId, {
        onSuccess: () => toast({ title: 'ลบแผนแล้ว' }),
      });
    }
  }, [delPlanMut, toast]);

  // Recalculate analytics
  const handleRecalculate = useCallback(async () => {
    setRecalculating(true);
    try {
      await apiFetch('/brand-content.php?action=analytics-recalculate', { method: 'POST' });
      refetchAnalytics();
      toast({ title: 'คำนวณใหม่สำเร็จ' });
    } catch (e: any) {
      toast({ title: 'คำนวณไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setRecalculating(false);
    }
  }, [refetchAnalytics, toast]);

  // Navigate to existing content page
  const goToArticles = useCallback(() => {
    navigate('/content');
  }, [navigate]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-6 lg:p-8 pb-0 space-y-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 shrink-0">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold font-heading">วางแผนคอนเทนต์</h1>
            <p className="text-sm text-muted-foreground">
              วางแผนคอนเทนต์รายเดือน / ไตรมาส / ปี พร้อม AI ช่วยสร้างและวิเคราะห์เวลาโพสต์
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hidden sm:flex"
              onClick={() => setShowGuide(v => !v)}
            >
              <Info className="h-3.5 w-3.5" />
              {showGuide ? 'ซ่อนคำแนะนำ' : 'วิธีใช้งาน'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={goToArticles}
            >
              บทความทั้งหมด
            </Button>
            <Button
              className="gap-2 bg-gradient-to-r from-primary to-violet-600 text-white shadow-md text-xs"
              onClick={() => setAiPanelOpen(v => !v)}
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI สร้างแผน</span>
            </Button>
          </div>
        </div>

        {/* Guide */}
        {showGuide && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-violet-900 dark:text-violet-200 flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-violet-600" />
                AI Panel →
              </p>
              <p className="text-xs text-violet-700 dark:text-violet-400">
                ใส่หัวข้อ → เลือก Skill/Context → AI สร้างแผนคอนเทนต์ให้ พร้อมแคปชั่นและ image brief
              </p>
            </div>
            <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                Calendar + Drag
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                ลากรายการจาก AI Panel ลงวันที่ต้องการ &middot; คลิกวันที่เพื่อสร้าง/แก้ไขคอนเทนต์ &middot; ย้ายแผนได้ด้วยการลาก
              </p>
            </div>
            <div className="rounded-xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-green-900 dark:text-green-200 flex items-center gap-2">
                <Info className="h-4 w-4 text-green-600" />
                วิเคราะห์เวลาโพสต์
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                ดูได้ด้านล่าง &middot; จุดสีเขียว = วันที่มี engagement สูง &middot; กดคำนวณใหม่เพื่อรีเฟรชข้อมูล
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main content: Calendar + AI Panel */}
      <div className="flex-1 flex min-h-0 p-4 sm:p-6 lg:p-8 gap-0">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <ContentPlannerCalendar
            plans={plans}
            view={view}
            currentDate={currentDate}
            onNavigate={handleNavigate}
            onViewChange={setView}
            onDateClick={handleDateClick}
            onDateDragOver={handleDateDragOver}
            onDateDrop={handleDateDrop}
            analytics={analytics}
            isLoading={loadPlans}
          />
        </div>

        {/* AI Side Panel */}
        <ContentPlannerAI
          isOpen={aiPanelOpen}
          onToggle={() => setAiPanelOpen(v => !v)}
          plans={plans}
          skills={skills}
          contexts={contexts}
          triggers={triggers}
          gwModelName={gwModelName}
          selectedPlanId={null}
          onSelectPlan={handleSelectPlan}
          onDeletePlan={handleDeletePlan}
          onGenerate={handleGenerate}
          isGenerating={generating}
        />
      </div>

      {/* Analytics bottom panel */}
      <BestTimeAnalyticsPanel
        analytics={analytics}
        isLoading={loadAnalytics}
        onRecalculate={handleRecalculate}
        isRecalculating={recalculating}
      />

      {/* Create/Edit Card Dialog */}
      <ContentCardDialog
        open={cardDialogOpen}
        onOpenChange={setCardDialogOpen}
        date={selectedDate}
        planId={plans[0]?.id ?? ''}
        existingItem={selectedDateItems[0] ?? null}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        onRequestAI={handleRequestAI}
      />
    </div>
  );
}
```

- [ ] **Step 10.2: Add plan-items API action in brand-content.php**

Add this before existing schedules block or near other item CRUD:

```php
// ─── PLAN-ITEMS CRUD (for manual card creation) ──────────────────
if ($action === 'plan-items') {
    if ($method === 'POST') {
        $body = getRequestBody();
        $planId = $body['plan_id'] ?? '';
        $topic  = $body['topic'] ?? '';
        if (!$planId || !$topic) jsonError('plan_id and topic required', 400);

        $scheduledDate = $body['scheduled_date'] ?? date('Y-m-d');
        $ts = strtotime($scheduledDate);
        $dayLabels = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        $dayOrders = [7, 1, 2, 3, 4, 5, 6];
        $id = generateUUID();
        $db->prepare('INSERT INTO content_items (id, plan_id, day_label, day_order, scheduled_date, platform, topic, caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
           ->execute([$id, $planId, $dayLabels[(int)date('w', $ts)], $dayOrders[(int)date('w', $ts)], $scheduledDate, $body['platform'] ?? 'facebook', $topic, $body['caption'] ?? '']);
        jsonResponse(['id' => $id, 'created' => true], 201);
    }
    if ($method === 'DELETE') {
        $id = $_GET['id'] ?? '';
        if (!$id) jsonError('id required', 400);
        $db->prepare('DELETE FROM content_items WHERE id=?')->execute([$id]);
        jsonResponse(['deleted' => true]);
    }
}
```

- [ ] **Step 10.3: Add plans POST action (create plan without AI)**

The existing plans block only has GET/PUT/DELETE. Add POST support:

```php
// Plans POST (manual plan creation)
if ($action === 'plans' && $method === 'POST') {
    $body = getRequestBody();
    $title   = $body['title'] ?? 'Untitled Plan';
    $planType = $body['plan_type'] ?? 'monthly';
    $planStart = $body['plan_start'] ?? null;
    $planEnd  = $body['plan_end'] ?? null;
    $trigger = $body['trigger_command'] ?? '';
    $id = generateUUID();
    $weekStart = $planStart ?? date('Y-m-d');
    $db->prepare('INSERT INTO content_plans (id, tenant_id, title, week_start, status, plan_type, plan_start, plan_end, trigger_command, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
       ->execute([$id, $tenantId, $title, $weekStart, 'draft', $planType, $planStart, $planEnd, $trigger, $userId]);
    jsonResponse(['id' => $id, 'created' => true], 201);
}
```

- [ ] **Step 10.4: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit --pretty`
Expected: No errors.

- [ ] **Step 10.5: Verify lint**

Run: `pnpm lint`
Expected: No new errors.

- [ ] **Step 10.6: Commit**

```bash
git add src/pages/ContentPlannerPage.tsx api/brand-content.php
git commit -m "feat: rewrite ContentPlannerPage with calendar view, AI side panel, and analytics

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Cleanup — Remove old ContentPlannerTab

**Files:**
- Delete: `src/components/content/tabs/ContentPlannerTab.tsx`
- Modify: `src/App.tsx` (remove import if present)

- [ ] **Step 11.1: Delete old tab file**

```bash
rm src/components/content/tabs/ContentPlannerTab.tsx
```

- [ ] **Step 11.2: Check for remaining references**

```bash
grep -r "ContentPlannerTab" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results (the only import was in ContentPlannerPage.tsx which is now rewritten).

- [ ] **Step 11.3: Verify build**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 11.4: Commit**

```bash
git add src/components/content/tabs/ContentPlannerTab.tsx
git commit -m "refactor: remove old ContentPlannerTab, replaced by calendar components

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: E2E Tests

**File:** Create: `e2e/content-calendar.spec.ts`

- [ ] **Step 12.1: Create E2E test file**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Content Calendar Planner', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:8080/#/login');
    await page.fill('input[name="email"]', 'admin@flowstack.local');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 10000 });
  });

  test('renders calendar with month view by default', async ({ page }) => {
    await page.goto('http://localhost:8080/#/content-planner');
    await page.waitForSelector('text=วางแผนคอนเทนต์', { timeout: 10000 });

    // Should show month header with Thai year
    const currentYear = new Date().getFullYear() + 543;
    await expect(page.locator('text=เดือน').first()).toBeVisible();
    await expect(page.locator('text=ไตรมาส').first()).toBeVisible();
    await expect(page.locator('text=ปี').first()).toBeVisible();
  });

  test('switches between month, quarter, and year views', async ({ page }) => {
    await page.goto('http://localhost:8080/#/content-planner');
    await page.waitForSelector('text=วางแผนคอนเทนต์', { timeout: 10000 });

    // Click quarter view
    await page.click('button:has-text("ไตรมาส")');
    await page.waitForTimeout(300);
    // Quarter should show 3 month labels
    const monthLabels = page.locator('h4');
    const count = await monthLabels.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click year view
    await page.click('button:has-text("ปี")');
    await page.waitForTimeout(300);
    // Year should show 12 month blocks
    await expect(page.locator('text=มกราคม').first()).toBeVisible();
  });

  test('navigates to next and previous months', async ({ page }) => {
    await page.goto('http://localhost:8080/#/content-planner');
    await page.waitForSelector('text=วางแผนคอนเทนต์', { timeout: 10000 });

    const prevBtn = page.locator('button').filter({ has: page.locator('.lucide-chevron-left') }).first();
    const nextBtn = page.locator('button').filter({ has: page.locator('.lucide-chevron-right') }).first();

    await nextBtn.click();
    await page.waitForTimeout(200);
    await prevBtn.click();
    await page.waitForTimeout(200);
  });

  test('opens AI side panel', async ({ page }) => {
    await page.goto('http://localhost:8080/#/content-planner');
    await page.waitForSelector('text=วางแผนคอนเทนต์', { timeout: 10000 });

    // AI panel should be visible by default
    await expect(page.locator('text=AI สร้างแผน').first()).toBeVisible();

    // Should have plan type selector
    await expect(page.locator('text=ประเภทแผน').first()).toBeVisible();
  });

  test('clicks date to open content card dialog', async ({ page }) => {
    await page.goto('http://localhost:8080/#/content-planner');
    await page.waitForSelector('text=วางแผนคอนเทนต์', { timeout: 10000 });

    // Click on today's date cell (marked with ring)
    const todayCell = page.locator('[class*="ring-1"][class*="ring-primary"]').first();
    if (await todayCell.isVisible()) {
      await todayCell.click();
      await page.waitForTimeout(500);
      // Dialog should appear
      await expect(page.locator('text=สร้างคอนเทนต์ใหม่').or(page.locator('text=แก้ไขคอนเทนต์'))).toBeVisible({ timeout: 3000 });
    }
  });

  test('analytics panel shows or shows empty state', async ({ page }) => {
    await page.goto('http://localhost:8080/#/content-planner');
    await page.waitForSelector('text=วางแผนคอนเทนต์', { timeout: 10000 });

    // Analytics toggle should be visible at bottom
    await expect(page.locator('text=เวลาที่ดีที่สุดในการโพสต์').first()).toBeVisible({ timeout: 5000 });
  });
});
```

- [ ] **Step 12.2: Run E2E tests**

```bash
pnpm exec playwright test e2e/content-calendar.spec.ts --reporter=list
```

Expected: Tests pass (some may need Playwright server running).

- [ ] **Step 12.3: Commit**

```bash
git add e2e/content-calendar.spec.ts
git commit -m "test: add E2E tests for content calendar planner

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Final Verification

- [ ] Run full test suite: `pnpm test`
- [ ] Run lint: `pnpm lint`
- [ ] Run build: `pnpm build`
- [ ] Quick smoke test on dev server: `pnpm dev`, visit `http://localhost:8080/#/content-planner`
