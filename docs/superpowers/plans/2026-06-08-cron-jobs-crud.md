# Cron Jobs CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้าย cron job registry จาก PHP hardcode ไปเก็บใน DB และเพิ่ม CRUD UI ใน Admin panel

**Architecture:** สร้าง table `cron_jobs` ใน MariaDB, seed 4 built-in jobs, rewrite `api/cron-manager.php` ให้ CRUD จาก DB, rewrite `CronJobsPanel.tsx` ให้รองรับ add/edit/delete/enable/history

**Tech Stack:** PHP 8.2 + PDO + MariaDB, React 18 + TypeScript, TanStack Query, shadcn-ui

---

## File Map

| File | Action |
|---|---|
| `database/migrations/2026_06_08_000001_create_cron_jobs_table.sql` | CREATE |
| `api/cron-manager.php` | REWRITE |
| `src/components/admin/CronJobsPanel.tsx` | REWRITE |

---

### Task 1: Migration — สร้าง cron_jobs table + seed

**Files:**
- Create: `database/migrations/2026_06_08_000001_create_cron_jobs_table.sql`

- [ ] **Step 1: เขียน migration file**

```sql
-- database/migrations/2026_06_08_000001_create_cron_jobs_table.sql

CREATE TABLE IF NOT EXISTS cron_jobs (
  id             CHAR(36)       NOT NULL PRIMARY KEY,
  `key`          VARCHAR(60)    NOT NULL UNIQUE,
  name           VARCHAR(100)   NOT NULL,
  description    TEXT           DEFAULT NULL,
  interval_label VARCHAR(100)   DEFAULT NULL,
  type           ENUM('http','include') NOT NULL DEFAULT 'http',
  endpoint       VARCHAR(255)   DEFAULT NULL,
  file_path      VARCHAR(500)   DEFAULT NULL,
  http_method    ENUM('GET','POST') NOT NULL DEFAULT 'GET',
  query_string   VARCHAR(255)   DEFAULT NULL,
  enabled        TINYINT(1)     NOT NULL DEFAULT 1,
  created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO cron_jobs (id, `key`, name, description, interval_label, type, endpoint, file_path, http_method, query_string, enabled)
VALUES
  (UUID(), 'cron-publish',          'Content Publish Scheduler',  'ประมวลผล content_schedules ที่ถึงเวลาโพสต์ (brand-content flow)',         'ทุก 1 นาที',     'http',    'cron-publish.php',          NULL,                                              'GET',  NULL,        1),
  (UUID(), 'publish-scheduler',     'Publish Queue Processor',    'ประมวลผล content_publish_queue (SchedulePublishDialog flow)',              'ทุก 1 นาที',     'include', NULL,                        'api/cron/publish-scheduler.php',                  'GET',  NULL,        1),
  (UUID(), 'notification-dispatch', 'Notification Dispatch',      'ส่งการแจ้งเตือนผ่าน Line OA, Telegram, Email',                           'ทุก 15 นาที',    'http',    'notification-dispatch.php', NULL,                                              'GET',  NULL,        1),
  (UUID(), 'recurring-tasks',       'Recurring Task Generator',   'สร้าง instance ของงานซ้ำที่ถึงกำหนด',                                    'ทุกวัน เที่ยงคืน','http',   'recurring-tasks.php',       NULL,                                              'POST', 'trigger=1', 1);

ALTER TABLE cron_runs
  ADD INDEX IF NOT EXISTS idx_cron_runs_job_name (job_name);
```

- [ ] **Step 2: Run migration**

```bash
mysql -u root flowstack < database/migrations/2026_06_08_000001_create_cron_jobs_table.sql
```

Expected: ไม่มี error

- [ ] **Step 3: ตรวจสอบ**

```bash
mysql -u root flowstack -e "SELECT \`key\`, name, enabled FROM cron_jobs;"
```

Expected output:
```
key                     name                          enabled
cron-publish            Content Publish Scheduler     1
publish-scheduler       Publish Queue Processor       1
notification-dispatch   Notification Dispatch         1
recurring-tasks         Recurring Task Generator      1
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_06_08_000001_create_cron_jobs_table.sql
git commit -m "feat(db): create cron_jobs table and seed 4 built-in jobs"
```

---

### Task 2: API — rewrite cron-manager.php

