<?php
// api/cron-manager.php
// GET                                   — list jobs + last run
// GET  ?action=history&job=<key>        — 10 last runs for a job
// POST ?action=run&job=<key>            — run job manually
// POST ?action=create                   — create new job
// PUT  ?action=update&job=<key>         — update job fields
// DELETE ?action=delete&job=<key>       — delete job
// DELETE ?action=clear-history&job=<key> — clear cron_runs for job

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/lib/cron-runner.php';   // runJob(), cron_secret(), cron_expr_*(), CRON_STUCK_SECONDS
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
    if ($job['last_started_at'] && !$job['last_finished_at']) {
        if ($job['last_cancel_requested']) return 'cancelling';
        // อายุงานมาจาก TIMESTAMPDIFF ฝั่ง SQL ไม่ใช่ time() ของ PHP — started_at เขียน
        // ด้วย NOW() ของ MySQL ซึ่งต่างเขตเวลากับ PHP (ดูหัวข้อ "นาฬิกา" ใน cron-runner.php)
        // ถ้าเทียบด้วย time() ผลจะติดลบเสมอ → หน้านี้จะไม่เคยแสดง 'stuck' เลย
        $age = $job['last_age_seconds'];
        if ($age === null) return 'running';
        // ใช้เพดานเดียวกับตัวเลือกงานใน tick.php — ถ้าใช้ค่าต่างกัน หน้านี้จะบอกว่า
        // "running" ขณะที่ tick ปิดแถวค้างแล้วยิงงานใหม่ไปแล้ว
        if ($age < CRON_STUCK_SECONDS) return 'running';
        return 'stuck';
    }
    return ($job['last_errors'] ?? 0) > 0 ? 'error' : ($job['last_started_at'] ? 'ok' : 'never');
}

function mergeLastRun(PDO $db, array $jobs): array {
    if (empty($jobs)) return [];
    $stmt = $db->query(
        "SELECT job_name, started_at, finished_at, cancel_requested, records_processed, errors, notes,
                TIMESTAMPDIFF(SECOND, started_at, NOW()) AS age_seconds
         FROM cron_runs
         WHERE id IN (SELECT MAX(id) FROM cron_runs GROUP BY job_name)"
    );
    $last = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $last[$r['job_name']] = $r;
    }
    return array_map(function ($j) use ($last) {
        $r = $last[$j['key']] ?? null;
        $j['last_started_at']        = $r['started_at']          ?? null;
        $j['last_finished_at']       = $r['finished_at']         ?? null;
        $j['last_cancel_requested']  = $r ? (int)$r['cancel_requested'] : 0;
        $j['last_processed']         = $r ? (int)$r['records_processed'] : null;
        $j['last_errors']            = $r ? (int)$r['errors']    : null;
        $j['last_notes']             = $r['notes']               ?? null;
        $j['last_age_seconds']       = ($r && $r['age_seconds'] !== null) ? (int)$r['age_seconds'] : null;
        $j['state']                  = jobState($j);

        // "เลยกำหนด" แยกจาก state โดยเจตนา — state บอกผลของ "การรันครั้งล่าสุด"
        // ส่วนนี่บอกว่า "ยังถูกเรียกตามเวลาอยู่หรือไม่" งานหนึ่งเป็น ok ได้พร้อมกับ
        // ที่ไม่ถูกเรียกมา 3 วันแล้ว (ตัวตั้งเวลาไม่ทำงาน) ถ้ารวมเป็นค่าเดียวจะกลบกัน
        // ค่าบวก = เลยกำหนดมาแล้วกี่วินาที, ค่าลบ = อีกกี่วินาทีจะถึงกำหนด
        $overdue = $j['next_run_overdue_seconds'];
        $j['next_run_overdue_seconds'] = $overdue === null ? null : (int)$overdue;
        $j['is_overdue'] = (int)(
            !empty($j['enabled'])
            && $j['next_run_overdue_seconds'] !== null
            && $j['next_run_overdue_seconds'] > CRON_OVERDUE_SECONDS
        );
        return $j;
    }, $jobs);
}

