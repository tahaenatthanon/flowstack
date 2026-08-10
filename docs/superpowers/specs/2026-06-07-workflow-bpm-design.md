# Workflow BPM — Design Spec
**Date:** 2026-06-07
**Status:** Draft

---

## 1. Overview

เพิ่มโมดูล Workflow BPM (Business Process Management) เข้า FlowStack เพื่อให้ผู้ใช้สามารถ:
1. **สร้างและแก้ไข Process Map** แบบ drag-and-drop ด้วย React Flow
2. **ตรวจจับ Bottleneck** จาก cycle time + queue depth พร้อม heatmap overlay
3. **รับคำแนะนำจาก AI** ทั้งแก้ปัญหาระยะสั้นและ process improvement ระยะยาว

รองรับทุก entity หลัก: `project`, `opportunity` (Sales), `support_ticket`

---

## 2. สถาปัตยกรรม

### 2.1 Global BPM Hub

- Route: `/workflow`
- เป็น Single Page ที่มี 3 panel หลัก:
  - **Left:** Node Palette (drag node types ลง canvas)
  - **Center:** React Flow Canvas (blueprint editor + instance heatmap)
  - **Right:** Side Panel (properties, analytics, AI chat)
- แต่ละ module (Projects, Sales, Support) มี deep-link เข้า hub:
  - `/workflow?entity=project&workflow_id=xxx`
  - `/workflow?entity=opportunity&workflow_id=xxx`
  - `/workflow?entity=support_ticket&workflow_id=xxx`

### 2.2 Data Layer

| Table | หน้าที่ |
|---|---|
| `workflow_definitions` | Blueprint/template ของ workflow (nodes, edges, entity_type) |
| `workflow_instances` | Runtime record ต่อ entity (project_id / opportunity_id / ticket_id) |
| `workflow_step_logs` | History ของแต่ละ step: started_at, completed_at, assignee, duration |

### 2.3 Entity Mapping

| Entity | Sub-steps มาจาก |
|---|---|
| `project` | `tasks` + `subtasks` ที่ผูกกับ project |
| `opportunity` | `tasks` ที่ผูกกับ `sales_opportunities` |
| `support_ticket` | `tasks` + comments/actions ใน ticket |

ข้อมูลดึงจาก data ที่มีอยู่แล้ว ไม่ต้องกรอกซ้ำ

---

## 3. Process Map

### 3.1 Node Types

| Type | ความหมาย |
|---|---|
| Start / End | จุดเริ่มต้น / สิ้นสุด process |
| Stage | ขั้นตอนหลัก (เช่น "Proposal", "Development") |
| Decision | เงื่อนไข (if/else branching) |
| Delay | รอ timer หรือ approval |
| Notify | ส่งการแจ้งเตือน |

### 3.2 Drill-down Sub-steps

Stage node สามารถ expand เพื่อดู sub-steps ที่ดึงมาจาก tasks จริงในระบบ:

```
Stage: "Proposal"
├── Sub-step: ร่าง Quotation       → 1 วัน  🟢
├── Sub-step: ส่ง Approval         → 8 วัน  🔴 ← bottleneck
└── Sub-step: รอลูกค้าอนุมัติ     → 3 วัน  🟡
```

### 3.3 Templates สำเร็จรูป

ระบบมาพร้อม template เริ่มต้นสำหรับแต่ละ entity:
- **Project:** Kickoff → Planning → Development → Testing → Delivery
- **Sales:** Lead → Qualified → Proposal → Negotiation → Won/Lost
- **Support:** Received → Assigned → In Progress → Resolved → Closed

ผู้ใช้สามารถใช้ template แล้วปรับแต่งเพิ่มเติมได้

---

## 4. Bottleneck Detection

### 4.1 Metrics ที่วิเคราะห์

| Metric | คำอธิบาย |
|---|---|
| Cycle Time | เวลาเฉลี่ยที่แต่ละ step ใช้ เทียบกับ SLA/estimated |
| Queue Depth | จำนวน items ที่ค้างอยู่ใน step นั้น ณ ขณะนั้น |

### 4.2 Color Coding (Heatmap)

| สี | ความหมาย |
|---|---|
| 🟢 เขียว | เร็วกว่า SLA |
| 🟡 เหลือง | ใกล้เกิน SLA (80–100%) |
| 🔴 แดง | เกิน SLA หรือช้าผิดปกติ |

### 4.3 การแสดงผล

- Canvas overlay แสดง heatmap สี บน node/edge
- คลิก node → Right panel แสดง:
  - avg cycle time ของ step นั้น
  - จำนวน items ค้าง
  - รายชื่อ entity ที่ติดอยู่ (drill-down list)
  - กราฟ trend ย้อนหลัง 30 วัน

