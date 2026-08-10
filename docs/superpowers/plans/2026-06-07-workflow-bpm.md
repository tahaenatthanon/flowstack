# Workflow BPM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Global BPM Hub at `/workflow` with drag-and-drop Process Map, Bottleneck heatmap, and AI recommendations — integrated with Projects, Sales, and Support modules.

**Architecture:** Global BPM Hub (`/workflow`) with React Flow canvas editor, left node palette, right side panel (properties + analytics + AI). Workflow definitions store node/edge JSON; instances track runtime per entity; step_logs store timing data used for bottleneck analysis. Deep-links from Projects/Sales/Support pass `?entity=xxx&entity_id=yyy`.

**Tech Stack:** React 18, TypeScript, Vite, `@xyflow/react` (React Flow v12), TanStack Query, Tailwind CSS, shadcn-ui, PHP 8 + MariaDB, Recharts (already used in project for charts)

---

## File Map

**New files:**
- `database/migrations/2026_06_07_000001_workflow_tables.sql`
- `api/workflows.php` — CRUD for workflow_definitions
- `api/workflow-instances.php` — instance management + advance step
- `api/workflow-analytics.php` — bottleneck metrics per definition
- `api/workflow-ai.php` — AI recommendations
- `src/types/workflow.ts` — all TypeScript types
- `src/components/workflow/nodes/StageNode.tsx`
- `src/components/workflow/nodes/DecisionNode.tsx`
- `src/components/workflow/nodes/DelayNode.tsx`
- `src/components/workflow/nodes/NotifyNode.tsx`
- `src/components/workflow/nodes/StartEndNode.tsx`
- `src/components/workflow/WorkflowNodePalette.tsx`
- `src/components/workflow/WorkflowCanvas.tsx`
- `src/components/workflow/WorkflowSidePanel.tsx`
- `src/components/workflow/WorkflowAIPanel.tsx`
- `src/pages/WorkflowPage.tsx`

**Modified files:**
- `src/App.tsx` — add `/workflow` route
- `src/components/AppSidebar.tsx` — add menu item
- `api/auth.php` — add `workflow` to ALL_MENU_KEYS
- `src/pages/ProjectDetail.tsx` — add "Workflow" tab with deep-link button
- `src/pages/SalesPage.tsx` — add "ดู Workflow" button on opportunity card
- `src/pages/SupportPage.tsx` — add "Workflow" tab on ticket detail

---

## Task 1: Database Migration

**Files:**
- Create: `database/migrations/2026_06_07_000001_workflow_tables.sql`

- [ ] **Step 1: Write migration file**

```sql
-- database/migrations/2026_06_07_000001_workflow_tables.sql

CREATE TABLE workflow_definitions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  entity_type ENUM('project','opportunity','support_ticket') NOT NULL,
  definition JSON NOT NULL,
  is_template TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE workflow_instances (
  id CHAR(36) NOT NULL PRIMARY KEY,
  workflow_definition_id CHAR(36) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  current_step_id VARCHAR(100) DEFAULT NULL,
  status ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_definition_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_entity (entity_type, entity_id)
);

CREATE TABLE workflow_step_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  instance_id CHAR(36) NOT NULL,
  step_id VARCHAR(100) NOT NULL,
  step_name VARCHAR(255) DEFAULT NULL,
  assignee_id CHAR(36) DEFAULT NULL,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  duration_minutes INT DEFAULT NULL,
  status ENUM('in_progress','completed','skipped') NOT NULL DEFAULT 'in_progress',
  notes TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES workflow_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);
```

- [ ] **Step 2: Execute migration**

```bash
mysql -u root flowstack < database/migrations/2026_06_07_000001_workflow_tables.sql
```

- [ ] **Step 3: Verify tables created**

```bash
mysql -u root flowstack -e "SHOW TABLES LIKE 'workflow%';"
```

Expected output:
```
workflow_definitions
workflow_instances
workflow_step_logs
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_06_07_000001_workflow_tables.sql
git commit -m "feat(db): add workflow_definitions, workflow_instances, workflow_step_logs tables"
```

---

## Task 2: Install React Flow

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install package**

```bash
pnpm add @xyflow/react
```

- [ ] **Step 2: Verify install**

```bash
pnpm list @xyflow/react
```

Expected: `@xyflow/react 12.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(deps): add @xyflow/react for BPM canvas"
```

---

## Task 3: TypeScript Types

**Files:**
- Create: `src/types/workflow.ts`

- [ ] **Step 1: Create type file**

```typescript
// src/types/workflow.ts
import { Node, Edge } from '@xyflow/react';

export type WorkflowEntityType = 'project' | 'opportunity' | 'support_ticket';

export type WorkflowNodeType = 'start' | 'end' | 'stage' | 'decision' | 'delay' | 'notify';

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: WorkflowNodeType;
  slaMinutes?: number;          // SLA threshold in minutes
  description?: string;
  // analytics (populated when viewing instance)
  avgCycleMinutes?: number;
  queueDepth?: number;
  heatLevel?: 'ok' | 'warn' | 'critical'; // green/yellow/red
  subSteps?: WorkflowSubStep[];
  expanded?: boolean;
}

export interface WorkflowSubStep {
  id: string;
  name: string;
  durationMinutes: number;
  status: 'completed' | 'in_progress' | 'pending';
  heatLevel: 'ok' | 'warn' | 'critical';
}

export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;
export type WorkflowEdge = Edge;

export interface WorkflowDefinition {
  id: string;
  name: string;
  entity_type: WorkflowEntityType;
  definition: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  is_template: 0 | 1;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowInstance {
  id: string;
  workflow_definition_id: string;
  entity_type: WorkflowEntityType;
  entity_id: string;
  current_step_id: string | null;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
}

export interface WorkflowStepLog {
  id: string;
  instance_id: string;
  step_id: string;
  step_name: string | null;
  assignee_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  status: 'in_progress' | 'completed' | 'skipped';
}

export interface WorkflowAnalytics {
  definition_id: string;
  steps: StepAnalytics[];
}

export interface StepAnalytics {
  step_id: string;
  step_name: string;
  avg_cycle_minutes: number;
  max_cycle_minutes: number;
  queue_depth: number;
  sla_minutes: number;
  heat_level: 'ok' | 'warn' | 'critical';
  trend_30d: { date: string; avg_minutes: number }[];
  stalled_entities: { entity_id: string; entity_name: string; days_stalled: number }[];
}

export interface AIRecommendation {
  type: 'quick_fix' | 'process_improvement';
  step_id?: string;
  title: string;
  description: string;
  impact: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/workflow.ts
git commit -m "feat(types): add Workflow BPM TypeScript types"
```

