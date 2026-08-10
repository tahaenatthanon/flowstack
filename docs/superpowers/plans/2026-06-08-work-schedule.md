# Work Schedule System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded Mon–Fri 8h/day with a configurable work schedule system per user/team, so task estimated_hours and capacity calculations reflect actual working patterns.

**Architecture:** 3 new DB tables (work_schedules, work_schedule_days, user_work_schedules) → shared PHP helper `resolveSchedule()` in task-hours-rollup.php → updated countWorkingDays() + new countWorkingHours() → capacity.php reads schedule instead of hardcoding 8h → new CRUD API + Admin UI tab.

**Tech Stack:** PHP 8.2 + MariaDB, React 18 + TypeScript, TanStack Query, shadcn-ui, Tailwind CSS

---

## File Map

**New files:**
- `database/migrations/2026_06_08_400000_work_schedules.sql`
- `api/work-schedules.php` — CRUD for schedules + user assignment
- `src/components/admin/WorkSchedulePanel.tsx` — Admin UI tab

**Modified files:**
- `api/task-hours-rollup.php` — add `resolveSchedule()`, update `countWorkingDays()`, add `countWorkingHours()`
- `api/tasks.php` — pass `assignee_user_id` to `countWorkingDays()` / `countWorkingHours()`
- `api/capacity.php` — replace hardcoded `8.0` with schedule lookup
- `src/pages/AdminPage.tsx` — add WorkSchedulePanel tab

---

## Task 1: Database Migration

**Files:**
- Create: `database/migrations/2026_06_08_400000_work_schedules.sql`

- [ ] **Step 1: Write migration file**

```sql
-- database/migrations/2026_06_08_400000_work_schedules.sql

CREATE TABLE work_schedules (
  id            CHAR(36)       NOT NULL PRIMARY KEY,
  tenant_id     CHAR(36)       NOT NULL,
  name          VARCHAR(255)   NOT NULL,
  description   TEXT,
  is_default    TINYINT(1)     NOT NULL DEFAULT 0,
  hours_per_day DECIMAL(4,2)   NOT NULL DEFAULT 8.00,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id)
);

CREATE TABLE work_schedule_days (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  schedule_id CHAR(36)     NOT NULL,
  day_of_week TINYINT      NOT NULL COMMENT '1=Mon 2=Tue ... 7=Sun',
  is_working  TINYINT(1)   NOT NULL DEFAULT 1,
  work_hours  DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  UNIQUE KEY uq_schedule_day (schedule_id, day_of_week),
  FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE CASCADE
);

CREATE TABLE user_work_schedules (
  user_id     CHAR(36) NOT NULL PRIMARY KEY,
  schedule_id CHAR(36) NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE CASCADE
);

-- Seed default Mon–Fri 8h schedule for all existing tenants
INSERT INTO work_schedules (id, tenant_id, name, description, is_default, hours_per_day)
SELECT UUID(), tenant_id, 'ตารางงานมาตรฐาน (จ–ศ)', 'จันทร์–ศุกร์ 8 ชั่วโมง/วัน', 1, 8.00
FROM (SELECT DISTINCT tenant_id FROM company_settings) t;

-- Seed days for each new schedule
INSERT INTO work_schedule_days (id, schedule_id, day_of_week, is_working, work_hours)
SELECT UUID(), ws.id, d.dow,
       CASE WHEN d.dow BETWEEN 1 AND 5 THEN 1 ELSE 0 END,
       CASE WHEN d.dow BETWEEN 1 AND 5 THEN 8.00 ELSE 0.00 END
FROM work_schedules ws
JOIN (SELECT 1 dow UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
      UNION SELECT 5 UNION SELECT 6 UNION SELECT 7) d ON 1=1
WHERE ws.is_default = 1;
```

- [ ] **Step 2: Run migration**

```bash
mysql -u root flowstack < database/migrations/2026_06_08_400000_work_schedules.sql
```

- [ ] **Step 3: Verify**

```bash
mysql -u root flowstack -e "SHOW TABLES LIKE 'work_%'; SELECT id, name, is_default FROM work_schedules;"
```

