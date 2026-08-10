<?php
// DEV ONLY — migration runner. Do not expose in production.
// Usage: http://localhost/flowstack/database/run_migration.php?file=2026_05_15_000004_brand_content_tables.sql
if (getenv('APP_ENV') === 'production') {
    http_response_code(403);
    echo json_encode(['error' => 'Only available in development']);
    exit;
}

$file = $_GET['file'] ?? '';
if (!preg_match('/^[\w\-]+\.sql$/', $file)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file name']);
    exit;
}

$path = __DIR__ . '/migrations/' . $file;
if (!file_exists($path)) {
    http_response_code(404);
    echo json_encode(['error' => "File not found: $file"]);
    exit;
}

require_once __DIR__ . '/../api/config.php';
$db  = getDB();
$sql = file_get_contents($path);

try {
    $db->exec($sql);
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'file' => $file]);
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => $e->getMessage()]);
}