---

## Task 4: API — workflows.php (CRUD Definitions)

**Files:**
- Create: `api/workflows.php`

- [ ] **Step 1: Create the file**

```php
<?php
// api/workflows.php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

$user = requireAuth();
$db   = getDB();
$method = getMethod();

$id = $_GET['id'] ?? null;

// --- Default templates ---
$TEMPLATES = [
  'project' => [
    'nodes' => [
      ['id'=>'start','type'=>'start','position'=>['x'=>100,'y'=>200],'data'=>['label'=>'เริ่มต้น','nodeType'=>'start']],
      ['id'=>'kickoff','type'=>'stage','position'=>['x'=>250,'y'=>200],'data'=>['label'=>'Kickoff','nodeType'=>'stage','slaMinutes'=>1440]],
      ['id'=>'planning','type'=>'stage','position'=>['x'=>420,'y'=>200],'data'=>['label'=>'วางแผน','nodeType'=>'stage','slaMinutes'=>2880]],
      ['id'=>'development','type'=>'stage','position'=>['x'=>590,'y'=>200],'data'=>['label'=>'พัฒนา','nodeType'=>'stage','slaMinutes'=>14400]],
      ['id'=>'testing','type'=>'stage','position'=>['x'=>760,'y'=>200],'data'=>['label'=>'ทดสอบ','nodeType'=>'stage','slaMinutes'=>2880]],
      ['id'=>'delivery','type'=>'stage','position'=>['x'=>930,'y'=>200],'data'=>['label'=>'ส่งมอบ','nodeType'=>'stage','slaMinutes'=>1440]],
      ['id'=>'end','type'=>'end','position'=>['x'=>1100,'y'=>200],'data'=>['label'=>'เสร็จสิ้น','nodeType'=>'end']],
    ],
    'edges' => [
      ['id'=>'e1','source'=>'start','target'=>'kickoff'],
      ['id'=>'e2','source'=>'kickoff','target'=>'planning'],
      ['id'=>'e3','source'=>'planning','target'=>'development'],
      ['id'=>'e4','source'=>'development','target'=>'testing'],
      ['id'=>'e5','source'=>'testing','target'=>'delivery'],
      ['id'=>'e6','source'=>'delivery','target'=>'end'],
    ],
  ],
  'opportunity' => [
    'nodes' => [
      ['id'=>'start','type'=>'start','position'=>['x'=>100,'y'=>200],'data'=>['label'=>'เริ่มต้น','nodeType'=>'start']],
      ['id'=>'lead','type'=>'stage','position'=>['x'=>250,'y'=>200],'data'=>['label'=>'Lead','nodeType'=>'stage','slaMinutes'=>1440]],
      ['id'=>'qualified','type'=>'stage','position'=>['x'=>420,'y'=>200],'data'=>['label'=>'Qualified','nodeType'=>'stage','slaMinutes'=>2880]],
      ['id'=>'proposal','type'=>'stage','position'=>['x'=>590,'y'=>200],'data'=>['label'=>'Proposal','nodeType'=>'stage','slaMinutes'=>7200]],
      ['id'=>'negotiation','type'=>'stage','position'=>['x'=>760,'y'=>200],'data'=>['label'=>'Negotiation','nodeType'=>'stage','slaMinutes'=>4320]],
      ['id'=>'end','type'=>'end','position'=>['x'=>930,'y'=>200],'data'=>['label'=>'Won/Lost','nodeType'=>'end']],
    ],
    'edges' => [
      ['id'=>'e1','source'=>'start','target'=>'lead'],
      ['id'=>'e2','source'=>'lead','target'=>'qualified'],
      ['id'=>'e3','source'=>'qualified','target'=>'proposal'],
      ['id'=>'e4','source'=>'proposal','target'=>'negotiation'],
      ['id'=>'e5','source'=>'negotiation','target'=>'end'],
    ],
  ],
  'support_ticket' => [
    'nodes' => [
      ['id'=>'start','type'=>'start','position'=>['x'=>100,'y'=>200],'data'=>['label'=>'เริ่มต้น','nodeType'=>'start']],
      ['id'=>'received','type'=>'stage','position'=>['x'=>250,'y'=>200],'data'=>['label'=>'รับเรื่อง','nodeType'=>'stage','slaMinutes'=>60]],
      ['id'=>'assigned','type'=>'stage','position'=>['x'=>420,'y'=>200],'data'=>['label'=>'มอบหมาย','nodeType'=>'stage','slaMinutes'=>120]],
      ['id'=>'inprogress','type'=>'stage','position'=>['x'=>590,'y'=>200],'data'=>['label'=>'กำลังดำเนินการ','nodeType'=>'stage','slaMinutes'=>480]],
      ['id'=>'resolved','type'=>'stage','position'=>['x'=>760,'y'=>200],'data'=>['label'=>'แก้ไขแล้ว','nodeType'=>'stage','slaMinutes'=>60]],
      ['id'=>'end','type'=>'end','position'=>['x'=>930,'y'=>200],'data'=>['label'=>'ปิดเรื่อง','nodeType'=>'end']],
    ],
    'edges' => [
      ['id'=>'e1','source'=>'start','target'=>'received'],
      ['id'=>'e2','source'=>'received','target'=>'assigned'],
      ['id'=>'e3','source'=>'assigned','target'=>'inprogress'],
      ['id'=>'e4','source'=>'inprogress','target'=>'resolved'],
      ['id'=>'e5','source'=>'resolved','target'=>'end'],
    ],
  ],
];

if ($method === 'GET') {
  if (isset($_GET['templates'])) {
    jsonResponse($TEMPLATES);
  }
  $entity_type = $_GET['entity_type'] ?? null;
  $sql = 'SELECT * FROM workflow_definitions';
  $params = [];
  if ($entity_type) {
    $sql .= ' WHERE entity_type = ?';
    $params[] = $entity_type;
  }
  $sql .= ' ORDER BY is_template DESC, created_at DESC';
  $stmt = $db->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  foreach ($rows as &$row) {
    $row['definition'] = json_decode($row['definition'], true);
  }
  jsonResponse($rows);
}

if ($method === 'POST') {
  $body = json_decode(file_get_contents('php://input'), true);
  $newId = generateUUID();
  $db->prepare('INSERT INTO workflow_definitions (id, name, entity_type, definition, is_template, created_by) VALUES (?,?,?,?,?,?)')
     ->execute([$newId, $body['name'], $body['entity_type'], json_encode($body['definition']), $body['is_template'] ?? 0, $user['id']]);
  $stmt = $db->prepare('SELECT * FROM workflow_definitions WHERE id = ?');
  $stmt->execute([$newId]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  $row['definition'] = json_decode($row['definition'], true);
  jsonResponse($row, 201);
}

if ($method === 'PUT' && $id) {
  $body = json_decode(file_get_contents('php://input'), true);
  $db->prepare('UPDATE workflow_definitions SET name=?, entity_type=?, definition=?, is_template=?, updated_at=NOW() WHERE id=?')
     ->execute([$body['name'], $body['entity_type'], json_encode($body['definition']), $body['is_template'] ?? 0, $id]);
  $stmt = $db->prepare('SELECT * FROM workflow_definitions WHERE id = ?');
  $stmt->execute([$id]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  $row['definition'] = json_decode($row['definition'], true);
  jsonResponse($row);
}

if ($method === 'DELETE' && $id) {
  $db->prepare('DELETE FROM workflow_definitions WHERE id = ?')->execute([$id]);
  jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 2: Commit**

```bash
git add api/workflows.php
git commit -m "feat(api): add workflows.php CRUD endpoint"
```

---

## Task 5: API — workflow-instances.php

**Files:**
- Create: `api/workflow-instances.php`

- [ ] **Step 1: Create the file**

```php
<?php
// api/workflow-instances.php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

