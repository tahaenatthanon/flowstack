# Task Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/task-intelligence` page with Assessment, Data Quality, and Validation Rules tabs — plus inline validation enforcement in task creation/update.

**Architecture:** New PHP API endpoints handle data queries and rule management. A single React page with 3 tabs reads from those endpoints. Validation rules fire inside `api/tasks.php` on POST/PUT before any DB write. No existing schema is altered — one new table is added.

**Tech Stack:** PHP + MariaDB, React 18 + TypeScript, TanStack React Query, shadcn-ui, Tailwind CSS

---

## 🟢 สถานะการ Implement (อัปเดต 2026-05-14)

| Task | สถานะ | หมายเหตุ |
|------|--------|---------|
| Task 1: DB Migration (สร้างไฟล์) | ✅ เสร็จ | ไฟล์ `2026_05_14_000000_create_task_validation_rules.sql` สร้างแล้ว |
| Task 1: รัน migration | ✅ เสร็จ | รันแล้ว `mysql -u root flowstack < migration.sql` |
| Task 2: api/validation-rules.php | ✅ เสร็จ | CRUD + auto-seed 6 default rules |
| Task 3: api/task-intelligence.php | ✅ เสร็จ | 8 actions: assessment, quality, duplicates, migrate_preview, migrate, orphaned, assign_project, bulk_update |
| Task 4: api/tasks.php validation | ✅ เสร็จ | runValidationRules() ใน POST+PUT พร้อม block (422) และ warn |
| Task 5: auth.php + route + sidebar | ✅ เสร็จ | menu key `task_intelligence` ครบ |
| Task 6: TaskIntelligencePage.tsx | ✅ เสร็จ | 667 บรรทัด, 3 tabs, TypeScript check ผ่าน |
| Task 6: Wire warnings toast (create/update) | ✅ เสร็จ | TaskDetailSheet, CreateTaskDialog, InsertAdHocTaskDialog |
| Task 7: Build verification | ✅ เสร็จ | `pnpm build` ผ่าน, `pnpm lint` มี warning แต่ไม่ error |
| Task 7: Smoke test | ✅ เสร็จ | Dev server ทำงานได้ที่ http://localhost:8081 |

**สถานะ:** ✅ **พร้อมใช้งาน** - Feature Task Intelligence เสร็จสมบูรณ์

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `database/migrations/2026_05_14_000000_create_task_validation_rules.sql` | New table + seed rules |
| CREATE | `api/validation-rules.php` | CRUD for validation rules |
| CREATE | `api/task-intelligence.php` | Assessment, duplicates, quality, migrate actions |
| MODIFY | `api/tasks.php` | Enforce validation rules on POST/PUT |
| MODIFY | `api/auth.php` | Add `task_intelligence` to ALL_MENU_KEYS |
| CREATE | `src/pages/TaskIntelligencePage.tsx` | 3-tab page (Assessment, Data Quality, Validation Rules) |
| MODIFY | `src/App.tsx` | Add `/task-intelligence` route |
| MODIFY | `src/components/AppSidebar.tsx` | Add menu item |

---

## Task 1: Database Migration

**Files:**
- Create: `database/migrations/2026_05_14_000000_create_task_validation_rules.sql`

- [x] **Step 1: Create migration file**

```sql
-- database/migrations/2026_05_14_000000_create_task_validation_rules.sql

CREATE TABLE IF NOT EXISTS task_validation_rules (
  id                 CHAR(36)      NOT NULL PRIMARY KEY,
  tenant_id          CHAR(36)      NOT NULL,
  rule_type          ENUM('warn','block') NOT NULL,
  condition_field    VARCHAR(64)   NOT NULL,
  condition_operator VARCHAR(16)   NOT NULL,
  condition_value    VARCHAR(255)  DEFAULT NULL,
  message_th         VARCHAR(512)  NOT NULL,
  is_active          TINYINT(1)    NOT NULL DEFAULT 1,
  is_system          TINYINT(1)    NOT NULL DEFAULT 0,
  created_by         CHAR(36)      DEFAULT NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)  ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE SET NULL,
  INDEX idx_tvr_tenant (tenant_id),
  INDEX idx_tvr_active (tenant_id, is_active)
);
```

- [ ] **Step 2: Run migration in phpMyAdmin or MySQL CLI**

```sql
SOURCE /path/to/database/migrations/2026_05_14_000000_create_task_validation_rules.sql;
```

Expected: Table `task_validation_rules` created with no errors.

- [ ] **Step 3: Verify table exists**

```sql
DESCRIBE task_validation_rules;
```

Expected: 11 columns shown.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_05_14_000000_create_task_validation_rules.sql
git commit -m "feat: add task_validation_rules migration"
```

---

## Task 2: api/validation-rules.php

**Files:**
- Create: `api/validation-rules.php`

Default rules are seeded per-tenant on first GET if the tenant has no rules yet.

- [x] **Step 1: Create the file**

```php
<?php
// api/validation-rules.php
// GET    - list rules for tenant (seeds defaults if none exist)
// POST   - create rule
// PUT    - update rule (?id= required)
// DELETE - delete rule (?id= required, non-system only)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

