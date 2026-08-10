<?php
// CRUD /api/projects.php
// GET    - list user's projects (or single if ?id=)
// POST   - create project
// PUT    - update project (?id= required)
// DELETE - delete project (?id= required)
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

$ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

// Check if user is admin (tenant-scoped)
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// --- GET ---
$projFloatFields = ['project_value'];

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    // Common SELECT with creator and manager names joined
    $projectSelect = '
        SELECT p.*,
               uc.display_name AS creator_name,
               um.display_name AS manager_name
        FROM projects p
        LEFT JOIN users uc ON uc.id = p.user_id
        LEFT JOIN users um ON um.id = p.manager_id
    ';

    if ($id) {
        if ($isAdmin) {
            $stmt = $db->prepare("$projectSelect WHERE p.id = ? AND p.tenant_id = ?");
            $stmt->execute([$id, $tenantId]);
        } else {
            $stmt = $db->prepare("
                $projectSelect
                LEFT JOIN project_members pm ON p.id = pm.project_id
                WHERE p.id = ? AND p.tenant_id = ? AND (p.user_id = ? OR pm.user_id = ?)
            ");
            $stmt->execute([$id, $tenantId, $userId, $userId]);
        }
        $project = $stmt->fetch();
        if (!$project) jsonError('ไม่พบโครงการ', 404);
        jsonResponse(castNumericFields($project, $projFloatFields));
    }

    // Filters:
    //   ?include_archived=1   include archived projects (default: hide)
    //   ?kind=base_calendar   only Base Calendar (ปฏิทินทีม)
    //   ?kind=all             everything (project + base_calendar)
    //   ?kind=project         only customer projects (default)
    //   ?year=2026            filter by year (based on start_date)
    $includeArchived = (int)($_GET['include_archived'] ?? 0) === 1;
    $kindParam       = $_GET['kind'] ?? 'project';
    $yearParam       = $_GET['year'] ?? null;
    $allowedKinds    = ['project', 'base_calendar', 'all'];
    if (!in_array($kindParam, $allowedKinds, true)) $kindParam = 'project';

    // Build kind filter using a placeholder so the value is parameterized, not concatenated.
    // $kindParam has already been validated against an allowlist above.
    $kindClause      = $kindParam === 'all' ? '' : ' AND p.kind = ?';
    $kindParams      = $kindParam === 'all' ? [] : [$kindParam];
    $archivedClause  = $includeArchived ? '' : ' AND p.archived_at IS NULL';

    // Build year filter
    $yearClause = '';
    $yearParams = [];
    if ($yearParam) {
        $yearInt = (int)$yearParam;
        if ($yearInt >= 2000 && $yearInt <= 2100) {
            $yearClause = ' AND YEAR(p.start_date) = ?';
            $yearParams = [$yearInt];
        }
    }

    if ($isAdmin) {
        $sql = "$projectSelect WHERE p.tenant_id = ? $kindClause $archivedClause $yearClause ORDER BY p.created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute(array_merge([$tenantId], $kindParams, $yearParams));
    } else {
        // Non-admin: see owned/member projects, PLUS Base Calendar (everyone in tenant can see it)
        // When kind=project, do NOT include base_calendar via the OR shortcut
        $baseCalendarClause = ($kindParam === 'project') ? '' : " OR p.kind = 'base_calendar'";
        $sql = "
            $projectSelect
            LEFT JOIN project_members pm ON p.id = pm.project_id
            WHERE p.tenant_id = ?
              $kindClause
              $archivedClause
              $yearClause
              AND (p.user_id = ? OR pm.user_id = ?$baseCalendarClause)
            GROUP BY p.id
            ORDER BY p.created_at DESC
        ";
        $stmt = $db->prepare($sql);
        $stmt->execute(array_merge([$tenantId], $kindParams, $yearParams, [$userId, $userId]));
    }
    jsonResponse(castNumericFieldsAll($stmt->fetchAll(), $projFloatFields));
}