Expected: 3 tables, 1 row in work_schedules (name='ตารางงานมาตรฐาน (จ–ศ)')

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_06_08_400000_work_schedules.sql
git commit -m "feat(db): add work_schedules, work_schedule_days, user_work_schedules tables"
```

---

## Task 2: PHP Helper — resolveSchedule + countWorkingHours

**Files:**
- Modify: `api/task-hours-rollup.php`

- [ ] **Step 1: Add `resolveSchedule()` at top of file (after existing countWorkingDays)**

```php
/**
 * Return per-day schedule map for a user (or tenant default if no user).
 * @return array<int, array{is_working:int, work_hours:float}>  keyed by day_of_week 1–7
 */
function resolveSchedule(PDO $db, string $tenantId, ?string $userId): array {
    // Default fallback (hardcode Mon–Fri 8h) — used when no DB schedule exists
    $fallback = [];
    for ($d = 1; $d <= 7; $d++) {
        $fallback[$d] = ['is_working' => ($d <= 5 ? 1 : 0), 'work_hours' => ($d <= 5 ? 8.0 : 0.0)];
    }

    // Try user schedule first
    if ($userId) {
        $stmt = $db->prepare(
            'SELECT wsd.day_of_week, wsd.is_working, wsd.work_hours
             FROM user_work_schedules uws
             JOIN work_schedule_days wsd ON wsd.schedule_id = uws.schedule_id
             WHERE uws.user_id = ?'
        );
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if ($rows) {
            $map = [];
            foreach ($rows as $r) $map[(int)$r['day_of_week']] = ['is_working' => (int)$r['is_working'], 'work_hours' => (float)$r['work_hours']];
            return $map;
        }
    }

    // Try tenant default schedule
    $stmt = $db->prepare(
        'SELECT wsd.day_of_week, wsd.is_working, wsd.work_hours
         FROM work_schedules ws
         JOIN work_schedule_days wsd ON wsd.schedule_id = ws.id
         WHERE ws.tenant_id = ? AND ws.is_default = 1
         LIMIT 7'
    );
    $stmt->execute([$tenantId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($rows) {
        $map = [];
        foreach ($rows as $r) $map[(int)$r['day_of_week']] = ['is_working' => (int)$r['is_working'], 'work_hours' => (float)$r['work_hours']];
        return $map;
    }

    return $fallback;
}
```

- [ ] **Step 2: Update `countWorkingDays()` to accept optional userId and use resolveSchedule**

Replace the entire existing `countWorkingDays()` function with:

```php
function countWorkingDays(PDO $db, string $tenantId, string $startDate, string $endDate, ?string $userId = null): int {
    $schedule = resolveSchedule($db, $tenantId, $userId);

    // Fetch holidays in range
    $stmt = $db->prepare(
        "SELECT DISTINCT DATE(start_at) AS d
         FROM calendar_events
         WHERE tenant_id = ? AND event_type = 'holiday'
           AND DATE(start_at) BETWEEN ? AND ?"
    );
    $stmt->execute([$tenantId, $startDate, $endDate]);
    $holidays = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));

    // Also legacy company_holidays
    $stmt2 = $db->prepare(
        "SELECT DISTINCT holiday_date FROM company_holidays WHERE tenant_id = ? AND holiday_date BETWEEN ? AND ?"
    );
    $stmt2->execute([$tenantId, $startDate, $endDate]);
    foreach ($stmt2->fetchAll(PDO::FETCH_COLUMN) as $d) $holidays[$d] = true;

    $count   = 0;
    $current = strtotime($startDate);
    $end     = strtotime($endDate);
    while ($current <= $end) {
        $dow = (int)date('N', $current); // 1=Mon…7=Sun
        $d   = date('Y-m-d', $current);
        if (!isset($holidays[$d]) && ($schedule[$dow]['is_working'] ?? 0)) {
            $count++;
        }
        $current += 86400;
    }
    return max(1, $count);
}
```

- [ ] **Step 3: Add new `countWorkingHours()` function after countWorkingDays**

```php
/**
 * Sum actual work_hours across all working days in [startDate, endDate],
 * respecting schedule, holidays, and calendar_overrides for the user.
 * Returns at least 1.0 hour.
 */