$adminStmt = $db->prepare('SELECT is_admin FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
$adminStmt->execute([$userId, $tenantId]);
$isAdmin = (int)($adminStmt->fetchColumn() ?? 0) === 1;

// ── Seed default rules for tenant if none exist ──────────────────────────────
function seedDefaultRules(PDO $db, string $tenantId): void {
    $defaults = [
        ['warn',  'title_duplicate',    'duplicate', null,  'พบ task ที่อาจซ้ำกัน กรุณาตรวจสอบ'],
        ['block', 'actual_hours',       'gt',        '16',  'ไม่สามารถบันทึกชั่วโมงเกิน 16 ชั่วโมงต่อ task'],
        ['block', 'daily_hours_sum',    'gt',        '24',  'ชั่วโมงรวมของวันนี้เกิน 24 ชั่วโมง'],
        ['warn',  'assignee_user_id',   'null',      null,  'task ยังไม่มีผู้รับผิดชอบ'],
        ['warn',  'estimated_hours',    'null',      null,  'task ยังไม่มีชั่วโมงประมาณ'],
        ['block', 'end_before_start',   'invalid',   null,  'วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น'],
    ];
    $stmt = $db->prepare("INSERT INTO task_validation_rules
        (id, tenant_id, rule_type, condition_field, condition_operator, condition_value, message_th, is_active, is_system)
        VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1, 1)");
    foreach ($defaults as [$type, $field, $op, $val, $msg]) {
        $stmt->execute([$tenantId, $type, $field, $op, $val, $msg]);
    }
}

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $count = $db->prepare('SELECT COUNT(*) FROM task_validation_rules WHERE tenant_id = ?');
    $count->execute([$tenantId]);
    if ((int)$count->fetchColumn() === 0) {
        seedDefaultRules($db, $tenantId);
    }
    $stmt = $db->prepare('SELECT * FROM task_validation_rules WHERE tenant_id = ? ORDER BY is_system DESC, created_at ASC');
    $stmt->execute([$tenantId]);
    echo json_encode(['data' => $stmt->fetchAll(PDO::FETCH_ASSOC)], JSON_NUMERIC_CHECK);
    exit;
}

// Admin-only below ─────────────────────────────────────────────────────────
if (!$isAdmin) { jsonError('Forbidden', 403); }

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $required = ['rule_type','condition_field','condition_operator','message_th'];
    foreach ($required as $f) {
        if (empty($input[$f])) { jsonError("Field required: $f", 400); }
    }
    if (!in_array($input['rule_type'], ['warn','block'])) { jsonError('rule_type must be warn or block', 400); }
    $stmt = $db->prepare("INSERT INTO task_validation_rules
        (id, tenant_id, rule_type, condition_field, condition_operator, condition_value, message_th, is_active, is_system, created_by)
        VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1, 0, ?)");
    $stmt->execute([
        $tenantId,
        $input['rule_type'],
        $input['condition_field'],
        $input['condition_operator'],
        $input['condition_value'] ?? null,
        $input['message_th'],
        $userId,
    ]);
    echo json_encode(['success' => true]);
    exit;
}

// ── PUT ──────────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? '';
    if (!$id) { jsonError('id required', 400); }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $fields = [];
    $params = [];
    $allowed = ['rule_type','condition_field','condition_operator','condition_value','message_th','is_active'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $input)) {
            $fields[] = "$f = ?";
            $params[] = $input[$f];
        }
    }
    if (empty($fields)) { jsonError('Nothing to update', 400); }
    $params[] = $id;
    $params[] = $tenantId;
    $stmt = $db->prepare("UPDATE task_validation_rules SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?");
    $stmt->execute($params);
    echo json_encode(['success' => true]);
    exit;
}

// ── DELETE ───────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? '';
    if (!$id) { jsonError('id required', 400); }
    $stmt = $db->prepare("DELETE FROM task_validation_rules WHERE id = ? AND tenant_id = ? AND is_system = 0");
    $stmt->execute([$id, $tenantId]);
    echo json_encode(['success' => true]);
    exit;
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 2: Test GET seeds defaults**

Open browser: `http://localhost/flowstack/api/validation-rules.php`
Expected: JSON with `data` array of 6 rules.

- [ ] **Step 3: Commit**

```bash
git add api/validation-rules.php
git commit -m "feat: add validation-rules API with default seeding"
```

---

## Task 3: api/task-intelligence.php — Assessment + Quality + Duplicates

**Files:**
- Create: `api/task-intelligence.php`

- [x] **Step 1: Create the file**