// runJob() ย้ายไป api/lib/cron-runner.php แล้ว — ใช้ร่วมกับ api/cron/tick.php
// ไฟล์นี้จึงไม่มี include ไฟล์งาน และไม่มี curl_init ไปยัง endpoint งานอีก

// ── GET ────────────────────────────────────────────────────────────────────────

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
    // next_run_overdue_seconds คำนวณฝั่ง SQL ด้วยนาฬิกาฐานข้อมูลตัวเดียวกับที่เขียน
    // next_run_at (D10) — ถ้าให้เบราว์เซอร์เทียบเอง ผลจะเพี้ยนตามเขตเวลาเครื่องผู้ใช้
    $jobs = $db->query(
        "SELECT *, TIMESTAMPDIFF(SECOND, next_run_at, NOW()) AS next_run_overdue_seconds
         FROM cron_jobs ORDER BY created_at ASC"
    )->fetchAll(PDO::FETCH_ASSOC);
    jsonResponse(mergeLastRun($db, $jobs));
}

// ── POST ───────────────────────────────────────────────────────────────────────

if ($method === 'POST') {
    if ($action === 'run') {
        if (!$jobKey) jsonError('job param required', 400);
        $def = fetchJob($db, $jobKey);
        if (!$def) jsonError('Unknown job: ' . $jobKey, 404);
        jsonResponse(runJob($db, $def));
    }

    if ($action === 'stop') {
        if (!$jobKey) jsonError('job param required', 400);
        $def = fetchJob($db, $jobKey);
        // For include-type: set cancel flag for cooperative stop, then force-close
        // For http-type: force-close immediately (can't signal another process)
        if ($def && $def['type'] === 'include') {
            $db->prepare(
                "UPDATE cron_runs SET cancel_requested = 1
                 WHERE job_name = ? AND finished_at IS NULL"
            )->execute([$jobKey]);
        }
        // Always force-close to clear the stuck/cancelling state
        $stmt = $db->prepare(
            "UPDATE cron_runs SET finished_at = NOW(), errors = 1,
              notes = 'Force-stopped by admin'
             WHERE job_name = ? AND finished_at IS NULL"
        );
        $stmt->execute([$jobKey]);
        jsonResponse(['stopped' => $stmt->rowCount()]);
    }

    if ($action === 'create') {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $key  = trim($body['key'] ?? '');
        if (!preg_match('/^[a-z0-9-]+$/', $key)) jsonError('key must be [a-z0-9-]+', 422);
        if (empty($body['name']))                 jsonError('name is required', 422);
        // cron_expression เป็นตารางเวลาที่ tick.php ใช้จริง — ถ้าไม่มีหรือใช้ไม่ได้
        // งานจะถูกสร้างแล้วไม่เคยถูกเรียก ต้องปฏิเสธตรงนี้ ไม่ปล่อยผ่านเงียบ ๆ
        $expr = trim($body['cron_expression'] ?? '');
        if ($expr === '')                       jsonError('ต้องระบุตารางเวลา (cron_expression) เช่น "*/15 * * * *"', 422);
        if (!cron_expr_validate($expr))         jsonError('ตารางเวลาไม่ถูกต้อง: "' . $expr . '" — ต้องเป็น 5 ช่อง และใช้ได้เฉพาะ *, ตัวเลข, */N, A-B, A,B,C', 422);
        if (($body['type'] ?? 'http') === 'http'    && empty($body['endpoint']))  jsonError('endpoint required for http type', 422);
        if (($body['type'] ?? 'http') === 'include' && empty($body['file_path'])) jsonError('file_path required for include type', 422);
        if (fetchJob($db, $key)) jsonError('key already exists', 409);

        $id = generateUUID();
        // next_run_at ปล่อย NULL — tick รอบถัดไปจะ initialize ให้เอง ไม่รันทันทีที่สร้าง (D2)
        $db->prepare(
            "INSERT INTO cron_jobs (id, `key`, name, description, interval_label, cron_expression, type, endpoint, file_path, http_method, query_string, enabled)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,1)"
        )->execute([
            $id, $key,
            $body['name'],
            $body['description']    ?? null,
            $body['interval_label'] ?? null,
            $expr,
            $body['type']           ?? 'http',
            $body['endpoint']       ?? null,
            $body['file_path']      ?? null,
            $body['http_method']    ?? 'GET',
            $body['query_string']   ?? null,
        ]);
        jsonResponse(fetchJob($db, $key), 201);
    }

    jsonError('Unknown action', 400);
}

