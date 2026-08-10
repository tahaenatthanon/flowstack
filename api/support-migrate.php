<?php
// /api/support-migrate.php — trigger / inspect the support.nsf → flowstack migration.
// Admin-only. GET ?action=status returns counts; POST runs the import (idempotent).
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../migration/support_migrate_lib.php';

$tokenData = requireAuth();
$userId   = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db       = getDB();
$method   = getMethod();

requireAdmin($db, $userId, $tenantId);

$action = $_GET['action'] ?? '';

if ($method === 'GET' && ($action === 'status' || $action === '')) {
    $cfg = supportMigrateConfig();
    $out = [
        'configured' => ($cfg['token'] !== '' && $cfg['user'] !== '' && $cfg['pass'] !== ''),
        'db'         => supportMigrateDbCounts($db),
        'source'     => null,
        'reachable'  => false,
        'error'      => null,
    ];
    if ($out['configured']) {
        try {
            $out['source']    = supportMigrateManifest($cfg);
            $out['reachable'] = true;
        } catch (Throwable $e) {
            $out['error'] = $e->getMessage();
        }
    }
    jsonResponse($out);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $cfg = supportMigrateConfig([
        'attachments' => array_key_exists('attachments', $body) ? (bool)$body['attachments'] : null,
        'types'       => $body['types'] ?? null,
        'dry'         => array_key_exists('dry', $body) ? (bool)$body['dry'] : null,
    ]);
    if ($cfg['token'] === '' || $cfg['user'] === '' || $cfg['pass'] === '') {
        jsonError('ยังไม่ได้ตั้งค่าการเชื่อมต่อ Domino (migration/migrate.local.php)', 400);
    }
    // Long-running: fetching ~1,800 docs (+ attachments) can take minutes.
    @set_time_limit(0);
    ignore_user_abort(true);
    try {
        $report = supportMigrateRun($db, $cfg);
        jsonResponse(['ok' => true, 'report' => $report]);
    } catch (Throwable $e) {
        jsonError('Migration ล้มเหลว: ' . $e->getMessage(), 500);
    }
}

jsonError('Method not allowed', 405);