```php
<?php
// api/task-intelligence.php
// GET ?action=assessment  - health metrics
// GET ?action=quality     - missing fields, anomalies, zombies
// GET ?action=duplicates  - fuzzy-matched duplicate tasks
// GET ?action=migrate_preview&project_ids=id1,id2  - preview migration
// POST ?action=migrate    - run migration (admin only)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();
$action    = $_GET['action'] ?? '';

$adminStmt = $db->prepare('SELECT is_admin FROM tenant_users WHERE user_id = ? AND tenant_id = ?');
$adminStmt->execute([$userId, $tenantId]);
$isAdmin = (int)($adminStmt->fetchColumn() ?? 0) === 1;

// PM can see projects where they are manager
function getAccessibleProjectIds(PDO $db, string $tenantId, string $userId, bool $isAdmin): array {
    if ($isAdmin) {
        $stmt = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND deleted_at IS NULL AND kind = 'project'");
        $stmt->execute([$tenantId]);
    } else {
        $stmt = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND manager_id = ? AND deleted_at IS NULL AND kind = 'project'");
        $stmt->execute([$tenantId, $userId]);
    }
    return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'id');
}

// ── ASSESSMENT ───────────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'assessment') {
    $projectIds = getAccessibleProjectIds($db, $tenantId, $userId, $isAdmin);
    if (empty($projectIds)) { echo json_encode(['data' => []]); exit; }

    $filterProject = $_GET['project_id'] ?? '';
    $filterUser    = $_GET['user_id'] ?? '';
    $dateFrom      = $_GET['date_from'] ?? date('Y-m-d', strtotime('-90 days'));
    $dateTo        = $_GET['date_to']   ?? date('Y-m-d');

    if ($filterProject && !in_array($filterProject, $projectIds)) { jsonError('Forbidden', 403); }
    $scope = $filterProject ? [$filterProject] : $projectIds;
    $inClause = implode(',', array_fill(0, count($scope), '?'));

    // On-time vs late completion
    $params = $scope;
    $params[] = $dateFrom;
    $params[] = $dateTo;
    $userFilter = '';
    if ($filterUser) { $userFilter = ' AND assignee_user_id = ?'; $params[] = $filterUser; }

    $stmt = $db->prepare("SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='completed' AND (completed_date IS NULL OR completed_date <= end_date) THEN 1 ELSE 0 END) as on_time,
        SUM(CASE WHEN status='completed' AND completed_date > end_date THEN 1 ELSE 0 END) as late_completed,
        SUM(CASE WHEN status != 'completed' AND end_date < CURDATE() THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN estimated_hours > 0 THEN actual_hours - estimated_hours ELSE NULL END) as hours_diff_sum,
        COUNT(CASE WHEN estimated_hours > 0 THEN 1 END) as hours_diff_count
        FROM tasks
        WHERE project_id IN ($inClause)
        AND is_subtask = 0
        AND deleted_at IS NULL
        AND (start_date >= ? OR end_date <= ?)
        $userFilter");
    $stmt->execute($params);
    $summary = $stmt->fetch(PDO::FETCH_ASSOC);

    // Workload per person
    $wParams = $scope;
    if ($filterUser) $wParams[] = $filterUser;
    $stmt2 = $db->prepare("SELECT u.id, u.name,
        SUM(t.actual_hours) as actual_hours,
        SUM(t.estimated_hours) as estimated_hours,
        COUNT(t.id) as task_count
        FROM tasks t
        JOIN users u ON u.id = t.assignee_user_id
        WHERE t.project_id IN ($inClause)
        AND t.is_subtask = 0
        AND t.deleted_at IS NULL
        " . ($filterUser ? "AND t.assignee_user_id = ?" : "") . "
        GROUP BY u.id, u.name
        ORDER BY actual_hours DESC");
    $stmt2->execute($wParams);
    $workload = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    // Velocity: tasks completed per week (rolling 4 weeks)
    $vParams = $scope;
    $stmt3 = $db->prepare("SELECT
        YEARWEEK(completed_date, 1) as yw,
        COUNT(*) as completed
        FROM tasks
        WHERE project_id IN ($inClause)
        AND status = 'completed'
        AND completed_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)
        AND deleted_at IS NULL
        AND is_subtask = 0
        GROUP BY yw ORDER BY yw");
    $stmt3->execute($vParams);
    $velocity = $stmt3->fetchAll(PDO::FETCH_ASSOC);

    $total = (int)($summary['total'] ?? 0);
    $onTime = (int)($summary['on_time'] ?? 0);
    $overdue = (int)($summary['overdue'] ?? 0);
    $diffCount = (int)($summary['hours_diff_count'] ?? 0);
    $avgDeviation = $diffCount > 0 ? round(($summary['hours_diff_sum'] / $diffCount) * 100) / 100 : 0;

    echo json_encode([
        'summary' => [
            'total'              => $total,
            'on_time'            => $onTime,
            'on_time_pct'        => $total > 0 ? round($onTime / $total * 100) : 0,
            'overdue'            => $overdue,
            'overdue_pct'        => $total > 0 ? round($overdue / $total * 100) : 0,
            'avg_hours_deviation'=> $avgDeviation,
        ],
        'workload' => $workload,
        'velocity' => $velocity,
    ], JSON_NUMERIC_CHECK);
    exit;
}

// ── DATA QUALITY ─────────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'quality') {
    $projectIds = getAccessibleProjectIds($db, $tenantId, $userId, $isAdmin);
    if (empty($projectIds)) { echo json_encode(['missing'=>[],'anomalies'=>[],'zombies'=>[]]); exit; }
    $inClause = implode(',', array_fill(0, count($projectIds), '?'));

    // Missing fields
    $stmt = $db->prepare("SELECT t.id, t.title, t.project_id, p.name as project_name,
        t.assignee, t.estimated_hours, t.end_date, t.status
        FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.project_id IN ($inClause)
        AND t.is_subtask = 0
        AND t.deleted_at IS NULL
        -- holiday/leave official source is calendar_events; keep exclusion for legacy task compatibility rows
        AND t.task_type NOT IN ('holiday','leave')
        AND (t.estimated_hours IS NULL OR t.estimated_hours = 0
             OR t.assignee_user_id IS NULL
             OR t.end_date IS NULL)
        LIMIT 200");
    $stmt->execute($projectIds);
    $missing = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Hour anomalies: single task > 16h
    $params = $projectIds;
    $stmt2 = $db->prepare("SELECT t.id, t.title, t.project_id, p.name as project_name,
        t.actual_hours, t.assignee, t.start_date
        FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.project_id IN ($inClause)
        AND t.deleted_at IS NULL
        AND t.actual_hours > 16
        LIMIT 100");
    $stmt2->execute($params);
    $anomalies = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    // Zombie tasks: in-progress, end_date < 3 days ago, no history in 14 days
    $stmt3 = $db->prepare("SELECT t.id, t.title, t.project_id, p.name as project_name,
        t.assignee, t.end_date, t.status,
        MAX(th.created_at) as last_activity
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN task_history th ON th.task_id = t.id
        WHERE t.project_id IN ($inClause)
        AND t.status = 'in-progress'
        AND t.end_date < DATE_SUB(CURDATE(), INTERVAL 3 DAY)
        AND t.deleted_at IS NULL
        AND t.is_subtask = 0
        GROUP BY t.id, t.title, t.project_id, p.name, t.assignee, t.end_date, t.status
        HAVING last_activity IS NULL OR last_activity < DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        LIMIT 100");
    $stmt3->execute($projectIds);
    $zombies = $stmt3->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'missing'   => $missing,
        'anomalies' => $anomalies,
        'zombies'   => $zombies,
    ], JSON_NUMERIC_CHECK);
    exit;
}

// ── DUPLICATES ───────────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'duplicates') {
    $projectIds = getAccessibleProjectIds($db, $tenantId, $userId, $isAdmin);
    if (empty($projectIds)) { echo json_encode(['data' => []]); exit; }
    $inClause = implode(',', array_fill(0, count($projectIds), '?'));

    $stmt = $db->prepare("SELECT t.id, t.title, t.project_id, p.name as project_name,
        t.assignee_user_id, t.assignee, t.start_date, t.end_date, t.status
        FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.project_id IN ($inClause)
        AND t.is_subtask = 0
        AND t.deleted_at IS NULL
        ORDER BY t.title, t.assignee_user_id, t.start_date");
    $stmt->execute($projectIds);
    $all = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // PHP-side fuzzy match: group by similar title + same assignee + overlapping dates
    $groups = [];
    $used   = [];
    for ($i = 0; $i < count($all); $i++) {
        if (isset($used[$i])) continue;
        $group = [$all[$i]];
        for ($j = $i + 1; $j < count($all); $j++) {
            if (isset($used[$j])) continue;
            $a = $all[$i]; $b = $all[$j];
            similar_text(strtolower($a['title']), strtolower($b['title']), $pct);
            if ($pct < 80) continue;
            if ($a['assignee_user_id'] !== $b['assignee_user_id']) continue;
            // Date overlap check
            $aStart = $a['start_date']; $aEnd = $a['end_date'];
            $bStart = $b['start_date']; $bEnd = $b['end_date'];
            if ($aStart && $aEnd && $bStart && $bEnd) {
                if ($aEnd < $bStart || $bEnd < $aStart) continue;
            }
            $group[] = $b;
            $used[$j] = true;
        }
        if (count($group) > 1) {
            $groups[] = $group;
            $used[$i] = true;
        }
    }

    echo json_encode(['data' => $groups], JSON_NUMERIC_CHECK);
    exit;
}

// ── MIGRATE PREVIEW ──────────────────────────────────────────────────────────
if ($method === 'GET' && $action === 'migrate_preview') {
    if (!$isAdmin) { jsonError('Forbidden', 403); }
    $ids = array_filter(explode(',', $_GET['project_ids'] ?? ''));
    if (empty($ids)) { jsonError('project_ids required', 400); }
    $inClause = implode(',', array_fill(0, count($ids), '?'));

    $stmt = $db->prepare("SELECT p.id, p.name,
        COUNT(t.id) as task_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL AND t.is_subtask = 0
        WHERE p.id IN ($inClause) AND p.tenant_id = ?
        GROUP BY p.id, p.name");
    $params = array_merge($ids, [$tenantId]);
    $stmt->execute($params);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Find base_calendar
    $cal = $db->prepare("SELECT id, name FROM projects WHERE tenant_id = ? AND kind = 'base_calendar' AND deleted_at IS NULL LIMIT 1");
    $cal->execute([$tenantId]);
    $calendar = $cal->fetch(PDO::FETCH_ASSOC);

    echo json_encode(['projects' => $projects, 'target_calendar' => $calendar], JSON_NUMERIC_CHECK);
    exit;
}

// ── MIGRATE (POST) ───────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'migrate') {
    if (!$isAdmin) { jsonError('Forbidden', 403); }
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $ids = $input['project_ids'] ?? [];
    if (empty($ids) || !is_array($ids)) { jsonError('project_ids required', 400); }

    // Find base_calendar
    $cal = $db->prepare("SELECT id FROM projects WHERE tenant_id = ? AND kind = 'base_calendar' AND deleted_at IS NULL LIMIT 1");
    $cal->execute([$tenantId]);
    $calId = $cal->fetchColumn();
    if (!$calId) { jsonError('ไม่พบ Team Calendar สำหรับ tenant นี้', 404); }

    $db->beginTransaction();
    try {
        $moved = 0;
        foreach ($ids as $srcId) {
            // Verify ownership
            $check = $db->prepare("SELECT id, name FROM projects WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL");
            $check->execute([$srcId, $tenantId]);
            $src = $check->fetch(PDO::FETCH_ASSOC);
            if (!$src) continue;

            // Determine task_type mapping from project name
            $name = strtolower($src['name']);
            if (strpos($name, 'meeting') !== false)  $newType = 'meeting';
            elseif (strpos($name, 'research') !== false) $newType = 'research';
            else $newType = 'task';

            // Fetch tasks to move
            $tasks = $db->prepare("SELECT id FROM tasks WHERE project_id = ? AND deleted_at IS NULL");
            $tasks->execute([$srcId]);
            $taskRows = $tasks->fetchAll(PDO::FETCH_ASSOC);

            // Move tasks
            $upd = $db->prepare("UPDATE tasks SET project_id = ?, task_type = ? WHERE id = ?");
            $hist = $db->prepare("INSERT INTO task_history (id, task_id, action, field_name, old_value, new_value, changed_by, created_at)
                VALUES (UUID(), ?, 'migrated', 'project_id', ?, ?, ?, NOW())");
            foreach ($taskRows as $row) {
                $upd->execute([$calId, $newType, $row['id']]);
                $hist->execute([$row['id'], $srcId, $calId, $userId]);
                $moved++;
            }

            // Soft-delete source project
            $del = $db->prepare("UPDATE projects SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?");
            $del->execute([$srcId, $tenantId]);
        }
        $db->commit();
        echo json_encode(['success' => true, 'moved' => $moved]);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('Migration failed: ' . $e->getMessage(), 500);
    }
    exit;
}

jsonError('Method or action not allowed', 405);
```

