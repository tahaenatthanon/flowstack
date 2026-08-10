# BPM Redesign — Cross-Entity Customer Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/workflow` เป็น Customer Journey dashboard แบบ 2-level expand (Stage → Task → Subtask) แสดง Marketing→Sales→Project→Support→Renewal ต่อ deal cycle พร้อม auto-advance และ SLA alert

**Architecture:** เพิ่ม `entity_type='company_journey'` ใน workflow_definitions + ตาราง `workflow_journey_links` เชื่อม journey instance กับ entity จริง. PHP API ใหม่ `workflow-journeys.php` ดึง task/subtask จาก entity จริง (tasks, projects, support_tickets). React components ใหม่ทั้งหมดเป็น journey-specific — ไม่แตะ editor/bottleneck/report เดิม.

**Tech Stack:** React 18, TypeScript, TanStack Query, Tailwind CSS, shadcn-ui, PHP 8 + MariaDB 11.5, XAMPP

**Spec:** `docs/superpowers/specs/2026-06-13-bpm-redesign-design.md`

---

## File Map

**New files:**
- `database/migrations/2026_06_13_000001_journey_schema.sql` — ALTER + CREATE TABLE
- `api/journey-utils.php` — shared PHP functions: `journeyAutoAdvance()`, `getJourneyStages()`
- `api/workflow-journeys.php` — CRUD + detail endpoint
- `src/types/journey.ts` — TypeScript types สำหรับ journey (แยกจาก workflow.ts เดิม)
- `src/hooks/useJourneys.ts` — TanStack Query hooks
- `src/components/workflow/WorkflowAlertBar.tsx` — SLA alert bar บนสุด
- `src/components/workflow/WorkflowJourneyList.tsx` — sidebar journey list
- `src/components/workflow/WorkflowJourneyDetail.tsx` — main detail panel (orchestrates stage cards)
- `src/components/workflow/JourneyStageCard.tsx` — Level-1 expand: stage header + task list
- `src/components/workflow/JourneyTaskRow.tsx` — Level-2 expand: task header + subtask detail

**Modified files:**
- `src/pages/WorkflowPage.tsx` — เพิ่ม journey tab เป็น default, wire new components
- `src/types/workflow.ts` — เพิ่ม `'company_journey'` ใน `WorkflowEntityType`
- `api/opportunities.php` — เพิ่ม auto-advance hook เมื่อ stage → `won`
- `api/projects.php` — เพิ่ม auto-advance hook เมื่อ status → `completed`

---

## Task 1: Database Migration

**Files:**
- Create: `database/migrations/2026_06_13_000001_journey_schema.sql`

- [ ] **Step 1: เขียน migration file**

```sql
-- database/migrations/2026_06_13_000001_journey_schema.sql

-- 1. เพิ่ม company_journey ใน entity_type enum
ALTER TABLE workflow_definitions
  MODIFY COLUMN entity_type
    ENUM('project','opportunity','support_ticket','company_journey') NOT NULL;

-- 2. เพิ่ม columns ใน workflow_instances สำหรับ journey
ALTER TABLE workflow_instances
  ADD COLUMN journey_name   VARCHAR(255) DEFAULT NULL      AFTER entity_id,
  ADD COLUMN company_id     CHAR(36)     DEFAULT NULL      AFTER journey_name,
  ADD COLUMN sla_violated   TINYINT(1)   NOT NULL DEFAULT 0 AFTER company_id,
  ADD COLUMN current_stage  VARCHAR(50)  DEFAULT 'marketing'
    COMMENT 'marketing|sales|project|support|renewal'      AFTER sla_violated,
  ADD INDEX idx_company_id (company_id),
  ADD INDEX idx_current_stage (current_stage);

-- 3. ตาราง workflow_journey_links เชื่อม journey instance กับ entity จริง
CREATE TABLE workflow_journey_links (
  id           CHAR(36)    NOT NULL,
  instance_id  CHAR(36)    NOT NULL,
  stage        VARCHAR(50) NOT NULL COMMENT 'marketing|sales|project|support|renewal',
  entity_type  VARCHAR(50) NOT NULL COMMENT 'opportunity|project|support_ticket',
  entity_id    CHAR(36)    NOT NULL,
  stage_status ENUM('active','completed','skipped') NOT NULL DEFAULT 'active',
  sla_days     INT         DEFAULT NULL,
  linked_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME    DEFAULT NULL,
  notes        TEXT        DEFAULT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
  INDEX idx_instance_stage (instance_id, stage),
  INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Default journey definition สำหรับ tenant-default
INSERT INTO workflow_definitions
  (id, tenant_id, name, entity_type, definition, is_template, created_by, created_at, updated_at)
VALUES (
  UUID(),
  'tenant-default',
  'เส้นทางลูกค้า (Standard)',
  'company_journey',
  '{"nodes":[],"edges":[],"stages":["marketing","sales","project","support","renewal"],"sla":{"marketing":10,"sales":30,"project":60,"support":90,"renewal":30}}',
  1,
  NULL,
  NOW(),
  NOW()
);
```

- [ ] **Step 2: รัน migration**

```bash
mysql -u root flowstack < database/migrations/2026_06_13_000001_journey_schema.sql
```

Expected: no error output

- [ ] **Step 3: ตรวจสอบ**

```bash
mysql -u root flowstack -e "SHOW COLUMNS FROM workflow_instances LIKE 'journey_name';"
mysql -u root flowstack -e "SHOW COLUMNS FROM workflow_instances LIKE 'current_stage';"
mysql -u root flowstack -e "DESCRIBE workflow_journey_links;"
mysql -u root flowstack -e "SELECT name, entity_type FROM workflow_definitions WHERE entity_type='company_journey';"
```

Expected: columns มีอยู่, journey_links table มี schema ถูกต้อง, มี 1 row ใน workflow_definitions

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_06_13_000001_journey_schema.sql
git commit -m "feat(db): add company_journey schema — journey_links table + workflow_instances columns"
```

---

## Task 2: PHP — journey-utils.php (shared functions)

**Files:**
- Create: `api/journey-utils.php`

- [ ] **Step 1: เขียน journey-utils.php**

```php
<?php
// api/journey-utils.php
// Shared functions สำหรับ company_journey feature
// ไม่มี route handler — include เท่านั้น

/**
 * Auto-advance journey stage เมื่อ entity เปลี่ยน status
 *
 * @param PDO    $db
 * @param string $tenantId
 * @param string $fromStage   'marketing'|'sales'|'project'|'support'
 * @param string $entityType  'opportunity'|'project'|'support_ticket'
 * @param string $entityId    UUID ของ entity
 * @return void  (silently ignore ถ้าไม่มี journey link — journey เป็น optional)
 */
