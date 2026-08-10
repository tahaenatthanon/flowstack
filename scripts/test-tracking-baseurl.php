<?php
/**
 * Regression guard for BUG-0002: getBaseUrl() must resolve to the admin-configured
 * public URL (settings.app_public_url) so email open/click tracking pixels are
 * reachable by recipients' mail clients — NOT the internal host fallback.
 *
 * Requires settings.app_public_url to be configured (Admin > Mail settings).
 * Run:  php scripts/test-tracking-baseurl.php
 * Exit 0 = pass, 1 = regression.
 */
require_once __DIR__ . '/../api/email-utils.php';

// Simulate a send context (CLI/cron) where no usable HTTP host is available.
unset($_SERVER['HTTP_X_FORWARDED_HOST']);
$_SERVER['HTTP_HOST'] = 'localhost';

$base = getBaseUrl();
echo "getBaseUrl() = {$base}\n";

$configured = (getDB()->query("SELECT value FROM settings WHERE `key`='app_public_url' LIMIT 1")->fetchColumn()) ?: '';
if ($configured === '') {
    echo "SKIP: settings.app_public_url is not configured on this environment\n";
    exit(0);
}

$expectedHost = parse_url(rtrim($configured, '/'), PHP_URL_HOST);
if ($expectedHost && strpos($base, $expectedHost) !== false) {
    echo "PASS: tracking base URL resolves to configured public host ({$expectedHost})\n";
    exit(0);
}
echo "FAIL: fell back to unreachable internal host ({$base}); expected host {$expectedHost}\n";
exit(1);
