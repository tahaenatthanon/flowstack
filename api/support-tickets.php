<?php
// /api/support-tickets.php — Helpdesk ticket CRUD + comments
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db     = getDB();
$method = getMethod();

function ticketWithMeta(PDO $db, string $id, string $tenantId): array|false {
    $stmt = $db->prepare("
        SELECT st.*,
               sc.title AS contract_title, sc.contract_number,
               c.name  AS company_name,
               cu.first_name AS cust_first, cu.last_name AS cust_last,
               u.display_name AS assignee_name,
               cb.display_name AS created_by_name,
               TIMESTAMPDIFF(HOUR, st.created_at, COALESCE(st.resolved_at, NOW())) AS elapsed_hours,
               CASE WHEN st.resolved_at IS NULL AND TIMESTAMPDIFF(HOUR, st.created_at, NOW()) > st.sla_hours
                    THEN 1 ELSE 0 END AS sla_breached
        FROM support_tickets st
        LEFT JOIN support_contracts sc ON st.contract_id  = sc.id
        LEFT JOIN companies c          ON st.company_id   = c.id
        LEFT JOIN customers cu         ON st.customer_id  = cu.id
        LEFT JOIN users u              ON st.assigned_to  = u.id
        LEFT JOIN users cb             ON st.created_by   = cb.id
        WHERE st.id = ? AND st.tenant_id = ?
    ");
    $stmt->execute([$id, $tenantId]);
    $row = $stmt->fetch();
    if (!$row) return false;

    // comments
    $cmt = $db->prepare("
        SELECT stc.*, u.display_name AS user_name
        FROM support_ticket_comments stc
        JOIN users u ON stc.user_id = u.id
        WHERE stc.ticket_id = ?
        ORDER BY stc.created_at ASC
    ");
    $cmt->execute([$id]);
    $row['comments'] = $cmt->fetchAll();

    // attachments
    $att = $db->prepare("
        SELECT sa.*, u.display_name AS uploader_name
        FROM support_attachments sa
        JOIN users u ON sa.uploaded_by = u.id
        WHERE sa.ticket_id = ?
        ORDER BY sa.created_at ASC
    ");
    $att->execute([$id]);
    $row['attachments'] = $att->fetchAll();

    return $row;
}

function nextTicketNumber(PDO $db): string {
    $today  = date('Ymd');
    $prefix = 'TKT-' . $today . '-';
    $stmt   = $db->prepare("
        SELECT COUNT(*) FROM support_tickets
        WHERE ticket_number LIKE ?
    ");
    $stmt->execute([$prefix . '%']);
    $count = (int)$stmt->fetchColumn() + 1;
    return $prefix . str_pad($count, 3, '0', STR_PAD_LEFT);
}

// SLA hours by priority
function slaHours(string $priority): int {
    return match($priority) {
        'critical' => 2,
        'high'     => 4,
        'medium'   => 8,
        'low'      => 24,
        default    => 8,
    };
}

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $t = ticketWithMeta($db, $id, $tenantId);
        if (!$t) jsonError('ไม่พบ Ticket', 404);
        jsonResponse($t);
    }

    $where  = ['st.tenant_id = ?'];
    $params = [$tenantId];

    if (!empty($_GET['status'])) {
        $where[] = 'st.status = ?'; $params[] = $_GET['status'];
    }
    if (!empty($_GET['priority'])) {
        $where[] = 'st.priority = ?'; $params[] = $_GET['priority'];
    }
    if (!empty($_GET['assigned_to'])) {
        $where[] = 'st.assigned_to = ?'; $params[] = $_GET['assigned_to'];
    }
    if (!empty($_GET['company_id'])) {
        $where[] = 'st.company_id = ?'; $params[] = $_GET['company_id'];
    }
    if (!empty($_GET['contract_id'])) {
        $where[] = 'st.contract_id = ?'; $params[] = $_GET['contract_id'];
    }
    if (!empty($_GET['year'])) {
        $where[] = 'YEAR(st.created_at) = ?'; $params[] = (int) $_GET['year'];
    }
    if (!empty($_GET['search'])) {
        $q = '%' . $_GET['search'] . '%';
        $where[] = '(st.title LIKE ? OR st.ticket_number LIKE ? OR st.reported_by LIKE ?)';
        $params  = array_merge($params, [$q, $q, $q]);
    }
    if (isset($_GET['sla_breached']) && $_GET['sla_breached'] === '1') {
        $where[] = 'st.resolved_at IS NULL AND TIMESTAMPDIFF(HOUR, st.created_at, NOW()) > st.sla_hours';
    }

    $stmt = $db->prepare("
        SELECT st.*,
               sc.title AS contract_title,
               c.name  AS company_name,
               cu.first_name AS cust_first, cu.last_name AS cust_last,
               u.display_name AS assignee_name,
               TIMESTAMPDIFF(HOUR, st.created_at, COALESCE(st.resolved_at, NOW())) AS elapsed_hours,
               CASE WHEN st.resolved_at IS NULL AND TIMESTAMPDIFF(HOUR, st.created_at, NOW()) > st.sla_hours
                    THEN 1 ELSE 0 END AS sla_breached,
               (SELECT COUNT(*) FROM support_attachments sa WHERE sa.ticket_id = st.id) AS attachment_count,
               (SELECT COUNT(*) FROM support_ticket_comments stc WHERE stc.ticket_id = st.id) AS comment_count
        FROM support_tickets st
        LEFT JOIN support_contracts sc ON st.contract_id = sc.id
        LEFT JOIN companies c          ON st.company_id  = c.id
        LEFT JOIN customers cu         ON st.customer_id = cu.id
        LEFT JOIN users u              ON st.assigned_to = u.id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY
          FIELD(st.priority,'critical','high','medium','low'),
          st.created_at DESC
    ");
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

// ── Helpers: AI + auto-task ──────────────────────────────────────────────────

/**
 * Resolve text-generation AI credentials with fallback chain:
 *   ai_content_text_model_id → ai_default_model_id → active provider's model
 * Returns ['api_key','base_url','model'] or null when not configured.
 */
function supportResolveAi(PDO $db, string $tenantId = ''): ?array {
    try {
        $whereClause = $tenantId ? 'cs.tenant_id = ' . $db->quote($tenantId) : 'cs.id = 1';
        $stmt = $db->query("
            SELECT ap.api_base_url, ap.api_key_encrypted,
                   COALESCE(am_t.model_id, am_d.model_id) AS model_id
            FROM company_settings cs
            LEFT JOIN ai_models am_t ON am_t.id = cs.ai_content_text_model_id
            LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
            JOIN ai_providers ap ON ap.id = COALESCE(am_t.provider_id, am_d.provider_id, cs.ai_active_provider_id)
            WHERE $whereClause
              AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
            LIMIT 1
        ");
        $row = $stmt ? $stmt->fetch() : null;
    } catch (\Throwable $e) { return null; }
    if (!$row || empty($row['api_key_encrypted'])) return null;
    $plain = decryptApiKey($row['api_key_encrypted']);
    if ($plain === '' || $plain === false) return null;
    return [
        'api_key'  => trim($plain),
        'base_url' => rtrim($row['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/'),
        'model'    => $row['model_id'] ?: 'openai/gpt-4o-mini',
    ];
}

/**
 * Auto-create a task linked to a support ticket when the ticket transitions to in-progress.
 * Returns the created task id, or null when no Base Calendar exists, no project resolved,
 * or task creation failed.
 *
 * Strategy:
 *   1. If ticket already has task_id → skip (return null).
 *   2. Place the task in the tenant's Base Calendar (ปฏิทินทีม) using task_type='interrupt'.
 *   3. Otherwise create as 'task' inside a regular project (none chosen here → Base Calendar).
 */
function autoCreateTaskForTicket(PDO $db, string $ticketId, string $tenantId, string $createdByUserId): ?string {
    // Load ticket
    $tStmt = $db->prepare('SELECT * FROM support_tickets WHERE id = ? AND tenant_id = ?');
    $tStmt->execute([$ticketId, $tenantId]);
    $ticket = $tStmt->fetch();
    if (!$ticket) return null;
    if (!empty($ticket['task_id'])) return $ticket['task_id']; // already linked

    $projectId = getBaseCalendarProjectId($db, $tenantId);
    if (!$projectId) return null; // Base Calendar not seeded yet

    $assigneeId = $ticket['assigned_to'] ?? null;
    $assigneeName = '';
    if ($assigneeId) {
        $u = $db->prepare('SELECT display_name FROM users WHERE id = ?');
        $u->execute([$assigneeId]);
        $assigneeName = (string)($u->fetchColumn() ?? '');
    }

    $estHours = match($ticket['priority']) {
        'critical' => 2.0,
        'high'     => 4.0,
        'medium'   => 8.0,
        'low'      => 16.0,
        default    => 8.0,
    };

    $taskId = generateUUID();
    $today  = date('Y-m-d');
    $tStmt = $db->prepare("
        INSERT INTO tasks (
            id, tenant_id, project_id, user_id, title, description,
            status, priority, assignee, start_date, end_date,
            estimated_days, estimated_hours, task_type
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ");
    try {
        $tStmt->execute([
            $taskId, $tenantId, $projectId, $createdByUserId,
            'Support: ' . ($ticket['title'] ?? ''),
            ($ticket['description'] ?? '') . "\n\n[ผูกกับ Ticket #{$ticket['ticket_number']}]",
            'in-progress',
            match($ticket['priority']) {
                'critical', 'high' => 'high',
                'low'              => 'low',
                default            => 'medium',
            },
            $assigneeName,
            $today, $today,
            1, $estHours,
            'interrupt', // valid in base_calendar after extend_task_type migration
        ]);
    } catch (\Throwable $e) {
        error_log('[support auto-create-task] ' . $e->getMessage());
        return null;
    }

    $db->prepare('UPDATE support_tickets SET task_id = ? WHERE id = ?')->execute([$taskId, $ticketId]);
    return $taskId;
}

// ── POST ──────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $action = $_GET['action'] ?? 'create';

    // ── action=ai-suggest ─────────────────────────────────────────────────────
    if ($action === 'ai-suggest') {
        $b = getRequestBody();
        $ticketId = $_GET['ticket_id'] ?? ($b['ticket_id'] ?? null);
        if (!$ticketId) jsonError('Missing ticket_id', 400);

        $ticket = ticketWithMeta($db, $ticketId, $tenantId);
        if (!$ticket) jsonError('ไม่พบ Ticket', 404);

        $ai = supportResolveAi($db, $tenantId);
        if (!$ai) jsonError('AI provider not configured — ตั้งค่าใน Admin > AI Settings', 503);

        $title       = $ticket['title']        ?? '';
        $description = $ticket['description']  ?? '';
        $company     = $ticket['company_name'] ?? '';
        $currentPrio = $ticket['priority']     ?? 'medium';

        $sys = "คุณคือวิศวกร Helpdesk ที่มีประสบการณ์ ตอบเป็นภาษาไทยเท่านั้น ตอบเป็น JSON เท่านั้น ไม่มี markdown fence";
        $user = <<<PROMPT
ตั๋วลูกค้า:
- ชื่อ: {$title}
- รายละเอียด: {$description}
- ลูกค้า: {$company}
- ระดับความสำคัญปัจจุบัน: {$currentPrio}

ให้วิเคราะห์และตอบเป็น JSON object เท่านั้น (ใช้ HTML จัดรูปแบบข้อความที่แสดงต่อลูกค้าได้ เช่น <strong>, <ul>, <ol>, <li>, <table>, <a href>, <p>):
{
  "category_suggested": "Hardware|Software|Network|Account|Other",
  "priority_suggested": "critical|high|medium|low",
  "priority_reason": "เหตุผลภาษาไทย ≤ 100 ตัวอักษร",
  "first_response_th": "ข้อความตอบแรกที่ส่งให้ลูกค้า ภาษาไทย สุภาพ ใช้ HTML จัดรูปแบบได้ ≤ 500 ตัวอักษร",
  "checklist": ["ขั้นตอนที่ 1 ใช้ HTML ได้", "ขั้นตอนที่ 2", "ขั้นตอนที่ 3"],
  "estimated_hours": 0.5
}
PROMPT;

        $payload = [
            'model'    => $ai['model'],
            'messages' => [
                ['role' => 'system', 'content' => $sys],
                ['role' => 'user',   'content' => $user],
            ],
            'stream'   => false,
            'max_tokens' => 2048,
        ];
        $ch = curl_init($ai['base_url'] . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $ai['api_key'], 'Content-Type: application/json'],
            CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CONNECTTIMEOUT => 15,
        ]);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false) jsonError("AI request failed: {$err} — ตรวจสอบ Base URL ({$ai['base_url']}) ใน Admin > AI Settings", 500);

        $resp    = json_decode($raw, true);
        if (!is_array($resp)) {
            error_log('[ai-suggest] raw response: ' . substr($raw, 0, 500));
            jsonError('AI ตอบกลับผิดรูปแบบ (ไม่ใช่ JSON) — ตรวจสอบ Base URL และ Provider', 500);
        }
        // Check for OpenAI-compatible error
        if (!empty($resp['error'])) {
            $msg = is_array($resp['error']) ? ($resp['error']['message'] ?? '') : $resp['error'];
            error_log('[ai-suggest] API error: ' . ($msg ?: json_encode($resp['error'])) . ' | model=' . $ai['model'] . ' base=' . $ai['base_url'] . ' http=' . $httpCode);
            $detail = $msg ?: json_encode($resp['error'], JSON_UNESCAPED_UNICODE);
            jsonError("AI Provider error: {$detail} — ตรวจสอบ API Key และ Model ({$ai['model']}) ใน Admin > AI Settings", 500);
        }
        $content = $resp['choices'][0]['message']['content'] ?? '';
        if ($content === '' || $content === null) {
            error_log('[ai-suggest] empty content. full response: ' . substr($raw, 0, 1000));
            jsonError("AI ตอบกลับว่างเปล่า — model '{$ai['model']}' อาจไม่รองรับ หรือ API key ไม่ถูกต้อง (HTTP {$httpCode})", 500);
        }
        $content = trim(preg_replace(['/^```(?:json)?\s*/im','/\s*```$/m'], '', (string)$content));
        // try outermost {…}
        if (!str_starts_with($content, '{') && preg_match('/\{.*\}/s', $content, $m)) {
            $content = $m[0];
        }
        $parsed = json_decode($content, true);
        if (!is_array($parsed)) jsonError('AI returned non-JSON: ' . substr($content, 0, 300), 500);

        // Cache the suggestion on the ticket
        $db->prepare('UPDATE support_tickets SET ai_suggested_json = ?, ai_suggested_at = NOW() WHERE id = ? AND tenant_id = ?')
           ->execute([json_encode($parsed, JSON_UNESCAPED_UNICODE), $ticketId, $tenantId]);

        jsonResponse($parsed);
    }

    // Add comment
    if ($action === 'comment') {
        $b = getRequestBody();
        $ticketId = $_GET['ticket_id'] ?? null;
        if (!$ticketId) jsonError('Missing ticket_id');
        $cid = generateUUID();
        $db->prepare("
            INSERT INTO support_ticket_comments (id, ticket_id, user_id, comment, is_internal)
            VALUES (?,?,?,?,?)
        ")->execute([$cid, $ticketId, $userId, $b['comment'] ?? '', (int)($b['is_internal'] ?? 0)]);

        // Mark first_response_at if not set
        $db->prepare("
            UPDATE support_tickets SET first_response_at = NOW()
            WHERE id = ? AND first_response_at IS NULL
        ")->execute([$ticketId]);

        jsonResponse(['id' => $cid, 'success' => true]);
    }

    // Create ticket
    $b  = getRequestBody();
    $id = generateUUID();
    $priority = $b['priority'] ?? 'medium';

    $stmt = $db->prepare("
        INSERT INTO support_tickets
          (id, tenant_id, ticket_number, contract_id, company_id, customer_id, project_id, title, description,
           type, priority, status, channel, assigned_to,
           reported_by, reporter_phone, reporter_email, sla_hours, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ");
    $stmt->execute([
        $id,
        $tenantId,
        nextTicketNumber($db),
        $b['contract_id']   ?? null,
        $b['company_id']    ?? null,
        $b['customer_id']   ?? null,
        $b['project_id']    ?? null,
        $b['title']         ?? '',
        $b['description']   ?? '',
        $b['type']          ?? 'incident',
        $priority,
        'open',
        $b['channel']       ?? 'system',
        $b['assigned_to']   ?? null,
        $b['reported_by']   ?? '',
        $b['reporter_phone']?? '',
        $b['reporter_email']?? '',
        slaHours($priority),
        $userId,
    ]);

    // Inbox notification: notify assignee when ticket is created
    $assignedTo = $b['assigned_to'] ?? null;
    if ($assignedTo) {
        $creatorStmt = $db->prepare('SELECT display_name, email FROM users WHERE id = ?');
        $creatorStmt->execute([$userId]);
        $creator = $creatorStmt->fetch();
        inboxNotify(
            $db, $tenantId, $assignedTo,
            $creator['display_name'] ?? 'ระบบ', $creator['email'] ?? '',
            'Ticket ใหม่: ' . ($b['title'] ?? ''),
            'คุณถูกมอบหมาย ticket "' . ($b['title'] ?? '') . '" (ความสำคัญ: ' . $priority . ')',
            'ticket', $priority, $id
        );
    }

    // ── Best-effort async AI triage on creation ──────────────────────────────
    try {
        $ai = supportResolveAi($db, $tenantId);
        if ($ai) {
            $ticketText = ($b['title'] ?? '') . "\n" . ($b['description'] ?? '');
            $suggPayload = json_encode([
                'model'    => $ai['model'],
                'messages' => [[
                    'role'    => 'user',
                    'content' => "ตอบเป็นภาษาไทยเท่านั้น\nวิเคราะห์ support ticket นี้:\n---\n$ticketText\n---\n"
                               . "ตอบ JSON เท่านั้น: "
                               . '{"category_suggested":"Hardware|Software|Network|Account|Other",'
                               . '"priority_suggested":"critical|high|medium|low",'
                               . '"summary":"สรุปปัญหา 1 บรรทัด"}',
                ]],
                'stream' => false,
                'max_tokens' => 1024,
            ]);
            $suggCh = curl_init($ai['base_url'] . '/chat/completions');
            curl_setopt_array($suggCh, [
                CURLOPT_POST => true, CURLOPT_POSTFIELDS => $suggPayload,
                CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $ai['api_key'],
                ],
            ]);
            $suggRaw = curl_exec($suggCh);
            curl_close($suggCh);
            if ($suggRaw) {
                $suggResp = json_decode($suggRaw, true);
                $content  = $suggResp['choices'][0]['message']['content'] ?? '';
                if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
                    $sugg = json_decode($m[0], true);
                    if (!empty($sugg['priority_suggested'])) {
                        $db->prepare("
                            UPDATE support_tickets
                            SET ai_suggested_json = ?, ai_suggested_at = NOW()
                            WHERE id = ?
                        ")->execute([json_encode($sugg, JSON_UNESCAPED_UNICODE), $id]);
                    }
                }
            }
        }
    } catch (\Throwable $e) {
        error_log('[ticket ai-auto-suggest] ' . $e->getMessage());
    }

    jsonResponse(ticketWithMeta($db, $id, $tenantId), 201);
}

// ── PUT (update) ──────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    // Edit comment
    if (($action = $_GET['action'] ?? '') === 'comment') {
        $commentId = $_GET['comment_id'] ?? null;
        if (!$commentId) jsonError('Missing comment_id');
        $b = getRequestBody();
        $stmt = $db->prepare('UPDATE support_ticket_comments SET comment = ? WHERE id = ? AND user_id = ?');
        $stmt->execute([$b['comment'] ?? '', $commentId, $userId]);
        if ($stmt->rowCount() === 0) jsonError('ไม่พบความคิดเห็นหรือไม่มีสิทธิ์แก้ไข', 404);
        jsonResponse(['success' => true]);
    }

    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');

    // Load previous state for transition detection
    $prevStmt = $db->prepare('SELECT status, task_id, timesheet_id FROM support_tickets WHERE id = ? AND tenant_id = ?');
    $prevStmt->execute([$id, $tenantId]);
    $prevTicket = $prevStmt->fetch();
    if (!$prevTicket) jsonError('ไม่พบ Ticket', 404);

    $b      = getRequestBody();
    $fields = [];
    $vals   = [];
    $allowed = ['contract_id','company_id','customer_id','project_id','title','description',
                'type','priority','status','channel','assigned_to',
                'reported_by','reporter_phone','reporter_email','resolution','csat_score','csat_comment'];

    foreach ($allowed as $f) {
        if (array_key_exists($f, $b)) { $fields[] = "$f = ?"; $vals[] = $b[$f]; }
    }

    // Auto-set timestamps on status change
    if (!empty($b['status'])) {
        if ($b['status'] === 'resolved' || $b['status'] === 'closed') {
            $fields[] = 'resolved_at = COALESCE(resolved_at, NOW())';
        }
        if ($b['status'] === 'closed') {
            $fields[] = 'closed_at = NOW()';
        }
        if (in_array($b['status'], ['in-progress'])) {
            $fields[] = 'first_response_at = COALESCE(first_response_at, NOW())';
        }
    }

    if (!empty($fields)) {
        $vals[] = $id;
        $vals[] = $tenantId;
        $db->prepare('UPDATE support_tickets SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?')->execute($vals);
    }

    // ── Hook: auto-link ticket → task on status transitions ──────────────────
    $newStatus = $b['status'] ?? null;
    $oldStatus = $prevTicket['status'] ?? null;
    if ($newStatus && $newStatus !== $oldStatus) {
        // Transition INTO in-progress → create task if not yet linked
        if ($newStatus === 'in-progress' && empty($prevTicket['task_id'])) {
            autoCreateTaskForTicket($db, $id, $tenantId, $userId);
        }
        // Transition to resolved/closed → mark linked task completed + timesheet + AI note
        if (in_array($newStatus, ['resolved','closed'], true) && !empty($prevTicket['task_id'])) {
            try {
                // Compute hours worked
                $hoursWorked = 0.5;
                $firstResp = $db->prepare("
                    SELECT first_response_at, ticket_number FROM support_tickets WHERE id = ?
                ");
                $firstResp->execute([$id]);
                $fr = $firstResp->fetch();
                if ($fr && !empty($fr['first_response_at'])) {
                    $mins = max(0, (time() - strtotime($fr['first_response_at'])) / 60);
                    $hoursWorked = max(0.5, round($mins / 60, 1));
                }
                $ticketNumber = $fr['ticket_number'] ?? '';

                // Mark task completed with actual hours
                $db->prepare("
                    UPDATE tasks
                    SET status = 'completed',
                        completed_date = CURDATE(),
                        actual_hours = COALESCE(actual_hours, ?),
                        updated_at = NOW()
                    WHERE id = ? AND deleted_at IS NULL AND status != 'completed'
                ")->execute([$hoursWorked, $prevTicket['task_id']]);

                // Create subtask as timesheet entry (only if not already created)
                if (empty($prevTicket['timesheet_id'])) {
                    $taskInfo = $db->prepare('SELECT user_id, project_id, assignee, assignee_user_id FROM tasks WHERE id = ?');
                    $taskInfo->execute([$prevTicket['task_id']]);
                    $taskRow = $taskInfo->fetch();

                    if ($taskRow && ($taskRow['user_id'] || $taskRow['assignee_user_id'])) {
                        $tsId = generateUUID();
                        $assignedUser = $taskRow['user_id'] ?: $taskRow['assignee_user_id'];
                        $db->prepare("
                            INSERT INTO tasks
                              (id, tenant_id, project_id, parent_task_id, user_id, title, description,
                               status, priority, assignee, assignee_user_id, start_date, end_date,
                               estimated_days, estimated_hours, actual_hours, task_type, is_subtask,
                               created_at, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', 'medium', ?, ?, CURDATE(), CURDATE(), 1, ?, ?, 'interrupt', 1, NOW(), NOW())
                        ")->execute([
                            $tsId,
                            $tenantId,
                            $taskRow['project_id'],
                            $prevTicket['task_id'],
                            $assignedUser,
                            'ปิด Ticket #' . $ticketNumber,
                            'บันทึกเวลาอัตโนมัติเมื่อปิด ticket',
                            $taskRow['assignee'] ?? '',
                            $assignedUser,
                            $hoursWorked,
                            $hoursWorked,
                        ]);

                        // Link timesheet to ticket
                        $db->prepare("UPDATE support_tickets SET timesheet_id = ? WHERE id = ?")->execute([$tsId, $id]);
                    }
                }
            } catch (\Throwable $e) {
                error_log('[support task-close] ' . $e->getMessage());
            }
        }

        // Auto-advance journey support stage → renewal when ticket is closed
        if ($newStatus === 'closed') {
            require_once __DIR__ . '/journey-utils.php';
            journeyAutoAdvance($db, $tenantId, 'support', 'support_ticket', $id);
        }

        // AI closing summary when resolved/closed
        if (in_array($newStatus, ['resolved','closed'], true)) {
            try {
                $ai = supportResolveAi($db, $tenantId);
                if ($ai) {
                    $ticketInfo = $db->prepare("
                        SELECT st.title, st.description, st.resolution_note
                        FROM support_tickets st WHERE st.id = ?
                    ");
                    $ticketInfo->execute([$id]);
                    $ti = $ticketInfo->fetch();

                    if ($ti && empty($ti['resolution_note'])) {
                        // Load recent comments for context
                        $comments = $db->prepare("
                            SELECT stc.comment, u.display_name
                            FROM support_ticket_comments stc
                            LEFT JOIN users u ON u.id = stc.user_id
                            WHERE stc.ticket_id = ? ORDER BY stc.created_at DESC LIMIT 5
                        ");
                        $comments->execute([$id]);
                        $commentText = implode("\n", array_map(
                            fn($c) => "[{$c['display_name']}]: {$c['comment']}",
                            $comments->fetchAll()
                        ));

                        $closePayload = json_encode([
                            'model'    => $ai['model'],
                            'messages' => [[
                                'role'    => 'user',
                                'content' => "สรุปการแก้ไข ticket นี้เป็น 1-2 ประโยคภาษาไทย ใช้ HTML จัดรูปแบบได้ (<strong>, <p>, <ul>, <li>):"
                                           . "\nชื่อ: {$ti['title']}"
                                           . "\nปัญหา: {$ti['description']}"
                                           . ($commentText ? "\nความคิดเห็นล่าสุด:\n$commentText" : ''),
                            ]],
                            'stream' => false,
                            'max_tokens' => 512,
                        ]);
                        $closeCh = curl_init($ai['base_url'] . '/chat/completions');
                        curl_setopt_array($closeCh, [
                            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $closePayload,
                            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8,
                            CURLOPT_CONNECTTIMEOUT => 5,
                            CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
                            CURLOPT_HTTPHEADER => [
                                'Content-Type: application/json',
                                'Authorization: Bearer ' . $ai['api_key'],
                            ],
                        ]);
                        $closeRaw  = curl_exec($closeCh); curl_close($closeCh);
                        $closeResp = json_decode($closeRaw, true);
                        $note = trim($closeResp['choices'][0]['message']['content'] ?? '');
                        if ($note) {
                            $db->prepare("UPDATE support_tickets SET resolution_note = ? WHERE id = ?")->execute([$note, $id]);
                        }
                    }
                }
            } catch (\Throwable $e) {
                error_log('[ticket ai-close-summary] ' . $e->getMessage());
            }
        }
    }

    // Inbox notification: notify new assignee when ticket is reassigned
    if (!empty($b['assigned_to'])) {
        $ticketStmt = $db->prepare('SELECT assigned_to, title FROM support_tickets WHERE id = ?');
        $ticketStmt->execute([$id]);
        $ticket = $ticketStmt->fetch();
        $prevAssigned = $ticket['assigned_to'] ?? null;
        if ($b['assigned_to'] !== $prevAssigned && $b['assigned_to'] !== $userId) {
            $creatorStmt = $db->prepare('SELECT display_name, email FROM users WHERE id = ?');
            $creatorStmt->execute([$userId]);
            $creator = $creatorStmt->fetch();
            inboxNotify(
                $db, $tenantId, $b['assigned_to'],
                $creator['display_name'] ?? 'ระบบ', $creator['email'] ?? '',
                'Ticket ถูกมอบหมายให้คุณ: ' . ($ticket['title'] ?? ''),
                'คุณถูกมอบหมาย ticket "' . ($ticket['title'] ?? '') . '"',
                'ticket', $b['priority'] ?? 'medium', $id
            );
        }
    }

    jsonResponse(ticketWithMeta($db, $id, $tenantId));
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id');
    $db->prepare('DELETE FROM support_tickets WHERE id = ? AND tenant_id = ?')->execute([$id, $tenantId]);

    require_once __DIR__ . '/journey-utils.php';
    journeyCleanupEntityLinks($db, 'support_ticket', $id);

    jsonResponse(['success' => true]);
}