// ── PUT ────────────────────────────────────────────────────────────────────────

if ($method === 'PUT') {
    if (!$jobKey) jsonError('job param required', 400);
    $existing = fetchJob($db, $jobKey);
    if (!$existing) jsonError('Job not found', 404);

    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $fields   = [];
    $params   = [];
    $allowed  = ['name','description','interval_label','cron_expression','type','endpoint','file_path','http_method','query_string','enabled'];

    // validate ตารางเวลาก่อนแตะ UPDATE เลย — ถ้าผิดต้องตอบ 422 โดยค่าเดิมไม่เปลี่ยน
    $newExpr = null;
    if (array_key_exists('cron_expression', $body)) {
        $newExpr = trim((string)$body['cron_expression']);
        if ($newExpr === '')             jsonError('ต้องระบุตารางเวลา (cron_expression) เช่น "*/15 * * * *"', 422);
        if (!cron_expr_validate($newExpr)) jsonError('ตารางเวลาไม่ถูกต้อง: "' . $newExpr . '" — ต้องเป็น 5 ช่อง และใช้ได้เฉพาะ *, ตัวเลข, */N, A-B, A,B,C', 422);
        $body['cron_expression'] = $newExpr;
    }

    foreach ($allowed as $f) {
        if (array_key_exists($f, $body)) {
            $fields[] = "`$f` = ?";
            $params[]  = $body[$f];
        }
    }
    if (empty($fields)) jsonError('Nothing to update', 400);

    // ตารางเวลาเปลี่ยน → next_run_at เดิมใช้ไม่ได้แล้ว ต้องคำนวณใหม่ในรอบเดียวกับ UPDATE
    // ไม่ปล่อยเป็น NULL เพราะจะทำให้ tick เสียไปหนึ่งรอบเพื่อ initialize ใหม่
    // เวลา "เดี๋ยวนี้" มาจากนาฬิกาฐานข้อมูล ไม่ใช่ time() ของ PHP (ดู D10)
    if ($newExpr !== null && $newExpr !== ($existing['cron_expression'] ?? null)) {
        $next = cron_next_run($newExpr, cron_now($db), cron_timezone($db));
        $fields[] = '`next_run_at` = ?';
        $params[]  = $next;   // null ได้ ถ้าหา match ไม่เจอในเพดาน → tick จะรายงานเป็น error ของงานนั้น
    }

    $params[] = $jobKey;
    $db->prepare("UPDATE cron_jobs SET " . implode(', ', $fields) . " WHERE `key` = ?")->execute($params);
    jsonResponse(fetchJob($db, $jobKey));
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

if ($method === 'DELETE') {
    if (!$jobKey) jsonError('job param required', 400);

    if ($action === 'clear-history') {
        $stmt = $db->prepare("DELETE FROM cron_runs WHERE job_name = ?");
        $stmt->execute([$jobKey]);
        jsonResponse(['deleted' => $stmt->rowCount()]);
    }

    if (!fetchJob($db, $jobKey)) jsonError('Job not found', 404);
    $db->prepare("DELETE FROM cron_jobs WHERE `key` = ?")->execute([$jobKey]);
    $db->prepare("DELETE FROM cron_runs  WHERE job_name = ?")->execute([$jobKey]);
    jsonResponse(['success' => true]);
}

jsonError('Method not allowed', 405);