// --- POST ---
if ($method === 'POST') {
    $body = getRequestBody();
    $id = generateUUID();

    // If admin, allow setting a different owner (with validation)
    $ownerId = $userId; // Default to current user
    if ($isAdmin && !empty($body['user_id'])) {
        // Validate that the specified user exists
        $checkUser = $db->prepare('SELECT id FROM users WHERE id = ?');
        $checkUser->execute([$body['user_id']]);
        if (!$checkUser->fetch()) {
            jsonError('ไม่พบผู้ใช้ที่ระบุ', 404);
        }
        $ownerId = $body['user_id'];
    }

    $managerId = !empty($body['manager_id']) ? $body['manager_id'] : null;

    // NEVER allow client to set kind='base_calendar' via POST. Only seeded by migration.
    if (isset($body['kind']) && $body['kind'] === 'base_calendar') {
        jsonError('ไม่สามารถสร้าง Base Calendar ผ่าน API ได้ (มีระบบสร้างให้อัตโนมัติ)', 403);
    }

    $stmt = $db->prepare("
        INSERT INTO projects (id, tenant_id, user_id, manager_id, company_id, customer_id, opportunity_id, name, description, status, start_date, end_date, original_end_date, kind, is_protected)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'project', 0)
    ");
    $stmt->execute([
        $id,
        $tenantId,
        $ownerId,
        $managerId,
        $body['company_id'] ?? null,
        $body['customer_id'] ?? null,
        $body['opportunity_id'] ?? null,
        $body['name'] ?? '',
        $body['description'] ?? '',
        $body['status'] ?? 'on-track',
        $body['start_date'] ?? date('Y-m-d'),
        $body['end_date'] ?? date('Y-m-d', strtotime('+30 days')),
        $body['original_end_date'] ?? null,
    ]);

    $stmt = $db->prepare('SELECT * FROM projects WHERE id = ?');
    $stmt->execute([$id]);
    
    // Auto-create workflow instance using first project workflow definition
    try {
        $wfStmt = $db->prepare("SELECT id FROM workflow_definitions WHERE entity_type='project' AND tenant_id=? ORDER BY is_template DESC, created_at ASC LIMIT 1");
        $wfStmt->execute([$tenantId]);
        $wfDef = $wfStmt->fetchColumn();
        if ($wfDef) {
            $wfInstanceId = generateUUID();
            $db->prepare("INSERT INTO workflow_instances (id, workflow_definition_id, entity_type, entity_id, status, started_at) VALUES (?,?,'project',?,'active',NOW())")
               ->execute([$wfInstanceId, $wfDef, $id]);
            $wfDefData = json_decode($db->query("SELECT definition FROM workflow_definitions WHERE id='$wfDef'")->fetchColumn(), true);
            $firstStage = null;
            foreach (($wfDefData['nodes'] ?? []) as $n) { if ($n['type'] === 'stage') { $firstStage = $n; break; } }
            if ($firstStage) {
                $db->prepare("INSERT INTO workflow_step_logs (id, instance_id, step_id, step_name, status, started_at) VALUES (UUID(),?,?,?,'in_progress',NOW())")
                   ->execute([$wfInstanceId, $firstStage['id'], $firstStage['data']['label']]);
                $db->prepare("UPDATE workflow_instances SET current_step_id=? WHERE id=?")->execute([$firstStage['id'], $wfInstanceId]);
            }
        }
    } catch (Exception $e) { /* ignore — workflow is optional */ }

    // Log activity
    $projectName = $body['name'] ?? 'โปรเจกต์';
    $logStmt = $db->prepare('INSERT INTO user_activity_logs (id, user_id, tenant_id, action, description, ip_address, user_agent, created_at) VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())');
    $logStmt->execute([
        $userId,
        $tenantId,
        'create_project', 
        'สร้างโปรเจกต์: ' . $projectName, 
        $ipAddress, 
        $userAgent
    ]);
    
    jsonResponse(castNumericFields($stmt->fetch(), $projFloatFields), 201);
}