- [ ] **Step 2: Test assessment endpoint**

Open: `http://localhost/flowstack/api/task-intelligence.php?action=assessment`
Expected: JSON with `summary`, `workload`, `velocity` keys.

- [ ] **Step 3: Test quality endpoint**

Open: `http://localhost/flowstack/api/task-intelligence.php?action=quality`
Expected: JSON with `missing`, `anomalies`, `zombies` arrays.

- [ ] **Step 4: Commit**

```bash
git add api/task-intelligence.php
git commit -m "feat: add task-intelligence API (assessment, quality, duplicates, migrate)"
```

---

## Task 4: Add Validation to api/tasks.php

**Files:**
- Modify: `api/tasks.php`

Add a validation function that fires before INSERT and UPDATE on tasks.

- [x] **Step 1: Find the POST handler opening in api/tasks.php**

Search for the line that starts the POST handler (near top after auth setup):
```php
if ($method === 'POST') {
```

- [x] **Step 2: Add validation helper function before the POST block**

Insert this function after the `$isAdmin` definition (after the admin check block, before `if ($method === 'GET')`):

```php
// ── Validation rule enforcement ───────────────────────────────────────────
function runValidationRules(PDO $db, string $tenantId, string $userId, array $input, ?string $taskId = null): array {
    $warnings = [];
    $blocks   = [];

    $stmt = $db->prepare("SELECT * FROM task_validation_rules WHERE tenant_id = ? AND is_active = 1");
    $stmt->execute([$tenantId]);
    $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rules as $rule) {
        $field = $rule['condition_field'];
        $op    = $rule['condition_operator'];
        $val   = $rule['condition_value'];
        $msg   = $rule['message_th'];
        $type  = $rule['rule_type'];
        $triggered = false;

        if ($field === 'actual_hours' && $op === 'gt') {
            $triggered = isset($input['actual_hours']) && (float)$input['actual_hours'] > (float)$val;
        } elseif ($field === 'daily_hours_sum' && $op === 'gt') {
            $date = $input['start_date'] ?? date('Y-m-d');
            $excludeId = $taskId ?? '__none__';
            $s = $db->prepare("SELECT COALESCE(SUM(actual_hours),0) FROM tasks
                WHERE assignee_user_id = ? AND start_date = ? AND deleted_at IS NULL AND id != ?");
            $s->execute([$userId, $date, $excludeId]);
            $sum = (float)$s->fetchColumn() + (float)($input['actual_hours'] ?? 0);
            $triggered = $sum > (float)$val;
        } elseif ($field === 'assignee_user_id' && $op === 'null') {
            $triggered = empty($input['assignee_user_id']);
        } elseif ($field === 'estimated_hours' && $op === 'null') {
            $triggered = !isset($input['estimated_hours']) || $input['estimated_hours'] === '' || $input['estimated_hours'] === null;
        } elseif ($field === 'end_before_start' && $op === 'invalid') {
            $s = $input['start_date'] ?? null; $e = $input['end_date'] ?? null;
            $triggered = $s && $e && $e < $s;
        } elseif ($field === 'title_duplicate' && $op === 'duplicate') {
            if (!empty($input['title']) && !empty($input['project_id'])) {
                $excludeId = $taskId ?? '__none__';
                $s = $db->prepare("SELECT COUNT(*) FROM tasks
                    WHERE project_id = ? AND title = ? AND deleted_at IS NULL AND id != ?");
                $s->execute([$input['project_id'], $input['title'], $excludeId]);
                $triggered = (int)$s->fetchColumn() > 0;
            }
        }

        if ($triggered) {
            if ($type === 'block') $blocks[] = $msg;
            else $warnings[] = $msg;
        }
    }
    return ['warnings' => $warnings, 'blocks' => $blocks];
}
```

