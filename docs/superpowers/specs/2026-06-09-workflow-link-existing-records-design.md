# Workflow: Link Existing Records Design

**Date:** 2026-06-09  
**Status:** Approved

## Overview

Allow users to link existing Projects, Sales Opportunities, and Support Tickets to Workflow definitions — both in bulk from WorkflowPage and contextually from each entity's detail page. Each entity record can have at most one active workflow instance; it must be cancelled before re-linking.

---

## Requirements

- **Scope:** All entity types — `project`, `opportunity`, `support_ticket`
- **Entry points:** WorkflowPage (bulk) + detail pages (contextual)
- **Cardinality:** 1 active workflow per record; cancel before re-linking
- **Unlink:** Sets instance status to `cancelled` (preserves step_log audit trail)

---

## Section 1: Backend API (`api/workflow-instances.php`)

### New: GET `?entity_type=X&unlinked=1`

Returns all tenant records of the given entity type that have **no active workflow instance**.

Logic:
- Query the appropriate table (`projects`, `sales_opportunities`, `support_tickets`) filtered by `tenant_id`
- LEFT JOIN `workflow_instances` on `entity_type + entity_id` where `status = 'active'`
- Return only rows where the join produces no match (unlinked)

Response shape per entity type:
```json
[
  { "id": "...", "name/title": "...", "status": "...", "company_name": "..." }
]
```

Tables and label fields:
| entity_type      | table                 | name field | status field |
|------------------|-----------------------|------------|--------------|
| project          | projects              | name       | status       |
| opportunity      | sales_opportunities   | title      | stage        |
| support_ticket   | support_tickets       | title      | status       |

Company name: JOIN `companies` on `company_id` where available.

### New: DELETE `?id=X`

Cancels a workflow instance by setting:
```sql
UPDATE workflow_instances SET status='cancelled', completed_at=NOW() WHERE id=?
```
Does **not** delete the row — preserves `workflow_step_logs` for audit.

Auth: only the instance's tenant may cancel.

### Existing: POST (no changes)

Used as-is for creating single instances. Frontend loops for bulk creation.

---

## Section 2: WorkflowPage — Bulk Link Dialog

### Toolbar addition

When a workflow definition is selected, show a new button:  
**"ผูกรายการ"** — alongside the existing Save button.

### Link Dialog

- **Header:** "ผูกรายการกับ [workflow name]"
- **Filter input:** text search on record name/title
- **Table columns:** `☐ | ชื่อ | สถานะ | บริษัท`
- **Data source:** `GET /workflow-instances.php?entity_type=X&unlinked=1` where X = definition's entity_type
- **Confirm button:** "ผูก (N รายการ)" — disabled when nothing selected, shows Loader2 while posting
- **On success:** 
  - Invalidate `['workflow-global-analytics']`
  - Invalidate `['workflow-instance', entityType, entityId]` for each linked record
  - Toast "ผูก N รายการเรียบร้อย"

### Cancel instance (InstanceView)

In the `InstanceView` bar (shown when URL has `?entity=X&entity_id=Y`):
- Add "ยกเลิก Workflow" button (destructive variant) at far right
- Requires confirm dialog before DELETE
- On success: refetch instance query → InstanceView shows State A

---

## Section 3: Shared `WorkflowInstanceCard` Component

**File:** `src/components/workflow/WorkflowInstanceCard.tsx`

```tsx
<WorkflowInstanceCard entityType="project" entityId={projectId} />
```

Fetches: `GET /workflow-instances.php?entity_type=X&entity_id=Y`

### State A — No instance

```
🔀 Workflow                    [ผูก Workflow ▾]
ยังไม่มี workflow ผูกอยู่
```

- Dropdown lists workflow definitions filtered by entity_type
- On select: POST to create instance → refetch
- Definition options fetched from `GET /workflows.php?entity_type=X`

### State B — Active instance

```
🔀 [workflow name]      [ดู BPM]  [ยกเลิก]
● Done → ● Done → [Current] → Pending
```

- Step progress bar (same as WorkflowPage InstanceView)
- **"ดู BPM"** → navigates to `/workflow?entity=X&entity_id=Y`
- **"ยกเลิก"** → confirm dialog → DELETE → State A

### State C — Completed instance

```
🔀 [workflow name]           ✅ เสร็จสิ้น
● → ● → ● → ● (all green)
```

No action buttons.

### Detail pages that receive this card

| Page | File | Placement |
|------|------|-----------|
| Project detail | `src/pages/ProjectDetail.tsx` | Replace existing "Workflow" navigate button with `<WorkflowInstanceCard>` in the sidebar/detail section |
| Sales opportunity detail | `src/pages/SalesDetailPage.tsx` | Add card in sidebar or info tab |
| Support ticket detail | `src/pages/SupportPage.tsx` | Add card in ticket detail panel |

---

## Data Flow

```
WorkflowPage (bulk)
  → GET /workflows.php          (list definitions)
  → GET /workflow-instances.php?entity_type=X&unlinked=1   (unlinked records)
  → POST /workflow-instances.php  ×N   (create instances)
  → DELETE /workflow-instances.php?id=X   (cancel)

WorkflowInstanceCard (contextual)
  → GET /workflow-instances.php?entity_type=X&entity_id=Y  (current instance)
  → GET /workflows.php?entity_type=X   (definitions for picker)
  → POST /workflow-instances.php   (link)
  → DELETE /workflow-instances.php?id=X   (cancel)
```

---

## Constraints

- `workflow_instances.tenant_id` must be populated on all INSERT operations (already fixed in prior session)
- Unlinked query must filter by tenant to prevent cross-tenant data leak
- Bulk link: if any POST fails, show partial success toast listing which records failed
- `WorkflowInstanceCard` must not break existing pages — wrap in `<ErrorBoundary>` in each detail page

---

## Out of Scope

- Auto-linking new records on creation (deferred)
- Running multiple workflows simultaneously on one record
- Workflow templates auto-applied by entity status/stage