**Files:**
- Modify: `api/cron-manager.php` (rewrite ทั้งไฟล์)

- [ ] **Step 1: เขียน cron-manager.php ใหม่ทั้งไฟล์**

```php
<?php
// api/cron-manager.php
// GET                              — list jobs + last run
// GET  ?action=history&job=<key>   — 10 last runs for a job
// POST ?action=run&job=<key>        — run job manually
// POST ?action=create               — create new job
// PUT  ?action=update&job=<key>     — update job fields
// DELETE ?action=delete&job=<key>   — delete job
// DELETE ?action=clear-history&job=<key> — clear cron_runs for job

require_once __DIR__ . '/auth.php';
$tokenData = requireAuth();
$db        = getDB();
requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

$method = getMethod();
$action = $_GET['action'] ?? '';
$jobKey = $_GET['job']    ?? '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fetchJob(PDO $db, string $key): ?array {
    $stmt = $db->prepare('SELECT * FROM cron_jobs WHERE `key` = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function jobState(array $job): string {
    // running: started but not finished within last 10 minutes
    if ($job['last_started_at'] && !$job['last_finished_at']) {
        $started = strtotime($job['last_started_at']);
        if (time() - $started < 600) return 'running';
        return 'stuck';
    }
    return $job['last_errors'] > 0 ? 'error' : ($job['last_started_at'] ? 'ok' : 'never');
}

function mergeLastRun(PDO $db, array $jobs): array {
    if (empty($jobs)) return [];
    $stmt = $db->query(
        "SELECT job_name, started_at, finished_at, records_processed, errors, notes
         FROM cron_runs
         WHERE id IN (SELECT MAX(id) FROM cron_runs GROUP BY job_name)"
    );
    $last = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $last[$r['job_name']] = $r;
    }
    return array_map(function ($j) use ($last) {
        $r = $last[$j['key']] ?? null;
        $j['last_started_at']  = $r['started_at']        ?? null;
        $j['last_finished_at'] = $r['finished_at']        ?? null;
        $j['last_processed']   = $r ? (int)$r['records_processed'] : null;
        $j['last_errors']      = $r ? (int)$r['errors']            : null;
        $j['last_notes']       = $r['notes']              ?? null;
        $j['state']            = jobState($j);
        return $j;
    }, $jobs);
}

function runJob(PDO $db, array $def): array {
    $cronSecret = getenv('CRON_SECRET') ?: 'flowstack-cron-2026';

    // If stuck: close the old run first
    $db->prepare(
        "UPDATE cron_runs SET finished_at = NOW(), errors = 1,
          notes = 'Force-restarted after timeout'
         WHERE job_name = ? AND finished_at IS NULL"
    )->execute([$def['key']]);

    $db->prepare("INSERT INTO cron_runs (job_name, started_at) VALUES (?, NOW())")->execute([$def['key']]);
    $runId = $db->lastInsertId();

    $output = ''; $success = false; $processed = 0; $errors = 0;

    try {
        if ($def['type'] === 'include') {
            ob_start();
            if (!defined('CRON_MODE')) define('CRON_MODE', true);
            $file = strpos($def['file_path'], '/') === 0
                ? $def['file_path']
                : __DIR__ . '/../' . $def['file_path'];
            include $file;
            $output  = ob_get_clean() ?: '';
            $success = true;
        } else {
            $q   = $def['query_string'] ?? '';
            $sep = $def['http_method'] === 'GET' ? '?' : ($q ? '?' : '');
            $url = 'http://localhost/flowstack/api/' . $def['endpoint']
                 . ($def['http_method'] === 'GET'
                     ? '?token=' . urlencode($cronSecret) . ($q ? '&' . $q : '')
                     : ($q ? '?' . $q : ''));
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 120,
                CURLOPT_CUSTOMREQUEST  => $def['http_method'],
                CURLOPT_HTTPHEADER     => $def['http_method'] === 'POST'
                    ? ['Content-Type: application/json'] : [],
            ]);
            if ($def['http_method'] === 'POST') {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['secret' => $cronSecret]));
            }
            $output   = (string)(curl_exec($ch) ?: '');
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr  = curl_error($ch);
            curl_close($ch);
            $success = !$curlErr && $httpCode < 400;
            if ($curlErr) $output = 'cURL error: ' . $curlErr;
        }
        if (preg_match('/(\d+)\s+entries/i', $output, $m)) $processed = (int)$m[1];
        if (preg_match('/(\d+)\s+error/i',   $output, $m)) $errors    = (int)$m[1];
    } catch (Throwable $e) {
        $output = 'Exception: ' . $e->getMessage();
        $success = false; $errors = 1;
    }

    $db->prepare(
        "UPDATE cron_runs SET finished_at=NOW(), records_processed=?, errors=?, notes=? WHERE id=?"
    )->execute([$processed, $errors, mb_substr($output, 0, 500), $runId]);

    return [
        'success'   => $success,
        'output'    => mb_substr($output ?: ($success ? 'Completed.' : 'Failed.'), 0, 2000),
        'processed' => $processed,
        'errors'    => $errors,
    ];
}

// ── GET: list or history ───────────────────────────────────────────────────────

if ($method === 'GET') {
    if ($action === 'history' && $jobKey) {
        $stmt = $db->prepare(
            "SELECT started_at, finished_at, records_processed, errors, notes
             FROM cron_runs WHERE job_name = ?
             ORDER BY id DESC LIMIT 10"
        );
        $stmt->execute([$jobKey]);
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    $jobs = $db->query('SELECT * FROM cron_jobs ORDER BY created_at ASC')
               ->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse(mergeLastRun($db, $jobs));
}

// ── POST: run or create ────────────────────────────────────────────────────────

if ($method === 'POST') {
    if ($action === 'run') {
        if (!$jobKey) jsonError('job param required', 400);
        $def = fetchJob($db, $jobKey);
        if (!$def) jsonError('Unknown job: ' . $jobKey, 404);
        jsonResponse(runJob($db, $def));
    }

    if ($action === 'create') {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $key  = trim($body['key'] ?? '');
        if (!preg_match('/^[a-z0-9-]+$/', $key)) jsonError('key must be [a-z0-9-]+', 422);
        if (empty($body['name']))                 jsonError('name is required', 422);
        if (($body['type'] ?? '') === 'http'    && empty($body['endpoint']))  jsonError('endpoint required for http type', 422);
        if (($body['type'] ?? '') === 'include' && empty($body['file_path'])) jsonError('file_path required for include type', 422);

        if (fetchJob($db, $key)) jsonError('key already exists', 409);

        $id = generateUUID();
        $db->prepare(
            "INSERT INTO cron_jobs (id, `key`, name, description, interval_label, type, endpoint, file_path, http_method, query_string, enabled)
             VALUES (?,?,?,?,?,?,?,?,?,?,1)"
        )->execute([
            $id, $key,
            $body['name'],
            $body['description'] ?? null,
            $body['interval_label'] ?? null,
            $body['type'] ?? 'http',
            $body['endpoint'] ?? null,
            $body['file_path'] ?? null,
            $body['http_method'] ?? 'GET',
            $body['query_string'] ?? null,
        ]);
        jsonResponse(fetchJob($db, $key), 201);
    }

    jsonError('Unknown action', 400);
}

// ── PUT: update ────────────────────────────────────────────────────────────────

if ($method === 'PUT') {
    if (!$jobKey) jsonError('job param required', 400);
    $def  = fetchJob($db, $jobKey);
    if (!$def) jsonError('Job not found', 404);

    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $fields = [];
    $params = [];
    $allowed = ['name','description','interval_label','type','endpoint','file_path','http_method','query_string','enabled'];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "`$f` = ?";
            $params[]  = $body[$f];
        }
    }
    if (empty($fields)) jsonError('Nothing to update', 400);

    $params[] = $jobKey;
    $db->prepare("UPDATE cron_jobs SET " . implode(', ', $fields) . " WHERE `key` = ?")->execute($params);
    jsonResponse(fetchJob($db, $jobKey));
}

// ── DELETE: delete job or clear history ───────────────────────────────────────

if ($method === 'DELETE') {
    if (!$jobKey) jsonError('job param required', 400);

    if ($action === 'clear-history') {
        $stmt = $db->prepare("DELETE FROM cron_runs WHERE job_name = ?");
        $stmt->execute([$jobKey]);
        jsonResponse(['deleted' => $stmt->rowCount()]);
    }

    // delete job
    $def = fetchJob($db, $jobKey);
    if (!$def) jsonError('Job not found', 404);
    $db->prepare("DELETE FROM cron_jobs WHERE `key` = ?")->execute([$jobKey]);
    $db->prepare("DELETE FROM cron_runs WHERE job_name = ?")->execute([$jobKey]);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
```