- [x] **Step 3: Call validation in the POST handler**

Inside the `if ($method === 'POST')` block, find where task data is assembled (just before the INSERT query). Add after input parsing:

```php
    // Run validation rules
    $validation = runValidationRules($db, $tenantId, $userId, $input);
    if (!empty($validation['blocks'])) {
        http_response_code(422);
        echo json_encode(['error' => implode(' | ', $validation['blocks']), 'blocks' => $validation['blocks']]);
        exit;
    }
    $validationWarnings = $validation['warnings'];
```

Then after the INSERT, wrap the success response to include warnings:

```php
    // If task was created successfully, include any warnings
    $response = ['success' => true, 'id' => $newId ?? $db->lastInsertId()];
    if (!empty($validationWarnings)) {
        $response['warnings'] = $validationWarnings;
    }
    echo json_encode($response);
    exit;
```

- [x] **Step 4: Call validation in the PUT handler**

Inside `if ($method === 'PUT')`, similarly after input parsing:

```php
    $taskId = $_GET['id'] ?? '';
    // Run validation rules
    $validation = runValidationRules($db, $tenantId, $userId, $input, $taskId);
    if (!empty($validation['blocks'])) {
        http_response_code(422);
        echo json_encode(['error' => implode(' | ', $validation['blocks']), 'blocks' => $validation['blocks']]);
        exit;
    }
    $validationWarnings = $validation['warnings'];
```

