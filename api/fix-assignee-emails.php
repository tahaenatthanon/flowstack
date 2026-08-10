<?php
// POST /api/fix-assignee-emails.php
// Dry-run:   POST body { "dry_run": true }
// Apply:     POST body { "dry_run": false }
// Admin only — normalizes tasks.assignee from raw email → display_name
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$db = getDB();
requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$body   = getRequestBody();
$dryRun = isset($body['dry_run']) ? (bool)$body['dry_run'] : true;

// ── Build resolution map: stored value → canonical display_name ──────────────
$resolveMap = []; // strtolower(value) → ['display_name' => ..., 'user_id' => ...]

$usersStmt = $db->query('SELECT id, email, display_name FROM users');
foreach ($usersStmt->fetchAll() as $u) {
    $canonical = $u['display_name'] ?: $u['email'];
    $key = strtolower($u['email']);
    $resolveMap[$key] = ['display_name' => $canonical, 'user_id' => $u['id']];

    $nameKey = strtolower($canonical);
    if (!isset($resolveMap[$nameKey])) {
        $resolveMap[$nameKey] = ['display_name' => $canonical, 'user_id' => $u['id']];
    }
}

$aliasStmt = $db->query('
    SELECT a.alias_email, u.id AS user_id, u.display_name, u.email
    FROM user_email_aliases a
    JOIN users u ON u.id = a.user_id
');
foreach ($aliasStmt->fetchAll() as $a) {
    $canonical = $a['display_name'] ?: $a['email'];
    $key = strtolower($a['alias_email']);
    if (!isset($resolveMap[$key])) {
        $resolveMap[$key] = ['display_name' => $canonical, 'user_id' => $a['user_id']];
    }
}

// ── Fetch all distinct non-empty assignee values from tasks ──────────────────
$stmt = $db->query("SELECT DISTINCT assignee FROM tasks WHERE assignee != '' AND assignee IS NOT NULL AND deleted_at IS NULL");
$distinctAssignees = $stmt->fetchAll(PDO::FETCH_COLUMN);

$changes  = [];
$noMatch  = [];

foreach ($distinctAssignees as $raw) {
    $key = strtolower(trim($raw));
    if (isset($resolveMap[$key])) {
        $resolved = $resolveMap[$key]['display_name'];
        if ($resolved !== $raw) {
            // Count tasks affected
            $countStmt = $db->prepare("SELECT COUNT(*) FROM tasks WHERE assignee = ? AND deleted_at IS NULL");
            $countStmt->execute([$raw]);
            $count = (int)$countStmt->fetchColumn();

            $changes[] = [
                'from'  => $raw,
                'to'    => $resolved,
                'count' => $count,
            ];

            if (!$dryRun) {
                $db->prepare("UPDATE tasks SET assignee = ? WHERE assignee = ? AND deleted_at IS NULL")
                   ->execute([$resolved, $raw]);
            }
        }
    } else {
        // Check if it looks like an email that we couldn't resolve
        if (filter_var($raw, FILTER_VALIDATE_EMAIL)) {
            $countStmt = $db->prepare("SELECT COUNT(*) FROM tasks WHERE assignee = ? AND deleted_at IS NULL");
            $countStmt->execute([$raw]);
            $count = (int)$countStmt->fetchColumn();
            $noMatch[] = ['value' => $raw, 'count' => $count];
        }
    }
}

jsonResponse([
    'dry_run'  => $dryRun,
    'changes'  => $changes,
    'no_match' => $noMatch,
    'applied'  => !$dryRun && count($changes) > 0,
]);
