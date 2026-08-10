<?php
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/seed-defaults.php';

if (getMethod() !== 'POST') jsonError('Method not allowed', 405);

$body        = getRequestBody();
$email       = trim($body['email']        ?? '');
$password    = $body['password']           ?? '';
$displayName = trim($body['display_name'] ?? '');
$companyName = trim($body['company_name'] ?? $displayName);

if (empty($email) || empty($password)) jsonError('กรุณากรอกอีเมลและรหัสผ่าน');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('รูปแบบอีเมลไม่ถูกต้อง');
if (strlen($password) < 6) jsonError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');

$db = getDB();

$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) jsonError('อีเมลนี้ถูกใช้งานแล้ว');

$aliasCheck = $db->prepare('SELECT id FROM user_email_aliases WHERE alias_email = ?');
$aliasCheck->execute([strtolower($email)]);
if ($aliasCheck->fetch()) jsonError('อีเมลนี้ถูกใช้เป็น Alias อยู่แล้ว');

$userId       = generateUUID();
$tenantId     = generateUUID();
$passwordHash = password_hash($password, PASSWORD_DEFAULT);

$tenantSlug = preg_replace('/[^a-z0-9]+/', '-', strtolower($companyName ?: explode('@', $email)[0]));
$tenantSlug = trim($tenantSlug, '-') ?: 'tenant';
$tenantSlug = $tenantSlug . '-' . substr($tenantId, 0, 8);

$db->beginTransaction();
try {
    $db->prepare('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)')
       ->execute([$userId, $email, $passwordHash, $displayName]);

    $db->prepare('INSERT INTO tenants (id, name, slug, plan, status) VALUES (?, ?, ?, ?, ?)')
       ->execute([$tenantId, $companyName ?: ($displayName ?: $email), $tenantSlug, 'trial', 'active']);

    $db->prepare('INSERT INTO tenant_users (tenant_id, user_id, is_admin) VALUES (?, ?, 1)')
       ->execute([$tenantId, $userId]);

    $db->prepare("
        INSERT INTO subscriptions (id, tenant_id, plan, started_at, expires_at, status)
        VALUES (UUID(), ?, 'trial', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'active')
    ")->execute([$tenantId]);

    seedTenantDefaults($db, $tenantId, $companyName ?: ($displayName ?: $email));

    $db->commit();
} catch (Exception $e) {
    $db->rollBack();
    error_log('signup error: ' . $e->getMessage());
    jsonError('ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่', 500);
}

$token = generateToken($userId, $email, $tenantId);
jsonResponse([
    'token' => $token,
    'user'  => [
        'id'           => $userId,
        'email'        => $email,
        'display_name' => $displayName,
        'position'     => '',
        'avatar_url'   => '',
        'is_admin'     => 1,
        'tenant_id'    => $tenantId,
        'permissions'  => ALL_MENU_KEYS,
    ],
]);