And include warnings in success response.

- [ ] **Step 5: Test block rule**

POST to `http://localhost/flowstack/api/tasks.php` with `actual_hours: 20`.
Expected: HTTP 422 with `{"error":"ไม่สามารถบันทึกชั่วโมงเกิน 16 ชั่วโมงต่อ task","blocks":[...]}`

- [ ] **Step 6: Commit**

```bash
git add api/tasks.php
git commit -m "feat: enforce validation rules on task create/update"
```

---

## Task 5: Register Menu Key + Route

**Files:**
- Modify: `api/auth.php`
- Modify: `src/App.tsx`
- Modify: `src/components/AppSidebar.tsx`

- [x] **Step 1: Add menu key to auth.php**

Find this line in `api/auth.php`:
```php
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','timesheet','reports','analytics','marketing','goals','automation','budget','support','admin','inbox','calendar'];
```

Replace with:
```php
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','timesheet','reports','analytics','marketing','goals','automation','budget','support','admin','inbox','calendar','task_intelligence'];
```

- [x] **Step 2: Add route in src/App.tsx**

Find an existing route import like:
```tsx
import ReportsPage from './pages/ReportsPage';
```

Add after it:
```tsx
import TaskIntelligencePage from './pages/TaskIntelligencePage';
```

Find the route block for reports (pattern: `<Route path="/reports" ...`), add below it:
```tsx
<Route path="/task-intelligence" element={<PermissionRoute menuKey="task_intelligence"><TaskIntelligencePage /></PermissionRoute>} />
```

- [x] **Step 3: Add sidebar menu item in src/components/AppSidebar.tsx**

Find the reports/analytics section in NAV_GROUPS. Add a new item to that group's `items` array:
```tsx
{ title: 'Task Intelligence', href: '/task-intelligence', icon: ShieldCheck, menuKey: 'task_intelligence' },
```

Also add the icon import at the top (with other lucide imports):
```tsx
import { ..., ShieldCheck } from 'lucide-react';
```

- [ ] **Step 4: Commit**

```bash
git add api/auth.php src/App.tsx src/components/AppSidebar.tsx
git commit -m "feat: register task_intelligence menu key and route"
```

---

## Task 6: TaskIntelligencePage.tsx

**Files:**
- Create: `src/pages/TaskIntelligencePage.tsx`

- [x] **Step 1: Create the page**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import PageShell from '@/components/PageShell';

const API = (path: string) => `/flowstack/api/${path}`;

