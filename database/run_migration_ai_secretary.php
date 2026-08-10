<?php
require_once __DIR__ . '/../api/config.php';
$db = getDB();
$sql = file_get_contents(__DIR__ . '/migrations/2026_05_12_000001_create_calendar_and_persona_tables.sql');
$statements = array_filter(array_map('trim', explode(';', $sql)));
$ok = 0;
$errors = [];
foreach ($statements as $s) {
    // Strip leading comment lines, keep actual SQL
    $lines = explode("\n", $s);
    $sqlLines = array_filter($lines, fn($l) => !preg_match('/^\s*(--|#)/', $l));
    $clean = trim(implode("\n", $sqlLines));
    if (!preg_match('/\S/', $clean)) continue;
    try {
        $db->exec($clean);
        $ok++;
    } catch (PDOException $e) {
        $errors[] = ['stmt' => substr($clean, 0, 80), 'error' => $e->getMessage()];
    }
}
header('Content-Type: application/json');
echo json_encode(['ok' => $ok, 'errors' => $errors], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