---

## 5. AI Recommendations

### 5.1 ระยะสั้น (Quick Fix)
AI วิเคราะห์ bottleneck แล้วเสนอ action ทันที เช่น:
- "Step 'ส่ง Approval' ค้างเฉลี่ย 8 วัน — แนะนำให้ assign ผู้อนุมัติสำรอง หรือตั้ง auto-reminder"
- "Deal XYZ ค้างที่ Proposal 12 วัน — ควร follow-up ด่วน"

### 5.2 ระยะยาว (Process Improvement)
AI เสนอ redesign process เช่น:
- "Merge ขั้นตอน Review และ Approval เข้าด้วยกัน — จะลด cycle time เฉลี่ย 40%"
- "เพิ่ม parallel path สำหรับ Legal Review แทนการรอตามลำดับ"

### 5.3 Implementation

- ใช้ AI model จาก `ai_settings` ของระบบ (kilo-auto/balanced)
- Context ที่ส่งให้ AI: workflow definition + step_logs ย้อนหลัง 90 วัน + SLA config
- แสดงผลใน Right Panel tab "AI แนะนำ" พร้อมปุ่ม "นำไปใช้" / "ดูรายละเอียด"

---

## 6. Database Schema (Migration)

```sql
-- workflow_definitions
CREATE TABLE workflow_definitions (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  entity_type ENUM('project','opportunity','support_ticket') NOT NULL,
  definition JSON NOT NULL,  -- nodes, edges config
  is_template TINYINT(1) DEFAULT 0,
  created_by CHAR(36),
  created_at DATETIME,
  updated_at DATETIME
);

-- workflow_instances
CREATE TABLE workflow_instances (
  id CHAR(36) PRIMARY KEY,
  workflow_definition_id CHAR(36) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  current_step_id VARCHAR(100),
  status ENUM('active','completed','cancelled') DEFAULT 'active',
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME,
  updated_at DATETIME,
  FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE
);

-- workflow_step_logs
CREATE TABLE workflow_step_logs (
  id CHAR(36) PRIMARY KEY,
  instance_id CHAR(36) NOT NULL,
  step_id VARCHAR(100) NOT NULL,
  step_name VARCHAR(255),
  assignee_id CHAR(36),
  started_at DATETIME,
  completed_at DATETIME,
  duration_minutes INT,
  status ENUM('in_progress','completed','skipped') DEFAULT 'in_progress',
  notes TEXT,
  created_at DATETIME,
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE
);
```

---

## 7. API Endpoints

| Method | Endpoint | หน้าที่ |
|---|---|---|
| GET | `/api/workflows.php` | list definitions |
| POST | `/api/workflows.php` | create definition |
| PUT | `/api/workflows.php?id=xxx` | update definition |
| DELETE | `/api/workflows.php?id=xxx` | delete definition |
| GET | `/api/workflow-instances.php?entity_type=project&entity_id=xxx` | get instance |
| POST | `/api/workflow-instances.php` | start instance |
| POST | `/api/workflow-instances.php?action=advance` | advance step |
| GET | `/api/workflow-analytics.php?definition_id=xxx` | bottleneck analytics |
| POST | `/api/workflow-ai.php` | AI recommendations |

---

## 8. Frontend Components

```
src/pages/WorkflowPage.tsx          — Global BPM Hub page
src/components/workflow/
  WorkflowCanvas.tsx                — React Flow canvas
  WorkflowNodePalette.tsx           — Left panel: node types
  WorkflowSidePanel.tsx             — Right panel: properties/analytics/AI
  WorkflowHeatmapOverlay.tsx        — Bottleneck color overlay
  WorkflowAIPanel.tsx               — AI recommendations tab
  nodes/
    StageNode.tsx                   — Stage node with sub-step expand
    DecisionNode.tsx
    DelayNode.tsx
    NotifyNode.tsx
```

---

## 9. Integration Points

- **ProjectDetail** → tab "Workflow" → deep-link `/workflow?entity=project&entity_id=xxx`
- **SalesPage** → ปุ่ม "ดู Workflow" บน opportunity card
- **SupportPage** → tab "Workflow" บน ticket detail
- **AppSidebar** → menu item ใหม่ `workflow` ใต้กลุ่ม Operations

---

## 10. Out of Scope (v1)

- Real-time collaboration (multi-user edit canvas พร้อมกัน)
- Webhook trigger ออกไป external systems
- Export workflow เป็น BPMN 2.0 XML
- Mobile canvas editor (view-only บน mobile)
