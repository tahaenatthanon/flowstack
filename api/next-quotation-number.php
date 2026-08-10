<?php
// GET /api/next-quotation-number.php
// Returns the next suggested quotation number based on settings format
// Does NOT increment — just peeks at the next number
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$db = getDB();
$tenantId = $tokenData['tenant_id'];
$method = getMethod();

if ($method !== 'GET') {
    jsonError('Method not allowed', 405);
}

// Read settings
$stmt = $db->prepare('SELECT quotation_prefix, quotation_number_format FROM company_settings WHERE tenant_id = ?');
$stmt->execute([$tenantId]);
$settings = $stmt->fetch();

$prefix = $settings['quotation_prefix'] ?? 'QT-';
$format = $settings['quotation_number_format'] ?? '{PREFIX}{YYYY}{MM}-{NNNN}';

// Determine period_key from format
$now = new DateTime();
$periodKey = 'global';

if (strpos($format, '{MM}') !== false) {
    // Monthly reset
    $periodKey = $now->format('Ym');
} elseif (strpos($format, '{YYYY}') !== false || strpos($format, '{YY}') !== false) {
    // Yearly reset
    $periodKey = $now->format('Y');
}

// Get last number for global sequence (scoped by tenant)
$stmt = $db->prepare('SELECT last_number FROM quotation_sequences WHERE period_key = ? AND tenant_id = ?');
$stmt->execute(['global', $tenantId]);
$row = $stmt->fetch();
$lastNumber = $row ? (int)$row['last_number'] : 0;
$nextNumber = $lastNumber + 1;

// Determine digit count from format (count consecutive N's)
$digitCount = 4; // default
if (preg_match('/\{(N+)\}/', $format, $matches)) {
    $digitCount = strlen($matches[1]);
}

// Build the formatted number
$result = $format;
$result = str_replace('{PREFIX}', $prefix, $result);
$result = str_replace('{YYYY}', $now->format('Y'), $result);
$result = str_replace('{YY}', $now->format('y'), $result);
$result = str_replace('{MM}', $now->format('m'), $result);
$result = str_replace('{DD}', $now->format('d'), $result);

// Replace {NNN...} with padded number
$result = preg_replace('/\{N+\}/', str_pad($nextNumber, $digitCount, '0', STR_PAD_LEFT), $result);

jsonResponse([
    'next_number' => $result,
    'period_key' => 'global',
    'sequence' => $nextNumber,
    'format' => $format,
]);
