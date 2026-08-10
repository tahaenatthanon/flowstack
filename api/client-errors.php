<?php
// POST /api/client-errors.php — receive frontend crash reports from ErrorBoundary
// No auth required (the crash may happen before auth state loads).
// Rate-limited to 10 requests per IP per minute to prevent log flooding.

require_once __DIR__ . '/config.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$ip        = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';

// Simple IP-based rate limit via rate_limits table (reuse existing table)
try {
    $db = getDB();
    $limitKey = 'client_errors:' . $ip;
    $db->prepare("DELETE FROM rate_limits WHERE `key` = ? AND window_end < NOW()")->execute([$limitKey]);
    $db->prepare("
        INSERT INTO rate_limits (`key`, attempts, window_end)
        VALUES (?, 1, DATE_ADD(NOW(), INTERVAL 60 SECOND))
        ON DUPLICATE KEY UPDATE attempts = attempts + 1
    ")->execute([$limitKey]);
    $countStmt = $db->prepare("SELECT attempts FROM rate_limits WHERE `key` = ?");
    $countStmt->execute([$limitKey]);
    $row = (int)($countStmt->fetchColumn() ?: 0);
    if ($row > 10) {
        jsonError('Too many requests', 429);
    }
} catch (Throwable $e) {
    // If rate_limits table missing, allow through — non-critical
}

$body = getRequestBody();

// Try to get user context from JWT if present (best-effort, non-blocking)
$userId   = null;
$tenantId = null;
try {
    $tokenData = validateToken();
    $userId    = $tokenData['user_id']   ?? null;
    $tenantId  = $tokenData['tenant_id'] ?? null;
} catch (Throwable $e) {}

$section        = mb_substr(trim($body['section']        ?? 'unknown'), 0, 100);
$message        = mb_substr(trim($body['message']        ?? ''),        0, 2000);
$stack          = mb_substr(trim($body['stack']          ?? ''),        0, 2000);
$componentStack = mb_substr(trim($body['component_stack'] ?? ''),       0, 2000);

if (empty($message)) {
    jsonError('message required', 400);
}

try {
    $db = getDB();

    // Purge entries older than 30 days on each write (cheap maintenance)
    $db->exec("DELETE FROM client_errors WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");

    $db->prepare("
        INSERT INTO client_errors (section, message, stack, component_stack, user_id, tenant_id, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([$section, $message, $stack ?: null, $componentStack ?: null, $userId, $tenantId, $userAgent, $ip]);

    jsonResponse(['ok' => true]);
} catch (Throwable $e) {
    error_log('[client-errors] ' . $e->getMessage());
    jsonError('Failed to record error', 500);
}