$user   = requireAuth();
$db     = getDB();
$method = getMethod();
$action = $_GET['action'] ?? null;

if ($method === 'GET') {
  $entity_type = $_GET['entity_type'] ?? null;
  $entity_id   = $_GET['entity_id'] ?? null;
  if (!$entity_type || !$entity_id) jsonError('entity_type and entity_id required', 400);

  $stmt = $db->prepare('SELECT wi.*, wd.name as definition_name, wd.definition FROM workflow_instances wi JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id WHERE wi.entity_type = ? AND wi.entity_id = ?');
  $stmt->execute([$entity_type, $entity_id]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$row) jsonResponse(null);
  $row['definition'] = json_decode($row['definition'], true);

  // Attach step logs
  $logStmt = $db->prepare('SELECT * FROM workflow_step_logs WHERE instance_id = ? ORDER BY started_at ASC');
  $logStmt->execute([$row['id']]);
  $row['step_logs'] = $logStmt->fetchAll(PDO::FETCH_ASSOC);
  jsonResponse($row);
}

if ($method === 'POST' && !$action) {
  $body = json_decode(file_get_contents('php://input'), true);
  $newId = generateUUID();
  $db->prepare('INSERT INTO workflow_instances (id, workflow_definition_id, entity_type, entity_id, status, started_at) VALUES (?,?,?,?,\'active\',NOW())')
     ->execute([$newId, $body['workflow_definition_id'], $body['entity_type'], $body['entity_id']]);

  // Create first step log from definition's first non-start node
  $defStmt = $db->prepare('SELECT definition FROM workflow_definitions WHERE id = ?');
  $defStmt->execute([$body['workflow_definition_id']]);
  $def = json_decode($defStmt->fetchColumn(), true);
  $firstNode = collect_first_stage($def['nodes']);
  if ($firstNode) {
    $logId = generateUUID();
    $db->prepare('INSERT INTO workflow_step_logs (id, instance_id, step_id, step_name, status, started_at) VALUES (?,?,?,?,\'in_progress\',NOW())')
       ->execute([$logId, $newId, $firstNode['id'], $firstNode['data']['label']]);
    $db->prepare('UPDATE workflow_instances SET current_step_id = ? WHERE id = ?')->execute([$firstNode['id'], $newId]);
  }

  $stmt = $db->prepare('SELECT * FROM workflow_instances WHERE id = ?');
  $stmt->execute([$newId]);
  jsonResponse($stmt->fetch(PDO::FETCH_ASSOC), 201);
}

if ($method === 'POST' && $action === 'advance') {
  $body       = json_decode(file_get_contents('php://input'), true);
  $instanceId = $body['instance_id'];
  $stepId     = $body['step_id'];
  $nextStepId = $body['next_step_id'] ?? null;
  $notes      = $body['notes'] ?? null;

  // Complete current step log
  $db->prepare('UPDATE workflow_step_logs SET status=\'completed\', completed_at=NOW(), duration_minutes=TIMESTAMPDIFF(MINUTE, started_at, NOW()), notes=? WHERE instance_id=? AND step_id=? AND status=\'in_progress\'')
     ->execute([$notes, $instanceId, $stepId]);

  if ($nextStepId) {
    $logId = generateUUID();
    $db->prepare('INSERT INTO workflow_step_logs (id, instance_id, step_id, status, started_at) VALUES (?,?,?,\'in_progress\',NOW())')
       ->execute([$logId, $instanceId, $nextStepId]);
    $db->prepare('UPDATE workflow_instances SET current_step_id=?, updated_at=NOW() WHERE id=?')->execute([$nextStepId, $instanceId]);
  } else {
    $db->prepare('UPDATE workflow_instances SET status=\'completed\', completed_at=NOW(), current_step_id=NULL, updated_at=NOW() WHERE id=?')->execute([$instanceId]);
  }
  jsonResponse(['ok' => true]);
}

jsonError('Method not allowed', 405);

