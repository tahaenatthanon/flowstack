<?php
// api/surveys.php
// GET    - list templates (global + own personal)
// GET    ?id=X - get template with questions
// POST   - create template + questions
// PUT    ?id=X - update template + questions
// DELETE ?id=X - delete (owner or admin)
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/survey-scoring.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

// Check admin status
$isAdmin = isTenantAdmin($db, $userId, $tenantId);

// Seed built-in global templates if not yet seeded
seedBuiltinTemplates($db, $tenantId, $userId);

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    if ($id) {
        if ($isAdmin) {
            $stmt = $db->prepare('SELECT * FROM survey_templates WHERE id = ? AND tenant_id = ?');
            $stmt->execute([$id, $tenantId]);
        } else {
            $stmt = $db->prepare('SELECT * FROM survey_templates WHERE id = ? AND tenant_id = ? AND (is_global = 1 OR created_by = ?)');
            $stmt->execute([$id, $tenantId, $userId]);
        }
        $template = $stmt->fetch();
        if (!$template) jsonError('ไม่พบ template', 404);

        $qStmt = $db->prepare('SELECT * FROM survey_questions WHERE template_id = ? ORDER BY order_index ASC');
        $qStmt->execute([$id]);
        $template['questions'] = $qStmt->fetchAll();
        jsonResponse($template);
    }

    // List: global + personal (owned by user)
    $stmt = $db->prepare('
        SELECT * FROM survey_templates
        WHERE tenant_id = ? AND (is_global = 1 OR created_by = ?)
        ORDER BY is_global DESC, name ASC
    ');
    $stmt->execute([$tenantId, $userId]);
    jsonResponse($stmt->fetchAll());
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    // ── action=suggest-weights ────────────────────────────────────────────
    $action = $_GET['action'] ?? null;
    if ($action === 'suggest-weights') {
        $questions = $body['questions'] ?? [];
        if (empty($questions)) jsonError('ต้องระบุ questions', 400);

        // Resolve AI credentials
        $credStmt = $db->prepare("
            SELECT ap.api_base_url, ap.api_key_encrypted, COALESCE(am_t.model_id, am_d.model_id) AS model_id
            FROM company_settings cs
            LEFT JOIN ai_models am_t ON am_t.id = cs.ai_content_text_model_id
            LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
            JOIN ai_providers ap ON ap.id = COALESCE(am_t.provider_id, am_d.provider_id)
            WHERE cs.tenant_id = ? LIMIT 1
        ");
        $credStmt->execute([$tenantId]);
        $credRow = $credStmt ? $credStmt->fetch() : null;
        if (!$credRow || empty($credRow['api_key_encrypted'])) {
            jsonError('AI provider not configured', 503);
        }
        $plain = decryptApiKey($credRow['api_key_encrypted']);
        if ($plain === '' || $plain === false) jsonError('Failed to decrypt API key', 500);
        $baseUrl  = rtrim($credRow['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
        $model    = $credRow['model_id'] ?: 'openai/gpt-4o-mini';

        // Build prompt
        $qTexts = [];
        $criticalCount = 0;
        foreach ($questions as $q) {
            $type  = $q['question_type'] ?? 'text';
            $text  = $q['question_text'] ?? '';
            $isCrit = (int)($q['is_critical'] ?? 0);
            if ($isCrit) $criticalCount++;
            $qTexts[] = "- [{$type}] {$text}" . ($isCrit ? ' (is_critical=1, min weight ≥ 15%)' : '');
        }
        $qList = implode("\n", $qTexts);
        $prompt = <<<PROMPT
คุณคือผู้เชี่ยวชาญด้าน Survey Design
มีคำถาม N ข้อ ดังนี้:
{$qList}

ให้ตอบเป็น JSON array เท่านั้น: [{"question_index":0,"weight_pct":25,"reason":"คำอธิบายสั้นภาษาไทย"}, ...]
เงื่อนไข:
- Σweight_pct = 100
- ข้อที่เป็น is_critical=1 ต้องน้ำหนัก ≥ 15
- แจกน้ำหนักตามความสำคัญของคำถามต่อเป้าหมายการสำรวจ
- ตอบ JSON เท่านั้น ไม่มี markdown
PROMPT;

        $payload = [
            'model'    => $model,
            'messages' => [
                ['role' => 'system', 'content' => 'คุณคือนักออกแบบแบบสอบถามมืออาชีพ ตอบเป็นภาษาไทยเท่านั้น ตอบเป็น JSON เท่านั้น'],
                ['role' => 'user',   'content' => $prompt],
            ],
            'stream'     => false,
            'max_tokens' => 4096,
        ];

        $ch = curl_init($baseUrl . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . trim($plain), 'Content-Type: application/json'],
            CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CONNECTTIMEOUT => 15,
        ]);
        $aiRaw = curl_exec($ch);
        curl_close($ch);

        $aiResp  = json_decode($aiRaw, true);
        $content = $aiResp['choices'][0]['message']['content'] ?? null;
        if (!$content) jsonError('AI returned empty response', 500);

        $content = preg_replace('/^```(?:json)?\s*/i', '', trim($content));
        $content = preg_replace('/\s*```$/i', '', $content);
        $parsed  = json_decode($content, true);

        if (!is_array($parsed)) jsonError('AI response was not valid JSON', 500);

        // Normalize to 100
        $sum = array_sum(array_column($parsed, 'weight_pct'));
        if ($sum > 0) {
            foreach ($parsed as &$w) {
                $w['weight_pct'] = round(($w['weight_pct'] / $sum) * 100, 1);
            }
        }

        jsonResponse($parsed);
    }

    if (empty($body['name'])) jsonError('ต้องระบุชื่อ template', 400);

    // Only admin can create global templates
    $isGlobal = isset($body['is_global']) && $body['is_global'] && $isAdmin ? 1 : 0;

    $id  = generateUUID();
    $now = date('Y-m-d H:i:s');

    $stmt = $db->prepare('
        INSERT INTO survey_templates (id, tenant_id, name, industry, strategic_theme, description, is_global, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([
        $id, $tenantId,
        $body['name'],
        $body['industry'] ?? 'general',
        $body['strategic_theme'] ?? 'general',
        $body['description'] ?? null,
        $isGlobal,
        $userId, $now, $now,
    ]);

    insertQuestions($db, $id, $body['questions'] ?? []);
    jsonResponse(['id' => $id, 'message' => 'สร้าง template สำเร็จ']);
}

// ── PUT ──────────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('ต้องระบุ id', 400);

    $stmt = $db->prepare('SELECT * FROM survey_templates WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    $template = $stmt->fetch();
    if (!$template) jsonError('ไม่พบ template', 404);
    if (!$isAdmin && $template['created_by'] !== $userId) jsonError('ไม่มีสิทธิ์แก้ไข', 403);

    $body = json_decode(file_get_contents('php://input'), true);
    $now  = date('Y-m-d H:i:s');

    $isGlobal = isset($body['is_global']) && $body['is_global'] && $isAdmin ? 1 : (int)$template['is_global'];

    $stmt = $db->prepare('
        UPDATE survey_templates
        SET name=?, industry=?, strategic_theme=?, description=?, is_global=?, updated_at=?
        WHERE id=?
    ');
    $stmt->execute([
        $body['name'] ?? $template['name'],
        $body['industry'] ?? $template['industry'],
        $body['strategic_theme'] ?? $template['strategic_theme'],
        $body['description'] ?? $template['description'],
        $isGlobal, $now, $id,
    ]);

    if (isset($body['questions'])) {
        $db->prepare('DELETE FROM survey_questions WHERE template_id = ?')->execute([$id]);
        insertQuestions($db, $id, $body['questions']);
    }

    jsonResponse(['message' => 'อัปเดต template สำเร็จ']);
}

// ── DELETE ───────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('ต้องระบุ id', 400);

    $stmt = $db->prepare('SELECT * FROM survey_templates WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    $template = $stmt->fetch();
    if (!$template) jsonError('ไม่พบ template', 404);
    if (!$isAdmin && $template['created_by'] !== $userId) jsonError('ไม่มีสิทธิ์ลบ', 403);

    $db->prepare('DELETE FROM survey_templates WHERE id = ?')->execute([$id]);
    jsonResponse(['message' => 'ลบ template สำเร็จ']);
}

jsonError('Method not allowed', 405);

// ── Helpers ──────────────────────────────────────────────────────────────────

function insertQuestions(PDO $db, string $templateId, array $questions): void {
    $now  = date('Y-m-d H:i:s');
    $stmt = $db->prepare('
        INSERT INTO survey_questions
          (id, template_id, order_index, question_text, question_type, options_json,
           weight, is_critical, critical_bonus, max_score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    foreach ($questions as $i => $q) {
        $stmt->execute([
            generateUUID(), $templateId, $i,
            $q['question_text'],
            $q['question_type'],
            isset($q['options_json']) ? json_encode($q['options_json']) : null,
            $q['weight'] ?? 1.00,
            $q['is_critical'] ?? 0,
            $q['critical_bonus'] ?? 0.00,
            $q['max_score'] ?? ($q['question_type'] === 'scale_1_5' ? 5.00 : 1.00),
            $now, $now,
        ]);
    }
}

function seedBuiltinTemplates(PDO $db, string $tenantId, string $userId): void {
    // Per-template-name guard: skip existing so new templates are added
    // for existing tenants without duplicating.
    $existsStmt = $db->prepare('SELECT COUNT(*) FROM survey_templates WHERE tenant_id = ? AND name = ? AND is_global = 1');

    $templates = [
        // ── 1. IT Bottleneck Audit ──────────────────────────────────────────
        [
            'name' => 'IT Bottleneck Audit',
            'industry' => 'it_service',
            'strategic_theme' => 'it_bottleneck',
            'description' => 'สำรวจจุดคอขวดที่ระบบ IT เดิมทำงานแบบ Manual ซ้ำซ้อน สื่อสารระหว่างระบบไม่ได้ และเป็นอุปสรรคต่อการขยายธุรกิจ เหมาะสำหรับบริษัท IT Service ที่มีลูกค้าหลายรายและระบบ Legacy จำนวนมาก',
            'questions' => [
                ['question_text'=>'ระบบปัจจุบันของคุณสามารถแลกเปลี่ยนข้อมูลกันได้โดยอัตโนมัติ (API/Integration) หรือต้องทำด้วยตนเอง?','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>5],
                ['question_text'=>'มีงานที่ทีมต้องทำซ้ำๆ ด้วยมือ (Manual) ทุกวันหรือไม่?','question_type'=>'yes_no','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'เคยเกิดข้อมูลผิดพลาดเพราะพิมพ์ซ้ำหรือ Copy-Paste ระหว่างระบบหรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'ระบบหลักที่ใช้อยู่มีอายุเกิน 5 ปีหรือไม่?','question_type'=>'yes_no','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'ทีมใช้เวลากี่ชั่วโมงต่อสัปดาห์กับงาน Report ที่ต้อง Export/Import ผ่าน Excel?','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'จำนวนระบบ Software ที่องค์กรใช้อยู่ (ERP, CRM, Accounting, HR, Inventory ฯลฯ)','question_type'=>'multiple_choice','weight'=>1.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'1-2','label'=>'1-2 ระบบ','score'=>0.25],['value'=>'3-5','label'=>'3-5 ระบบ','score'=>0.5],['value'=>'6-10','label'=>'6-10 ระบบ','score'=>0.75],['value'=>'10+','label'=>'มากกว่า 10 ระบบ','score'=>1]]],
                ['question_text'=>'มีแผนก IT ภายในองค์กรหรือใช้ Outsource?','question_type'=>'multiple_choice','weight'=>1.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'internal','label'=>'มีแผนก IT ภายใน','score'=>1],['value'=>'outsource','label'=>'Outsource ทั้งหมด','score'=>0.33],['value'=>'hybrid','label'=>'ผสมทั้งสองแบบ','score'=>0.66],['value'=>'none','label'=>'ไม่มี IT เลย','score'=>0]]],
                ['question_text'=>'ระบบปัจจุบันรองรับการทำงานบน Cloud ได้หรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'เคยมีเหตุการณ์ระบบล่ม (Downtime) กระทบธุรกิจในรอบ 6 เดือนที่ผ่านมาหรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>12,'max_score'=>1],
                ['question_text'=>'ความพึงพอใจของผู้ใช้งานต่อระบบ IT ปัจจุบัน (ความเร็ว, ความเสถียร, UX)','question_type'=>'scale_1_5','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
            ],
        ],
        // ── 2. AI Governance Readiness ──────────────────────────────────────
        [
            'name' => 'AI Governance Readiness',
            'industry' => 'general',
            'strategic_theme' => 'ai_governance',
            'description' => 'ประเมินความเสี่ยงข้อมูลรั่วไหล ภัยคุกคามทางไซเบอร์ และการขาดธรรมาภิบาลในการใช้ AI ภายในองค์กร เหมาะสำหรับองค์กรที่พนักงานเริ่มใช้ AI Tools โดยยังไม่มีนโยบายควบคุมที่ชัดเจน',
            'questions' => [
                ['question_text'=>'พนักงานในองค์กรใช้ AI Tools (ChatGPT, Copilot, Gemini ฯลฯ) ในการทำงานหรือไม่?','question_type'=>'yes_no','weight'=>1.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'มีนโยบายควบคุมการใช้ AI เป็นลายลักษณ์อักษรที่พนักงานทุกคนรับทราบหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'เคยมีกรณีที่ข้อมูลลูกค้าหรือข้อมูลความลับทางธุรกิจถูกป้อนเข้า AI ภายนอกหรือไม่?','question_type'=>'yes_no','weight'=>3.0,'is_critical'=>1,'critical_bonus'=>15,'max_score'=>1],
                ['question_text'=>'ระบบ IT มีการแยก Network (VLAN/DMZ) สำหรับข้อมูลลับหรือข้อมูลลูกค้าหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'ผู้บริหารระดับสูง (C-Level) ตระหนักถึงความเสี่ยงด้าน AI Data Leakage และ Cybersecurity หรือไม่?','question_type'=>'scale_1_5','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'องค์กรมี Data Classification Policy (การจัดระดับชั้นความลับของข้อมูล) หรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'จำนวน AI Tools ที่พนักงานใช้งานโดยไม่ผ่านการอนุมัติจาก IT (Shadow AI)','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>1,'critical_bonus'=>8,'max_score'=>5],
                ['question_text'=>'มีการอบรมพนักงานเรื่องความปลอดภัยในการใช้ AI อย่างน้อยปีละครั้งหรือไม่?','question_type'=>'yes_no','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'องค์กรมี DLP (Data Loss Prevention) Solution หรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>12,'max_score'=>1],
                ['question_text'=>'หากมีการรั่วไหลของข้อมูลผ่าน AI องค์กรมีแผนรับมือและแจ้งลูกค้าภายในกี่ชั่วโมง?','question_type'=>'multiple_choice','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'24h','label'=>'ภายใน 24 ชม.','score'=>1],['value'=>'72h','label'=>'ภายใน 72 ชม.','score'=>0.66],['value'=>'no_plan','label'=>'ไม่มีแผนรับมือ','score'=>0],['value'=>'unknown','label'=>'ไม่ทราบ','score'=>0]]],
            ],
        ],
        // ── 3. ISO Compliance Survey ────────────────────────────────────────
        [
            'name' => 'ISO Compliance Survey',
            'industry' => 'food_pharma',
            'strategic_theme' => 'iso_compliance',
            'description' => 'ประเมินความพร้อมก่อนขอการรับรอง ISO 9001, GHP, HACCP สำหรับโรงงานอาหารและยา ครอบคลุมระบบเอกสาร การตรวจสอบย้อนกลับ และการควบคุมคุณภาพ',
            'questions' => [
                ['question_text'=>'องค์กรมีเอกสารขั้นตอนการทำงาน (SOP) ครบถ้วนทุกกระบวนการผลิตหรือไม่?','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'มีระบบ Traceability ติดตาม Lot/Batch ของวัตถุดิบตั้งแต่ต้นทางถึงปลายทางได้หรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'เคยผ่านการ Audit จากหน่วยงานภายนอก (อย., FDA, ลูกค้า) ในรอบ 2 ปีหรือไม่?','question_type'=>'yes_no','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'ระบบบันทึกข้อมูลคุณภาพ (QC Report, COA) ยังเป็นกระดาษหรือ Excel อยู่หรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>1,'critical_bonus'=>8,'max_score'=>1],
                ['question_text'=>'มีแผนจะได้รับ ISO 9001 หรือ GHP ภายใน 12 เดือนหรือไม่?','question_type'=>'yes_no','weight'=>1.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'มีระบบจัดการเอกสาร (Document Management) ที่ควบคุม Version และ Approval Flow หรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>1,'critical_bonus'=>8,'max_score'=>1],
                ['question_text'=>'มีการสอบเทียบเครื่องมือวัด (Calibration) ตามตารางที่กำหนดครบถ้วนหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'จำนวน Non-Conformance (NC) ที่พบในการตรวจติดตามภายใน (Internal Audit) ครั้งล่าสุด','question_type'=>'scale_1_5','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>5],
                ['question_text'=>'พนักงานได้รับการอบรมด้านคุณภาพ (Quality Awareness) อย่างน้อยปีละ 1 ครั้งหรือไม่?','question_type'=>'yes_no','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'ระบบ Supplier Evaluation — มีการประเมินและจัดอันดับ Supplier ตามมาตรฐานคุณภาพหรือไม่?','question_type'=>'multiple_choice','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'full','label'=>'มีระบบเต็มรูปแบบ','score'=>1],['value'=>'partial','label'=>'มีบางส่วน','score'=>0.66],['value'=>'planned','label'=>'กำลังวางแผน','score'=>0.33],['value'=>'none','label'=>'ยังไม่มี','score'=>0]]],
            ],
        ],
        // ── 4. Tapioca Factory Operations ───────────────────────────────────
        [
            'name' => 'Tapioca Factory Operations',
            'industry' => 'tapioca_factory',
            'strategic_theme' => 'general',
            'description' => 'ประเมินระบบบริหารจัดการโรงงานแป้งมันครบวงจร ตั้งแต่รับวัตถุดิบ กระบวนการผลิต จนถึงส่งมอบลูกค้า เน้นการลดต้นทุน เพิ่มประสิทธิภาพ และควบคุม Stock แบบ Real-time',
            'questions' => [
                ['question_text'=>'ระบบ Stock/Inventory ปัจจุบันเป็นแบบ Real-time หรือปิดบัญชีรายวัน?','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'มี BOM (Bill of Materials) ที่อัปเดตอัตโนมัติตามยอดผลิตจริงหรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'เคยมีปัญหาวัตถุดิบขาดมือกะทันหันโดยไม่มีการแจ้งเตือนล่วงหน้าหรือไม่?','question_type'=>'yes_no','weight'=>3.0,'is_critical'=>1,'critical_bonus'=>12,'max_score'=>1],
                ['question_text'=>'ต้นทุนการผลิตต่อหน่วย (Unit Cost) ถูกคำนวณอัตโนมัติจากข้อมูลจริงหรือทำด้วยมือ?','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'ระบบรายงานการผลิตเชื่อมกับฝ่ายบัญชีและการเงินโดยตรงหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'กำลังการผลิต (Capacity Utilization) โดยเฉลี่ยของโรงงานในปัจจุบัน','question_type'=>'scale_1_5','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>8,'max_score'=>5],
                ['question_text'=>'มีระบบบำรุงรักษาเครื่องจักรเชิงป้องกัน (Preventive Maintenance) หรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'ระยะเวลาเฉลี่ยในการปิดงบบัญชีต้นทุนต่อเดือน (Month-End Closing)','question_type'=>'multiple_choice','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'1-3','label'=>'1-3 วัน','score'=>1],['value'=>'4-7','label'=>'4-7 วัน','score'=>0.66],['value'=>'8-14','label'=>'8-14 วัน','score'=>0.33],['value'=>'15+','label'=>'มากกว่า 15 วัน','score'=>0]]],
                ['question_text'=>'ระบบสามารถติดตาม WIP (Work in Progress) ระหว่างกระบวนการผลิตได้ Real-time หรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'อัตราของเสีย (Yield Loss) โดยเฉลี่ยในกระบวนการผลิต','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
            ],
        ],
        // ── 5. Digital Transformation Readiness ──────────────────────────
        [
            'name' => 'Digital Transformation Readiness',
            'industry' => 'general',
            'strategic_theme' => 'general',
            'description' => 'ประเมินความพร้อมขององค์กรในการเปลี่ยนผ่านสู่ดิจิทัล (Digital Transformation) ครอบคลุมด้านกลยุทธ์ กระบวนการ เทคโนโลยี และบุคลากร เหมาะสำหรับองค์กรทุกขนาดที่ต้องการเริ่มต้น DX Journey',
            'questions' => [
                ['question_text'=>'องค์กรมีแผนกลยุทธ์ Digital Transformation ที่ชัดเจนและสื่อสารทั่วทั้งองค์กรหรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'ผู้บริหารระดับสูงให้การสนับสนุนและเป็น Sponsor ของโครงการ Digital Transformation หรือไม่?','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'สัดส่วนของกระบวนการทำงานที่ยังใช้กระดาษอยู่','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>1,'critical_bonus'=>8,'max_score'=>5],
                ['question_text'=>'พนักงานมีทักษะด้านดิจิทัล (Digital Literacy) เพียงพอต่อการใช้งานระบบใหม่หรือไม่?','question_type'=>'scale_1_5','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'องค์กรเคยลงทุนในโครงการ Digital Transformation มาก่อนและผลลัพธ์เป็นอย่างไร?','question_type'=>'multiple_choice','weight'=>1.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'success','label'=>'สำเร็จตามเป้า','score'=>1],['value'=>'partial','label'=>'สำเร็จบางส่วน','score'=>0.5],['value'=>'failed','label'=>'ไม่สำเร็จ','score'=>0.25],['value'=>'never','label'=>'ไม่เคยทำ','score'=>0]]],
                ['question_text'=>'ข้อมูลทางธุรกิจถูกจัดเก็บในรูปแบบดิจิทัลที่สามารถนำมาวิเคราะห์ต่อได้หรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'มีระบบ ERP หรือระบบบริหารจัดการกลางที่เชื่อมทุกแผนกเข้าด้วยกันหรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>12,'max_score'=>1],
                ['question_text'=>'องค์กรมีวัฒนธรรมการเรียนรู้และปรับตัวอย่างต่อเนื่อง (Continuous Improvement) หรือไม่?','question_type'=>'scale_1_5','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'งบประมาณด้าน IT และ Digital Transformation คิดเป็นกี่เปอร์เซ็นต์ของรายได้รวม?','question_type'=>'multiple_choice','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'<1%','label'=>'น้อยกว่า 1%','score'=>0.25],['value'=>'1-3%','label'=>'1-3%','score'=>0.5],['value'=>'3-5%','label'=>'3-5%','score'=>0.75],['value'=>'>5%','label'=>'มากกว่า 5%','score'=>1]]],
                ['question_text'=>'องค์กรมีแผนนำ AI หรือ Automation มาใช้ในกระบวนการทำงานภายใน 2 ปีหรือไม่?','question_type'=>'yes_no','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
            ],
        ],
        // ── 6. IT Service Maturity Assessment ──────────────────────────────
        [
            'name' => 'IT Service Maturity Assessment',
            'industry' => 'it_service',
            'strategic_theme' => 'general',
            'description' => 'ประเมินระดับวุฒิภาวะในการให้บริการ IT Service ตามแนวทาง ITIL ครอบคลุม Incident Management, Service Desk, SLA และการจัดการทรัพยากรบุคคลด้าน IT',
            'questions' => [
                ['question_text'=>'มีระบบ Helpdesk / Service Desk สำหรับรับแจ้งปัญหาและติดตามสถานะหรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'SLA (Service Level Agreement) กับลูกค้าถูกติดตามและรายงานอัตโนมัติหรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>12,'max_score'=>1],
                ['question_text'=>'ระยะเวลาเฉลี่ยในการตอบสนอง (First Response Time) ต่อ Incident ของลูกค้า','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'มีระบบ Monitoring และ Alerting สำหรับ Infrastructure ของลูกค้าตลอด 24/7 หรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'จำนวนลูกค้าที่ทีม IT Support ดูแลอยู่ในปัจจุบัน','question_type'=>'multiple_choice','weight'=>1.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'<10','label'=>'น้อยกว่า 10 ราย','score'=>0.25],['value'=>'10-30','label'=>'10-30 ราย','score'=>0.5],['value'=>'30-100','label'=>'30-100 ราย','score'=>0.75],['value'=>'100+','label'=>'มากกว่า 100 ราย','score'=>1]]],
                ['question_text'=>'มีการจัดการ Knowledge Base หรือระบบ FAQ สำหรับพนักงานและลูกค้าหรือไม่?','question_type'=>'yes_no','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'อัตราการแก้ปัญหาได้ภายในครั้งแรก (First Call Resolution Rate)','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'มีกระบวนการ Change Management สำหรับควบคุมการเปลี่ยนแปลงระบบของลูกค้าหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>1,'critical_bonus'=>8,'max_score'=>1],
                ['question_text'=>'วิศวกรได้รับการอบรมและถือ Certification ที่เกี่ยวข้อง (ITIL, CompTIA, Microsoft, Cisco) หรือไม่?','question_type'=>'multiple_choice','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'most','label'=>'ส่วนใหญ่มี Cert','score'=>1],['value'=>'some','label'=>'บางคนมี Cert','score'=>0.66],['value'=>'planned','label'=>'กำลังวางแผน','score'=>0.33],['value'=>'none','label'=>'ไม่มี','score'=>0]]],
                ['question_text'=>'มีการวัด CSAT (Customer Satisfaction) หลังปิด Ticket ทุกครั้งหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
            ],
        ],
        // ── 7. Food Safety & Traceability ───────────────────────────────────
        [
            'name' => 'Food Safety & Traceability',
            'industry' => 'food_pharma',
            'strategic_theme' => 'general',
            'description' => 'สำรวจระบบความปลอดภัยด้านอาหารและการติดตามผลิตภัณฑ์ตลอดห่วงโซ่อุปทาน เน้นมาตรฐาน GHP/HACCP และความสามารถในการเรียกคืนสินค้า (Recall)',
            'questions' => [
                ['question_text'=>'องค์กรได้รับการรับรอง GHP หรือ HACCP แล้วหรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'ระบบสามารถติดตามวัตถุดิบย้อนกลับไปถึงแหล่งผลิต (Farm/Supplier) ได้ภายในกี่นาที?','question_type'=>'scale_1_5','weight'=>3.0,'is_critical'=>1,'critical_bonus'=>15,'max_score'=>5],
                ['question_text'=>'มีการบันทึกอุณหภูมิ Cold Chain ตลอดกระบวนการขนส่งและจัดเก็บแบบอัตโนมัติหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'จำนวนข้อร้องเรียนด้านความปลอดภัยอาหารจากลูกค้าในรอบ 12 เดือนที่ผ่านมา','question_type'=>'scale_1_5','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>12,'max_score'=>5],
                ['question_text'=>'มีระบบแจ้งเตือนและเรียกคืนสินค้า (Product Recall) ที่สามารถดำเนินการได้ภายใน 24 ชม. หรือไม่?','question_type'=>'yes_no','weight'=>3.0,'is_critical'=>1,'critical_bonus'=>15,'max_score'=>1],
                ['question_text'=>'มีการทดสอบ Shelf-life และบันทึกวันหมดอายุของสินค้าทุก Lot การผลิตหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'ระบบสุขาภิบาล (Sanitation) และการทำความสะอาดได้รับการตรวจสอบตามรอบที่กำหนดหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'มีระบบบริหารจัดการสารก่อภูมิแพ้ (Allergen Management) แยกสายการผลิตชัดเจนหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'ผ่านการตรวจประเมินจากลูกค้า (Customer Audit) หรือหน่วยงานรับรองในรอบปีที่ผ่านมาหรือไม่?','question_type'=>'yes_no','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'พนักงานฝ่ายผลิตได้รับการอบรมด้าน Food Safety อย่างน้อยปีละกี่ครั้ง?','question_type'=>'multiple_choice','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'2+','label'=>'2 ครั้งขึ้นไป','score'=>1],['value'=>'1','label'=>'ปีละ 1 ครั้ง','score'=>0.66],['value'=>'less','label'=>'น้อยกว่า 1 ครั้ง','score'=>0.33],['value'=>'never','label'=>'ไม่เคย','score'=>0]]],
            ],
        ],
        // ── 8. Tapioca Supply Chain Optimization ───────────────────────────
        [
            'name' => 'Tapioca Supply Chain Optimization',
            'industry' => 'tapioca_factory',
            'strategic_theme' => 'it_bottleneck',
            'description' => 'วิเคราะห์คอขวดในห่วงโซ่อุปทานของโรงงานแป้งมัน ตั้งแต่การรับซื้อหัวมันสดจากเกษตรกร การจัดการลานมัน ลานตาก ไปจนถึงโลจิสติกส์ส่งออก เหมาะสำหรับโรงงานที่ต้องการลดต้นทุนโลจิสติกส์และเพิ่มประสิทธิภาพ Supply Chain',
            'questions' => [
                ['question_text'=>'ระบบสามารถพยากรณ์ปริมาณหัวมันสดที่จะเข้าสู่โรงงานล่วงหน้าได้แม่นยำหรือไม่?','question_type'=>'scale_1_5','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>5],
                ['question_text'=>'มีการเชื่อมต่อข้อมูลกับลานมันและเกษตรกรแบบ Real-time ผ่าน Mobile App หรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>12,'max_score'=>1],
                ['question_text'=>'จำนวนวันที่วัตถุดิบคงค้างในลานมันก่อนเข้าแปรรูป (Dwell Time)','question_type'=>'multiple_choice','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'<1','label'=>'น้อยกว่า 1 วัน','score'=>1],['value'=>'1-2','label'=>'1-2 วัน','score'=>0.66],['value'=>'3-5','label'=>'3-5 วัน','score'=>0.33],['value'=>'5+','label'=>'มากกว่า 5 วัน','score'=>0]]],
                ['question_text'=>'ระบบ Logistics จัดการขนส่งและ Fleet Management แบบอัตโนมัติหรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>1,'critical_bonus'=>8,'max_score'=>1],
                ['question_text'=>'เคยสูญเสียวัตถุดิบจากปัญหาการจัดเก็บ (เน่าเสีย, ความชื้นสูง) ในรอบปีหรือไม่?','question_type'=>'yes_no','weight'=>3.0,'is_critical'=>1,'critical_bonus'=>12,'max_score'=>1],
                ['question_text'=>'ต้นทุนค่าขนส่งต่อตันสามารถติดตามและเปรียบเทียบย้อนหลังได้ Real-time หรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'มีระบบจัดการสต็อกแป้งสำเร็จรูปที่เชื่อมกับคำสั่งซื้อของลูกค้าแบบ Real-time หรือไม่?','question_type'=>'yes_no','weight'=>2.5,'is_critical'=>1,'critical_bonus'=>10,'max_score'=>1],
                ['question_text'=>'ความแม่นยำของระบบพยากรณ์ยอดขายและการผลิต (Forecast Accuracy)','question_type'=>'scale_1_5','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>5],
                ['question_text'=>'มี Dashboard แสดง KPI ของ Supply Chain ให้ผู้บริหารดูแบบ Real-time หรือไม่?','question_type'=>'yes_no','weight'=>2.0,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1],
                ['question_text'=>'ระบบ ERP ปัจจุบันครอบคลุมตั้งแต่จัดซื้อ ผลิต ขาย จนถึงส่งออกหรือไม่?','question_type'=>'multiple_choice','weight'=>1.5,'is_critical'=>0,'critical_bonus'=>0,'max_score'=>1,'options_json'=>[['value'=>'full','label'=>'ครอบคลุมทั้งหมด','score'=>1],['value'=>'partial','label'=>'บางส่วน','score'=>0.66],['value'=>'separate','label'=>'ใช้แยกกันหลายระบบ','score'=>0.33],['value'=>'manual','label'=>'ยังใช้ Manual','score'=>0]]],
            ],
        ],
    ];

    $qCountStmt = $db->prepare('SELECT COUNT(*) FROM survey_questions WHERE template_id = ?');

    // Only seed when tenant has zero global templates (first-time setup).
    // Deleted templates stay deleted. New built-ins for existing tenants
    // must be added via a separate database migration.
    $totalGlobal = $db->prepare('SELECT COUNT(*) FROM survey_templates WHERE tenant_id = ? AND is_global = 1');
    $totalGlobal->execute([$tenantId]);
    if ((int)$totalGlobal->fetchColumn() > 0) {
        // Tenant already has global templates — recover missing questions only
        foreach ($templates as $t) {
            $tidStmt = $db->prepare('SELECT id FROM survey_templates WHERE tenant_id = ? AND name = ? AND is_global = 1');
            $tidStmt->execute([$tenantId, $t['name']]);
            $existingId = $tidStmt->fetchColumn();
            if ($existingId) {
                $qCountStmt->execute([$existingId]);
                if ((int)$qCountStmt->fetchColumn() === 0) {
                    insertQuestions($db, $existingId, $t['questions']);
                }
            }
        }
        return;
    }

    // First-time seed: create all built-in templates
    foreach ($templates as $t) {
        $id  = generateUUID();
        $now = date('Y-m-d H:i:s');
        $ins = $db->prepare('
            INSERT INTO survey_templates (id, tenant_id, name, industry, strategic_theme, description, is_global, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ');
        $ins->execute([$id, $tenantId, $t['name'], $t['industry'], $t['strategic_theme'], $t['description'], $userId, $now, $now]);
        insertQuestions($db, $id, $t['questions']);
    }
}
