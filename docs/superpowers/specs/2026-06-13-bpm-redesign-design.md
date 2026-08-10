# BPM Redesign — Cross-Entity Customer Journey
**Date:** 2026-06-13
**Status:** Approved (mockup v3 confirmed)

---

## 1. Overview

ปรับหน้า `/workflow` ใหม่ให้สะท้อนกระบวนการธุรกิจจริง:

**Marketing → Sales → Project → Support → Renewal**

แทนที่จะเป็น workflow แยกต่อ entity (project หนึ่งตัว / opportunity หนึ่งตัว) ให้มองเป็น **Customer Journey** ต่อ deal cycle — หนึ่งบริษัทมีหลาย journey ได้ (แต่ละ deal = journey ใหม่)

### Design ที่ได้รับการ approve

- **Layout:** Master-Detail — sidebar (journey list) + main panel (journey detail)
- **Alert bar:** SLA violation แบบ real-time บนสุด
- **Journey detail:** 2-level expand
  - Level 1: Stage (Marketing / Sales / Project / Support / Renewal) — expand/collapse
  - Level 2: Task — expand/collapse ดูงานย่อย + ชั่วโมง + ผู้รับผิดชอบ + notes
- **Default open:** stage ที่ active + task ที่กำลังทำ
- **Tab default:** "เส้นทาง Journey" (ไม่ใช่ canvas editor)
- **Canvas editor:** ยังมีอยู่ แต่ซ่อนไว้เป็น tab มุมขวา

---

## 2. Concepts

### 2.1 Journey vs Workflow

| | Workflow เดี่ยว (เดิม) | Journey (ใหม่) |
|---|---|---|
| Scope | 1 entity (project / opp / ticket) | cross-entity: Marketing→Sales→Project→Support→Renewal |
| สร้างเมื่อ | ผู้ใช้สร้าง workflow instance | อัตโนมัติเมื่อ Lead ถูก qualify หรือสร้าง Opportunity |
| Advance | ผู้ใช้กดปุ่มใน BPM | **อัตโนมัติ** เมื่อ entity เปลี่ยน status + ผู้ใช้กดใน entity page |
| แสดงใน | Flow Report tab | หน้าหลัก BPM (default tab) |
| entity_type | `project` / `opportunity` / `support_ticket` | `company_journey` (ใหม่) |

### 2.2 Auto-Advance Rules

| เหตุการณ์ | ผล |
|---|---|
| Opportunity status = `qualified` | Journey stage → Sales |
| Opportunity status = `won` | Journey stage → Project · สร้าง Project อัตโนมัติหรือผูกกับที่มี |
| Project status = `completed` | Journey stage → Support · สร้าง Support Contract prompt |
| Support contract เหลือ < 30 วัน | Journey stage → Renewal · สร้าง Renewal Opportunity |
| Renewal Opportunity = `won` | Journey เสร็จ → เริ่ม Journey ใหม่ถ้าต้องการ |

Auto-advance ทำในฝั่ง PHP เมื่อ API endpoint อัปเดต entity status

### 2.3 Who uses BPM page

- **Manager:** ดู health overview ทุก journey, ตรวจสอบ SLA, escalate
- **Team member:** ดู journey ของตัวเอง, เปิด link ไปทำงานใน Projects/Sales/Support ตรงๆ — ไม่ advance step จาก BPM โดยตรง

---

## 3. Data Model

### 3.1 ALTER: `workflow_definitions.entity_type`

```sql
ALTER TABLE workflow_definitions
  MODIFY entity_type ENUM('project','opportunity','support_ticket','company_journey') NOT NULL;
```

เพิ่ม enum value `company_journey` — backward compatible กับข้อมูลเดิม

### 3.2 ALTER: `workflow_instances` — เพิ่ม fields สำหรับ journey

```sql
ALTER TABLE workflow_instances
  ADD COLUMN journey_name VARCHAR(255) DEFAULT NULL AFTER entity_id,
  ADD COLUMN company_id CHAR(36) DEFAULT NULL AFTER journey_name,
  ADD COLUMN sla_violated TINYINT(1) NOT NULL DEFAULT 0 AFTER company_id,
  ADD COLUMN current_stage VARCHAR(50) DEFAULT 'marketing'
    COMMENT 'marketing|sales|project|support|renewal' AFTER sla_violated;
```

### 3.3 NEW TABLE: `workflow_journey_links`

เชื่อม Journey Instance กับ entity จริงในแต่ละ stage