- [ ] **Step 2: ทดสอบ GET**

```bash
TOKEN=$(curl -s -X POST http://localhost/flowstack/api/auth/login.php \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@flowstack.com","password":"ktN@007"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

curl -s http://localhost/flowstack/api/cron-manager.php \
  -H "Authorization: Bearer $TOKEN" | grep -o '"key":"[^"]*"'
```

Expected:
```
"key":"cron-publish"
"key":"publish-scheduler"
"key":"notification-dispatch"
"key":"recurring-tasks"
```

- [ ] **Step 3: ทดสอบ POST create**

```bash
curl -s -X POST "http://localhost/flowstack/api/cron-manager.php?action=create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"test-job","name":"Test Job","type":"http","endpoint":"test.php","interval_label":"ทุก 5 นาที"}'
```

Expected: JSON ของ job ที่สร้าง (201)

- [ ] **Step 4: ทดสอบ PUT update (enable toggle)**

```bash
curl -s -X PUT "http://localhost/flowstack/api/cron-manager.php?action=update&job=test-job" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":0}'
```

Expected: job object ที่มี `"enabled":0`

- [ ] **Step 5: ทดสอบ GET history**

```bash
curl -s "http://localhost/flowstack/api/cron-manager.php?action=history&job=cron-publish" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: array (อาจว่างหรือมี rows)

- [ ] **Step 6: ทดสอบ DELETE clear-history + delete job**

```bash
curl -s -X DELETE "http://localhost/flowstack/api/cron-manager.php?action=clear-history&job=test-job" \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"data":{"deleted":0}}