function countWorkingHours(PDO $db, string $tenantId, string $startDate, string $endDate, ?string $userId = null): float {
    $schedule = resolveSchedule($db, $tenantId, $userId);

    // Holidays
    $stmt = $db->prepare(
        "SELECT DISTINCT DATE(start_at) FROM calendar_events
         WHERE tenant_id = ? AND event_type = 'holiday' AND DATE(start_at) BETWEEN ? AND ?"
    );
    $stmt->execute([$tenantId, $startDate, $endDate]);
    $holidays = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));

    $stmt2 = $db->prepare(
        "SELECT DISTINCT holiday_date FROM company_holidays WHERE tenant_id = ? AND holiday_date BETWEEN ? AND ?"
    );
    $stmt2->execute([$tenantId, $startDate, $endDate]);
    foreach ($stmt2->fetchAll(PDO::FETCH_COLUMN) as $d) $holidays[$d] = true;

    // calendar_overrides for this user
    $overrides = [];
    if ($userId) {
        $stmt3 = $db->prepare(
            "SELECT override_date, override_type, hours FROM calendar_overrides
             WHERE tenant_id = ? AND user_id = ? AND override_date BETWEEN ? AND ?"
        );
        $stmt3->execute([$tenantId, $userId, $startDate, $endDate]);
        foreach ($stmt3->fetchAll(PDO::FETCH_ASSOC) as $ov) {
            $overrides[$ov['override_date']] = $ov;
        }
    }

    $total   = 0.0;
    $current = strtotime($startDate);
    $end     = strtotime($endDate);
    while ($current <= $end) {
        $dow = (int)date('N', $current);
        $d   = date('Y-m-d', $current);

        if (isset($overrides[$d])) {
            $ov = $overrides[$d];
            $total += $ov['override_type'] === 'work' ? (float)$ov['hours'] : 0.0;
            $current += 86400;
            continue;
        }

        if (isset($holidays[$d])) { $current += 86400; continue; }

        if ($schedule[$dow]['is_working'] ?? 0) {
            $total += (float)($schedule[$dow]['work_hours'] ?? 8.0);
        }
        $current += 86400;
    }
    return max(1.0, $total);
}
```

- [ ] **Step 4: Update `recalcTaskHoursFromChildrenUnified()` — use countWorkingHours instead of countWorkingDays * 8**

In the leaf-task block (around line 80), replace:
```php
$finalEstDays = countWorkingDays($db, $parent['tenant_id'], $parent['start_date'], $parent['end_date']);
$finalEst = round($finalEstDays * 8, 2);
```
With:
```php
$finalEstDays = countWorkingDays($db, $parent['tenant_id'], $parent['start_date'], $parent['end_date'], $parent['assignee_user_id'] ?? null);
$finalEst     = round(countWorkingHours($db, $parent['tenant_id'], $parent['start_date'], $parent['end_date'], $parent['assignee_user_id'] ?? null), 2);
```

Also update the SELECT to include `assignee_user_id`:
```php
$stmt = $db->prepare('SELECT tenant_id, assignee_user_id, estimated_hours, actual_hours, base_actual_hours, start_date, end_date FROM tasks WHERE id = ?');
```

- [ ] **Step 5: Verify PHP syntax**

```bash
php -l api/task-hours-rollup.php
```

Expected: `No syntax errors detected`

- [ ] **Step 6: Commit**

```bash
git add api/task-hours-rollup.php
git commit -m "feat(backend): add resolveSchedule(), update countWorkingDays/Hours to use work schedule"
```

---

## Task 3: Update tasks.php — pass userId to hour functions

**Files:**
- Modify: `api/tasks.php`

- [ ] **Step 1: Find and update CREATE estimated_hours block (~line 385)**

Current:
```php
$estDays  = countWorkingDays($db, $tenantId, $startDate, $endDate);
$estHours = isset($body['estimated_hours']) && $body['estimated_hours'] !== ''
    ? floatval($body['estimated_hours'])
    : $estDays * 8;