function journeyAutoAdvance(PDO $db, string $tenantId, string $fromStage, string $entityType, string $entityId): void {
    try {
        // หา journey link ที่ผูกกับ entity นี้
        $stmt = $db->prepare('
            SELECT jl.id AS link_id, jl.instance_id, wi.current_stage
            FROM workflow_journey_links jl
            JOIN workflow_instances wi ON jl.instance_id = wi.id
            WHERE jl.entity_type = ?
              AND jl.entity_id   = ?
              AND jl.stage       = ?
              AND jl.stage_status = \'active\'
              AND wi.tenant_id   = ?
            LIMIT 1
        ');
        $stmt->execute([$entityType, $entityId, $fromStage, $tenantId]);
        $link = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$link) return; // ไม่มี journey — skip

        $stageOrder = ['marketing', 'sales', 'project', 'support', 'renewal'];
        $idx = array_search($fromStage, $stageOrder);
        $nextStage = $stageOrder[$idx + 1] ?? null;

        // Mark current link completed
        $db->prepare('
            UPDATE workflow_journey_links
            SET stage_status = \'completed\', completed_at = NOW()
            WHERE id = ?
        ')->execute([$link['link_id']]);

        // อัปเดต current_stage ใน instance
        if ($nextStage) {
            $db->prepare('
                UPDATE workflow_instances
                SET current_stage = ?, updated_at = NOW()
                WHERE id = ?
            ')->execute([$nextStage, $link['instance_id']]);
        } else {
            // ถึง renewal แล้ว → complete journey
            $db->prepare('
                UPDATE workflow_instances
                SET status = \'completed\', current_stage = \'renewal\', completed_at = NOW(), updated_at = NOW()
                WHERE id = ?
            ')->execute([$link['instance_id']]);
        }

        // บันทึก step log
        $db->prepare('
            INSERT INTO workflow_step_logs
              (id, instance_id, step_id, step_name, status, started_at, completed_at, duration_minutes)
            VALUES (UUID(), ?, ?, ?, \'completed\', NOW(), NOW(), 0)
        ')->execute([$link['instance_id'], $fromStage, 'advance:' . $fromStage . '->' . ($nextStage ?? 'done')]);

    } catch (Exception $e) {
        // Journey auto-advance เป็น optional — ไม่ throw ให้ caller
        error_log('[journeyAutoAdvance] ' . $e->getMessage());
    }
}

/**
 * ดึง tasks ของ entity พร้อม subtasks สำหรับแสดงใน journey detail
 *
 * @param PDO    $db
 * @param string $tenantId
 * @param string $entityType  'project'|'opportunity'|'support_ticket'
 * @param string $entityId
 * @return array  tasks[] แต่ละ task มี subtasks[]
 */
function getJourneyEntityTasks(PDO $db, string $tenantId, string $entityType, string $entityId): array {
    if ($entityType === 'project') {
        // parent tasks ของ project (ไม่รวม subtask)
        $stmt = $db->prepare('
            SELECT t.id, t.title AS name, t.status, t.assigned_to,
                   u.first_name, u.last_name,
                   t.estimated_hours, t.actual_hours,
                   t.start_date, t.due_date, t.completed_date,
                   t.notes, t.parent_task_id
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.project_id = ?
              AND t.tenant_id  = ?
              AND t.parent_task_id IS NULL
              AND t.deleted_at IS NULL
            ORDER BY t.sort_order, t.created_at
        ');
        $stmt->execute([$entityId, $tenantId]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // subtasks สำหรับแต่ละ parent
        foreach ($tasks as &$task) {
            $subStmt = $db->prepare('
                SELECT t.id, t.title AS name, t.status, t.actual_hours, t.estimated_hours,
                       u.first_name, u.last_name, t.notes, t.completed_date
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.parent_task_id = ?
                  AND t.tenant_id = ?
                  AND t.deleted_at IS NULL
                ORDER BY t.sort_order, t.created_at
            ');
            $subStmt->execute([$task['id'], $tenantId]);
            $task['subtasks'] = $subStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        unset($task);
        return $tasks;
    }

    if ($entityType === 'opportunity') {
        $stmt = $db->prepare('
            SELECT t.id, t.title AS name, t.status, t.actual_hours, t.estimated_hours,
                   u.first_name, u.last_name, t.notes, t.completed_date, t.start_date, t.due_date
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.related_entity_type = \'opportunity\'
              AND t.related_entity_id = ?
              AND t.tenant_id = ?
              AND t.deleted_at IS NULL
            ORDER BY t.created_at
        ');
        $stmt->execute([$entityId, $tenantId]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($tasks as &$t) { $t['subtasks'] = []; }
        unset($t);
        return $tasks;
    }

    if ($entityType === 'support_ticket') {
        $stmt = $db->prepare('
            SELECT t.id, t.title AS name, t.status, t.actual_hours, t.estimated_hours,
                   u.first_name, u.last_name, t.notes, t.completed_date, t.start_date, t.due_date
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            WHERE t.related_entity_type = \'support_ticket\'
              AND t.related_entity_id = ?
              AND t.tenant_id = ?
              AND t.deleted_at IS NULL
            ORDER BY t.created_at
        ');
        $stmt->execute([$entityId, $tenantId]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($tasks as &$t) { $t['subtasks'] = []; }
        unset($t);
        return $tasks;
    }

    return [];
}
```

- [ ] **Step 2: Commit**

```bash
git add api/journey-utils.php
git commit -m "feat(api): add journey-utils.php — journeyAutoAdvance + getJourneyEntityTasks"
```

---

## Task 3: PHP — workflow-journeys.php (main API)

**Files:**
- Create: `api/workflow-journeys.php`

- [ ] **Step 1: เขียน workflow-journeys.php**

```php
<?php
// api/workflow-journeys.php
// GET    - list journeys (?id= single detail, ?action=alerts)
// POST   - create journey
// PUT    - advance stage manually (?id=) หรือ link entity (?action=link)
// DELETE - delete journey (?id=)

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/journey-utils.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

// ─── GET ───────────────────────────────────────────────────────
if ($method === 'GET') {
    $id     = $_GET['id']     ?? null;
    $action = $_GET['action'] ?? null;

    // GET ?action=alerts — journeys ที่ SLA เกิน หรือใกล้เกิน
    if ($action === 'alerts') {
        $stmt = $db->prepare('
            SELECT wi.id, wi.journey_name, wi.current_stage, wi.sla_violated,
                   wi.started_at, wi.updated_at,
                   c.name AS company_name,
                   DATEDIFF(NOW(), wi.updated_at) AS days_in_stage
            FROM workflow_instances wi
            LEFT JOIN companies c ON wi.company_id = c.id
            WHERE wi.tenant_id = ?
              AND wi.entity_type = \'company_journey\'
              AND wi.status = \'active\'
              AND (wi.sla_violated = 1 OR DATEDIFF(NOW(), wi.updated_at) >= 7)
            ORDER BY wi.sla_violated DESC, days_in_stage DESC
            LIMIT 20
        ');
        $stmt->execute([$tenantId]);
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    // GET ?id= — single journey detail with per-stage tasks
    if ($id) {
        $stmt = $db->prepare('
            SELECT wi.*, c.name AS company_name, wd.definition AS def_json
            FROM workflow_instances wi
            LEFT JOIN companies c ON wi.company_id = c.id
            LEFT JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
            WHERE wi.id = ? AND wi.tenant_id = ?
        ');
        $stmt->execute([$id, $tenantId]);
        $inst = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$inst) jsonError('ไม่พบ Journey', 404);

        // โหลด stage links ทั้งหมดของ journey นี้
        $linkStmt = $db->prepare('
            SELECT jl.*, 
                   CASE jl.entity_type
                     WHEN \'project\'        THEN (SELECT name FROM projects WHERE id = jl.entity_id LIMIT 1)
                     WHEN \'opportunity\'    THEN (SELECT name FROM sales_opportunities WHERE id = jl.entity_id LIMIT 1)
                     WHEN \'support_ticket\' THEN (SELECT title FROM support_tickets WHERE id = jl.entity_id LIMIT 1)
                   END AS entity_name,
                   DATEDIFF(NOW(), jl.linked_at) AS days_in_stage
            FROM workflow_journey_links jl
            WHERE jl.instance_id = ?
            ORDER BY FIELD(jl.stage, \'marketing\',\'sales\',\'project\',\'support\',\'renewal\')
        ');
        $linkStmt->execute([$id]);
        $links = $linkStmt->fetchAll(PDO::FETCH_ASSOC);

        // ดึง SLA config จาก definition
        $defJson = json_decode($inst['def_json'] ?? '{}', true);
        $slaDays = $defJson['sla'] ?? ['marketing'=>10,'sales'=>30,'project'=>60,'support'=>90,'renewal'=>30];

        // สร้าง stages array พร้อม tasks
        $stageOrder = ['marketing','sales','project','support','renewal'];
        $stages = [];
        foreach ($stageOrder as $stage) {
            $link = null;
            foreach ($links as $l) {
                if ($l['stage'] === $stage) { $link = $l; break; }
            }

            $stageData = [
                'stage'        => $stage,
                'status'       => $link ? $link['stage_status'] : ($stage === $inst['current_stage'] ? 'active' : 'pending'),
                'entity_type'  => $link['entity_type']  ?? null,
                'entity_id'    => $link['entity_id']    ?? null,
                'entity_name'  => $link['entity_name']  ?? null,
                'days_in_stage'=> $link['days_in_stage'] ?? null,
                'sla_days'     => $slaDays[$stage] ?? null,
                'notes'        => $link['notes'] ?? null,
                'tasks'        => [],
            ];

            // ดึง tasks ถ้ามี entity link
            if ($link && $link['entity_id']) {
                $stageData['tasks'] = getJourneyEntityTasks($db, $tenantId, $link['entity_type'], $link['entity_id']);
            }

            // คำนวณ sla_violated ต่อ stage
            if ($stageData['sla_days'] && $stageData['days_in_stage'] > $stageData['sla_days']) {
                $stageData['sla_exceeded'] = true;
            } else {
                $stageData['sla_exceeded'] = false;
            }

            $stages[$stage] = $stageData;
        }

        unset($inst['def_json']);
        $inst['stages'] = $stages;
        jsonResponse($inst);
    }

    // GET list — ดึง journey ทั้งหมด
    $whereExtra = '';
    $params = [$tenantId];
    if (!empty($_GET['sla_violated'])) {
        $whereExtra .= ' AND wi.sla_violated = 1';
    }
    if (!empty($_GET['status'])) {
        $whereExtra .= ' AND wi.status = ?';
        $params[] = $_GET['status'];
    }

    $stmt = $db->prepare("
        SELECT wi.id, wi.journey_name, wi.current_stage, wi.sla_violated, wi.status,
               wi.started_at, wi.updated_at,
               c.name AS company_name,
               DATEDIFF(NOW(), wi.updated_at) AS days_in_stage,
               (SELECT COUNT(*) FROM workflow_journey_links WHERE instance_id = wi.id AND stage_status = 'completed') AS stages_done
        FROM workflow_instances wi
        LEFT JOIN companies c ON wi.company_id = c.id
        WHERE wi.tenant_id = ?
          AND wi.entity_type = 'company_journey'
          $whereExtra
        ORDER BY wi.sla_violated DESC, wi.updated_at DESC
    ");
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
}

// ─── POST ───────────────────────────────────────────────────────
if ($method === 'POST') {
    $action = $_GET['action'] ?? null;

    // POST ?action=link — ผูก entity เข้า stage
    if ($action === 'link') {
        $body = getRequestBody();
        $required = ['instance_id', 'stage', 'entity_type', 'entity_id'];
        foreach ($required as $f) {
            if (empty($body[$f])) jsonError("กรุณาระบุ $f", 400);
        }

        // ตรวจสอบว่า instance เป็นของ tenant นี้
        $check = $db->prepare('SELECT id FROM workflow_instances WHERE id = ? AND tenant_id = ?');
        $check->execute([$body['instance_id'], $tenantId]);
        if (!$check->fetch()) jsonError('ไม่พบ Journey', 404);

        // ลบ link เดิมของ stage นี้ถ้ามี (replace)
        $db->prepare('DELETE FROM workflow_journey_links WHERE instance_id = ? AND stage = ?')
           ->execute([$body['instance_id'], $body['stage']]);

        $defJson = '{}';
        $defStmt = $db->prepare('SELECT wd.definition FROM workflow_instances wi JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id WHERE wi.id = ?');
        $defStmt->execute([$body['instance_id']]);
        $defRow = $defStmt->fetch(PDO::FETCH_ASSOC);
        $slaDays = json_decode($defRow['definition'] ?? '{}', true)['sla'][$body['stage']] ?? null;

        $db->prepare('INSERT INTO workflow_journey_links (id, instance_id, stage, entity_type, entity_id, sla_days) VALUES (UUID(),?,?,?,?,?)')
           ->execute([$body['instance_id'], $body['stage'], $body['entity_type'], $body['entity_id'], $slaDays]);

        // อัปเดต current_stage ถ้า stage นี้ใหม่กว่า current
        $stageOrder = ['marketing','sales','project','support','renewal'];
        $instStmt = $db->prepare('SELECT current_stage FROM workflow_instances WHERE id = ?');
        $instStmt->execute([$body['instance_id']]);
        $inst = $instStmt->fetch(PDO::FETCH_ASSOC);
        $currentIdx = array_search($inst['current_stage'] ?? 'marketing', $stageOrder);
        $newIdx     = array_search($body['stage'], $stageOrder);
        if ($newIdx >= $currentIdx) {
            $db->prepare('UPDATE workflow_instances SET current_stage = ?, updated_at = NOW() WHERE id = ?')
               ->execute([$body['stage'], $body['instance_id']]);
        }

        jsonResponse(['message' => 'ผูก entity สำเร็จ'], 201);
    }

    // POST — สร้าง journey ใหม่
    $body = getRequestBody();
    if (empty($body['company_id'])) jsonError('กรุณาระบุ company_id', 400);
    if (empty($body['journey_name'])) jsonError('กรุณาระบุ journey_name', 400);

    // หา definition สำหรับ company_journey
    $defStmt = $db->prepare("SELECT id FROM workflow_definitions WHERE tenant_id = ? AND entity_type = 'company_journey' ORDER BY is_template DESC LIMIT 1");
    $defStmt->execute([$tenantId]);
    $def = $defStmt->fetch(PDO::FETCH_ASSOC);
    if (!$def) jsonError('ยังไม่มี Journey Definition — กรุณาสร้างใน Editor', 404);

    $instanceId = generateUUID();
    $db->prepare('
        INSERT INTO workflow_instances
          (id, tenant_id, workflow_definition_id, entity_type, entity_id, journey_name, company_id, current_stage, status, started_at)
        VALUES (?, ?, ?, \'company_journey\', ?, ?, ?, \'marketing\', \'active\', NOW())
    ')->execute([$instanceId, $tenantId, $def['id'], $instanceId, $body['journey_name'], $body['company_id']]);

    jsonResponse(['id' => $instanceId, 'message' => 'สร้าง Journey สำเร็จ'], 201);
}

// ─── PUT ───────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id   = $_GET['id'] ?? null;
    $body = getRequestBody();
    if (!$id) jsonError('กรุณาระบุ id', 400);

    $check = $db->prepare('SELECT id FROM workflow_instances WHERE id = ? AND tenant_id = ?');
    $check->execute([$id, $tenantId]);
    if (!$check->fetch()) jsonError('ไม่พบ Journey', 404);

    $fields = []; $values = [];
    foreach (['journey_name','current_stage','sla_violated','status'] as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "$f = ?";
            $values[] = $body[$f];
        }
    }
    if (empty($fields)) jsonError('ไม่มีข้อมูลที่ต้องการอัปเดต', 400);
    $values[] = $id;
    $db->prepare('UPDATE workflow_instances SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = ?')
       ->execute($values);

    jsonResponse(['message' => 'อัปเดต Journey สำเร็จ']);
}

// ─── DELETE ───────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('กรุณาระบุ id', 400);
    $stmt = $db->prepare("DELETE FROM workflow_instances WHERE id = ? AND tenant_id = ? AND entity_type = 'company_journey'");
    $stmt->execute([$id, $tenantId]);
    if ($stmt->rowCount() === 0) jsonError('ไม่พบ Journey', 404);
    jsonResponse(['message' => 'ลบ Journey สำเร็จ']);
}
```

- [ ] **Step 2: ทดสอบด้วย curl (ต้องมี JWT token จริงก่อน)**

```bash
# ดู journey list (ควรได้ empty array ถ้ายังไม่มีข้อมูล)
curl -s -H "Authorization: Bearer <token>" http://localhost/flowstack/api/workflow-journeys.php | jq .

# ดู alerts
curl -s -H "Authorization: Bearer <token>" "http://localhost/flowstack/api/workflow-journeys.php?action=alerts" | jq .
```

Expected: `[]` (ยังไม่มี journey) และ no PHP errors ใน `C:/xampp/apache/logs/error.log`

- [ ] **Step 3: Commit**

```bash
git add api/workflow-journeys.php
git commit -m "feat(api): add workflow-journeys.php — CRUD + stage detail + SLA alerts"
```

---

## Task 4: PHP — Auto-Advance Hooks

**Files:**
- Modify: `api/opportunities.php` — เพิ่มหลัง PUT execute ที่ line ~204
- Modify: `api/projects.php` — เพิ่มหลัง "completed" cascade ที่ line ~283

- [ ] **Step 1: แก้ api/opportunities.php — hook เมื่อ stage → won**

หา block PUT ที่บรรทัด ~204 (`$db->prepare($sql)->execute($values);`) แล้วเพิ่มหลังจากนั้น:

```php
    // Auto-advance journey เมื่อ opportunity เป็น won
    if (isset($body['stage']) && $body['stage'] === 'won') {
        require_once __DIR__ . '/journey-utils.php';
        journeyAutoAdvance($db, $tenantId, 'sales', 'opportunity', $id);
    }
```

- [ ] **Step 2: แก้ api/projects.php — hook เมื่อ status → completed**

หา block ที่ line ~282 (`if (isset($body['status']) && $body['status'] === 'completed')`) แล้วเพิ่มใน if block:

```php
    if (isset($body['status']) && $body['status'] === 'completed') {
        $db->prepare('UPDATE tasks SET status = ?, completed_date = NOW(), updated_at = NOW() WHERE project_id = ? AND deleted_at IS NULL AND status != ?')
           ->execute(['completed', $id, 'completed']);
        // Auto-advance journey
        require_once __DIR__ . '/journey-utils.php';
        journeyAutoAdvance($db, $tenantId, 'project', 'project', $id);
    }
```

- [ ] **Step 3: ตรวจสอบ syntax**

```bash
php -l api/opportunities.php
php -l api/projects.php
```

Expected: `No syntax errors detected`

- [ ] **Step 4: Commit**

```bash
git add api/opportunities.php api/projects.php
git commit -m "feat(api): add journey auto-advance hooks to opportunities + projects PUT"
```

---

## Task 5: TypeScript Types

**Files:**
- Create: `src/types/journey.ts`
- Modify: `src/types/workflow.ts` — เพิ่ม `'company_journey'`

- [ ] **Step 1: สร้าง src/types/journey.ts**

```typescript
// src/types/journey.ts

export type JourneyStage = 'marketing' | 'sales' | 'project' | 'support' | 'renewal';
export type JourneyStageStatus = 'active' | 'completed' | 'skipped' | 'pending';

export interface JourneySubtask {
  id: string;
  name: string;
  status: string;
  actual_hours: number | null;
  estimated_hours: number | null;
  first_name: string | null;
  last_name: string | null;
  notes: string | null;
  completed_date: string | null;
}

export interface JourneyTask {
  id: string;
  name: string;
  status: string;
  assigned_to: string | null;
  first_name: string | null;
  last_name: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  start_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  notes: string | null;
  subtasks: JourneySubtask[];
}

export interface JourneyStageData {
  stage: JourneyStage;
  status: JourneyStageStatus;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  days_in_stage: number | null;
  sla_days: number | null;
  sla_exceeded: boolean;
  notes: string | null;
  tasks: JourneyTask[];
}

export interface JourneyDetail {
  id: string;
  tenant_id: string;
  journey_name: string | null;
  company_id: string | null;
  company_name: string | null;
  current_stage: JourneyStage;
  sla_violated: 0 | 1;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string | null;
  updated_at: string;
  stages: Record<JourneyStage, JourneyStageData>;
}

export interface JourneySummary {
  id: string;
  journey_name: string | null;
  current_stage: JourneyStage;
  sla_violated: 0 | 1;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string | null;
  updated_at: string;
  company_name: string | null;
  days_in_stage: number | null;
  stages_done: number;
}

export interface JourneyAlert {
  id: string;
  journey_name: string | null;
  current_stage: JourneyStage;
  sla_violated: 0 | 1;
  company_name: string | null;
  days_in_stage: number | null;
}
```

- [ ] **Step 2: แก้ src/types/workflow.ts — เพิ่ม company_journey**

แก้บรรทัดที่ 3:
```typescript
export type WorkflowEntityType = 'project' | 'opportunity' | 'support_ticket' | 'company_journey';
```

- [ ] **Step 3: ตรวจสอบ TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: ไม่มี error ใหม่จาก journey.ts หรือ workflow.ts

- [ ] **Step 4: Commit**

```bash
git add src/types/journey.ts src/types/workflow.ts
git commit -m "feat(types): add journey TypeScript types + company_journey entity type"
```

---

## Task 6: useJourneys Hook

**Files:**
- Create: `src/hooks/useJourneys.ts`

- [ ] **Step 1: สร้าง src/hooks/useJourneys.ts**

```typescript
// src/hooks/useJourneys.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import type { JourneySummary, JourneyDetail, JourneyAlert } from '@/types/journey';

export function useJourneys(filters?: { sla_violated?: boolean; status?: string }) {
  const { user } = useAuth();
  const params = new URLSearchParams();
  if (filters?.sla_violated) params.set('sla_violated', '1');
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString() ? `?${params.toString()}` : '';

  return useQuery<JourneySummary[]>({
    queryKey: ['journeys', filters],
    queryFn: () => apiFetch(`/workflow-journeys.php${qs}`),
    enabled: !!user,
    staleTime: 30_000,
  });
}

export function useJourneyDetail(id: string | null) {
  const { user } = useAuth();
  return useQuery<JourneyDetail>({
    queryKey: ['journey', id],
    queryFn: () => apiFetch(`/workflow-journeys.php?id=${id}`),
    enabled: !!user && !!id,
    staleTime: 15_000,
  });
}

export function useJourneyAlerts() {
  const { user } = useAuth();
  return useQuery<JourneyAlert[]>({
    queryKey: ['journey-alerts'],
    queryFn: () => apiFetch('/workflow-journeys.php?action=alerts'),
    enabled: !!user,
    refetchInterval: 5 * 60_000, // refresh ทุก 5 นาที
    staleTime: 60_000,
  });
}

export function useCreateJourney() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { company_id: string; journey_name: string }) =>
      apiFetch('/workflow-journeys.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journeys'] }),
  });
}

export function useLinkJourneyEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { instance_id: string; stage: string; entity_type: string; entity_id: string }) =>
      apiFetch('/workflow-journeys.php?action=link', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['journey', vars.instance_id] });
      qc.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}
```

- [ ] **Step 2: ตรวจสอบ TypeScript**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useJourneys.ts
git commit -m "feat(hooks): add useJourneys, useJourneyDetail, useJourneyAlerts hooks"
```

---

## Task 7: WorkflowAlertBar Component

**Files:**
- Create: `src/components/workflow/WorkflowAlertBar.tsx`

- [ ] **Step 1: สร้าง WorkflowAlertBar.tsx**

```tsx
// src/components/workflow/WorkflowAlertBar.tsx
import { AlertTriangle } from 'lucide-react';
import { useJourneyAlerts } from '@/hooks/useJourneys';
import type { JourneyAlert } from '@/types/journey';

const STAGE_LABEL: Record<string, string> = {
  marketing: 'Marketing', sales: 'Sales', project: 'Project',
  support: 'Support', renewal: 'Renewal',
};

export function WorkflowAlertBar() {
  const { data: alerts = [] } = useJourneyAlerts();
  if (alerts.length === 0) return null;

  return (
    <div className="flex items-center gap-2 bg-red-50 border-b-2 border-red-200 px-4 py-1.5 text-xs">
      <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
      <span className="font-bold text-red-700">{alerts.length} Journey เกิน SLA</span>
      <span className="text-slate-400">·</span>
      <div className="flex gap-3 overflow-x-auto">
        {alerts.slice(0, 3).map((a: JourneyAlert) => (
          <span key={a.id} className="text-red-700 whitespace-nowrap">
            {a.company_name || a.journey_name || a.id} — {STAGE_LABEL[a.current_stage]} {a.days_in_stage} วัน
          </span>
        ))}
        {alerts.length > 3 && (
          <span className="text-slate-400">+{alerts.length - 3} รายการ</span>
        )}
      </div>
      <span className="ml-auto text-violet-600 cursor-pointer underline font-semibold whitespace-nowrap">
        ดูทั้งหมด →
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workflow/WorkflowAlertBar.tsx
git commit -m "feat(ui): add WorkflowAlertBar — SLA violation alert strip"
```

---

## Task 8: WorkflowJourneyList Sidebar

**Files:**
- Create: `src/components/workflow/WorkflowJourneyList.tsx`

- [ ] **Step 1: สร้าง WorkflowJourneyList.tsx**

```tsx
// src/components/workflow/WorkflowJourneyList.tsx
import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJourneys } from '@/hooks/useJourneys';
import type { JourneySummary, JourneyStage } from '@/types/journey';

const STAGE_PILL: Record<JourneyStage, string> = {
  marketing: 'bg-blue-100 text-blue-700',
  sales:     'bg-violet-100 text-violet-700',
  project:   'bg-yellow-100 text-yellow-800',
  support:   'bg-red-100 text-red-700',
  renewal:   'bg-green-100 text-green-700',
};
const STAGE_EMOJI: Record<JourneyStage, string> = {
  marketing: '📣', sales: '💼', project: '🚀', support: '🎧', renewal: '🔄',
};
const STAGE_LABEL: Record<JourneyStage, string> = {
  marketing: 'Marketing', sales: 'Sales', project: 'Project',
  support: 'Support', renewal: 'Renewal',
};

type FilterType = 'all' | 'active' | 'sla';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function WorkflowJourneyList({ selectedId, onSelect, onNew }: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch]  = useState('');

  const { data: all = [] } = useJourneys();

  const filtered = all.filter((j: JourneySummary) => {
    if (filter === 'active' && j.status !== 'active') return false;
    if (filter === 'sla'    && !j.sla_violated)       return false;
    if (search && !(j.journey_name ?? j.company_name ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // แยก journey กับ single-entity workflow
  const journeys = filtered.filter(j => j.status === 'active' || j.status === 'completed');

  return (
    <div className="w-52 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 p-2 border-b border-slate-100">
        <div className="flex-1 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-400">
          <Search size={10} />
          <input
            className="bg-transparent outline-none flex-1 text-slate-700"
            placeholder="ค้นหา..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={onNew}
          className="bg-violet-600 text-white rounded-md p-1.5 hover:bg-violet-700"
          title="สร้าง Journey ใหม่"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 p-1.5 border-b border-slate-100">
        {(['all','active','sla'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2 py-0.5 rounded-full text-[9px] font-bold border',
              filter === f
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-500 border-slate-200'
            )}
          >
            {f === 'all' ? 'ทั้งหมด' : f === 'active' ? 'กำลังทำ' : 'เกิน SLA'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1">
          🗺 Deal Cycle
        </p>

        {journeys.length === 0 && (
          <p className="text-[9px] text-slate-400 px-2 py-3 text-center">ไม่พบ Journey</p>
        )}

        {journeys.map((j: JourneySummary) => {
          const isViolated = !!j.sla_violated;
          return (
            <button
              key={j.id}
              onClick={() => onSelect(j.id)}
              className={cn(
                'w-full text-left rounded-lg px-2 py-1.5 mb-0.5 border transition-colors',
                selectedId === j.id
                  ? 'bg-violet-50 border-violet-300'
                  : 'bg-white border-transparent hover:bg-slate-50'
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                  isViolated ? 'bg-red-500' : j.days_in_stage && j.days_in_stage > 5 ? 'bg-amber-400' : 'bg-green-500'
                )} />
                <span className="text-[10px] font-semibold text-slate-800 truncate">
                  {j.journey_name || j.company_name || j.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded-full', STAGE_PILL[j.current_stage])}>
                  {STAGE_EMOJI[j.current_stage]} {STAGE_LABEL[j.current_stage]}
                </span>
                <span className={cn('text-[8px]', isViolated ? 'text-red-600 font-bold' : 'text-slate-400')}>
                  {j.days_in_stage} วัน{isViolated ? ' ⚠' : ''}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workflow/WorkflowJourneyList.tsx
git commit -m "feat(ui): add WorkflowJourneyList sidebar with filter + health dots"
```

---

## Task 9: JourneyTaskRow + JourneyStageCard (2-level expand)

**Files:**
- Create: `src/components/workflow/JourneyTaskRow.tsx`
- Create: `src/components/workflow/JourneyStageCard.tsx`

- [ ] **Step 1: สร้าง JourneyTaskRow.tsx**

```tsx
// src/components/workflow/JourneyTaskRow.tsx
import { cn } from '@/lib/utils';
import type { JourneyTask } from '@/types/journey';

const STATUS_CHECK: Record<string, { cls: string; icon: string }> = {
  completed:   { cls: 'bg-green-500 text-white',   icon: '✓' },
  in_progress: { cls: 'bg-violet-600 text-white',  icon: '▶' },
  cancelled:   { cls: 'bg-slate-400 text-white',   icon: '×' },
  blocked:     { cls: 'bg-red-500 text-white',     icon: '!' },
};
function checkProps(status: string) {
  return STATUS_CHECK[status] ?? { cls: 'bg-slate-200 text-slate-500', icon: '○' };
}

const TASK_ROW_BG: Record<string, string> = {
  completed:   'bg-green-50 border-green-200',
  in_progress: 'bg-violet-50 border-violet-200',
  blocked:     'bg-red-50 border-red-200',
};

interface Props {
  task: JourneyTask;
  isOpen: boolean;
  onToggle: () => void;
}

export function JourneyTaskRow({ task, isOpen, onToggle }: Props) {
  const check  = checkProps(task.status);
  const rowBg  = TASK_ROW_BG[task.status] ?? 'bg-slate-50 border-slate-100';
  const ownerName = [task.first_name, task.last_name].filter(Boolean).join(' ') || null;
  const doneSubtasks = task.subtasks.filter(s => s.status === 'completed').length;

  return (
    <div className={cn('rounded-lg overflow-hidden border', rowBg, task.status === 'in_progress' && 'border-violet-300')}>
      {/* Task header row */}
      <button
        className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 hover:brightness-95 transition-all text-left', rowBg)}
        onClick={onToggle}
      >
        <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0', check.cls)}>
          {check.icon}
        </div>
        <span className={cn('text-[10px] font-semibold flex-1 min-w-0 truncate',
          task.status === 'blocked' ? 'text-red-700' : 'text-slate-800'
        )}>
          {task.name}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {ownerName && (
            <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600">{ownerName}</span>
          )}
          {task.actual_hours != null && (
            <span className="text-[9px] text-slate-500">{task.actual_hours}ชม.</span>
          )}
          {task.status === 'in_progress' && task.due_date && (
            <span className="text-[8px] text-red-600 font-bold">ครบ {task.due_date.slice(0, 10)}</span>
          )}
          <span className={cn('text-[10px] text-slate-400 transition-transform flex-shrink-0', isOpen && 'rotate-180')}>▼</span>
        </div>
      </button>

      {/* Task detail (expand) */}
      {isOpen && (
        <div className="px-3 pt-2 pb-3 bg-white border-t border-slate-100 ml-4">
          {/* Meta row */}
          <div className="flex flex-wrap gap-3 mb-2">
            {task.start_date && (
              <span className="text-[9px]"><span className="text-slate-400">เริ่ม:</span><span className="font-semibold ml-1">{task.start_date.slice(0, 10)}</span></span>
            )}
            {task.completed_date && (
              <span className="text-[9px]"><span className="text-slate-400">เสร็จ:</span><span className="font-semibold ml-1">{task.completed_date.slice(0, 10)}</span></span>
            )}
            {task.actual_hours != null && (
              <span className="text-[9px]"><span className="text-slate-400">ชั่วโมงจริง:</span><span className="font-semibold ml-1">{task.actual_hours} ชม.</span></span>
            )}
            {task.estimated_hours != null && (
              <span className="text-[9px]"><span className="text-slate-400">ประมาณ:</span><span className="font-semibold ml-1">{task.estimated_hours} ชม.</span></span>
            )}
          </div>

          {/* Subtasks */}
          {task.subtasks.length > 0 && (
            <>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">งานย่อย</p>
              <div className="flex flex-col gap-1">
                {task.subtasks.map(sub => {
                  const sc = checkProps(sub.status);
                  const subOwner = [sub.first_name, sub.last_name].filter(Boolean).join(' ');
                  return (
                    <div key={sub.id} className="flex items-center gap-1.5 bg-slate-50 rounded-md px-2 py-1">
                      <div className={cn('w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0', sc.cls)}>
                        {sc.icon}
                      </div>
                      <span className="text-[9px] flex-1 text-slate-700 min-w-0 truncate">{sub.name}</span>
                      {sub.actual_hours != null && (
                        <span className="text-[8px] text-slate-400 whitespace-nowrap">{sub.actual_hours}ชม.</span>
                      )}
                      {subOwner && (
                        <span className="text-[8px] text-slate-400 whitespace-nowrap">{subOwner}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${task.subtasks.length > 0 ? (doneSubtasks / task.subtasks.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[8px] text-slate-500 whitespace-nowrap">
                  {doneSubtasks}/{task.subtasks.length} งานย่อย
                </span>
              </div>
            </>
          )}

          {/* Notes / Blocker */}
          {task.notes && (
            <div className={cn(
              'mt-2 text-[9px] rounded-md px-2 py-1.5 border-l-2 italic',
              task.status === 'blocked'
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'bg-slate-50 border-slate-300 text-slate-500'
            )}>
              {task.status === 'blocked' ? '🔴 ' : '📝 '}{task.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: สร้าง JourneyStageCard.tsx**

```tsx
// src/components/workflow/JourneyStageCard.tsx
import { cn } from '@/lib/utils';
import { JourneyTaskRow } from './JourneyTaskRow';
import type { JourneyStageData, JourneyStage } from '@/types/journey';

const STAGE_CONFIG: Record<JourneyStage, { emoji: string; label: string; iconBg: string }> = {
  marketing: { emoji: '📣', label: 'Marketing',  iconBg: 'bg-blue-100' },
  sales:     { emoji: '💼', label: 'Sales',      iconBg: 'bg-violet-100' },
  project:   { emoji: '🚀', label: 'Project',    iconBg: 'bg-yellow-100' },
  support:   { emoji: '🎧', label: 'Support',    iconBg: 'bg-red-100' },
  renewal:   { emoji: '🔄', label: 'Renewal',    iconBg: 'bg-green-100' },
};

const ENTITY_ROUTE: Record<string, string> = {
  opportunity:    '/#/sales',
  project:        '/#/projects',
  support_ticket: '/#/support',
};

interface Props {
  stageNum: number;
  data: JourneyStageData;
  isOpen: boolean;
  onToggleStage: () => void;
  openTasks: Set<string>;
  onToggleTask: (taskId: string) => void;
}

export function JourneyStageCard({ stageNum, data, isOpen, onToggleStage, openTasks, onToggleTask }: Props) {
  const cfg = STAGE_CONFIG[data.stage];
  const isActive   = data.status === 'active';
  const isDone     = data.status === 'completed';
  const isFuture   = data.status === 'pending' || data.status === 'skipped';
  const isCritical = data.sla_exceeded;

  const slaPercent = data.sla_days && data.days_in_stage != null
    ? Math.min((data.days_in_stage / data.sla_days) * 100, 100)
    : 0;

  const cardBorder = isCritical
    ? 'border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,.08)]'
    : isActive
    ? 'border-violet-400 shadow-[0_0_0_3px_rgba(124,58,237,.08)]'
    : isDone
    ? 'border-green-300'
    : 'border-slate-200';

  const doneTasks = data.tasks.filter(t => t.status === 'completed').length;
  const activeTasks = data.tasks.filter(t => t.status === 'in_progress' || t.status === 'blocked').length;

  return (
    <div className={cn('bg-white rounded-xl border-[1.5px] overflow-hidden', cardBorder, isFuture && 'opacity-55')}>
      {/* Stage header — click to expand/collapse */}
      <button
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors text-left"
        onClick={onToggleStage}
      >
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0', cfg.iconBg)}>
          {cfg.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800">{stageNum}. {cfg.label}</div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">
            {data.entity_name
              ? data.entity_name
              : isFuture
              ? 'รอ stage ก่อนหน้าเสร็จ'
              : 'ยังไม่ผูก entity'}
            {data.tasks.length > 0 && ` · ${doneTasks}/${data.tasks.length} งาน`}
            {activeTasks > 0 && ` · ${activeTasks} กำลังทำ`}
          </div>
        </div>

        {/* SLA bar */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', isCritical ? 'bg-red-500' : isDone ? 'bg-green-500' : 'bg-violet-500')}
              style={{ width: `${slaPercent}%` }}
            />
          </div>
          <span className={cn('text-[9px] whitespace-nowrap', isCritical ? 'text-red-600 font-bold' : 'text-slate-400')}>
            {data.days_in_stage ?? 0}/{data.sla_days ?? '?'} วัน{isCritical ? ' ⚠' : ''}
          </span>
        </div>

        {/* Badge */}
        <span className={cn(
          'text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0',
          isCritical ? 'bg-red-100 text-red-700'
          : isDone    ? 'bg-green-100 text-green-700'
          : isActive  ? 'bg-violet-100 text-violet-700'
          : 'bg-slate-100 text-slate-500'
        )}>
          {isCritical ? '⚠ เกิน SLA' : isDone ? '✓ เสร็จแล้ว' : isActive ? '▶ กำลังทำ' : 'รอ'}
        </span>

        <span className={cn('text-[10px] text-slate-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')}>▼</span>
      </button>

      {/* Stage body */}
      {isOpen && (
        <div className="border-t border-slate-100">
          {/* Entity link row */}
          {data.entity_name && data.entity_type && (
            <div className={cn(
              'flex items-center gap-2 px-3.5 py-2 text-[10px] border-b border-slate-100',
              isCritical ? 'bg-red-50' : 'bg-slate-50'
            )}>
              <span>{cfg.emoji}</span>
              <div>
                <span className="font-semibold text-slate-800">{data.entity_name}</span>
                {data.entity_type && (
                  <span className={cn('ml-2', isCritical ? 'text-red-600' : 'text-slate-500')}>
                    {isCritical ? `เกิน SLA ${(data.days_in_stage ?? 0) - (data.sla_days ?? 0)} วัน` : ''}
                  </span>
                )}
              </div>
              {data.entity_type && ENTITY_ROUTE[data.entity_type] && (
                <a
                  href={ENTITY_ROUTE[data.entity_type]}
                  className="ml-auto text-violet-600 text-[9px] underline font-bold whitespace-nowrap"
                  onClick={e => e.stopPropagation()}
                >
                  ดูใน {cfg.label} →
                </a>
              )}
            </div>
          )}

          {/* Tasks */}
          <div className="px-3.5 py-2.5 flex flex-col gap-1.5">
            {data.tasks.length > 0 && (
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                งานใน {cfg.label} Stage
              </p>
            )}
            {data.tasks.map(task => (
              <JourneyTaskRow
                key={task.id}
                task={task}
                isOpen={openTasks.has(task.id)}
                onToggle={() => onToggleTask(task.id)}
              />
            ))}
            {data.tasks.length === 0 && (
              <p className="text-[9px] text-slate-400 text-center py-2">
                {isFuture ? 'งานจะแสดงเมื่อ stage นี้เริ่มต้น' : 'ไม่มีงานใน stage นี้'}
              </p>
            )}

            {/* Critical stage warning */}
            {isCritical && (
              <div className="mt-1 bg-red-50 border border-red-200 rounded-md px-2.5 py-2 text-[9px] text-red-700 flex items-center gap-1.5">
                🔴 Stage นี้เกิน SLA แล้ว — กรุณาตรวจสอบความคืบหน้าใน {cfg.label}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/workflow/JourneyTaskRow.tsx src/components/workflow/JourneyStageCard.tsx
git commit -m "feat(ui): add JourneyTaskRow + JourneyStageCard with 2-level expand"
```

---

## Task 10: WorkflowJourneyDetail Main Panel

**Files:**
- Create: `src/components/workflow/WorkflowJourneyDetail.tsx`

- [ ] **Step 1: สร้าง WorkflowJourneyDetail.tsx**

```tsx
// src/components/workflow/WorkflowJourneyDetail.tsx
import { useState, useEffect } from 'react';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJourneyDetail } from '@/hooks/useJourneys';
import { JourneyStageCard } from './JourneyStageCard';
import type { JourneyStage } from '@/types/journey';

const STAGE_ORDER: JourneyStage[] = ['marketing', 'sales', 'project', 'support', 'renewal'];

interface Props {
  journeyId: string;
}

export function WorkflowJourneyDetail({ journeyId }: Props) {
  const { data: journey, isLoading } = useJourneyDetail(journeyId);

  // open/close state สำหรับ stage (Level 1)
  const [openStages, setOpenStages] = useState<Set<JourneyStage>>(new Set());
  // open/close state สำหรับ task (Level 2)
  const [openTasks, setOpenTasks] = useState<Set<string>>(new Set());

  // เมื่อ journey โหลดเสร็จ: auto-open stage active + task in_progress/blocked
  useEffect(() => {
    if (!journey) return;
    const autoOpenStages = new Set<JourneyStage>();
    const autoOpenTasks  = new Set<string>();

    STAGE_ORDER.forEach(stage => {
      const s = journey.stages[stage];
      if (!s) return;
      if (s.status === 'active' || s.sla_exceeded) autoOpenStages.add(stage);
      s.tasks.forEach(t => {
        if (t.status === 'in_progress' || t.status === 'blocked') autoOpenTasks.add(t.id);
      });
    });

    setOpenStages(autoOpenStages);
    setOpenTasks(autoOpenTasks);
  }, [journey?.id]);

  const toggleStage = (stage: JourneyStage) =>
    setOpenStages(prev => { const n = new Set(prev); n.has(stage) ? n.delete(stage) : n.add(stage); return n; });

  const toggleTask = (taskId: string) =>
    setOpenTasks(prev => { const n = new Set(prev); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n; });

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">กำลังโหลด...</div>
  );
  if (!journey) return (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">เลือก Journey จากรายการ</div>
  );

  const stagesDone = STAGE_ORDER.filter(s => journey.stages[s]?.status === 'completed').length;
  const totalDays  = journey.started_at ? Math.floor((Date.now() - new Date(journey.started_at).getTime()) / 86400000) : 0;
  const daysInCurrent = journey.stages[journey.current_stage]?.days_in_stage ?? 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div>
          <div className="text-sm font-bold text-slate-800">{journey.journey_name || journey.company_name || journey.id.slice(0,8)}</div>
          <div className="text-[10px] text-slate-400">
            Deal Cycle · เริ่ม {journey.started_at?.slice(0, 10) ?? '—'}
          </div>
        </div>
        {/* Day counter */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
          daysInCurrent > (journey.stages[journey.current_stage]?.sla_days ?? 9999)
            ? 'bg-red-50 border-red-200'
            : 'border-slate-200'
        )}>
          <div>
            <div className={cn('text-lg font-black leading-none',
              daysInCurrent > (journey.stages[journey.current_stage]?.sla_days ?? 9999) ? 'text-red-600' : 'text-slate-800'
            )}>{daysInCurrent}</div>
            <div className="text-[8px] text-slate-400 leading-none mt-0.5">วันใน<br/>stage ปัจจุบัน</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
          <div>
            <div className="text-lg font-black leading-none text-violet-600">{stagesDone}/5</div>
            <div className="text-[8px] text-slate-400 leading-none mt-0.5">Stage<br/>สำเร็จ</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
          <div>
            <div className="text-lg font-black leading-none">{totalDays}</div>
            <div className="text-[8px] text-slate-400 leading-none mt-0.5">วัน<br/>รวม</div>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
            <Link2 size={11} /> ผูก Entity
          </button>
        </div>
      </div>

      {/* Journey flow */}
      <div className="flex-1 overflow-y-auto p-3.5 flex gap-3">
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="bg-amber-50 border border-dashed border-amber-200 rounded-lg px-3 py-1.5 text-[9px] text-amber-800 flex items-center gap-2">
            <span>💡</span>
            <span>คลิก stage เพื่อดูงาน · คลิก task เพื่อดูรายละเอียดงานย่อย · ทีมงาน advance งานจากหน้า Projects/Sales/Support ตรงๆ</span>
          </div>

          {STAGE_ORDER.map((stage, idx) => {
            const stageData = journey.stages[stage];
            if (!stageData) return null;
            return (
              <div key={stage}>
                {idx > 0 && (
                  <div className="flex justify-center text-slate-300 text-base h-2">↓</div>
                )}
                <JourneyStageCard
                  stageNum={idx + 1}
                  data={stageData}
                  isOpen={openStages.has(stage)}
                  onToggleStage={() => toggleStage(stage)}
                  openTasks={openTasks}
                  onToggleTask={toggleTask}
                />
              </div>
            );
          })}
        </div>

        {/* Right info panel */}
        <div className="w-44 flex-shrink-0 flex flex-col gap-2">
          {/* Company */}
          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">บริษัท</p>
            <p className="text-xs font-bold">{journey.company_name || '—'}</p>
          </div>

          {/* Progress donut */}
          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2">ความคืบหน้า</p>
            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-10 h-10" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#7c3aed" strokeWidth="3"
                    strokeDasharray={`${(stagesDone / 5) * 100} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-violet-700">
                  {Math.round((stagesDone / 5) * 100)}%
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold">{stagesDone}/5 stage</p>
                <p className="text-[9px] text-slate-400">สำเร็จ</p>
                {journey.sla_violated ? (
                  <p className="text-[9px] text-red-600 font-bold mt-0.5">⚠ เกิน SLA</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Timeline</p>
            <div className="flex flex-col gap-1">
              <div className="text-[9px]"><span className="text-slate-400">เริ่ม:</span><span className="font-semibold ml-1">{journey.started_at?.slice(0,10) ?? '—'}</span></div>
              <div className="text-[9px]"><span className="text-slate-400">ผ่านมา:</span><span className={cn('font-semibold ml-1', totalDays > 60 ? 'text-red-600' : '')}>{totalDays} วัน</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workflow/WorkflowJourneyDetail.tsx
git commit -m "feat(ui): add WorkflowJourneyDetail — 2-level expand journey panel"
```

---

## Task 11: Wire Everything into WorkflowPage.tsx

**Files:**
- Modify: `src/pages/WorkflowPage.tsx`

- [ ] **Step 1: อ่านไฟล์เดิมก่อนแก้**

```bash
head -25 src/pages/WorkflowPage.tsx
```

- [ ] **Step 2: เพิ่ม imports ที่ด้านบน WorkflowPage.tsx**

เพิ่มหลัง import เดิม (ก่อน `interface UnlinkedRecord`):

```tsx
import { WorkflowAlertBar }       from '@/components/workflow/WorkflowAlertBar';
import { WorkflowJourneyList }     from '@/components/workflow/WorkflowJourneyList';
import { WorkflowJourneyDetail }   from '@/components/workflow/WorkflowJourneyDetail';
import { useCreateJourney }        from '@/hooks/useJourneys';
import { useCompanies }            from '@/hooks/useProjects';
```

- [ ] **Step 3: เปลี่ยน default tab และเพิ่ม journey state**

หาบรรทัด `useState<'editor' | 'bottleneck' | 'report'>` แล้วแก้:

```tsx
const [activeTab, setActiveTab] = useState<'journey' | 'editor' | 'bottleneck' | 'report'>('journey');
const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
const [showNewJourneyDialog, setShowNewJourneyDialog] = useState(false);
```

- [ ] **Step 4: เพิ่ม journey tab ใน JSX tabs bar**

หาส่วน tabs bar (มี `<button` หรือ div ที่แสดง tab) และเพิ่ม journey tab เป็นอันแรก:

```tsx
{/* เพิ่ม journey tab เป็น tab แรก */}
<button
  onClick={() => setActiveTab('journey')}
  className={cn(
    'px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
    activeTab === 'journey'
      ? 'border-violet-600 text-violet-600'
      : 'border-transparent text-slate-400 hover:text-slate-600'
  )}
>
  🗺 เส้นทาง Journey
</button>
```

- [ ] **Step 5: เพิ่ม alert bar และ journey tab content ใน JSX**

เพิ่ม `<WorkflowAlertBar />` ก่อน content area หลัก และเพิ่ม `{activeTab === 'journey' && (...)}` block:

```tsx
{/* SLA Alert Bar — แสดงทุก tab */}
<WorkflowAlertBar />

{/* Journey tab content */}
{activeTab === 'journey' && (
  <div className="flex flex-1 overflow-hidden">
    <WorkflowJourneyList
      selectedId={selectedJourneyId}
      onSelect={setSelectedJourneyId}
      onNew={() => setShowNewJourneyDialog(true)}
    />
    {selectedJourneyId
      ? <WorkflowJourneyDetail journeyId={selectedJourneyId} />
      : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
          <span className="text-4xl">🗺</span>
          <p className="text-sm font-medium">เลือก Journey จากรายการทางซ้าย</p>
          <p className="text-xs">หรือสร้าง Journey ใหม่ด้วยปุ่ม +</p>
        </div>
      )
    }
  </div>
)}
```

- [ ] **Step 6: ตรวจสอบ TypeScript + Lint**

```bash
pnpm tsc --noEmit 2>&1 | head -30
pnpm lint 2>&1 | head -30
```

Expected: ไม่มี error จากไฟล์ใหม่ (อาจมี warning จากไฟล์เดิมที่มีอยู่แล้ว)

- [ ] **Step 7: Build ทดสอบ**

```bash
pnpm build 2>&1 | tail -20
```

Expected: `built in X.XXs` ไม่มี error

- [ ] **Step 8: Commit**

```bash
git add src/pages/WorkflowPage.tsx
git commit -m "feat(ui): wire journey tab into WorkflowPage — default to journey view"
```

---

## Task 12: Integration Test & Seed Data

**Files:**
- Create: `database/migrations/2026_06_13_000002_journey_seed.sql`

- [ ] **Step 1: สร้าง seed data สำหรับทดสอบ (ใช้ UUID จริงจาก DB)**

ก่อนรัน seed ต้องดู company_id จริงก่อน:

```bash
mysql -u root flowstack -e "SELECT id, name FROM companies LIMIT 5;"
```

แล้วแทน `<REAL_COMPANY_ID>` ด้วย id จริง:

```sql
-- database/migrations/2026_06_13_000002_journey_seed.sql
-- ใส่ company_id จริงที่ได้จาก query ด้านบน
SET @company_id = '<REAL_COMPANY_ID>';
SET @def_id = (SELECT id FROM workflow_definitions WHERE entity_type='company_journey' AND tenant_id='tenant-default' LIMIT 1);
SET @inst_id = UUID();

INSERT INTO workflow_instances
  (id, tenant_id, workflow_definition_id, entity_type, entity_id, journey_name, company_id, current_stage, sla_violated, status, started_at)
VALUES
  (@inst_id, 'tenant-default', @def_id, 'company_journey', @inst_id,
   'Journey ทดสอบ', @company_id, 'project', 0, 'active', DATE_SUB(NOW(), INTERVAL 42 DAY));
```

- [ ] **Step 2: รัน seed**

```bash
mysql -u root flowstack < database/migrations/2026_06_13_000002_journey_seed.sql
```

- [ ] **Step 3: ทดสอบใน browser**

1. เปิด http://localhost:8080/#/workflow
2. Tab แรกควรเป็น "🗺 เส้นทาง Journey"
3. Sidebar ควรแสดง "Journey ทดสอบ"
4. คลิกเลือก journey → detail panel แสดง 5 stage
5. คลิก stage header → expand/collapse ทำงาน
6. (ถ้ามี project ผูกแล้ว) คลิก task → expand แสดง subtasks

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_06_13_000002_journey_seed.sql
git commit -m "test(db): add journey seed data for manual testing"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Task 1: DB migration — entity_type enum, workflow_instances columns, workflow_journey_links
- [x] Task 2-3: PHP API — journey CRUD, link entity, SLA alerts, auto-advance hooks
- [x] Task 4: `WorkflowEntityType` เพิ่ม `company_journey`
- [x] Task 5-6: TypeScript types + hooks
- [x] Task 7: Alert bar
- [x] Task 8: Sidebar journey list
- [x] Task 9: 2-level expand (Stage + Task)
- [x] Task 10: Detail panel
- [x] Task 11: WorkflowPage wiring + default tab = journey
- [x] Task 12: Seed + manual test

**Out of scope (spec section 8) — ไม่ implement:**
- AI-suggested SLA, journey template marketplace, Gantt view

**Type consistency check:**
- `JourneyStage` ใช้ตรงกัน: journey.ts → useJourneys.ts → JourneyStageCard.tsx → WorkflowJourneyDetail.tsx ✓
- `JourneySummary.id` ใช้ใน WorkflowJourneyList → useJourneyDetail(id) ✓
- `JourneyDetail.stages[stage]` indexed by `JourneyStage` ✓
- `openTasks: Set<string>` ส่งผ่าน WorkflowJourneyDetail → JourneyStageCard → JourneyTaskRow ✓