curl -s -X DELETE "http://localhost/flowstack/api/cron-manager.php?action=delete&job=test-job" \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"data":{"success":true}}
```

- [ ] **Step 7: Commit**

```bash
git add api/cron-manager.php
git commit -m "feat(api): rewrite cron-manager to DB-backed CRUD with history and run conditions"
```

---

### Task 3: Frontend — rewrite CronJobsPanel.tsx

**Files:**
- Modify: `src/components/admin/CronJobsPanel.tsx` (rewrite ทั้งไฟล์)

- [ ] **Step 1: เขียน CronJobsPanel.tsx ใหม่ทั้งไฟล์**

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Play, RefreshCw, Clock, CheckCircle2, XCircle, Minus,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2, AlertTriangle, Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface CronJob {
  id: string;
  key: string;
  name: string;
  description: string | null;
  interval_label: string | null;
  type: 'http' | 'include';
  endpoint: string | null;
  file_path: string | null;
  http_method: 'GET' | 'POST';
  query_string: string | null;
  enabled: number;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_processed: number | null;
  last_errors: number | null;
  last_notes: string | null;
  state: 'ok' | 'error' | 'running' | 'stuck' | 'never';
}

interface HistoryRow {
  started_at: string;
  finished_at: string | null;
  records_processed: number;
  errors: number;
  notes: string | null;
}

interface RunResult {
  success: boolean;
  output: string;
  processed: number;
  errors: number;
}

const emptyForm = () => ({
  key: '', name: '', description: '', interval_label: '',
  type: 'http' as 'http' | 'include',
  endpoint: '', file_path: '', http_method: 'GET' as 'GET' | 'POST', query_string: '',
});

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ job }: { job: CronJob }) {
  if (job.state === 'running')
    return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300"><RefreshCw className="h-3 w-3 animate-spin" />กำลังรัน</Badge>;
  if (job.state === 'stuck')
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />ค้าง</Badge>;
  if (job.state === 'error')
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />มีข้อผิดพลาด</Badge>;
  if (job.state === 'ok')
    return <Badge className="gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" />สำเร็จ</Badge>;
  return <Badge variant="secondary" className="gap-1"><Minus className="h-3 w-3" />ยังไม่เคยรัน</Badge>;
}

// ── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ jobKey, onClear }: { jobKey: string; onClear: () => void }) {
  const { data: rows = [], isFetching } = useQuery<HistoryRow[]>({
    queryKey: ['cron-history', jobKey],
    queryFn: () => apiFetch(`/cron-manager.php?action=history&job=${jobKey}`),
  });
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="mt-2 border-t pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">10 ครั้งล่าสุด</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive px-2"
          onClick={() => setConfirmClear(true)}>
          ล้าง History
        </Button>
      </div>
      {isFetching && <p className="text-xs text-muted-foreground">กำลังโหลด...</p>}
      {!isFetching && rows.length === 0 && <p className="text-xs text-muted-foreground">ไม่มีประวัติ</p>}
      {rows.length > 0 && (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left pb-1 font-medium">เริ่ม</th>
              <th className="text-right pb-1 font-medium">ระยะเวลา</th>
              <th className="text-right pb-1 font-medium">ประมวลผล</th>
              <th className="text-right pb-1 font-medium">errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dur = r.started_at && r.finished_at
                ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000) + 's'
                : r.started_at ? 'รันอยู่' : '-';
              return (
                <tr key={i} className="border-b border-dashed last:border-0">
                  <td className="py-1 text-muted-foreground">
                    {formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale: th })}
                  </td>
                  <td className="py-1 text-right">{dur}</td>
                  <td className="py-1 text-right">{r.records_processed}</td>
                  <td className={`py-1 text-right ${r.errors > 0 ? 'text-destructive font-medium' : ''}`}>{r.errors}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ล้าง History?</AlertDialogTitle>
            <AlertDialogDescription>ประวัติการรันทั้งหมดของ job นี้จะถูกลบถาวร</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onClear(); setConfirmClear(false); }}>
              ล้าง History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Job Form Dialog ───────────────────────────────────────────────────────────

function JobFormDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ReturnType<typeof emptyForm> | null;
  onSave: (data: ReturnType<typeof emptyForm>) => void;
}) {
  const isEdit = !!initial?.key;
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(initial ?? emptyForm());

  // Reset when dialog opens
  const handleOpen = (v: boolean) => {
    if (v) setForm(initial ?? emptyForm());
    onOpenChange(v);
  };

  const set = (k: keyof ReturnType<typeof emptyForm>, v: string) =>
    setForm(p => ({ ...p, [k]: v }));

  const valid =
    form.key.match(/^[a-z0-9-]+$/) &&
    form.name.trim() &&
    (form.type === 'http' ? form.endpoint.trim() : form.file_path.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'แก้ไข Cron Job' : 'เพิ่ม Cron Job'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Key <span className="text-destructive">*</span></Label>
              <Input value={form.key} onChange={e => set('key', e.target.value)}
                placeholder="my-job" disabled={isEdit} className="font-mono text-sm" />
              <p className="text-[10px] text-muted-foreground">[a-z0-9-] เท่านั้น</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ชื่อ <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Job" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">คำอธิบาย</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="ทำอะไร ทำทำไม..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ความถี่ (display เท่านั้น)</Label>
            <Input value={form.interval_label} onChange={e => set('interval_label', e.target.value)}
              placeholder="เช่น ทุก 1 นาที" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ประเภท</Label>
            <Select value={form.type} onValueChange={v => set('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP (curl ไปยัง endpoint)</SelectItem>
                <SelectItem value="include">Include (PHP include file)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.type === 'http' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Endpoint <span className="text-destructive">*</span></Label>
                <Input value={form.endpoint} onChange={e => set('endpoint', e.target.value)}
                  placeholder="my-job.php" className="font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Method</Label>
                <Select value={form.http_method} onValueChange={v => set('http_method', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {form.type === 'include' && (
            <div className="space-y-1">
              <Label className="text-xs">File Path <span className="text-destructive">*</span></Label>
              <Input value={form.file_path} onChange={e => set('file_path', e.target.value)}
                placeholder="api/cron/my-script.php" className="font-mono text-sm" />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Query String (optional)</Label>
            <Input value={form.query_string} onChange={e => set('query_string', e.target.value)}
              placeholder="trigger=1&mode=test" className="font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button disabled={!valid} onClick={() => { onSave(form); onOpenChange(false); }}>
            {isEdit ? 'บันทึก' : 'เพิ่ม Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function CronJobsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [running, setRunning]       = useState<Record<string, boolean>>({});
  const [results, setResults]       = useState<Record<string, RunResult>>({});
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen]     = useState(false);
  const [editTarget, setEditTarget] = useState<CronJob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CronJob | null>(null);
  const [disabledRunConfirm, setDisabledRunConfirm] = useState<CronJob | null>(null);

  const { data: jobs = [], isFetching, refetch } = useQuery<CronJob[]>({
    queryKey: ['cron-jobs'],
    queryFn: () => apiFetch('/cron-manager.php'),
    refetchInterval: 15_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cron-jobs'] });

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch('/cron-manager.php?action=create', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); toast({ title: 'เพิ่ม Job สำเร็จ' }); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ key, body }: { key: string; body: object }) =>
      apiFetch(`/cron-manager.php?action=update&job=${key}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); toast({ title: 'บันทึกสำเร็จ' }); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (key: string) => apiFetch(`/cron-manager.php?action=delete&job=${key}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast({ title: 'ลบ Job สำเร็จ' }); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const clearHistoryMut = useMutation({
    mutationFn: (key: string) => apiFetch(`/cron-manager.php?action=clear-history&job=${key}`, { method: 'DELETE' }),
    onSuccess: (_, key) => {
      qc.invalidateQueries({ queryKey: ['cron-history', key] });
      invalidate();
      toast({ title: 'ล้าง History สำเร็จ' });
    },
  });

  const doRun = async (job: CronJob) => {
    setRunning(p => ({ ...p, [job.key]: true }));
    try {
      const res = await apiFetch<RunResult>(`/cron-manager.php?action=run&job=${job.key}`, { method: 'POST' });
      setResults(p => ({ ...p, [job.key]: res }));
      setExpanded(p => ({ ...p, [job.key]: true }));
      toast({
        title: res.success ? `รัน ${job.name} สำเร็จ` : `รัน ${job.name} มีข้อผิดพลาด`,
        description: `ประมวลผล ${res.processed} รายการ, errors ${res.errors}`,
        variant: res.success ? 'default' : 'destructive',
      });
      invalidate();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setRunning(p => ({ ...p, [job.key]: false }));
    }
  };

  const handleRunClick = (job: CronJob) => {
    if (!job.enabled) { setDisabledRunConfirm(job); return; }
    doRun(job);
  };

  const handleSave = (form: ReturnType<typeof emptyForm>) => {
    if (editTarget) {
      updateMut.mutate({ key: editTarget.key, body: form });
    } else {
      createMut.mutate(form);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Cron Jobs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">จัดการ background jobs — รัน trigger ด้วยตนเอง หรือตรวจสอบสถานะ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />เพิ่ม Job
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      {/* Job cards */}
      <div className="grid gap-3">
        {jobs.map((job) => {
          const isRunning  = running[job.key] || job.state === 'running';
          const isStuck    = job.state === 'stuck';
          const result     = results[job.key];
          const isExpanded = expanded[job.key];
          const historyOpen = showHistory[job.key];
          const runBlocked = isRunning && !isStuck;

          return (
            <div key={job.key} className={`rounded-lg border bg-card p-4 space-y-3 ${!job.enabled ? 'opacity-60' : ''}`}>
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{job.name}</span>
                    <StatusBadge job={job} />
                    {!job.enabled && <Badge variant="secondary" className="text-[10px]">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{job.description}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">{job.key}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={!!job.enabled}
                    onCheckedChange={v => updateMut.mutate({ key: job.key, body: { enabled: v ? 1 : 0 } })}
                    title={job.enabled ? 'ปิด job' : 'เปิด job'}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { setEditTarget(job); setFormOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(job)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" className="gap-1.5 ml-1" onClick={() => handleRunClick(job)} disabled={runBlocked}>
                    {running[job.key]
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Play className="h-3.5 w-3.5" />}
                    {running[job.key] ? 'กำลังรัน...' : 'Run Now'}
                  </Button>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                {job.interval_label && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="text-foreground font-medium">{job.interval_label}</span>
                  </span>
                )}
                {job.last_started_at && (
                  <span>รันล่าสุด: <span className="text-foreground">
                    {formatDistanceToNow(new Date(job.last_started_at), { addSuffix: true, locale: th })}
                  </span></span>
                )}
                {job.last_processed !== null && (
                  <span>ประมวลผล: <span className="text-foreground font-medium">{job.last_processed}</span> รายการ</span>
                )}
                {(job.last_errors ?? 0) > 0 && (
                  <span className="text-destructive">errors: <span className="font-medium">{job.last_errors}</span></span>
                )}
              </div>

              {/* History toggle */}
              <div className="flex items-center gap-3">
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowHistory(p => ({ ...p, [job.key]: !historyOpen }))}>
                  {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  ดู History
                </button>
              </div>

              {historyOpen && (
                <HistoryPanel
                  jobKey={job.key}
                  onClear={() => clearHistoryMut.mutate(job.key)}
                />
              )}

              {/* Run output */}
              {result && (
                <div className="space-y-1.5">
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded(p => ({ ...p, [job.key]: !isExpanded }))}>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Output ล่าสุด
                  </button>
                  {isExpanded && (
                    <pre className={`text-[11px] p-3 rounded-md font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto
                      ${result.success
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200'}`}>
                      {result.output || '(ไม่มี output)'}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {jobs.length === 0 && !isFetching && (
        <p className="text-sm text-muted-foreground text-center py-8">ไม่พบข้อมูล</p>
      )}

      {/* Add / Edit dialog */}
      <JobFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editTarget ? {
          key: editTarget.key,
          name: editTarget.name,
          description: editTarget.description ?? '',
          interval_label: editTarget.interval_label ?? '',
          type: editTarget.type,
          endpoint: editTarget.endpoint ?? '',
          file_path: editTarget.file_path ?? '',
          http_method: editTarget.http_method,
          query_string: editTarget.query_string ?? '',
        } : null}
        onSave={handleSave}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Job "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบจะไม่สามารถกู้คืนได้ และจะลบประวัติการรันทั้งหมดของ job นี้ด้วย
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteMut.mutate(deleteTarget!.key); setDeleteTarget(null); }}>
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Run while disabled confirm */}
      <AlertDialog open={!!disabledRunConfirm} onOpenChange={v => !v && setDisabledRunConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Job นี้ถูกปิดอยู่</AlertDialogTitle>
            <AlertDialogDescription>
              "{disabledRunConfirm?.name}" ถูก disable อยู่ ต้องการรันครั้งเดียวโดยไม่เปิด job ไหม?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              doRun(disabledRunConfirm!);
              setDisabledRunConfirm(null);
            }}>
              รันครั้งเดียว
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 2: Build เพื่อตรวจ TypeScript**