```

Replace with:
```php
$assigneeUserId = $body['assignee_user_id'] ?? null;
$estDays  = countWorkingDays($db, $tenantId, $startDate, $endDate, $assigneeUserId);
$estHours = isset($body['estimated_hours']) && $body['estimated_hours'] !== ''
    ? floatval($body['estimated_hours'])
    : countWorkingHours($db, $tenantId, $startDate, $endDate, $assigneeUserId);
```

- [ ] **Step 2: Find and update UPDATE leaf-task block (~line 665)**

Current:
```php
$newEstDays  = countWorkingDays($db, $tenantId, $upStart, $upEnd);
$newEstHours = $hasEstimatedHoursInput
    ? floatval($body['estimated_hours'])
    : $newEstDays * 8;
```

Replace with:
```php
$assigneeUserId = $body['assignee_user_id'] ?? $currentTask['assignee_user_id'] ?? null;
$newEstDays  = countWorkingDays($db, $tenantId, $upStart, $upEnd, $assigneeUserId);
$newEstHours = $hasEstimatedHoursInput
    ? floatval($body['estimated_hours'])
    : countWorkingHours($db, $tenantId, $upStart, $upEnd, $assigneeUserId);
```

- [ ] **Step 3: Find and update UPDATE parent-task estimated_days block (~line 685)**

Current:
```php
$fields[] = '`estimated_days` = ?';
$values[] = countWorkingDays($db, $tenantId, $upStart, $upEnd);
```

Replace with:
```php
$fields[] = '`estimated_days` = ?';
$values[] = countWorkingDays($db, $tenantId, $upStart, $upEnd, $body['assignee_user_id'] ?? $currentTask['assignee_user_id'] ?? null);
```

- [ ] **Step 4: Verify PHP syntax**

```bash
php -l api/tasks.php
```

- [ ] **Step 5: Commit**

```bash
git add api/tasks.php
git commit -m "feat(tasks): pass assignee_user_id to schedule-aware hour calculations"
```

---

## Task 4: Update capacity.php — replace hardcoded 8h

**Files:**
- Modify: `api/capacity.php`

- [ ] **Step 1: Add require for task-hours-rollup at top of capacity.php**

Find the require statements near the top and add:
```php
require_once __DIR__ . '/task-hours-rollup.php';
```

- [ ] **Step 2: Update `buildDayCapacities()` — replace hardcoded 8.0**

Find the section in `buildDayCapacities()` that handles normal working days (~line 244):

Current:
```php
if ($dow >= 6) {
    $result[$d] = ['capacity' => 0.0, 'reason' => 'weekend'];
    $current->modify('+1 day');
    continue;
}
...
$capacity    = max(0.0, 8.0 - $leaveHours);
$reason      = $leaveHours >= 8.0 ? 'full_leave' : ($leaveHours > 0 ? 'partial_leave' : 'working');
```

Replace the entire inner loop body with:
```php
// Resolve schedule once outside loop (add before while loop)
// $schedule = resolveSchedule($db, $tenantId, $userId);

// Inside loop, replace weekend check and capacity calc:
$schedDay = $schedule[$dow] ?? ['is_working' => 0, 'work_hours' => 0.0];

if (!$schedDay['is_working']) {
    $result[$d] = ['capacity' => 0.0, 'reason' => 'non_working'];
    $current->modify('+1 day');
    continue;
}
...
$dayHours    = (float)$schedDay['work_hours'];
$capacity    = max(0.0, $dayHours - $leaveHours);
$reason      = $leaveHours >= $dayHours ? 'full_leave' : ($leaveHours > 0 ? 'partial_leave' : 'working');
```

Full updated `buildDayCapacities()` function signature stays the same. Add `$schedule = resolveSchedule($db, $tenantId, $userId);` just before the `while ($current <= $endDt)` loop, and replace the `$dow >= 6` weekend block + `8.0` hardcode as shown above.

- [ ] **Step 3: Verify PHP syntax**

```bash
php -l api/capacity.php
```

- [ ] **Step 4: Quick smoke test — call capacity API**

```bash
curl -s -H "Authorization: Bearer $(php -r "echo file_get_contents('C:/xampp/htdocs/flowstack/.env.local') ?: '';")" \
  "http://localhost/flowstack/api/capacity.php?start=2026-06-08&end=2026-06-14" | php -r "echo json_encode(json_decode(file_get_contents('php://stdin')), JSON_PRETTY_PRINT);" 2>/dev/null | head -30
