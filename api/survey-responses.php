<?php
// api/survey-responses.php
// POST              - create response (internal, generate token)
// GET ?opportunity_id=X - list responses for opportunity
// GET ?id=X         - get response detail with answers + score
// GET ?list=1       - list all responses (opt filters: template_id, company_id)
// POST ?id=X&action=submit - internal submit with answers
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/survey-scoring.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $id            = $_GET['id'] ?? null;
    $opportunityId = $_GET['opportunity_id'] ?? null;

    if ($id) {
        $stmt = $db->prepare('SELECT * FROM survey_responses WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$id, $tenantId]);
        $response = $stmt->fetch();
        if (!$response) jsonError('ไม่พบ response', 404);

        // Fetch answers with question text
        $aStmt = $db->prepare('
            SELECT sa.*, sq.question_text, sq.question_type, sq.order_index,
                   sq.options_json, sq.is_critical, sq.max_score
            FROM survey_answers sa
            JOIN survey_questions sq ON sa.question_id = sq.id
            WHERE sa.response_id = ?
            ORDER BY sq.order_index ASC
        ');
        $aStmt->execute([$id]);
        $response['answers'] = $aStmt->fetchAll();

        // Fetch template name
        $tStmt = $db->prepare('SELECT name, industry, strategic_theme FROM survey_templates WHERE id = ?');
        $tStmt->execute([$response['template_id']]);
        $response['template'] = $tStmt->fetch();

        // Fetch company name
        $cStmt = $db->prepare('SELECT name FROM companies WHERE id = ?');
        $cStmt->execute([$response['company_id']]);
        $company = $cStmt->fetch();
        $response['company_name'] = $company['name'] ?? '';

        jsonResponse($response);
    }

    if ($opportunityId) {
        $stmt = $db->prepare('
            SELECT sr.*, st.name as template_name, st.industry, st.strategic_theme
            FROM survey_responses sr
            JOIN survey_templates st ON sr.template_id = st.id
            WHERE sr.opportunity_id = ? AND sr.tenant_id = ?
            ORDER BY sr.created_at DESC
        ');
        $stmt->execute([$opportunityId, $tenantId]);
        jsonResponse($stmt->fetchAll());
    }

    // List all responses with optional filters
    if (($_GET['list'] ?? '') === '1') {
        $templateId = $_GET['template_id'] ?? null;
        $companyId  = $_GET['company_id'] ?? null;

        $sql = '
            SELECT sr.id, sr.status, sr.pain_point_score, sr.pain_priority,
                   sr.submitted_at, sr.created_at, sr.updated_at, sr.token,
                   st.id as template_id, st.name as template_name, st.industry, st.strategic_theme,
                   c.id as company_id, c.name as company_name,
                   opp.name as opportunity_name
            FROM survey_responses sr
            JOIN survey_templates st ON sr.template_id = st.id
            JOIN companies c ON sr.company_id = c.id
            LEFT JOIN sales_opportunities opp ON sr.opportunity_id = opp.id
            WHERE sr.tenant_id = ?
        ';
        $params = [$tenantId];

        if ($templateId) {
            $sql .= ' AND sr.template_id = ?';
            $params[] = $templateId;
        }
        if ($companyId) {
            $sql .= ' AND sr.company_id = ?';
            $params[] = $companyId;
        }

        $sql .= ' ORDER BY sr.created_at DESC LIMIT 200';
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll());
    }

    jsonError('ต้องระบุ id หรือ opportunity_id', 400);
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $action = $_GET['action'] ?? null;
    $id     = $_GET['id'] ?? null;

    // Internal submit: POST ?id=X&action=submit  {answers:[...]}
    if ($action === 'submit' && $id) {
        $stmt = $db->prepare('SELECT * FROM survey_responses WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$id, $tenantId]);
        $response = $stmt->fetch();
        if (!$response) jsonError('ไม่พบ response', 404);
        if ($response['status'] === 'completed') jsonError('กรอกแบบสอบถามนี้ไปแล้ว', 409);

        $body    = json_decode(file_get_contents('php://input'), true);
        $answers = $body['answers'] ?? [];

        $qStmt = $db->prepare('SELECT * FROM survey_questions WHERE template_id = ?');
        $qStmt->execute([$response['template_id']]);
        $questions = $qStmt->fetchAll();

        $scoring = calculateScore($answers, $questions);

        $validQids = array_column($questions, 'id');
        foreach ($answers as $a) {
            if (!in_array($a['question_id'], $validQids, true)) {
                jsonError('question_id ไม่ถูกต้อง', 400);
            }
        }

        $db->beginTransaction();
        try {
            $now = date('Y-m-d H:i:s');

            // Insert answers
            $aStmt = $db->prepare('
                INSERT INTO survey_answers (id, response_id, question_id, answer_value, score_contribution, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ');
            foreach ($answers as $a) {
                $contrib = $scoring['per_question'][$a['question_id']] ?? 0.0;
                $aStmt->execute([generateUUID(), $id, $a['question_id'], $a['answer_value'], $contrib, $now]);
            }

            // Update response
            $db->prepare('
                UPDATE survey_responses
                SET status=\'completed\', pain_point_score=?, pain_priority=?, submitted_by=?, submitted_at=?, updated_at=?
                WHERE id=?
            ')->execute([$scoring['score'], $scoring['priority'], $userId, $now, $now, $id]);

            // Update opportunity notes + auto-promote lead→qualified
            updateOpportunityFromSurvey($db, $response['opportunity_id'], $scoring);

            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            jsonError('เกิดข้อผิดพลาดในการบันทึก', 500);
        }

        jsonResponse(['message' => 'บันทึกสำเร็จ', 'score' => $scoring]);
    }

    // Create new response: POST {template_id, opportunity_id, company_id}
    $body = json_decode(file_get_contents('php://input'), true);
    if (empty($body['template_id']) || empty($body['opportunity_id']) || empty($body['company_id'])) {
        jsonError('ต้องระบุ template_id, opportunity_id, company_id', 400);
    }

    $id    = generateUUID();
    $token = bin2hex(random_bytes(32)); // 64 hex chars
    $now   = date('Y-m-d H:i:s');

    $stmt = $db->prepare('
        INSERT INTO survey_responses
          (id, tenant_id, template_id, opportunity_id, company_id, token, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, \'pending\', ?, ?)
    ');
    $stmt->execute([
        $id, $tenantId,
        $body['template_id'],
        $body['opportunity_id'],
        $body['company_id'],
        $token, $now, $now,
    ]);

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $appUrl = $_ENV['APP_URL'] ?? ($scheme . '://' . $_SERVER['HTTP_HOST']);
    $publicUrl = rtrim($appUrl, '/') . '/#/survey/public/' . $token;

    // Log customer activity for the opportunity's contact
    $contactStmt = $db->prepare('SELECT customer_id FROM sales_opportunities WHERE id = ?');
    $contactStmt->execute([$body['opportunity_id']]);
    $contactId = $contactStmt->fetchColumn();
    if ($contactId) {
        $actId = generateUUID();
        $details = json_encode(['token' => $token, 'public_url' => $publicUrl]);
        $db->prepare('
            INSERT INTO customer_activities (id, customer_id, activity_type, reference_id, details, created_at)
            VALUES (?, ?, \'survey_sent\', ?, ?, NOW())
        ')->execute([$actId, $contactId, $id, $details]);
    }

    jsonResponse(['id' => $id, 'token' => $token, 'public_url' => $publicUrl]);
}

// ── DELETE ───────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('ต้องระบุ id', 400);

    $stmt = $db->prepare('SELECT * FROM survey_responses WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    $response = $stmt->fetch();
    if (!$response) jsonError('ไม่พบ response', 404);

    $db->prepare('DELETE FROM survey_responses WHERE id = ?')->execute([$id]);
    jsonResponse(['message' => 'ลบรายการสำเร็จ']);
}

jsonError('Method not allowed', 405);

function updateOpportunityFromSurvey(PDO $db, string $opportunityId, array $scoring): void {
    $stmt = $db->prepare('SELECT stage, notes FROM sales_opportunities WHERE id = ?');
    $stmt->execute([$opportunityId]);
    $opp = $stmt->fetch();
    if (!$opp) return;

    $priorityLabel = ['critical'=>'วิกฤต', 'high'=>'สูง', 'medium'=>'ปานกลาง', 'low'=>'ต่ำ'][$scoring['priority']] ?? $scoring['priority'];
    $summary = "\n[Survey] Pain Score: {$scoring['percentage']}% | ระดับ: {$priorityLabel}";
    $newNotes = ($opp['notes'] ?? '') . $summary;

    $newStage = ($opp['stage'] === 'lead') ? 'qualified' : $opp['stage'];
    $now = date('Y-m-d H:i:s');

    $db->prepare('UPDATE sales_opportunities SET notes=?, stage=?, updated_at=? WHERE id=?')
       ->execute([$newNotes, $newStage, $now, $opportunityId]);
}