```sql
CREATE TABLE workflow_journey_links (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  instance_id   CHAR(36)     NOT NULL,
  stage         VARCHAR(50)  NOT NULL COMMENT 'marketing|sales|project|support|renewal',
  entity_type   VARCHAR(50)  NOT NULL COMMENT 'opportunity|project|support_ticket|marketing_campaign',
  entity_id     CHAR(36)     NOT NULL,
  linked_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stage_status  ENUM('active','completed','skipped') NOT NULL DEFAULT 'active',
  completed_at  DATETIME     DEFAULT NULL,
  sla_days      INT          DEFAULT NULL,
  notes         TEXT         DEFAULT NULL,
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
  INDEX idx_instance_stage (instance_id, stage),
  INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.4 Schema ER Summary

```
workflow_definitions (entity_type='company_journey')
  └── workflow_instances (company_journey, company_id, current_stage)
        └── workflow_step_logs      ← history ของ stage transitions
        └── workflow_journey_links  ← link ไป entity จริง (opp/project/ticket)
              ├── → sales_opportunities
              ├── → projects
              └── → support_tickets
```

---

## 4. API Endpoints

### 4.1 Journey List & Detail

**GET** `/api/workflow-journeys.php`
- Returns: `[{ instance_id, journey_name, company_name, current_stage, sla_violated, days_in_stage, links[] }]`
- Filter: `?status=active|completed` `?sla_violated=1`

**GET** `/api/workflow-journeys.php?id={instance_id}`
- Returns: journey detail + per-stage tasks จาก entity จริง
  - Marketing: tasks ใน marketing campaigns / email tasks
  - Sales: opportunity + tasks ที่ผูกกับ opp
  - Project: project + tasks + subtasks พร้อม actual_hours
  - Support: support tickets + tasks
  - Renewal: renewal opportunity

### 4.2 Journey CRUD

**POST** `/api/workflow-journeys.php` — สร้าง journey ใหม่ (body: `{ definition_id, company_id, journey_name }`)

**PUT** `/api/workflow-journeys.php?id={instance_id}` — advance stage manually หรืออัปเดต notes

**POST** `/api/workflow-journeys.php?action=link` — ผูก entity เข้า stage
```json
{ "instance_id": "...", "stage": "project", "entity_type": "project", "entity_id": "..." }
```

### 4.3 Auto-Advance Hooks (เรียกจาก entity API)

เพิ่ม trigger call ใน:
- `api/opportunities.php` — เมื่อ `PUT` status = `won` → call `journeyAutoAdvance('sales', 'project', $opportunityId)`
- `api/projects.php` — เมื่อ `PUT` status = `completed` → call `journeyAutoAdvance('project', 'support', $projectId)`
- `api/support-contracts.php` — เมื่อ contract ใกล้หมด → call `journeyAutoAdvance('support', 'renewal', $contractId)`

function `journeyAutoAdvance($fromStage, $toStage, $entityId)` ใน `api/journey-utils.php`:
1. หา journey link ที่ผูกกับ entity นี้
2. อัปเดต `workflow_journey_links.stage_status = completed` สำหรับ fromStage
3. อัปเดต `workflow_instances.current_stage = toStage`
4. Insert `workflow_step_logs` record
5. Return journey instance id

### 4.4 SLA Alert Endpoint

**GET** `/api/workflow-journeys.php?action=alerts`
- Returns: journeys ที่ `sla_violated = 1` หรือ `days_in_stage > sla_days * 0.8`
- ใช้แสดงใน alert bar บนสุด

---

## 5. Frontend — WorkflowPage.tsx Redesign

### 5.1 Tab Structure (เปลี่ยนจากเดิม)

```
เดิม: [Editor | Bottleneck | Report]
ใหม่: [🗺 เส้นทาง Journey | 📋 ประวัติ | 📊 Analytics | ... ⚙ ออกแบบ Workflow (far-right)]
```

Default tab: `journey` (ไม่ใช่ `report` อีกต่อไป)

### 5.2 Component Tree

```
WorkflowPage
├── WorkflowAlertBar          (NEW) — SLA alerts, fixed top
├── [tab=journey]
│   ├── WorkflowJourneyList   (NEW) — sidebar, journey items with health dots
│   └── WorkflowJourneyDetail (NEW) — main panel
│       ├── JourneyStatsBar   (NEW) — days/stage count/total days
│       ├── JourneyStageCard  (NEW, repeats x5) — Level-1 expand
│       │   ├── StageHeader   — icon, title, SLA bar, badge, chevron
│       │   └── StageBody (expandable)
│       │       ├── EntityLinkRow  — link ไป entity จริง
│       │       └── TaskRow (repeats) — Level-2 expand  (NEW)
│       │           ├── task header: check, name, owner, duration, chevron
│       │           └── TaskDetail (expandable)
│       │               ├── detail-row: dates, hours, status
│       │               ├── SubtaskList
│       │               ├── ProgressBar
│       │               └── NotesBox (blocker/notes)
│       └── JourneyInfoPanel  (NEW) — right sidebar: company, progress, auto-advance, timeline
├── [tab=history]  WorkflowFlowReport (เดิม — ยังคงไว้)
├── [tab=analytics] WorkflowBottleneck (เดิม — ยังคงไว้)
└── [tab=editor]
    ├── WorkflowNodePalette (เดิม)
    └── ReactFlow Canvas (เดิม)
