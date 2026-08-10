<?php
// api/query.php
require_once 'config.php';
require_once 'auth.php'; // Use auth utility

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

// Verify user is logged in
$user = requireAuth();
$tenantId = $user['tenant_id'];

$input = json_decode(file_get_contents('php://input'), true);
$sql = $input['sql'] ?? '';

if (empty($sql)) {
    http_response_code(400);
    echo json_encode(['error' => 'No SQL query provided']);
    exit;
}

// Security: ONLY ALLOW SELECT
$upperSql = strtoupper(trim($sql));
if (strpos($upperSql, 'SELECT') !== 0) {
    http_response_code(403);
    echo json_encode(['error' => 'Only SELECT queries are allowed for analysis.']);
    exit;
}

// Disallow dangerous keywords — use word-boundary regex to avoid matching
// column names like deleted_at, updated_at, etc.
$dangerous = ['DELETE', 'DROP', 'INSERT', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
foreach ($dangerous as $word) {
    if (preg_match('/\b' . $word . '\b/i', $upperSql)) {
        http_response_code(403);
        echo json_encode(['error' => "Query contains forbidden keyword: $word"]);
        exit;
    }
}

// UPDATE: only block if it's a DML statement (UPDATE table SET), not DDL ON UPDATE
if (preg_match('/\bUPDATE\s+\w+\s+SET\b/i', $upperSql)) {
    http_response_code(403);
    echo json_encode(['error' => 'Query contains forbidden keyword: UPDATE']);
    exit;
}

try {
    $db = getDB();
    $stmt = $db->prepare($sql);
    // Inject tenant_id as a named or positional param if the SQL uses it
    // For safety: bind :tenant_id and ?tenant_id placeholders automatically
    $params = [];
    if (strpos($sql, ':tenant_id') !== false) {
        $params[':tenant_id'] = $tenantId;
    }
    $stmt->execute($params ?: null);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['data' => $data]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
