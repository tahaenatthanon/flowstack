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
        $started = strtotime($job['last_started_at']);
        if (time() - $started < 600) return 'running';
        return 'stuck';
    }
    return ($job['last_errors'] ?? 0) > 0 ? 'error' : ($job['last_started_at'] ? 'ok' : 'never');
}

function mergeLastRun(PDO $db, array $jobs): array {
    if (empty($jobs)) return [];
    $stmt = $db->query(
        "SELECT job_name, started_at, finished_at, cancel_requested, records_processed, errors, notes
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
        $j['state']                  = jobState($j);
        return $j;
    }, $jobs);
}

function runJob(PDO $db, array $def): array {
    $cronSecret = getenv('CRON_SECRET') ?: 'flowstack-cron-2026';

    // Close any stuck run first
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
            $GLOBALS['cron_run_id'] = $runId;  // allows job script to check cancel flag
            $file = (strpos($def['file_path'], '/') === 0 || strpos($def['file_path'], ':') === 1)
                ? $def['file_path']
                : __DIR__ . '/../' . $def['file_path'];
            include $file;
            $output  = ob_get_clean() ?: '';
            $success = true;
        } else {
            $q   = $def['query_string'] ?? '';
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
    $jobs = $db->query('SELECT * FROM cron_jobs ORDER BY created_at ASC')
               ->fetchAll(PDO::FETCH_ASSOC);
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
        if (($body['type'] ?? 'http') === 'http'    && empty($body['endpoint']))  jsonError('endpoint required for http type', 422);
        if (($body['type'] ?? 'http') === 'include' && empty($body['file_path'])) jsonError('file_path required for include type', 422);
        if (fetchJob($db, $key)) jsonError('key already exists', 409);

        $id = generateUUID();
        $db->prepare(
            "INSERT INTO cron_jobs (id, `key`, name, description, interval_label, type, endpoint, file_path, http_method, query_string, enabled)
             VALUES (?,?,?,?,?,?,?,?,?,?,1)"
        )->execute([
            $id, $key,
            $body['name'],
            $body['description']    ?? null,
            $body['interval_label'] ?? null,
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
    if (!fetchJob($db, $jobKey)) jsonError('Job not found', 404);

    $body    = json_decode(file_get_contents('php://input'), true) ?? [];
    $fields  = [];
    $params  = [];
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