function collect_first_stage(array $nodes): ?array {
  foreach ($nodes as $n) {
    if (($n['type'] ?? '') === 'stage') return $n;
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add api/workflow-instances.php
git commit -m "feat(api): add workflow-instances.php endpoint"
```

---

## Task 6: API — workflow-analytics.php

**Files:**
- Create: `api/workflow-analytics.php`

- [ ] **Step 1: Create the file**

```php
<?php
// api/workflow-analytics.php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

$user          = requireAuth();
$db            = getDB();
$definition_id = $_GET['definition_id'] ?? null;
if (!$definition_id) jsonError('definition_id required', 400);

// Load definition to get node SLA config
$defStmt = $db->prepare('SELECT definition FROM workflow_definitions WHERE id = ?');
$defStmt->execute([$definition_id]);
$def = json_decode($defStmt->fetchColumn(), true);
$nodeMap = [];
foreach ($def['nodes'] as $n) {
  $nodeMap[$n['id']] = $n;
}

// Aggregate step logs for this definition
$sql = '
  SELECT
    wsl.step_id,
    wsl.step_name,
    COUNT(*) AS total_runs,
    AVG(wsl.duration_minutes) AS avg_cycle_minutes,
    MAX(wsl.duration_minutes) AS max_cycle_minutes,
    SUM(CASE WHEN wsl.status = \'in_progress\' THEN 1 ELSE 0 END) AS queue_depth
  FROM workflow_step_logs wsl
  JOIN workflow_instances wi ON wsl.instance_id = wi.id
  WHERE wi.workflow_definition_id = ?
  GROUP BY wsl.step_id, wsl.step_name
';
$stmt = $db->prepare($sql);
$stmt->execute([$definition_id]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Trend last 30 days per step
$trendSql = '
  SELECT wsl.step_id, DATE(wsl.completed_at) as day, AVG(wsl.duration_minutes) as avg_minutes
  FROM workflow_step_logs wsl
  JOIN workflow_instances wi ON wsl.instance_id = wi.id
  WHERE wi.workflow_definition_id = ? AND wsl.completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  GROUP BY wsl.step_id, day ORDER BY day ASC
';
$trendStmt = $db->prepare($trendSql);
$trendStmt->execute([$definition_id]);
$trendRows = $trendStmt->fetchAll(PDO::FETCH_ASSOC);
$trendMap = [];
foreach ($trendRows as $t) {
  $trendMap[$t['step_id']][] = ['date' => $t['day'], 'avg_minutes' => (float)$t['avg_minutes']];
}

// Stalled entities (in_progress > 24h)
$stalledSql = '
  SELECT wsl.step_id, wi.entity_type, wi.entity_id, TIMESTAMPDIFF(HOUR, wsl.started_at, NOW()) as hours_stalled
  FROM workflow_step_logs wsl
  JOIN workflow_instances wi ON wsl.instance_id = wi.id
  WHERE wi.workflow_definition_id = ? AND wsl.status = \'in_progress\' AND wsl.started_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
';
$stalledStmt = $db->prepare($stalledSql);
$stalledStmt->execute([$definition_id]);
$stalledRows = $stalledStmt->fetchAll(PDO::FETCH_ASSOC);
$stalledMap = [];
foreach ($stalledRows as $s) {
  $stalledMap[$s['step_id']][] = [
    'entity_id'    => $s['entity_id'],
    'entity_name'  => $s['entity_type'] . ':' . substr($s['entity_id'], 0, 8),
    'days_stalled' => round($s['hours_stalled'] / 24, 1),
  ];
}

$steps = [];
foreach ($rows as $row) {
  $nodeId    = $row['step_id'];
  $slaMin    = (int)($nodeMap[$nodeId]['data']['slaMinutes'] ?? 1440);
  $avgMin    = (float)$row['avg_cycle_minutes'];
  $ratio     = $slaMin > 0 ? $avgMin / $slaMin : 0;
  $heatLevel = $ratio >= 1.0 ? 'critical' : ($ratio >= 0.8 ? 'warn' : 'ok');

  $steps[] = [
    'step_id'           => $nodeId,
    'step_name'         => $row['step_name'] ?? ($nodeMap[$nodeId]['data']['label'] ?? $nodeId),
    'avg_cycle_minutes' => round($avgMin, 1),
    'max_cycle_minutes' => (float)$row['max_cycle_minutes'],
    'queue_depth'       => (int)$row['queue_depth'],
    'sla_minutes'       => $slaMin,
    'heat_level'        => $heatLevel,
    'trend_30d'         => $trendMap[$nodeId] ?? [],
    'stalled_entities'  => $stalledMap[$nodeId] ?? [],
  ];
}

jsonResponse(['definition_id' => $definition_id, 'steps' => $steps]);
```

- [ ] **Step 2: Commit**

```bash
git add api/workflow-analytics.php
git commit -m "feat(api): add workflow-analytics.php bottleneck endpoint"
```

---

## Task 7: API — workflow-ai.php

**Files:**
- Create: `api/workflow-ai.php`

- [ ] **Step 1: Create the file**

```php
<?php
// api/workflow-ai.php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

$user = requireAuth();
$db   = getDB();
if (getMethod() !== 'POST') jsonError('Method not allowed', 405);

$body          = json_decode(file_get_contents('php://input'), true);
$definition_id = $body['definition_id'] ?? null;
if (!$definition_id) jsonError('definition_id required', 400);

// Load definition + analytics
$defStmt = $db->prepare('SELECT name, entity_type, definition FROM workflow_definitions WHERE id = ?');
$defStmt->execute([$definition_id]);
$def = $defStmt->fetch(PDO::FETCH_ASSOC);
if (!$def) jsonError('Workflow not found', 404);

// Load step summary (reuse analytics logic inline)
$sql = '
  SELECT wsl.step_id, wsl.step_name,
    AVG(wsl.duration_minutes) avg_minutes,
    SUM(CASE WHEN wsl.status=\'in_progress\' THEN 1 ELSE 0 END) queue_depth
  FROM workflow_step_logs wsl
  JOIN workflow_instances wi ON wsl.instance_id = wi.id
  WHERE wi.workflow_definition_id = ? AND wsl.started_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
  GROUP BY wsl.step_id, wsl.step_name
';
$stmt = $db->prepare($sql);
$stmt->execute([$definition_id]);
$stepStats = $stmt->fetchAll(PDO::FETCH_ASSOC);

$defData    = json_decode($def['definition'], true);
$nodeMap    = [];
foreach ($defData['nodes'] as $n) { $nodeMap[$n['id']] = $n; }

$stepSummary = '';
foreach ($stepStats as $s) {
  $sla     = (int)($nodeMap[$s['step_id']]['data']['slaMinutes'] ?? 1440);
  $avg     = round((float)$s['avg_minutes'], 0);
  $stepSummary .= "- {$s['step_name']}: avg {$avg} นาที (SLA: {$sla} นาที), ค้างอยู่: {$s['queue_depth']} รายการ\n";
}

// Load AI settings
$aiStmt = $db->prepare("SELECT value FROM company_settings WHERE key_name = 'ai_provider_balanced'");
$aiStmt->execute();
$provider = $aiStmt->fetchColumn() ?: 'provider-kilo';
$modelStmt = $db->prepare("SELECT value FROM company_settings WHERE key_name = 'ai_model_balanced'");
$modelStmt->execute();
$model = $modelStmt->fetchColumn() ?: 'kilo-auto';

$prompt = <<<PROMPT
คุณเป็น Business Process Expert วิเคราะห์ workflow "{$def['name']}" (entity: {$def['entity_type']}) จากข้อมูล 90 วันล่าสุด:

ข้อมูล step performance:
{$stepSummary}

กรุณาตอบเป็น JSON array ของ recommendations เท่านั้น ไม่มี text อื่น:
[
  {
    "type": "quick_fix" หรือ "process_improvement",
    "step_id": "step id หรือ null ถ้าเป็น process-level",
    "title": "ชื่อคำแนะนำ (ภาษาไทย)",
    "description": "รายละเอียด (ภาษาไทย)",
    "impact": "ผลที่คาดว่าจะได้รับ (ภาษาไทย)"
  }
]
PROMPT;

// Call AI via OpenRouter-compatible endpoint
$aiModel = $db->prepare("SELECT base_url, api_key FROM ai_providers WHERE id = ?");
$aiModel->execute([$provider]);
$providerRow = $aiModel->fetch(PDO::FETCH_ASSOC);

$payload = [
  'model'    => $model,
  'messages' => [['role' => 'user', 'content' => $prompt]],
];

$ch = curl_init($providerRow['base_url'] . '/chat/completions');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => json_encode($payload),
  CURLOPT_HTTPHEADER     => [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $providerRow['api_key'],
  ],
  CURLOPT_TIMEOUT => 60,
]);
$resp = curl_exec($ch);
curl_close($ch);

$data = json_decode($resp, true);
$content = $data['choices'][0]['message']['content'] ?? '[]';
$recommendations = json_decode(trim($content), true) ?: [];

jsonResponse(['recommendations' => $recommendations]);
```

- [ ] **Step 2: Commit**

```bash
git add api/workflow-ai.php
git commit -m "feat(api): add workflow-ai.php AI recommendations endpoint"
```

---

## Task 8: Custom Node Components

**Files:**
- Create: `src/components/workflow/nodes/StartEndNode.tsx`
- Create: `src/components/workflow/nodes/StageNode.tsx`
- Create: `src/components/workflow/nodes/DecisionNode.tsx`
- Create: `src/components/workflow/nodes/DelayNode.tsx`
- Create: `src/components/workflow/nodes/NotifyNode.tsx`

- [ ] **Step 1: Create StartEndNode**

```tsx
// src/components/workflow/nodes/StartEndNode.tsx
import { Handle, Position } from '@xyflow/react';
import { WorkflowNodeData } from '@/types/workflow';

interface Props { data: WorkflowNodeData; }

export function StartEndNode({ data }: Props) {
  const isStart = data.nodeType === 'start';
  return (
    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-md ${isStart ? 'bg-emerald-500' : 'bg-slate-500'}`}>
      {data.label}
      {!isStart && <Handle type="target" position={Position.Left} />}
      {isStart && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
```

- [ ] **Step 2: Create StageNode with sub-step expand + heatmap**

```tsx
// src/components/workflow/nodes/StageNode.tsx
import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { WorkflowNodeData } from '@/types/workflow';
import { cn } from '@/lib/utils';

interface Props { data: WorkflowNodeData; selected?: boolean; }

const heatColors: Record<string, string> = {
  ok:       'border-emerald-400 bg-emerald-50',
  warn:     'border-amber-400 bg-amber-50',
  critical: 'border-red-500 bg-red-50',
};
const subHeat: Record<string, string> = {
  ok: 'text-emerald-600', warn: 'text-amber-600', critical: 'text-red-600',
};

export function StageNode({ data, selected }: Props) {
  const [expanded, setExpanded] = useState(false);
  const heat = data.heatLevel ?? 'ok';
  const hasSubSteps = (data.subSteps ?? []).length > 0;

  return (
    <div className={cn('min-w-[160px] rounded-lg border-2 shadow-sm bg-white', heatColors[heat], selected && 'ring-2 ring-blue-400')}>
      <Handle type="target" position={Position.Left} />
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700">{data.label}</span>
          {hasSubSteps && (
            <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>
        {data.avgCycleMinutes != null && (
          <div className="text-xs text-slate-500 mt-0.5">
            เฉลี่ย {Math.round(data.avgCycleMinutes / 60 * 10) / 10} ชม.
            {data.queueDepth != null && data.queueDepth > 0 && (
              <span className="ml-2 text-amber-600">ค้าง {data.queueDepth}</span>
            )}
          </div>
        )}
      </div>
      {expanded && hasSubSteps && (
        <div className="border-t border-slate-200 px-3 py-1.5 space-y-1">
          {data.subSteps!.map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-600 truncate max-w-[110px]">{s.name}</span>
              <span className={cn('font-medium ml-2', subHeat[s.heatLevel])}>
                {Math.round(s.durationMinutes / 60 * 10) / 10}ชม.
              </span>
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 3: Create DecisionNode**

```tsx
// src/components/workflow/nodes/DecisionNode.tsx
import { Handle, Position } from '@xyflow/react';
import { WorkflowNodeData } from '@/types/workflow';

interface Props { data: WorkflowNodeData; }

export function DecisionNode({ data }: Props) {
  return (
    <div className="w-20 h-20 rotate-45 bg-yellow-100 border-2 border-yellow-400 shadow-sm flex items-center justify-center">
      <span className="-rotate-45 text-xs font-semibold text-yellow-800 text-center px-1">{data.label}</span>
      <Handle type="target" position={Position.Left} style={{ left: -8, top: '50%' }} />
      <Handle type="source" position={Position.Right} id="yes" style={{ right: -8, top: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ bottom: -8, left: '50%' }} />
    </div>
  );
}
```

- [ ] **Step 4: Create DelayNode**

```tsx
// src/components/workflow/nodes/DelayNode.tsx
import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { WorkflowNodeData } from '@/types/workflow';

interface Props { data: WorkflowNodeData; }

export function DelayNode({ data }: Props) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-slate-300 bg-slate-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1.5">
        <Clock size={14} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-700">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 5: Create NotifyNode**

```tsx
// src/components/workflow/nodes/NotifyNode.tsx
import { Handle, Position } from '@xyflow/react';
import { Bell } from 'lucide-react';
import { WorkflowNodeData } from '@/types/workflow';

interface Props { data: WorkflowNodeData; }

export function NotifyNode({ data }: Props) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-blue-300 bg-blue-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1.5">
        <Bell size={14} className="text-blue-500" />
        <span className="text-sm font-medium text-blue-700">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/workflow/nodes/
git commit -m "feat(ui): add Workflow custom node components"
```

---

## Task 9: WorkflowNodePalette

**Files:**
- Create: `src/components/workflow/WorkflowNodePalette.tsx`

- [ ] **Step 1: Create palette**

```tsx
// src/components/workflow/WorkflowNodePalette.tsx
import { Circle, Square, Diamond, Clock, Bell, GitBranch } from 'lucide-react';
import { WorkflowNodeType } from '@/types/workflow';

const NODE_TYPES: { type: WorkflowNodeType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'start',    label: 'เริ่มต้น',   icon: Circle,   color: 'bg-emerald-100 border-emerald-400 text-emerald-700' },
  { type: 'end',      label: 'สิ้นสุด',    icon: Circle,   color: 'bg-slate-100 border-slate-400 text-slate-700' },
  { type: 'stage',    label: 'ขั้นตอน',    icon: Square,   color: 'bg-blue-100 border-blue-400 text-blue-700' },
  { type: 'decision', label: 'เงื่อนไข',   icon: Diamond,  color: 'bg-yellow-100 border-yellow-400 text-yellow-700' },
  { type: 'delay',    label: 'รอ/Delay',   icon: Clock,    color: 'bg-slate-100 border-slate-300 text-slate-600' },
  { type: 'notify',   label: 'แจ้งเตือน',  icon: Bell,     color: 'bg-blue-50 border-blue-300 text-blue-600' },
];

export function WorkflowNodePalette() {
  const onDragStart = (e: React.DragEvent, nodeType: WorkflowNodeType) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-48 border-r bg-white flex flex-col gap-1 p-3 overflow-y-auto">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Node Types</p>
      {NODE_TYPES.map(({ type, label, icon: Icon, color }) => (
        <div
          key={type}
          draggable
          onDragStart={e => onDragStart(e, type)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-grab text-sm font-medium ${color} hover:opacity-80 active:cursor-grabbing`}
        >
          <Icon size={14} />
          {label}
        </div>
      ))}
      <div className="mt-4 border-t pt-3">
        <p className="text-xs text-slate-400">ลาก node ลงบน canvas</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workflow/WorkflowNodePalette.tsx
git commit -m "feat(ui): add WorkflowNodePalette drag-and-drop panel"
```

---

## Task 10: WorkflowCanvas

**Files:**
- Create: `src/components/workflow/WorkflowCanvas.tsx`

- [ ] **Step 1: Create canvas**

```tsx
// src/components/workflow/WorkflowCanvas.tsx
import { useCallback, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type OnConnect, type NodeTypes, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowNode, WorkflowEdge, WorkflowNodeData, WorkflowNodeType } from '@/types/workflow';
import { StageNode } from './nodes/StageNode';
import { StartEndNode } from './nodes/StartEndNode';
import { DecisionNode } from './nodes/DecisionNode';
import { DelayNode } from './nodes/DelayNode';
import { NotifyNode } from './nodes/NotifyNode';

const NODE_TYPES: NodeTypes = {
  start:    StartEndNode,
  end:      StartEndNode,
  stage:    StageNode,
  decision: DecisionNode,
  delay:    DelayNode,
  notify:   NotifyNode,
};

interface Props {
  initialNodes: WorkflowNode[];
  initialEdges: WorkflowEdge[];
  readOnly?: boolean;
  onNodeClick?: (node: WorkflowNode) => void;
  onChange?: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
}

let nodeIdCounter = Date.now();
function newNodeId() { return `node_${++nodeIdCounter}`; }

export function WorkflowCanvas({ initialNodes, initialEdges, readOnly, onNodeClick, onChange }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge>(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect: OnConnect = useCallback((params: Connection) => {
    setEdges(eds => {
      const next = addEdge(params, eds);
      onChange?.(nodes, next);
      return next;
    });
  }, [nodes, onChange, setEdges]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow') as WorkflowNodeType;
    if (!type || !reactFlowWrapper.current) return;
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = { x: e.clientX - bounds.left - 80, y: e.clientY - bounds.top - 20 };
    const newNode: WorkflowNode = {
      id: newNodeId(),
      type,
      position,
      data: { label: type === 'stage' ? 'ขั้นตอนใหม่' : type, nodeType: type } as WorkflowNodeData,
    };
    setNodes(ns => {
      const next = [...ns, newNode];
      onChange?.(next, edges);
      return next;
    });
  }, [edges, onChange, setNodes]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onDrop={readOnly ? undefined : onDrop}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onNodeClick={(_, node) => onNodeClick?.(node as WorkflowNode)}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workflow/WorkflowCanvas.tsx
git commit -m "feat(ui): add WorkflowCanvas with React Flow drag-and-drop"
```

---

## Task 11: WorkflowAIPanel

**Files:**
- Create: `src/components/workflow/WorkflowAIPanel.tsx`

- [ ] **Step 1: Create AI panel**

```tsx
// src/components/workflow/WorkflowAIPanel.tsx
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Zap, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { AIRecommendation } from '@/types/workflow';
import { toast } from 'sonner';

interface Props { definitionId: string; }

export function WorkflowAIPanel({ definitionId }: Props) {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);

  const mutation = useMutation({
    mutationFn: () => apiFetch('/workflow-ai.php', { method: 'POST', body: JSON.stringify({ definition_id: definitionId }) }),
    onSuccess: (data: { recommendations: AIRecommendation[] }) => setRecommendations(data.recommendations),
    onError: () => toast.error('ไม่สามารถรับคำแนะนำจาก AI ได้'),
  });

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-purple-700">
          <Sparkles size={16} />
          <span className="font-semibold text-sm">AI แนะนำ</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
          วิเคราะห์
        </Button>
      </div>

      {recommendations.length === 0 && !mutation.isPending && (
        <p className="text-xs text-slate-400 text-center mt-8">กด "วิเคราะห์" เพื่อให้ AI ตรวจสอบ workflow</p>
      )}

      <div className="flex flex-col gap-3 overflow-y-auto">
        {recommendations.map((r, i) => (
          <div key={i} className={`rounded-lg border p-3 ${r.type === 'quick_fix' ? 'border-amber-200 bg-amber-50' : 'border-purple-200 bg-purple-50'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              {r.type === 'quick_fix' ? <Zap size={12} className="text-amber-600" /> : <TrendingUp size={12} className="text-purple-600" />}
              <Badge variant="outline" className={`text-xs ${r.type === 'quick_fix' ? 'text-amber-700 border-amber-300' : 'text-purple-700 border-purple-300'}`}>
                {r.type === 'quick_fix' ? 'แก้ด่วน' : 'ปรับปรุง process'}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-slate-700">{r.title}</p>
            <p className="text-xs text-slate-600 mt-1">{r.description}</p>
            <p className="text-xs text-slate-500 mt-1 italic">ผลที่คาด: {r.impact}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workflow/WorkflowAIPanel.tsx
git commit -m "feat(ui): add WorkflowAIPanel for AI recommendations"
```

---

## Task 12: WorkflowSidePanel

**Files:**
- Create: `src/components/workflow/WorkflowSidePanel.tsx`

- [ ] **Step 1: Create side panel**

```tsx
// src/components/workflow/WorkflowSidePanel.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, BarChart2, Sparkles } from 'lucide-react';
import { WorkflowNode, StepAnalytics } from '@/types/workflow';
import { WorkflowAIPanel } from './WorkflowAIPanel';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  selectedNode: WorkflowNode | null;
  stepAnalytics: StepAnalytics | null;
  definitionId: string;
  onLabelChange?: (nodeId: string, label: string) => void;
  onSlaChange?: (nodeId: string, slaMinutes: number) => void;
}

export function WorkflowSidePanel({ selectedNode, stepAnalytics, definitionId, onLabelChange, onSlaChange }: Props) {
  return (
    <div className="w-72 border-l bg-white flex flex-col">
      <Tabs defaultValue="properties" className="flex flex-col h-full">
        <TabsList className="grid grid-cols-3 m-2">
          <TabsTrigger value="properties"><Settings size={14} /></TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 size={14} /></TabsTrigger>
          <TabsTrigger value="ai"><Sparkles size={14} /></TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="flex-1 overflow-y-auto p-3 space-y-3">
          {!selectedNode && <p className="text-xs text-slate-400 text-center mt-8">เลือก node เพื่อแก้ไข</p>}
          {selectedNode && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600">ชื่อ</label>
                <input
                  className="mt-1 w-full text-sm border rounded px-2 py-1"
                  value={selectedNode.data.label}
                  onChange={e => onLabelChange?.(selectedNode.id, e.target.value)}
                />
              </div>
              {selectedNode.type === 'stage' && (
                <div>
                  <label className="text-xs font-medium text-slate-600">SLA (นาที)</label>
                  <input
                    type="number"
                    className="mt-1 w-full text-sm border rounded px-2 py-1"
                    value={selectedNode.data.slaMinutes ?? 1440}
                    onChange={e => onSlaChange?.(selectedNode.id, Number(e.target.value))}
                  />
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="flex-1 overflow-y-auto p-3 space-y-3">
          {!stepAnalytics && <p className="text-xs text-slate-400 text-center mt-8">เลือก Stage node เพื่อดู analytics</p>}
          {stepAnalytics && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-slate-50 p-2 text-center">
                  <div className="text-lg font-bold text-slate-700">{Math.round(stepAnalytics.avg_cycle_minutes / 60 * 10) / 10}ชม.</div>
                  <div className="text-xs text-slate-500">เฉลี่ย</div>
                </div>
                <div className="rounded-md bg-slate-50 p-2 text-center">
                  <div className={`text-lg font-bold ${stepAnalytics.queue_depth > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{stepAnalytics.queue_depth}</div>
                  <div className="text-xs text-slate-500">ค้างอยู่</div>
                </div>
              </div>

              {stepAnalytics.trend_30d.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">Trend 30 วัน (ชม.)</p>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={stepAnalytics.trend_30d}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip formatter={(v: number) => [`${Math.round(v / 60 * 10) / 10} ชม.`]} />
                      <Line type="monotone" dataKey="avg_minutes" stroke="#6366f1" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {stepAnalytics.stalled_entities.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">ค้างอยู่นาน</p>
                  {stepAnalytics.stalled_entities.map((e, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b last:border-0">
                      <span className="text-slate-600 truncate">{e.entity_name}</span>
                      <span className="text-red-600 ml-2">{e.days_stalled} วัน</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-hidden">
          <WorkflowAIPanel definitionId={definitionId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/workflow/WorkflowSidePanel.tsx
git commit -m "feat(ui): add WorkflowSidePanel with properties/analytics/AI tabs"
```

---

## Task 13: WorkflowPage (Global BPM Hub)

**Files:**
- Create: `src/pages/WorkflowPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/pages/WorkflowPage.tsx
import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, GitBranch, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import PageShell from '@/components/PageShell';
import { apiFetch } from '@/lib/api';
import { WorkflowDefinition, WorkflowNode, WorkflowEdge, WorkflowEntityType, StepAnalytics } from '@/types/workflow';
import { WorkflowNodePalette } from '@/components/workflow/WorkflowNodePalette';
import { WorkflowCanvas } from '@/components/workflow/WorkflowCanvas';
import { WorkflowSidePanel } from '@/components/workflow/WorkflowSidePanel';

export default function WorkflowPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [selectedDefId, setSelectedDefId] = useState<string>(searchParams.get('workflow_id') ?? '');
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEntityType, setNewEntityType] = useState<WorkflowEntityType>('project');
  const [useTemplate, setUseTemplate] = useState(true);

  const { data: definitions = [], isLoading } = useQuery<WorkflowDefinition[]>({
    queryKey: ['workflow-definitions'],
    queryFn: () => apiFetch('/workflows.php'),
  });

  const { data: templates } = useQuery<Record<WorkflowEntityType, { nodes: WorkflowNode[]; edges: WorkflowEdge[] }>>({
    queryKey: ['workflow-templates'],
    queryFn: () => apiFetch('/workflows.php?templates=1'),
  });

  const { data: analytics } = useQuery({
    queryKey: ['workflow-analytics', selectedDefId],
    queryFn: () => apiFetch(`/workflow-analytics.php?definition_id=${selectedDefId}`),
    enabled: !!selectedDefId,
  });

  const selectedDef = definitions.find(d => d.id === selectedDefId);

  // Load definition into canvas when selected
  const handleSelectDef = useCallback((id: string) => {
    setSelectedDefId(id);
    const def = definitions.find(d => d.id === id);
    if (def) {
      // Merge analytics heat levels into nodes
      const steps: StepAnalytics[] = analytics?.steps ?? [];
      const enriched = def.definition.nodes.map(n => {
        const stat = steps.find(s => s.step_id === n.id);
        return stat ? { ...n, data: { ...n.data, avgCycleMinutes: stat.avg_cycle_minutes, queueDepth: stat.queue_depth, heatLevel: stat.heat_level } } : n;
      });
      setNodes(enriched);
      setEdges(def.definition.edges);
    }
    setSelectedNode(null);
  }, [definitions, analytics]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedDef) return Promise.reject();
      return apiFetch(`/workflows.php?id=${selectedDefId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: selectedDef.name, entity_type: selectedDef.entity_type, definition: { nodes, edges }, is_template: selectedDef.is_template }),
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] }); toast.success('บันทึก workflow สำเร็จ'); },
    onError: () => toast.error('ไม่สามารถบันทึกได้'),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const def = useTemplate && templates ? templates[newEntityType] : { nodes: [], edges: [] };
      return apiFetch('/workflows.php', {
        method: 'POST',
        body: JSON.stringify({ name: newName, entity_type: newEntityType, definition: def, is_template: 0 }),
      });
    },
    onSuccess: (data: WorkflowDefinition) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] });
      setShowCreate(false);
      setNewName('');
      handleSelectDef(data.id);
      toast.success('สร้าง workflow สำเร็จ');
    },
    onError: () => toast.error('ไม่สามารถสร้าง workflow ได้'),
  });

  const selectedStepAnalytics: StepAnalytics | null = selectedNode
    ? analytics?.steps?.find((s: StepAnalytics) => s.step_id === selectedNode.id) ?? null
    : null;

  const handleLabelChange = (nodeId: string, label: string) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label } } : n));
  };
  const handleSlaChange = (nodeId: string, slaMinutes: number) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, slaMinutes } } : n));
  };

  return (
    <PageShell title="Workflow BPM" icon={<GitBranch size={20} />}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
        <Select value={selectedDefId} onValueChange={handleSelectDef}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="เลือก Workflow..." />
          </SelectTrigger>
          <SelectContent>
            {definitions.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name} ({d.entity_type})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" /> สร้างใหม่
        </Button>
        {selectedDefId && (
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
            บันทึก
          </Button>
        )}
      </div>

      {/* Main 3-panel layout */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
        <WorkflowNodePalette />
        {selectedDefId ? (
          <WorkflowCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onNodeClick={setSelectedNode}
            onChange={(n, e) => { setNodes(n); setEdges(e); }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <GitBranch size={48} className="mx-auto mb-3 opacity-30" />
              <p>เลือก Workflow หรือสร้างใหม่</p>
            </div>
          </div>
        )}
        <WorkflowSidePanel
          selectedNode={selectedNode}
          stepAnalytics={selectedStepAnalytics}
          definitionId={selectedDefId}
          onLabelChange={handleLabelChange}
          onSlaChange={handleSlaChange}
        />
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>สร้าง Workflow ใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>ชื่อ Workflow</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="เช่น Project Delivery Process" className="mt-1" />
            </div>
            <div>
              <Label>Entity Type</Label>
              <Select value={newEntityType} onValueChange={v => setNewEntityType(v as WorkflowEntityType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">โปรเจกต์</SelectItem>
                  <SelectItem value="opportunity">Sales / โอกาสขาย</SelectItem>
                  <SelectItem value="support_ticket">Support Ticket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="use-template" checked={useTemplate} onChange={e => setUseTemplate(e.target.checked)} />
              <label htmlFor="use-template" className="text-sm text-slate-600">ใช้ template สำเร็จรูป</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>ยกเลิก</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null} สร้าง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/WorkflowPage.tsx
git commit -m "feat(ui): add WorkflowPage Global BPM Hub"
```

---

## Task 14: Register Route, Sidebar, Auth

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `api/auth.php`

- [ ] **Step 1: Add import + route in App.tsx**

In `src/App.tsx`, add import after the existing imports:
```tsx
import WorkflowPage from '@/pages/WorkflowPage';
```

Add route after the `/automation` route (line ~118):
```tsx
<Route path="/workflow" element={<PermissionRoute menuKey="workflow"><WorkflowPage /></PermissionRoute>} />
```

- [ ] **Step 2: Add sidebar menu item in AppSidebar.tsx**

In `src/components/AppSidebar.tsx`, add `GitBranch` to the existing import from lucide-react, then add inside the Operations group (after the automation item, around line 51):
```tsx
{ title: 'Workflow BPM', href: '/workflow', icon: GitBranch, menuKey: 'workflow' },
```

- [ ] **Step 3: Add menuKey to auth.php**

In `api/auth.php`, find line 110:
```php
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','timesheet','reports','analytics','marketing','goals','automation','budget','support','admin','inbox','calendar','task_intelligence'];
```

Replace with:
```php
const ALL_MENU_KEYS = ['home','projects','sales','quotations','companies','revenue','resources','timesheet','reports','analytics','marketing','goals','automation','budget','support','admin','inbox','calendar','task_intelligence','workflow'];
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/AppSidebar.tsx api/auth.php
git commit -m "feat(routing): register /workflow route, sidebar item, and menu key"
```

---

## Task 15: Integration — Deep-links from Projects, Sales, Support

**Files:**
- Modify: `src/pages/ProjectDetail.tsx`
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SupportPage.tsx`

- [ ] **Step 1: Add Workflow button to ProjectDetail**

In `src/pages/ProjectDetail.tsx`, find the tab list near the top of the page render. Add import:
```tsx
import { useNavigate } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
```

Add a button in the project header actions area (near the existing action buttons):
```tsx
const navigate = useNavigate();
// In the JSX button group:
<Button size="sm" variant="outline" onClick={() => navigate(`/workflow?entity=project&entity_id=${project.id}`)}>
  <GitBranch size={14} className="mr-1" /> Workflow
</Button>
```

- [ ] **Step 2: Add Workflow button to SalesPage opportunity cards**

In `src/pages/SalesPage.tsx`, add import:
```tsx
import { useNavigate } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
```

On each opportunity card, add a small button in the card actions:
```tsx
const navigate = useNavigate();
// In opportunity card footer:
<Button size="xs" variant="ghost" onClick={() => navigate(`/workflow?entity=opportunity&entity_id=${opp.id}`)}>
  <GitBranch size={12} className="mr-1" /> Workflow
</Button>
```

- [ ] **Step 3: Add Workflow button to SupportPage ticket detail**

In `src/pages/SupportPage.tsx`, add import:
```tsx
import { useNavigate } from 'react-router-dom';
import { GitBranch } from 'lucide-react';
```

In the ticket detail panel/dialog, add:
```tsx
const navigate = useNavigate();
<Button size="sm" variant="outline" onClick={() => navigate(`/workflow?entity=support_ticket&entity_id=${ticket.id}`)}>
  <GitBranch size={14} className="mr-1" /> ดู Workflow
</Button>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectDetail.tsx src/pages/SalesPage.tsx src/pages/SupportPage.tsx
git commit -m "feat(integration): add Workflow deep-links to Projects, Sales, Support"
```

---

## Task 16: Build Verification

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

Expected: no errors (warnings acceptable)

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: `dist/` created, no TypeScript errors

- [ ] **Step 3: Start dev server and verify**

```bash
pnpm dev
```

Open `http://localhost:8080/workflow` — verify:
- Sidebar shows "Workflow BPM" menu item
- Page loads with 3-panel layout (palette | canvas | side panel)
- "สร้างใหม่" dialog opens, template checkbox works
- Creating a workflow loads it into the canvas
- Nodes can be dragged from palette onto canvas
- Clicking a Stage node shows properties in right panel
- `/workflow?entity=project&entity_id=xxx` URL params work

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(workflow): complete Workflow BPM module v1"
```