```

### 5.3 Data Flow

```
useJourneys() hook
  → GET /api/workflow-journeys.php
  → returns JourneySummary[]

useJourneyDetail(instanceId) hook
  → GET /api/workflow-journeys.php?id={instanceId}
  → returns JourneyDetail {
      instance, company, stages: {
        marketing: { status, sla, entity, tasks[] },
        sales:     { status, sla, entity, tasks[] },
        project:   { status, sla, entity, tasks[] },
        support:   { status, sla, entity, tasks[] },
        renewal:   { status, sla, entity, tasks[] },
      }
    }
```

### 5.4 Task Detail Data

Tasks ใน journey detail ดึงจาก entity จริง ไม่สร้าง schema ใหม่:
- **Marketing tasks:** `tasks` ที่ผูกกับ marketing campaign entity
- **Sales tasks:** `tasks` ที่มี `entity_type='opportunity'` และ `entity_id=opp_id`
- **Project tasks:** `tasks` ที่ `project_id=...` และ `parent_task_id IS NULL`
- **Project subtasks:** `tasks` ที่ `parent_task_id IS NOT NULL` (หรือ `is_subtask=1`)
- **Support tasks:** `tasks` ที่ผูกกับ support ticket

### 5.5 Expand/Collapse Behavior

- State เก็บใน `useState<Set<string>>` — set ของ stage/task id ที่ open
- Default open: stage ที่ `current_stage` + task ที่ status=`in_progress`/`blocked`
- Persist ใน sessionStorage ต่อ journey instance id

---

## 6. UI/UX Decisions

| Decision | เหตุผล |
|---|---|
| Stage ที่ยังไม่เริ่ม (future) ยัง expand ได้ | ให้ manager เห็น template ของงานที่จะมา |
| task blocked แสดงสีแดง + auto-open | Blocker ควรเห็นทันทีไม่ต้องคลิก |
| Link ไป entity จริง ไม่ advance ใน BPM | Team advance งานจาก Projects/Sales/Support ตรงๆ |
| Sidebar filter: ทั้งหมด / กำลังทำ / เกิน SLA | ลด cognitive load สำหรับ manager |
| Journey per deal cycle | บริษัทเดียวมีหลาย journey ได้ (project ที่ 2, renewal เป็น journey ใหม่) |
| Workflow เดี่ยวยังอยู่ใน sidebar ส่วน "Workflow เดี่ยว" | ไม่ทิ้ง feature เดิมที่ใช้อยู่ |

---

## 7. Migration Strategy

1. `ALTER TABLE workflow_definitions` — เพิ่ม `company_journey` enum (ไม่กระทบ data เดิม)
2. `ALTER TABLE workflow_instances` — เพิ่ม nullable columns (ไม่กระทบ data เดิม)
3. `CREATE TABLE workflow_journey_links`
4. สร้าง default "เส้นทางลูกค้า" journey definition ใน `workflow_definitions` (tenant-default)
5. Frontend: เพิ่ม components ใหม่ โดยไม่ลบ component เดิม (editor, bottleneck, report ยังอยู่ครบ)

---

## 8. Out of Scope (version 1)

- ❌ AI-suggested SLA threshold
- ❌ Journey template marketplace
- ❌ Multi-tenant journey definition sharing
- ❌ Gantt/calendar view ของ journey
- ❌ Auto-create Project เมื่อ Opp won (ยังให้ผู้ใช้ผูก manually)
