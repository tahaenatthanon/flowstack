# Content Calendar Planner — Design Spec

**Date:** 2026-05-10
**Status:** Approved (design phase complete → awaiting implementation plan)

## Overview

Redesign `/#/content-planner` from a week-based AI-generation-only page into a Facebook-style content calendar supporting monthly, quarterly, and yearly plans with best-posting-time analytics.

## Requirements

1. Calendar views: Month, Quarter, Year
2. AI content plan generation (monthly/quarterly/yearly) as a collapsible side panel
3. Drag & Drop from AI-generated item list onto calendar dates
4. Best-posting-time analytics overlay showing engagement by day/hour per platform
5. Visual indicator per date cell: green/amber/gray dot based on engagement data
6. Click any date to manually create or edit content

## Architecture

### New Components (under `src/components/content/`)

| Component | Purpose |
|---|---|
| `ContentPlannerCalendar.tsx` | Main calendar rendering month/quarter/year grid, drag-drop targets |
| `ContentPlannerAI.tsx` | AI generation side panel (collapsible), replaces current inline generate card |
| `ContentCardDialog.tsx` | Create/edit dialog for a single content card on a selected date |
| `BestTimeIndicator.tsx` | Colored dot + tooltip per calendar cell |
| `BestTimeAnalyticsPanel.tsx` | Collapsible bottom panel with bar/line charts (day-of-week, hour-of-day) |

### Components to REMOVE

- `src/components/content/tabs/ContentPlannerTab.tsx` — fully replaced

### Page Rewrite

- `src/pages/ContentPlannerPage.tsx` — rewrite from scratch as thin shell composing Calendar + AI Panel + Analytics

### Layout

```
┌──────────────────────────────────────────────────────┐
│ Header: [Month|Quarter|Year] [< >] [Today] [+ New]  │
├────────────────────────────────────┬─────────────────┤
│                                    │ AI Panel (right)│
│        Calendar Grid               │ collapsible     │
│        (draggable cells)           │                 │
│                                    │ · Plan type     │
│                                    │ · Trigger cmd   │
│                                    │ · Generate btn  │
│                                    │ · Results list  │
│                                    │   (drag items)  │
├────────────────────────────────────┴─────────────────┤
│ Analytics Panel (toggleable, bottom)                  │
└──────────────────────────────────────────────────────┘
```

## Calendar Views

| View | Display | Navigation | Use case |
|------|---------|------------|----------|
| Month | 5-week grid, Mon-Sun | Month arrows | Daily/weekly planning |
| Quarter | 3-month compact grid | Quarter (Q1-Q4) | Campaign/seasonal |
| Year | 12 mini-month blocks, heatmap | Year arrows | Annual strategy |

- Month cells: show up to 3 content badges, then "+N more"
- Quarter cells: 1-2 compact badges
- Year cells: color heatmap by post count
- All views: click date → ContentCardDialog; drag over → highlight cell

## Database Changes

### Alter `content_plans`
```sql
ALTER TABLE content_plans
  ADD COLUMN plan_type ENUM('weekly','monthly','quarterly','yearly') NOT NULL DEFAULT 'weekly',
  ADD COLUMN plan_start DATE NULL,
  ADD COLUMN plan_end DATE NULL;
```

### New: `content_posting_analytics`
```sql
CREATE TABLE content_posting_analytics (
  id CHAR(36) NOT NULL,
  tenant_id VARCHAR(100) NOT NULL,
  platform VARCHAR(100) NOT NULL,
  day_of_week TINYINT NOT NULL,
  hour_of_day TINYINT NOT NULL,
  avg_engagement FLOAT NOT NULL DEFAULT 0,
  total_posts INT NOT NULL DEFAULT 0,
  sample_size INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY idx_tenant_platform_day_hour (tenant_id, platform, day_of_week, hour_of_day)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Migration
- `database/migrations/2026_05_10_HHMMSS_content_calendar_upgrade.sql`

## API Changes (in `api/brand-content.php`)

| Action | Method | Purpose |
|--------|--------|---------|
| `generate-monthly-plan` | POST | AI generates monthly/quarterly/yearly plan |
| `analytics-posting-times` | GET | Return best posting times per platform |
| `analytics-recalculate` | POST | Recalculate from content_items engagement |
| `plan-item-date` | PUT | Move item to different date (drag & drop) |

Existing actions (`generate-plan`, `generate-article`, `generate-image`, `schedules`, `publish`) are unchanged.

## Frontend Data

### New/Extended Hooks

| Hook | Purpose |
|------|---------|
| `usePostingAnalytics()` | Fetch best times, returns `{ byDay, byHour, recommendations }` |
| `useUpdatePlanItemDate()` | Mutation for drag-to-move |

### Extended types (`types.ts`)
```ts
interface ContentPlan {
  // ... existing fields
  plan_type: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  plan_start: string | null;
  plan_end: string | null;
}

interface PostingAnalytics {
  platform: string;
  day_of_week: number;
  hour_of_day: number;
  avg_engagement: number;
}
```

## Drag & Drop Flow

1. User generates plan in AI panel → items appear as a list
2. Each list item has a drag handle (GripVertical icon)
3. Dragging over a calendar date → blue border glow on target cell
4. On drop → PUT `plan-item-date` to update `scheduled_date`
5. Calendar cell refreshes to show new item
6. Items already on calendar are also draggable between dates
7. Brief scale animation on drop confirmation

## Best Time Analytics

- Data source: `content_items` engagement fields (`views`, `likes`) correlated with publish timestamps
- Requires minimum 10 published posts before analysis runs
- Cached in `content_posting_analytics` table, recalculated on demand
- Display: bar chart (day of week), line chart (hour of day), per platform

### Analytics Panel (UI)

```
┌─────────────────────────────────────────┐
│ 📊 Best Posting Times      [collapse ▲] │
├─────────────┬───────────────────────────┤
│ By Day      │ By Hour (avg engagement)  │
│ จ  ████████ │ 08:00 ████████████ 2.3K   │
│ อ  █████    │ 12:00 ██████████   1.8K   │
│ พ  ████████ │ 17:00 ████████     1.4K   │
└─────────────┴───────────────────────────┘
```

## States & Edge Cases

- **Empty calendar:** ghost state with CTA opening AI panel
- **No analytics:** "ยังไม่มีข้อมูลเพียงพอ รออย่างน้อย 10 โพสต์เพื่อเริ่มวิเคราะห์"
- **Loading:** skeleton grid for calendar, spinner on AI panel
- **Error:** toast on failed generation, retry button
- **Drag conflict:** warn if date already has 3+ items for same platform
- **Mobile:** calendar collapses to week view; AI panel becomes bottom drawer

## Testing

- Unit: calendar grid date math, best-time calculation, plan type logic
- Component: `ContentPlannerCalendar`, `BestTimeIndicator`, `ContentCardDialog` render + interaction states
- E2E: extend `e2e/content-campaign-bridge.spec.ts` — create plan, drag item, verify date, check analytics panel

## Tech Constraints

- UI text: Thai language (per CLAUDE.md)
- React 18 + TypeScript + Vite (existing stack)
- Tailwind CSS + shadcn-ui primitives
- TanStack React Query for data fetching
- Chart rendering: use lightweight inline SVGs or simple bar elements (no heavy chart library dependency)
- Drag & Drop: use native HTML5 drag-and-drop API (no external library)
- PHP backend with JWT auth, tenant isolation