```bash
pnpm build 2>&1 | grep -E "error|Error|✓ built"
```

Expected: `✓ built in Xs`

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/CronJobsPanel.tsx
git commit -m "feat(ui): rewrite CronJobsPanel with full CRUD, history, enable/disable, run conditions"
```

---

### Task 4: Integration test ด้วยมือ

- [ ] **Step 1: เปิด http://localhost:8080/#/admin → tab Cron Jobs**

ตรวจสอบ:
- เห็น 4 job cards พร้อม StatusBadge
- แต่ละ card มี Switch, Edit, Delete, Run Now

- [ ] **Step 2: ทดสอบ Edit**

คลิกปุ่ม Edit บน "Content Publish Scheduler" → แก้ description → Save
Expected: card อัพเดตโดยไม่ reload หน้า

- [ ] **Step 3: ทดสอบ Add + Delete**

คลิก "+ เพิ่ม Job" → กรอก key=`test-job`, name=`Test`, type=http, endpoint=`test.php` → เพิ่ม
Expected: card ใหม่ปรากฏ

คลิก Delete บน test-job → confirm
Expected: card หายไป

- [ ] **Step 4: ทดสอบ Run Now + History**

คลิก Run Now บน "Publish Queue Processor"
Expected: toast "สำเร็จ" + output panel แสดง

คลิก "ดู History" บน job ที่เพิ่งรัน
Expected: ตาราง 1 แถว

- [ ] **Step 5: ทดสอบ Enable/Disable + run while disabled**

Toggle Switch บน job ใดก็ได้ → disable
Expected: card opacity ลด, badge "Disabled" ปรากฏ

คลิก Run Now ขณะ disabled
Expected: AlertDialog confirm ก่อนรัน

- [ ] **Step 6: Final commit**

```bash
git add -A
git status
# ตรวจว่าไม่มีไฟล์ที่ไม่ควร stage
git commit -m "chore: verify cron jobs CRUD integration complete"
```