// --- PUT ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    // Load current project to determine kind/is_protected
    $currStmt = $db->prepare('SELECT kind, is_protected, updated_at FROM projects WHERE id = ? AND tenant_id = ?');
    $currStmt->execute([$id, $tenantId]);
    $current = $currStmt->fetch();
    if (!$current) jsonError('ไม่พบโครงการ', 404);

    $body = getRequestBody();

    // Optimistic concurrency: if client sends _updated_at and server is newer → 409
    if (!empty($body['_updated_at'])) {
        $serverTs = strtotime($current['updated_at'] ?? '');
        $clientTs = strtotime($body['_updated_at']);
        if ($serverTs !== false && $clientTs !== false && $serverTs > $clientTs) {
            http_response_code(409);
            echo json_encode([
                'error'   => 'โปรเจกต์นี้ถูกแก้ไขโดยผู้ใช้อื่น กรุณา refresh และลองใหม่',
                'conflict' => true,
                'server_updated' => $current['updated_at'],
            ]);
            exit;
        }
        unset($body['_updated_at']);
    }
    // Only allow kind change: base_calendar → project (one-way conversion)
    // Block all other kind/is_protected mutations
    $convertingToProject = false;
    if (array_key_exists('kind', $body)) {
        if ($body['kind'] === 'project' && $current['kind'] === 'base_calendar') {
            $convertingToProject = true;
        } else {
            jsonError('ไม่สามารถเปลี่ยน kind/is_protected ของโครงการได้', 403);
        }
    }
    if (array_key_exists('is_protected', $body) && !$convertingToProject) {
        jsonError('ไม่สามารถเปลี่ยน kind/is_protected ของโครงการได้', 403);
    }

    $fields = [];
    $values = [];

    // Base allowed fields for all users
    $allowed = ['name', 'description', 'status', 'start_date', 'end_date', 'original_end_date', 'extension_reason', 'company_id', 'customer_id', 'opportunity_id', 'project_value', 'payment_status', 'payment_terms', 'manager_id'];

    // Base Calendar: limit what can be updated (no status changes, no customer/value)
    // Exception: converting to project — allow kind change + full field access
    if ($current['kind'] === 'base_calendar' && !$convertingToProject) {
        $allowed = ['name', 'description', 'manager_id', 'company_id'];
    }

    if ($convertingToProject) {
        $allowed[] = 'kind';
    }
    
    // Only admins can change project owner
    if ($isAdmin && array_key_exists('user_id', $body)) {
        // Validate that the specified user exists
        $checkUser = $db->prepare('SELECT id FROM users WHERE id = ?');
        $checkUser->execute([$body['user_id']]);
        if (!$checkUser->fetch()) {
            jsonError('ไม่พบผู้ใช้ที่ระบุ', 404);
        }
        $allowed[] = 'user_id';
    }
    
    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $fields[] = "`$field` = ?";
            $values[] = $body[$field];
        }
    }

    if (empty($fields)) jsonError('No fields to update');

    $values[] = $id;
    if ($isAdmin) {
        $values[] = $tenantId;
        $sql = 'UPDATE projects SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?';
    } else {
        $values[] = $userId;
        $values[] = $tenantId;
        $sql = 'UPDATE projects SET ' . implode(', ', $fields) . ' WHERE id = ? AND user_id = ? AND tenant_id = ?';
    }
    $db->prepare($sql)->execute($values);

    // When project is marked completed, cascade status to all tasks and subtasks
    if (isset($body['status']) && $body['status'] === 'completed') {
        $db->prepare('UPDATE tasks SET status = ?, completed_date = NOW(), updated_at = NOW() WHERE project_id = ? AND deleted_at IS NULL AND status != ?')
           ->execute(['completed', $id, 'completed']);
        // Auto-advance journey
        require_once __DIR__ . '/journey-utils.php';
        journeyAutoAdvance($db, $tenantId, 'project', 'project', $id);
    }

    // Get project name for logging
    $projectStmt = $db->prepare('SELECT name FROM projects WHERE id = ?');
    $projectStmt->execute([$id]);
    $project = $projectStmt->fetch();
    $projectName = $project['name'] ?? 'โปรเจกต์';
    
    // Log activity
    $changedFields = implode(', ', $fields);
    $logStmt = $db->prepare('INSERT INTO user_activity_logs (id, user_id, tenant_id, action, description, ip_address, user_agent, created_at) VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())');
    $logStmt->execute([
        $userId,
        $tenantId,
        'update_project', 
        'อัปเดตโปรเจกต์: ' . $projectName . ' (' . $changedFields . ')', 
        $ipAddress, 
        $userAgent
    ]);

    $stmt = $db->prepare('SELECT * FROM projects WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(castNumericFields($stmt->fetch(), $projFloatFields));
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id parameter');

    // Check is_protected / kind before delete
    $checkStmt = $db->prepare('SELECT name, is_protected, kind FROM projects WHERE id = ? AND tenant_id = ?');
    $checkStmt->execute([$id, $tenantId]);
    $project = $checkStmt->fetch();
    if (!$project) jsonError('ไม่พบโครงการ', 404);
    if ((int)($project['is_protected'] ?? 0) === 1) {
        jsonError('ไม่สามารถลบ ' . ($project['kind'] === 'base_calendar' ? 'Base Calendar (ปฏิทินทีม)' : 'รายการที่ป้องกัน') . ' ได้', 403);
    }
    $projectName = $project['name'] ?? 'โปรเจกต์';

    if ($isAdmin) {
        $stmt = $db->prepare('DELETE FROM projects WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$id, $tenantId]);
    } else {
        $stmt = $db->prepare('DELETE FROM projects WHERE id = ? AND user_id = ? AND tenant_id = ?');
        $stmt->execute([$id, $userId, $tenantId]);
    }

    require_once __DIR__ . '/journey-utils.php';
    journeyCleanupEntityLinks($db, 'project', $id);

    // Log activity
    $logStmt = $db->prepare('INSERT INTO user_activity_logs (id, user_id, tenant_id, action, description, ip_address, user_agent, created_at) VALUES (UUID(), ?, ?, ?, ?, ?, ?, NOW())');
    $logStmt->execute([
        $userId,
        $tenantId,
        'delete_project', 
        'ลบโปรเจกต์: ' . $projectName, 
        $ipAddress, 
        $userAgent
    ]);
    
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
