<?php
// api/survey-public.php
// NO requireAuth() — public endpoint
// GET  ?token=X - fetch template + questions
// POST ?token=X - submit answers → score → update opportunity
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/survey-scoring.php';

$db     = getDB();
$method = getMethod();
$token  = $_GET['token'] ?? null;

if (!$token) jsonError('ต้องระบุ token', 400);

// Validate token and get response record
$stmt = $db->prepare('SELECT * FROM survey_responses WHERE token = ?');
$stmt->execute([$token]);
$response = $stmt->fetch();
if (!$response) jsonError('ลิงก์ไม่ถูกต้องหรือหมดอายุ', 404);
if ($response['status'] === 'completed') jsonError('แบบสอบถามนี้ถูกกรอกไปแล้ว', 409);

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $tStmt = $db->prepare('SELECT id, name, description, industry, strategic_theme FROM survey_templates WHERE id = ?');
    $tStmt->execute([$response['template_id']]);
    $template = $tStmt->fetch();
    if (!$template) jsonError('ไม่พบ template', 404);

    $qStmt = $db->prepare('SELECT id, order_index, question_text, question_type, options_json, is_critical FROM survey_questions WHERE template_id = ? ORDER BY order_index ASC');
    $qStmt->execute([$response['template_id']]);
    $template['questions'] = $qStmt->fetchAll();

    // Fetch company name for display
    $cStmt = $db->prepare('SELECT name FROM companies WHERE id = ?');
    $cStmt->execute([$response['company_id']]);
    $company = $cStmt->fetch();

    jsonResponse([
        'template'     => $template,
        'company_name' => $company['name'] ?? '',
        'response_id'  => $response['id'],
    ]);
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body    = json_decode(file_get_contents('php://input'), true);
    $answers = $body['answers'] ?? [];
    if (empty($answers)) jsonError('ต้องกรอกคำตอบ', 400);

    $qStmt = $db->prepare('SELECT * FROM survey_questions WHERE template_id = ?');
    $qStmt->execute([$response['template_id']]);
    $questions = $qStmt->fetchAll();

    // Validate question_ids belong to this template
    $validQids = array_column($questions, 'id');
    foreach ($answers as $a) {
        if (!in_array($a['question_id'], $validQids, true)) {
            jsonError('question_id ไม่ถูกต้อง', 400);
        }
    }

    $scoring = calculateScore($answers, $questions);
    $now     = date('Y-m-d H:i:s');

    $db->beginTransaction();
    try {
        // Insert answers
        $aStmt = $db->prepare('
            INSERT INTO survey_answers (id, response_id, question_id, answer_value, score_contribution, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        foreach ($answers as $a) {
            $contrib = $scoring['per_question'][$a['question_id']] ?? 0.0;
            $aStmt->execute([generateUUID(), $response['id'], $a['question_id'], $a['answer_value'], $contrib, $now]);
        }

        // Update response — submitted_by is NULL (external)
        $db->prepare('
            UPDATE survey_responses
            SET status=\'completed\', pain_point_score=?, pain_priority=?, submitted_by=NULL, submitted_at=?, updated_at=?
            WHERE id=?
        ')->execute([$scoring['score'], $scoring['priority'], $now, $now, $response['id']]);

        // Update opportunity notes + auto-promote
        $priorityLabel = ['critical'=>'วิกฤต','high'=>'สูง','medium'=>'ปานกลาง','low'=>'ต่ำ'][$scoring['priority']] ?? $scoring['priority'];
        $summary = "\n[Survey-External] Pain Score: {$scoring['percentage']}% | ระดับ: {$priorityLabel}";
        $oppStmt = $db->prepare('SELECT stage, notes FROM sales_opportunities WHERE id = ?');
        $oppStmt->execute([$response['opportunity_id']]);
        $opp = $oppStmt->fetch();
        if ($opp) {
            $newStage = ($opp['stage'] === 'lead') ? 'qualified' : $opp['stage'];
            $newNotes = ($opp['notes'] ?? '') . $summary;
            $db->prepare('UPDATE sales_opportunities SET notes=?, stage=?, updated_at=? WHERE id=?')
               ->execute([$newNotes, $newStage, $now, $response['opportunity_id']]);
        }

        $db->commit();
    } catch (\Exception $e) {
        $db->rollBack();
        jsonError('เกิดข้อผิดพลาดในการบันทึก', 500);
    }

    jsonResponse(['message' => 'ขอบคุณสำหรับการตอบแบบสอบถาม', 'priority' => $scoring['priority']]);
}

jsonError('Method not allowed', 405);
