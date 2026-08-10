<?php
// GET  /api/backup.php          — Download a full SQL dump
// POST /api/backup.php?action=restore — Upload + execute a .sql restore file
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$db = getDB();
requireAdmin($db, $tokenData['user_id'], $tokenData['tenant_id']);

$method = getMethod();
$action = $_GET['action'] ?? '';

// ── POST restore ──────────────────────────────────────────────────────────────
if ($method === 'POST' && $action === 'restore') {
    if (empty($_FILES['sql_file'])) {
        jsonError('ไม่พบไฟล์ที่อัปโหลด', 400);
    }
    $file = $_FILES['sql_file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        jsonError('อัปโหลดไม่สำเร็จ: error code ' . $file['error'], 400);
    }
    // Verify it's a .sql file
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if ($ext !== 'sql') {
        jsonError('รองรับเฉพาะไฟล์ .sql เท่านั้น', 422);
    }

    $sqlContent = file_get_contents($file['tmp_name']);
    if ($sqlContent === false || strlen($sqlContent) < 10) {
        jsonError('ไฟล์ว่างเปล่าหรืออ่านไม่ได้', 422);
    }

    $host   = defined('DB_HOST') ? DB_HOST : 'localhost';
    $dbName = defined('DB_NAME') ? DB_NAME : 'flowstack';
    $user   = defined('DB_USER') ? DB_USER : 'root';
    $pass   = defined('DB_PASS') ? DB_PASS : '';

    // Try mysql CLI first (handles multi-statement .sql files perfectly)
    $mysqlBin = '';
    foreach (['mysql', '/usr/bin/mysql', 'C:/xampp/mysql/bin/mysql.exe'] as $bin) {
        if (@is_executable($bin) || (stripos(PHP_OS, 'WIN') !== false && file_exists($bin))) {
            $mysqlBin = $bin;
            break;
        }
    }

    if ($mysqlBin) {
        $tmpFile = tempnam(sys_get_temp_dir(), 'fsrestore_');
        file_put_contents($tmpFile, $sqlContent);
        $cnfFile = tempnam(sys_get_temp_dir(), 'fscnf_');
        file_put_contents($cnfFile, "[client]\npassword=" . str_replace('"', '\\"', $pass) . "\n");
        chmod($cnfFile, 0600);

        $cmd    = sprintf('%s --defaults-extra-file=%s --host=%s --user=%s %s < %s 2>&1',
            escapeshellcmd($mysqlBin),
            escapeshellarg($cnfFile),
            escapeshellarg($host),
            escapeshellarg($user),
            escapeshellarg($dbName),
            escapeshellarg($tmpFile)
        );
        $output = shell_exec($cmd);
        @unlink($tmpFile);
        @unlink($cnfFile);

        if ($output && trim($output) !== '') {
            jsonError('Restore มีข้อผิดพลาด: ' . trim($output), 500);
        }
        jsonResponse(['success' => true, 'method' => 'mysql-cli']);
    }

    // Fallback: execute via PDO (limited — no multi-statement in all drivers)
    try {
        $db->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);
        $statements = array_filter(
            array_map('trim', preg_split('/;\s*\n/', $sqlContent)),
            fn($s) => $s !== '' && !str_starts_with($s, '--')
        );
        $db->beginTransaction();
        $db->exec('SET FOREIGN_KEY_CHECKS=0');
        foreach ($statements as $sql) {
            if (trim($sql) !== '') $db->exec($sql);
        }
        $db->exec('SET FOREIGN_KEY_CHECKS=1');
        $db->commit();
        jsonResponse(['success' => true, 'method' => 'pdo-fallback', 'statements' => count($statements)]);
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        jsonError('Restore ล้มเหลว: ' . $e->getMessage(), 500);
    }
}

if ($method !== 'GET') {
    jsonError('Method not allowed', 405);
}

// Pull DB credentials from config
$host   = defined('DB_HOST') ? DB_HOST : 'localhost';
$dbName = defined('DB_NAME') ? DB_NAME : 'flowstack';
$user   = defined('DB_USER') ? DB_USER : 'root';
$pass   = defined('DB_PASS') ? DB_PASS : '';

// ------------------------------------------------------------------
// Try mysqldump first (fastest, handles all edge-cases)
// ------------------------------------------------------------------
$mysqldumpBin = '';
foreach (['mysqldump', '/usr/bin/mysqldump', 'C:/xampp/mysql/bin/mysqldump.exe'] as $bin) {
    if (@is_executable($bin) || (stripos(PHP_OS, 'WIN') !== false && file_exists($bin))) {
        $mysqldumpBin = $bin;
        break;
    }
}

$filename = 'flowstack_backup_' . date('Ymd_His') . '.sql';

if ($mysqldumpBin) {
    // Write a temporary defaults file so the password is never visible in the process list.
    $tmpFile = tempnam(sys_get_temp_dir(), 'fsdb_');
    file_put_contents($tmpFile, "[client]\npassword=" . str_replace('"', '\\"', $pass) . "\n");
    chmod($tmpFile, 0600);

    $cmd = sprintf(
        '%s --defaults-extra-file=%s --host=%s --user=%s --single-transaction --routines --triggers %s',
        escapeshellcmd($mysqldumpBin),
        escapeshellarg($tmpFile),
        escapeshellarg($host),
        escapeshellarg($user),
        escapeshellarg($dbName)
    );

    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-cache');
    passthru($cmd);
    @unlink($tmpFile);
    exit;
}

// ------------------------------------------------------------------
// Fallback: pure-PHP SQL export
// ------------------------------------------------------------------
ob_start();
echo "-- Flowstack Database Backup\n";
echo "-- Generated: " . date('Y-m-d H:i:s') . "\n";
echo "-- Database: $dbName\n\n";
echo "SET FOREIGN_KEY_CHECKS=0;\n\n";

// Get all tables
$tables = $db->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_COLUMN);

foreach ($tables as $table) {
    // Validate table name is safe (only allow alphanumeric + underscore)
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) continue;

    // DROP + CREATE
    $createRow = $db->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_ASSOC);
    $createSql = array_values($createRow)[1]; // second column
    echo "DROP TABLE IF EXISTS `$table`;\n";
    echo $createSql . ";\n\n";

    // Rows — paginate 500 rows at a time to avoid OOM on large tables
    $offset   = 0;
    $pageSize = 500;
    $cols     = null;
    do {
        $rows = $db->query("SELECT * FROM `$table` LIMIT $pageSize OFFSET $offset")->fetchAll(PDO::FETCH_ASSOC);
        if (empty($rows)) break;
        if ($cols === null) {
            $cols = '`' . implode('`, `', array_keys($rows[0])) . '`';
        }
        echo "INSERT INTO `$table` ($cols) VALUES\n";
        $valParts = [];
        foreach ($rows as $row) {
            $vals = array_map(function ($v) use ($db) {
                if ($v === null) return 'NULL';
                return $db->quote((string)$v);
            }, array_values($row));
            $valParts[] = '(' . implode(', ', $vals) . ')';
        }
        echo implode(",\n", $valParts) . ";\n";
        $offset += $pageSize;
    } while (count($rows) === $pageSize);
    echo "\n";
}

echo "SET FOREIGN_KEY_CHECKS=1;\n";

$sql = ob_get_clean();

header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . strlen($sql));
header('Cache-Control: no-cache');
echo $sql;
exit;