```

(ถ้า curl ไม่ได้ผล — ทดสอบผ่าน browser แทน)

- [ ] **Step 5: Commit**

```bash
git add api/capacity.php
git commit -m "feat(capacity): use work schedule from DB instead of hardcoded Mon–Fri 8h"
```

---

## Task 5: API — work-schedules.php

**Files:**
- Create: `api/work-schedules.php`

- [ ] **Step 1: Create the file**

```php
<?php
// GET    /api/work-schedules.php                         — list schedules + days
// GET    /api/work-schedules.php?id=<id>                — single schedule + days
// POST   /api/work-schedules.php                         — create schedule
// PUT    /api/work-schedules.php?id=<id>                — update schedule fields + days
// DELETE /api/work-schedules.php?id=<id>                — delete (not if default+has users)
// POST   /api/work-schedules.php?action=assign          — assign user to schedule
// GET    /api/work-schedules.php?action=user_assignments — list user→schedule
require_once __DIR__ . '/auth.php';

$user     = requireAuth();
$db       = getDB();
$method   = getMethod();
$tenantId = $user['tenant_id'];
$userId   = $user['user_id'];
$id       = $_GET['id']     ?? null;
$action   = $_GET['action'] ?? '';

function fetchScheduleWithDays(PDO $db, string $id): ?array {
    $stmt = $db->prepare('SELECT * FROM work_schedules WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;
    $days = $db->prepare('SELECT * FROM work_schedule_days WHERE schedule_id = ? ORDER BY day_of_week');
    $days->execute([$id]);
    $row['days'] = $days->fetchAll(PDO::FETCH_ASSOC);
    return $row;
}

if ($method === 'GET') {
    if ($action === 'user_assignments') {
        $stmt = $db->prepare(
            'SELECT uws.user_id, uws.schedule_id, u.display_name, u.email, ws.name as schedule_name
             FROM user_work_schedules uws
             JOIN users u  ON u.id  = uws.user_id
             JOIN work_schedules ws ON ws.id = uws.schedule_id
             WHERE ws.tenant_id = ?
             ORDER BY u.display_name'
        );
        $stmt->execute([$tenantId]);
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
    if ($id) {
        $row = fetchScheduleWithDays($db, $id);
        if (!$row || $row['tenant_id'] !== $tenantId) jsonError('Not found', 404);
        jsonResponse($row);
    }
    $stmt = $db->prepare('SELECT ws.* FROM work_schedules ws WHERE ws.tenant_id = ? ORDER BY is_default DESC, name ASC');
    $stmt->execute([$tenantId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        $days = $db->prepare('SELECT * FROM work_schedule_days WHERE schedule_id = ? ORDER BY day_of_week');
        $days->execute([$r['id']]);
        $r['days'] = $days->fetchAll(PDO::FETCH_ASSOC);
    }
    jsonResponse($rows);
}

if ($method === 'POST') {
    if ($action === 'assign') {
        $body       = json_decode(file_get_contents('php://input'), true) ?? [];
        $targetUser = $body['user_id']     ?? '';
        $schedId    = $body['schedule_id'] ?? '';
        if (!$targetUser || !$schedId) jsonError('user_id and schedule_id required', 422);
        // Verify schedule belongs to tenant
        $chk = $db->prepare('SELECT id FROM work_schedules WHERE id = ? AND tenant_id = ?');
        $chk->execute([$schedId, $tenantId]);
        if (!$chk->fetch()) jsonError('Schedule not found', 404);
        $db->prepare(
            'INSERT INTO user_work_schedules (user_id, schedule_id) VALUES (?,?)
             ON DUPLICATE KEY UPDATE schedule_id=VALUES(schedule_id), updated_at=NOW()'
        )->execute([$targetUser, $schedId]);
        jsonResponse(['success' => true]);
    }

    // Create schedule
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    if (empty($body['name'])) jsonError('name required', 422);
    $days = $body['days'] ?? [];  // array of {day_of_week, is_working, work_hours}

    // If is_default requested, clear existing default
    if (!empty($body['is_default'])) {
        $db->prepare('UPDATE work_schedules SET is_default=0 WHERE tenant_id=?')->execute([$tenantId]);
    }

    $newId = generateUUID();
    $db->prepare(
        'INSERT INTO work_schedules (id, tenant_id, name, description, is_default, hours_per_day)
         VALUES (?,?,?,?,?,?)'
    )->execute([$newId, $tenantId, $body['name'], $body['description'] ?? null, $body['is_default'] ? 1 : 0, $body['hours_per_day'] ?? 8.00]);

    foreach ($days as $day) {
        $db->prepare(
            'INSERT INTO work_schedule_days (id, schedule_id, day_of_week, is_working, work_hours)
             VALUES (?,?,?,?,?)'
        )->execute([generateUUID(), $newId, (int)$day['day_of_week'], (int)$day['is_working'], (float)$day['work_hours']]);
    }

    jsonResponse(fetchScheduleWithDays($db, $newId), 201);
}

if ($method === 'PUT') {
    if (!$id) jsonError('id required', 400);
    $row = fetchScheduleWithDays($db, $id);
    if (!$row || $row['tenant_id'] !== $tenantId) jsonError('Not found', 404);

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    if (!empty($body['is_default'])) {
        $db->prepare('UPDATE work_schedules SET is_default=0 WHERE tenant_id=?')->execute([$tenantId]);
    }

    $fields = []; $values = [];
    foreach (['name','description','is_default','hours_per_day'] as $f) {
        if (array_key_exists($f, $body)) { $fields[] = "$f=?"; $values[] = $body[$f]; }
    }
    if ($fields) {
        $values[] = $id;
        $db->prepare('UPDATE work_schedules SET '.implode(',', $fields).' WHERE id=?')->execute($values);
    }

    // Replace days if provided
    if (!empty($body['days'])) {
        $db->prepare('DELETE FROM work_schedule_days WHERE schedule_id=?')->execute([$id]);
        foreach ($body['days'] as $day) {
            $db->prepare(
                'INSERT INTO work_schedule_days (id, schedule_id, day_of_week, is_working, work_hours)
                 VALUES (?,?,?,?,?)'
            )->execute([generateUUID(), $id, (int)$day['day_of_week'], (int)$day['is_working'], (float)$day['work_hours']]);
        }
    }

    jsonResponse(fetchScheduleWithDays($db, $id));
}

if ($method === 'DELETE') {
    if (!$id) jsonError('id required', 400);
    $row = fetchScheduleWithDays($db, $id);
    if (!$row || $row['tenant_id'] !== $tenantId) jsonError('Not found', 404);

    // Check if any user is assigned
    $used = $db->prepare('SELECT COUNT(*) FROM user_work_schedules WHERE schedule_id=?');
    $used->execute([$id]);
    if ((int)$used->fetchColumn() > 0) jsonError('ไม่สามารถลบ schedule ที่มีพนักงานใช้งานอยู่', 409);

    $db->prepare('DELETE FROM work_schedules WHERE id=?')->execute([$id]);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 2: Verify PHP syntax**

```bash
php -l api/work-schedules.php
```

- [ ] **Step 3: Quick API test**

Login via browser and call:
```
GET http://localhost/flowstack/api/work-schedules.php
```
Expected: JSON array with 1 schedule (the seeded default)

- [ ] **Step 4: Commit**

```bash
git add api/work-schedules.php
git commit -m "feat(api): add work-schedules.php — CRUD schedules + user assignment"
```

---

## Task 6: Admin UI — WorkSchedulePanel

**Files:**
- Create: `src/components/admin/WorkSchedulePanel.tsx`
- Modify: `src/pages/AdminPage.tsx`

- [ ] **Step 1: Create WorkSchedulePanel.tsx**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

const DAY_LABELS: Record<number, string> = {
  1:'จันทร์', 2:'อังคาร', 3:'พุธ', 4:'พฤหัส', 5:'ศุกร์', 6:'เสาร์', 7:'อาทิตย์'
};

interface ScheduleDay { id?: string; day_of_week: number; is_working: number; work_hours: number; }
interface WorkSchedule { id: string; name: string; description: string; is_default: number; hours_per_day: number; days: ScheduleDay[]; }
interface UserAssignment { user_id: string; schedule_id: string; display_name: string; email: string; schedule_name: string; }

function defaultDays(): ScheduleDay[] {
  return Array.from({length:7}, (_,i) => ({
    day_of_week: i+1,
    is_working: i < 5 ? 1 : 0,
    work_hours: i < 5 ? 8 : 0,
  }));
}

function ScheduleFormDialog({ open, onClose, initial }: {
  open: boolean; onClose: () => void; initial?: WorkSchedule;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [isDefault, setIsDefault] = useState(!!(initial?.is_default));
  const [days, setDays] = useState<ScheduleDay[]>(initial?.days ?? defaultDays());

  const mut = useMutation({
    mutationFn: (body: any) => initial
      ? apiFetch(`/work-schedules.php?id=${initial.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : apiFetch('/work-schedules.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-schedules'] });
      toast({ title: initial ? 'แก้ไขสำเร็จ' : 'สร้างสำเร็จ' });
      onClose();
    },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const updateDay = (dow: number, field: 'is_working'|'work_hours', value: any) => {
    setDays(prev => prev.map(d => d.day_of_week === dow ? { ...d, [field]: value } : d));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'แก้ไข Schedule' : 'สร้าง Schedule ใหม่'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>ชื่อ Schedule</Label>
            <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น ออฟฟิส จ–ศ" />
          </div>
          <div>
            <Label>คำอธิบาย (ไม่บังคับ)</Label>
            <Input className="mt-1" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} id="is-default" />
            <Label htmlFor="is-default" className="cursor-pointer">ใช้เป็น default ของบริษัท</Label>
          </div>
          <div>
            <Label className="text-sm mb-2 block">วันทำงานและชั่วโมง</Label>
            <div className="space-y-2">
              {days.map(day => (
                <div key={day.day_of_week} className="flex items-center gap-3">
                  <Switch
                    checked={!!day.is_working}
                    onCheckedChange={v => updateDay(day.day_of_week, 'is_working', v ? 1 : 0)}
                  />
                  <span className="w-16 text-sm">{DAY_LABELS[day.day_of_week]}</span>
                  <Input
                    type="number" min={0} max={24} step={0.5}
                    className="w-20 h-8 text-sm"
                    value={day.work_hours}
                    disabled={!day.is_working}
                    onChange={e => updateDay(day.day_of_week, 'work_hours', parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-xs text-muted-foreground">ชั่วโมง</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={!name || mut.isPending} onClick={() => mut.mutate({ name, description: desc, is_default: isDefault, days })}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {initial ? 'บันทึก' : 'สร้าง'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkSchedulePanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editTarget, setEditTarget] = useState<WorkSchedule | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: schedules = [], isLoading } = useQuery<WorkSchedule[]>({
    queryKey: ['work-schedules'],
    queryFn: () => apiFetch('/work-schedules.php'),
  });

  const { data: assignments = [] } = useQuery<UserAssignment[]>({
    queryKey: ['work-schedule-assignments'],
    queryFn: () => apiFetch('/work-schedules.php?action=user_assignments'),
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/users.php'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/work-schedules.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-schedules'] }); toast({ title: 'ลบสำเร็จ' }); },
    onError: (e: Error) => toast({ title: 'ลบไม่สำเร็จ', description: e.message, variant: 'destructive' }),
  });

  const assignMut = useMutation({
    mutationFn: (body: { user_id: string; schedule_id: string }) =>
      apiFetch('/work-schedules.php?action=assign', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-schedule-assignments'] }); toast({ title: 'กำหนด Schedule สำเร็จ' }); },
  });

  const getAssignment = (userId: string) => assignments.find(a => a.user_id === userId);

  return (
    <div className="space-y-6">
      {/* Schedules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Work Schedules</h3>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> สร้าง Schedule
          </Button>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        <div className="grid gap-3 sm:grid-cols-2">
          {schedules.map(s => (
            <Card key={s.id}>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  {s.name}
                  {!!s.is_default && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300"><Star className="h-2.5 w-2.5 mr-0.5" />Default</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                <div className="flex gap-1 flex-wrap">
                  {(s.days ?? []).map(d => (
                    <Badge key={d.day_of_week} variant={d.is_working ? 'secondary' : 'outline'}
                      className={`text-[10px] ${!d.is_working ? 'opacity-40' : ''}`}>
                      {DAY_LABELS[d.day_of_week]} {d.is_working ? `${d.work_hours}h` : '–'}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1 justify-end">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTarget(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  {!s.is_default && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm('ลบ Schedule นี้?')) deleteMut.mutate(s.id) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* User assignments */}
      <div>
        <h3 className="text-sm font-medium mb-3">กำหนด Schedule ให้พนักงาน</h3>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-xs">พนักงาน</th>
                <th className="px-3 py-2 text-left font-medium text-xs">Schedule ปัจจุบัน</th>
                <th className="px-3 py-2 text-left font-medium text-xs">เปลี่ยน</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.filter((u: any) => u.is_active !== 0).map((u: any) => {
                const asgn = getAssignment(u.id);
                return (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium text-xs">{u.display_name}</div>
                      <div className="text-[10px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {asgn ? asgn.schedule_name : <span className="italic">Default บริษัท</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={asgn?.schedule_id ?? '__default__'}
                        onValueChange={v => {
                          if (v === '__default__') return;
                          assignMut.mutate({ user_id: u.id, schedule_id: v });
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Default บริษัท</SelectItem>
                          {schedules.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <ScheduleFormDialog open onClose={() => setShowCreate(false)} />}
      {editTarget && <ScheduleFormDialog open onClose={() => setEditTarget(null)} initial={editTarget} key={editTarget.id} />}
    </div>
  );
}
```

- [ ] **Step 2: Add tab to AdminPage.tsx**

In the TabsList section, after the work-types tab trigger:
```tsx
<TabsTrigger value="work-schedules" className="gap-1.5 text-xs px-2.5 py-1.5 shrink-0">
  <Clock className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">ตารางงาน</span>
</TabsTrigger>
```

Add import at top:
```tsx
import WorkSchedulePanel from '@/components/admin/WorkSchedulePanel';
```

Add TabsContent after work-types content:
```tsx
<TabsContent value="work-schedules" className="space-y-6">
  {hasTab('work-schedules') && <WorkSchedulePanel />}
</TabsContent>
```

- [ ] **Step 3: Build to verify TypeScript**

```bash
pnpm build 2>&1 | tail -5
```

Expected: `✓ built in ...`

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/WorkSchedulePanel.tsx src/pages/AdminPage.tsx
git commit -m "feat(ui): add WorkSchedulePanel — manage work schedules and user assignments"
```

---

## Self-Review

**Spec coverage:**
- ✅ 3 new tables (Task 1)
- ✅ resolveSchedule() priority chain (Task 2)
- ✅ countWorkingDays() updated (Task 2)
- ✅ countWorkingHours() new function (Task 2)
- ✅ tasks.php passes userId (Task 3)
- ✅ capacity.php uses schedule (Task 4)
- ✅ CRUD API (Task 5)
- ✅ Admin UI schedules + user assignment (Task 6)
- ✅ Fallback hardcode Mon–Fri 8h (resolveSchedule fallback)
- ✅ calendar_overrides honored (countWorkingHours step 3)
- ✅ OT = actual_hours only, no estimated OT (not implemented = YAGNI ✓)

**Placeholder scan:** None found.

**Type consistency:** `WorkSchedule`, `ScheduleDay`, `UserAssignment` defined in Task 6 only — consistent throughout.