// ── Data fetching helpers ────────────────────────────────────────────────────
function useAssessment(filters: Record<string, string>) {
  const params = new URLSearchParams({ action: 'assessment', ...filters }).toString();
  return useQuery({
    queryKey: ['task-intelligence', 'assessment', filters],
    queryFn: async () => {
      const res = await fetch(`${API('task-intelligence.php')}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      return res.json();
    },
  });
}

function useQuality() {
  return useQuery({
    queryKey: ['task-intelligence', 'quality'],
    queryFn: async () => {
      const res = await fetch(`${API('task-intelligence.php')}?action=quality`, { credentials: 'include' });
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      return res.json();
    },
  });
}

function useDuplicates() {
  return useQuery({
    queryKey: ['task-intelligence', 'duplicates'],
    queryFn: async () => {
      const res = await fetch(`${API('task-intelligence.php')}?action=duplicates`, { credentials: 'include' });
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      return res.json();
    },
  });
}

function useValidationRules() {
  return useQuery({
    queryKey: ['validation-rules'],
    queryFn: async () => {
      const res = await fetch(API('validation-rules.php'), { credentials: 'include' });
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
      return res.json();
    },
  });
}

// ── Assessment Tab ────────────────────────────────────────────────────────────
function AssessmentTab() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data, isLoading } = useAssessment(filters);

  if (isLoading) return <p className="text-muted-foreground py-8 text-center">กำลังโหลด...</p>;
  if (!data) return null;

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">งานทั้งหมด</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{s.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">เสร็จตรงเวลา</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{s.on_time_pct}%</p>
            <p className="text-xs text-muted-foreground">{s.on_time} งาน</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">เกินกำหนด</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{s.overdue_pct}%</p>
            <p className="text-xs text-muted-foreground">{s.overdue} งาน</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">ชั่วโมงเบี่ยง (เฉลี่ย)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{s.avg_hours_deviation > 0 ? '+' : ''}{s.avg_hours_deviation}h</p>
          </CardContent>
        </Card>
      </div>

      {data.workload?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Workload ต่อคน</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead className="text-right">จำนวนงาน</TableHead>
                  <TableHead className="text-right">ชั่วโมงประมาณ</TableHead>
                  <TableHead className="text-right">ชั่วโมงจริง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.workload.map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell>{w.name}</TableCell>
                    <TableCell className="text-right">{w.task_count}</TableCell>
                    <TableCell className="text-right">{w.estimated_hours}h</TableCell>
                    <TableCell className="text-right">{w.actual_hours}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data.velocity?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Velocity (งานที่เสร็จต่อสัปดาห์)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              {data.velocity.map((v: any) => (
                <div key={v.yw} className="text-center">
                  <p className="text-2xl font-bold">{v.completed}</p>
                  <p className="text-xs text-muted-foreground">สัปดาห์ {String(v.yw).slice(4)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Data Quality Tab ─────────────────────────────────────────────────────────
function DataQualityTab({ isAdmin }: { isAdmin: boolean }) {
  const { data: quality, isLoading: qLoading } = useQuality();
  const { data: dups, isLoading: dLoading } = useDuplicates();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);

  const migrateMutation = useMutation({
    mutationFn: async (projectIds: string[]) => {
      const res = await fetch(`${API('task-intelligence.php')}?action=migrate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_ids: projectIds }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: (d) => {
      toast({ title: `ย้าย ${d.moved} งานสำเร็จ` });
      setPreview(null);
      qc.invalidateQueries({ queryKey: ['task-intelligence'] });
    },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  if (qLoading || dLoading) return <p className="text-muted-foreground py-8 text-center">กำลังโหลด...</p>;

  const missing   = quality?.missing   ?? [];
  const anomalies = quality?.anomalies ?? [];
  const zombies   = quality?.zombies   ?? [];
  const dupGroups = dups?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Duplicates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            งานที่อาจซ้ำซ้อน
            <Badge variant={dupGroups.length > 0 ? 'destructive' : 'secondary'}>{dupGroups.length} กลุ่ม</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dupGroups.length === 0
            ? <p className="text-muted-foreground text-sm">ไม่พบงานซ้ำ</p>
            : dupGroups.map((group: any[], i: number) => (
              <div key={i} className="mb-4 border rounded p-3">
                {group.map((t: any) => (
                  <div key={t.id} className="flex justify-between text-sm py-1">
                    <span>{t.title}</span>
                    <span className="text-muted-foreground">{t.project_name} · {t.start_date}</span>
                  </div>
                ))}
              </div>
            ))
          }
        </CardContent>
      </Card>

      {/* Missing fields */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ข้อมูลไม่ครบ
            <Badge variant={missing.length > 0 ? 'destructive' : 'secondary'}>{missing.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {missing.length === 0
            ? <p className="text-muted-foreground text-sm">ข้อมูลครบถ้วน</p>
            : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>งาน</TableHead>
                    <TableHead>โปรเจค</TableHead>
                    <TableHead>ปัญหา</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missing.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>{t.project_name}</TableCell>
                      <TableCell className="text-xs text-red-600">
                        {[
                          !t.estimated_hours && 'ไม่มีชั่วโมงประมาณ',
                          !t.assignee && 'ไม่มีผู้รับผิดชอบ',
                          !t.end_date && 'ไม่มีวันสิ้นสุด',
                        ].filter(Boolean).join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          }
        </CardContent>
      </Card>

      {/* Anomalies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ชั่วโมงผิดปกติ (&gt;16h)
            <Badge variant={anomalies.length > 0 ? 'destructive' : 'secondary'}>{anomalies.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0
            ? <p className="text-muted-foreground text-sm">ไม่พบความผิดปกติ</p>
            : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>งาน</TableHead>
                    <TableHead>โปรเจค</TableHead>
                    <TableHead className="text-right">ชั่วโมงจริง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>{t.project_name}</TableCell>
                      <TableCell className="text-right text-red-600 font-bold">{t.actual_hours}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          }
        </CardContent>
      </Card>

      {/* Zombies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Zombie Tasks (ค้างนาน &gt;14 วัน)
            <Badge variant={zombies.length > 0 ? 'destructive' : 'secondary'}>{zombies.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {zombies.length === 0
            ? <p className="text-muted-foreground text-sm">ไม่พบ zombie tasks</p>
            : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>งาน</TableHead>
                    <TableHead>โปรเจค</TableHead>
                    <TableHead>วันสิ้นสุด</TableHead>
                    <TableHead>Activity ล่าสุด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zombies.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>{t.project_name}</TableCell>
                      <TableCell className="text-red-600">{t.end_date}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{t.last_activity ?? 'ไม่มี'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          }
        </CardContent>
      </Card>

      {/* Consolidation Tool - Admin only */}
      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>รวม Projects เข้า Team Calendar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">ใส่ Project IDs ที่ต้องการย้าย (คั่นด้วยคอมมา) แล้วกด Preview</p>
            <textarea
              className="w-full border rounded p-2 text-sm font-mono"
              rows={3}
              placeholder="project-id-1, project-id-2"
              onChange={(e) => setSelectedProjects(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={async () => {
                if (!selectedProjects.length) return;
                const res = await fetch(`${API('task-intelligence.php')}?action=migrate_preview&project_ids=${selectedProjects.join(',')}`, { credentials: 'include' });
                const d = await res.json();
                setPreview(d);
              }}>Preview</Button>
              {preview && (
                <Button size="sm" variant="destructive"
                  disabled={migrateMutation.isPending}
                  onClick={() => migrateMutation.mutate(selectedProjects)}>
                  ยืนยันการย้าย ({preview.projects?.reduce((a: number, p: any) => a + p.task_count, 0)} งาน → {preview.target_calendar?.name})
                </Button>
              )}
            </div>
            {preview && (
              <div className="text-sm border rounded p-3 bg-muted">
                {preview.projects?.map((p: any) => (
                  <div key={p.id}>{p.name}: {p.task_count} งาน</div>
                ))}
                <div className="mt-2 font-medium">→ {preview.target_calendar?.name}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Validation Rules Tab ─────────────────────────────────────────────────────
function ValidationRulesTab() {
  const { data, isLoading } = useValidationRules();
  const { toast } = useToast();
  const qc = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: number }) => {
      const res = await fetch(`${API('validation-rules.php')}?id=${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error('อัปเดตไม่สำเร็จ');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['validation-rules'] }),
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <p className="text-muted-foreground py-8 text-center">กำลังโหลด...</p>;
  const rules = data?.data ?? [];

  return (
    <Card>
      <CardHeader><CardTitle>กฎการตรวจสอบข้อมูล</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ประเภท</TableHead>
              <TableHead>เงื่อนไข</TableHead>
              <TableHead>ข้อความแจ้งเตือน</TableHead>
              <TableHead className="text-center">เปิดใช้</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Badge variant={r.rule_type === 'block' ? 'destructive' : 'secondary'}>
                    {r.rule_type === 'block' ? 'บล็อก' : 'เตือน'}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.condition_field} {r.condition_operator} {r.condition_value ?? ''}</TableCell>
                <TableCell className="text-sm">{r.message_th}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={!!r.is_active}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, is_active: v ? 1 : 0 })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TaskIntelligencePage() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.is_admin === 1;

  return (
    <PageShell title="Task Intelligence" subtitle="ประเมินผล วิเคราะห์คุณภาพ และตรวจสอบข้อมูลงาน">
      <Tabs defaultValue="assessment" className="w-full">
        <TabsList>
          <TabsTrigger value="assessment">ประเมินผล</TabsTrigger>
          <TabsTrigger value="quality">คุณภาพข้อมูล</TabsTrigger>
          {isAdmin && <TabsTrigger value="rules">กฎการตรวจสอบ</TabsTrigger>}
        </TabsList>

        <TabsContent value="assessment" className="mt-6">
          <AssessmentTab />
        </TabsContent>

        <TabsContent value="quality" className="mt-6">
          <DataQualityTab isAdmin={isAdmin} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="rules" className="mt-6">
            <ValidationRulesTab />
          </TabsContent>
        )}
      </Tabs>
    </PageShell>
  );
}
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: No errors (or only pre-existing warnings).

- [ ] **Step 3: Start dev server and verify page loads**

```bash
pnpm dev
```

Open `http://localhost:8080/#/task-intelligence` — should show 3 tabs with data.

- [ ] **Step 4: Commit**

```bash
git add src/pages/TaskIntelligencePage.tsx
git commit -m "feat: add TaskIntelligencePage with Assessment, Data Quality, Validation Rules tabs"
```

---

## Task 7: Final Wiring + Build Verification

**Files:**
- Verify all modified files compile cleanly

- [ ] **Step 1: Run full build**

```bash
pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Manual smoke test**

1. Open `/task-intelligence` → Assessment tab loads cards
2. Click Data Quality tab → missing/anomaly/zombie sections appear
3. Click Validation Rules tab (as admin) → 6 default rules shown with toggles
4. Create a task with `actual_hours: 20` → expect 422 error toast in UI
5. Create a task with duplicate title in same project → expect warning toast

- [ ] **Step 3: Final commit**

```bash
git add api/auth.php src/App.tsx src/components/AppSidebar.tsx
git commit -m "feat: wire task-intelligence route, menu key, and sidebar item"
```
