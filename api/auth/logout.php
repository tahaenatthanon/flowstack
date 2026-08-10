<?php
// POST /api/auth/logout.php
// Body: {} (just needs authentication)
require_once __DIR__ . '/../auth.php';

if (getMethod() !== 'POST') {
    jsonError('Method not allowed', 405);
}

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$db = getDB();

// Log user logout activity (ignore if table doesn't exist yet)
try {
    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
    $stmt = $db->prepare('INSERT INTO user_activity_logs (id, user_id, action, description, ip_address, user_agent, created_at) VALUES (UUID(), ?, ?, ?, ?, ?, NOW())');
    $stmt->execute([$userId, 'logout', 'ออกจากระบบ', $ipAddress, $userAgent]);
} catch (Exception $e) {
    // Table doesn't exist yet, ignore
}

// Clear the token (client should remove it as well)
jsonResponse(['logged_out' => true]);
