<?php
// Lead Generation — REST API สำหรับคลัง leads กลาง (เฟส 1)
// GET    /api/leads.php                  list (filter: status, source, q)
// GET    /api/leads.php?id=...           รายตัว
// POST   /api/leads.php                  สร้าง lead (กรอกเอง)
// PUT    /api/leads.php?id=...           แก้ไข / เปลี่ยน status
// DELETE /api/leads.php?id=...           ลบ
// POST   /api/leads.php?action=ai_search ค้นหาจากอินเทอร์เน็ตด้วย AI (ไม่เขียน DB)
// POST   /api/leads.php?action=convert   แปลงเป็น company / opportunity

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/imap-client.php';

$authUser = requireAuth();
$userId   = $authUser['user_id'];
$tenantId = $authUser['tenant_id'];
$db       = getDB();
$method   = getMethod();
$isAdmin  = isTenantAdmin($db, $userId, $tenantId);
$action   = $_GET['action'] ?? '';
$id       = $_GET['id'] ?? '';

// ── ownership: non-admin เห็นเฉพาะ lead ที่ตัวเอง created_by หรือ assigned_to ──
function leadOwnershipSql(bool $isAdmin): string {
    return $isAdmin ? '' : ' AND (created_by = :uid OR assigned_to = :uid) ';
}

// โหลด lead ตัวเดียว + ตรวจสิทธิ์ คืน row หรือ null
function loadLead(PDO $db, string $tenantId, string $id, string $userId, bool $isAdmin): ?array {
    $sql = 'SELECT * FROM leads WHERE id = :id AND tenant_id = :tid' . leadOwnershipSql($isAdmin);
    $stmt = $db->prepare($sql);
    $params = [':id' => $id, ':tid' => $tenantId];
    if (!$isAdmin) $params[':uid'] = $userId;
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

switch ($method) {
    case 'GET':
        if ($id) {
            $lead = loadLead($db, $tenantId, $id, $userId, $isAdmin);
            if (!$lead) jsonError('ไม่พบ lead', 404);
            jsonResponse($lead);
        }
        $where  = 'WHERE tenant_id = :tid' . leadOwnershipSql($isAdmin);
        $params = [':tid' => $tenantId];
        if (!$isAdmin) $params[':uid'] = $userId;

        $status = trim($_GET['status'] ?? '');
        $source = trim($_GET['source'] ?? '');
        $q      = trim($_GET['q'] ?? '');
        $ctype  = trim($_GET['company_type'] ?? '');
        if ($status !== '') { $where .= ' AND status = :status'; $params[':status'] = $status; }
        if ($source !== '') { $where .= ' AND source = :source'; $params[':source'] = $source; }
        if (in_array($ctype, ['customer','partner','manufacturer'], true)) {
            $where .= ' AND company_type = :ctype'; $params[':ctype'] = $ctype;
        }
        if ($q !== '') {
            $where .= ' AND (name LIKE :q OR contact_name LIKE :q OR email LIKE :q OR phone LIKE :q)';
            $params[':q'] = '%' . $q . '%';
        }
        $stmt = $db->prepare("SELECT * FROM leads $where ORDER BY created_at DESC");
        $stmt->execute($params);
        jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
        break;

    case 'POST':
        $body = getRequestBody();

        if ($action === 'ai_search')  { aiSearchLeads($db, $tenantId, $body); }
        if ($action === 'convert')    { convertLead($db, $tenantId, $userId, $isAdmin, $body); }
        if ($action === 'bulk')        { bulkInsertLeads($db, $tenantId, $userId, $body); }
        if ($action === 'bulk_update') { bulkUpdateLeads($db, $tenantId, $userId, $isAdmin, $body); }
        if ($action === 'bulk_delete') { bulkDeleteLeads($db, $tenantId, $userId, $isAdmin, $body); }
        if ($action === 'imap_fetch')  { imapFetchLeads($db, $tenantId, $body); }

        // สร้าง lead กรอกเอง
        $name = trim($body['name'] ?? '');
        if ($name === '') jsonError('กรุณาระบุชื่อ lead', 400);

        $srcIn  = $body['source'] ?? 'manual';
        $statIn = $body['status'] ?? 'new';
        $newId = generateUUID();
        $ctypeIn = in_array($body['company_type'] ?? '', ['customer','partner','manufacturer'], true) ? $body['company_type'] : 'customer';
        $stmt = $db->prepare(
            'INSERT INTO leads (id, tenant_id, name, contact_name, department, email, phone, website, address, company_desc,
                business_type, company_type, source, status, ai_confidence, source_note, notes, assigned_to, created_by)
             VALUES (:id, :tid, :name, :contact, :dept, :email, :phone, :website, :address, :desc,
                :btype, :ctype, :source, :status, :conf, :snote, :notes, :assigned, :creator)'
        );
        $stmt->execute([
            ':id'       => $newId,
            ':tid'      => $tenantId,
            ':name'     => $name,
            ':contact'  => trim($body['contact_name'] ?? '') ?: null,
            ':dept'     => trim($body['department'] ?? '') ?: null,
            ':email'    => trim($body['email'] ?? '') ?: null,
            ':phone'    => trim($body['phone'] ?? '') ?: null,
            ':website'  => trim($body['website'] ?? '') ?: null,
            ':address'  => trim($body['address'] ?? '') ?: null,
            ':desc'     => trim($body['company_desc'] ?? '') ?: null,
            ':btype'    => trim($body['business_type'] ?? '') ?: null,
            ':ctype'    => $ctypeIn,
            ':source'   => in_array($srcIn,  ['manual','ai_search','business_card','csv','email']) ? $srcIn  : 'manual',
            ':status'   => in_array($statIn, ['new','contacted','qualified','converted','rejected']) ? $statIn : 'new',
            ':conf'     => trim($body['ai_confidence'] ?? '') ?: null,
            ':snote'    => trim($body['source_note'] ?? '') ?: null,
            ':notes'    => trim($body['notes'] ?? '') ?: null,
            ':assigned' => trim($body['assigned_to'] ?? '') ?: $userId,
            ':creator'  => $userId,
        ]);
        $lead = loadLead($db, $tenantId, $newId, $userId, $isAdmin);
        jsonResponse($lead, 201);
        break;

    case 'PUT':
        if (!$id) jsonError('ต้องระบุ id', 400);
        $lead = loadLead($db, $tenantId, $id, $userId, $isAdmin);
        if (!$lead) jsonError('ไม่พบ lead', 404);
        $body = getRequestBody();

        $fields = [];
        $params = [':id' => $id, ':tid' => $tenantId];
        $map = [
            'name' => 'name', 'contact_name' => 'contact_name', 'department' => 'department',
            'email' => 'email', 'phone' => 'phone', 'website' => 'website', 'address' => 'address',
            'company_desc' => 'company_desc',
            'business_type' => 'business_type', 'notes' => 'notes', 'assigned_to' => 'assigned_to',
        ];
        foreach ($map as $key => $col) {
            if (array_key_exists($key, $body)) {
                $fields[] = "$col = :$col";
                $params[":$col"] = trim((string)$body[$key]) ?: null;
            }
        }
        if (array_key_exists('status', $body) &&
            in_array($body['status'], ['new','contacted','qualified','converted','rejected'])) {
            $fields[] = 'status = :status';
            $params[':status'] = $body['status'];
        }
        if (array_key_exists('company_type', $body) &&
            in_array($body['company_type'], ['customer','partner','manufacturer'], true)) {
            $fields[] = 'company_type = :company_type';
            $params[':company_type'] = $body['company_type'];
        }
        if (!$fields) jsonError('ไม่มีข้อมูลให้แก้ไข', 400);
        $stmt = $db->prepare('UPDATE leads SET ' . implode(', ', $fields) . ' WHERE id = :id AND tenant_id = :tid');
        $stmt->execute($params);
        jsonResponse(loadLead($db, $tenantId, $id, $userId, $isAdmin));
        break;

    case 'DELETE':
        if (!$id) jsonError('ต้องระบุ id', 400);
        $lead = loadLead($db, $tenantId, $id, $userId, $isAdmin);
        if (!$lead) jsonError('ไม่พบ lead', 404);
        $stmt = $db->prepare('DELETE FROM leads WHERE id = :id AND tenant_id = :tid');
        $stmt->execute([':id' => $id, ':tid' => $tenantId]);
        jsonResponse(['success' => true]);
        break;

    default:
        jsonError('Method not allowed', 405);
}

// ── AI helpers (ใช้ร่วมกันหลาย action) ────────────────────────────────────────
// resolve API key/base/model ของ tenant คืน ['key','base','model'] หรือ null ถ้าไม่มี key
function leadResolveAi(PDO $db, string $tenantId): ?array {
    $apiKey = ''; $baseUrl = 'https://api.kilo.ai/api/gateway';
    try {
        $stmt = $db->query("
            SELECT ap.api_base_url, ap.api_key_encrypted
            FROM company_settings cs
            JOIN ai_providers ap ON ap.id = cs.ai_active_provider_id
            WHERE cs.tenant_id = " . $db->quote($tenantId) . "
              AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != '' LIMIT 1");
        $row = $stmt ? $stmt->fetch() : null;
        if ($row && !empty($row['api_key_encrypted'])) {
            $plain = decryptApiKey($row['api_key_encrypted']);
            if (!empty(trim($plain))) { $apiKey = trim($plain); $baseUrl = rtrim($row['api_base_url'] ?: $baseUrl, '/'); }
        }
    } catch (Exception $e) {}
    if ($apiKey === '' && !empty(KILO_API_TOKEN)) $apiKey = KILO_API_TOKEN;
    if ($apiKey === '') return null;

    // เลือกโมเดล: ฟีเจอร์ lead → chat → default (ใช้ตัวแรกที่ตั้งค่าไว้)
    $model = 'kilo-auto/balanced';
    try {
        $ms = $db->prepare("
            SELECT am.model_id
            FROM company_settings cs
            LEFT JOIN ai_models am ON am.id = COALESCE(cs.ai_lead_model_id, cs.ai_chat_model_id, cs.ai_default_model_id)
            WHERE cs.tenant_id = ? AND am.model_id IS NOT NULL LIMIT 1");
        $ms->execute([$tenantId]);
        $mrow = $ms->fetch();
        if ($mrow && !empty($mrow['model_id'])) $model = $mrow['model_id'];
    } catch (Exception $e) {}
    return ['key' => $apiKey, 'base' => $baseUrl, 'model' => $model];
}

// เรียก chat completion ครั้งเดียว คืน content (string) หรือ null
// เก็บสาเหตุที่ล้มเหลวไว้ที่ $GLOBALS['lead_ai_last_error'] เพื่อ debug
function leadAiChat(array $ai, array $messages, int $maxTokens = 2500): ?string {
    $GLOBALS['lead_ai_last_error'] = '';
    $url = rtrim($ai['base'], '/') . '/chat/completions';
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['model' => $ai['model'], 'messages' => $messages, 'stream' => false, 'max_tokens' => $maxTokens]),
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $ai['key'], 'Content-Type: application/json'],
        CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_CONNECTTIMEOUT => 20,
    ]);
    $raw  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $raw === '') {
        $GLOBALS['lead_ai_last_error'] = $err !== '' ? "curl: $err" : "HTTP $code (ไม่มีข้อมูลตอบกลับ)";
        return null;
    }
    $decoded = json_decode($raw, true);
    $content = $decoded['choices'][0]['message']['content'] ?? null;
    if ($content === null || $content === '') {
        $apiErr = $decoded['error']['message'] ?? ($decoded['message'] ?? '');
        $GLOBALS['lead_ai_last_error'] = $apiErr !== '' ? "HTTP $code: $apiErr" : "HTTP $code: " . substr($raw, 0, 300);
        return null;
    }
    return $content;
}

// เรียก chat พร้อม fallback: ถ้าโมเดลที่ตั้งค่าใช้ไม่ได้ ลองใหม่ด้วย kilo-auto/balanced
function leadAiChatFallback(array $ai, array $messages, int $maxTokens = 2500): ?string {
    $content = leadAiChat($ai, $messages, $maxTokens);
    if ($content !== null) return $content;
    if (($ai['model'] ?? '') !== 'kilo-auto/balanced') {
        $ai['model'] = 'kilo-auto/balanced';
        $content = leadAiChat($ai, $messages, $maxTokens);
        if ($content !== null) return $content;
    }
    return null;
}

// แกะ JSON array ออกจาก content (ตัด markdown fence / ข้อความรอบนอก)
function leadParseJsonArray(?string $content): ?array {
    if ($content === null) return null;
    if (preg_match('/```(?:json)?\s*([\s\S]*?)```/', $content, $m)) $content = trim($m[1]);
    if (preg_match('/\[[\s\S]*\]/', $content, $m)) $content = $m[0];
    $arr = json_decode($content, true);
    return is_array($arr) ? $arr : null;
}

// ใช้ AI สกัดฟิลด์ให้ครบ + สรุปเนื้อความ จากอีเมลที่รวมต่อผู้ส่งแล้ว
// $senders = [ ['email','name','subjects'=>[],'text'=>'...'], ... ]
// คืน map: lower(email) => ['contact_name','company_name','phone','website','address','department','business_type','company_desc','notes']
function leadAiEnrichSenders(array $ai, array $senders): array {
    $out = [];
    $batchSize  = 6;    // ผู้ส่งต่อ 1 คำขอ AI
    $maxSenders = 60;   // จำกัดจำนวนที่ส่งให้ AI กันค้าง/ค่าใช้จ่าย
    $senders = array_slice($senders, 0, $maxSenders);

    foreach (array_chunk($senders, $batchSize) as $chunk) {
        $payload = [];
        foreach ($chunk as $i => $s) {
            $txt = $s['text'] ?? '';
            $txt = function_exists('mb_substr') ? mb_substr($txt, 0, 2000) : substr($txt, 0, 2000);
            $payload[] = [
                'i'         => $i,
                'email'     => $s['email'],
                'from_name' => $s['name'] ?? '',
                'subjects'  => array_slice($s['subjects'] ?? [], 0, 5),
                'content'   => $txt,
            ];
        }
        $sys = "You are a B2B contact data extraction assistant. ตอบเป็นภาษาไทยเท่านั้น. "
             . "จากอีเมลของผู้ส่งแต่ละราย จงสกัดข้อมูลผู้ติดต่อให้ครบและถูกต้องที่สุด แล้วสรุปเนื้อความสั้น ๆ. "
             . "คืนผลเป็น JSON array เท่านั้น (ไม่มี markdown, ไม่มีคำอธิบาย) ขนาดเท่ากับ input และอ้างอิง index i เดิม. "
             . "แต่ละ object: {\"i\":number,\"contact_name\":\"\",\"company_name\":\"\",\"phone\":\"\",\"phones\":[],\"website\":\"\",\"address\":\"\",\"addresses\":[],\"other_emails\":[],\"department\":\"\",\"business_type\":\"\",\"company_desc\":\"สรุป 1-2 ประโยคว่าผู้ส่งคือใครและติดต่อเรื่องอะไร\",\"notes\":\"ข้อมูลเพิ่มเติมจากลายเซ็น\"}. "
             . "phone/address คือค่าหลัก (ตัวแรก/สำคัญสุด). ถ้าในลายเซ็นมีหลายเบอร์ให้ใส่ครบใน phones[], หลายที่อยู่ใส่ใน addresses[], อีเมลอื่นนอกจากผู้ส่งใส่ใน other_emails[]. "
             . "ใช้เฉพาะข้อมูลจาก content/ลายเซ็น/subject เท่านั้น ห้ามเดามั่ว. ถ้าไม่รู้ field ใดให้ใช้ \"\" หรือ [].";
        $user = "ข้อมูลผู้ส่ง (JSON): " . json_encode($payload, JSON_UNESCAPED_UNICODE);

        $content = leadAiChatFallback($ai, [
            ['role' => 'system', 'content' => $sys],
            ['role' => 'user',   'content' => $user],
        ], 3000);
        $arr = leadParseJsonArray($content);
        if (!is_array($arr)) continue;

        foreach ($arr as $obj) {
            if (!is_array($obj) || !isset($obj['i'])) continue;
            $idx = (int)$obj['i'];
            if (!isset($chunk[$idx])) continue;
            $out[strtolower($chunk[$idx]['email'])] = $obj;
        }
    }
    return $out;
}

// ── AI internet search — reuse logic จาก company-enrich.php ───────────────────
function aiSearchLeads(PDO $db, string $tenantId, array $body): void {
    $query   = trim($body['query'] ?? $body['name'] ?? '');
    $channel = in_array(($body['channel'] ?? 'web'), ['web', 'social']) ? $body['channel'] : 'web';
    if ($query === '') jsonError('กรุณาระบุคำค้นหา', 400);

    // resolve AI (key/base/model) — ใช้โมเดลฟีเจอร์ lead ถ้าตั้งค่าไว้
    $ai = leadResolveAi($db, $tenantId);
    if ($ai === null) jsonError('ยังไม่ได้ตั้งค่า AI API key', 500);
    $model = $ai['model'];

    $systemPrompt = <<<PROMPT
You are a B2B lead research assistant. ตอบเป็นภาษาไทยเท่านั้น. ค้นหาจากอินเทอร์เน็ตและคืนผลเป็น JSON array เท่านั้น (ไม่มี markdown, ไม่มีคำอธิบาย) ของบริษัท/ผู้ติดต่อที่ตรงกับคำค้น สูงสุด 8 รายการ แต่ละ object มี field:
{
  "name": "ชื่อบริษัทหรือผู้ติดต่อ",
  "contact_name": "ชื่อผู้ติดต่อ หรือ \"\"",
  "email": "อีเมล หรือ \"\"",
  "phone": "เบอร์โทร หรือ \"\"",
  "website": "URL หรือ \"\"",
  "business_type": "ประเภทธุรกิจ หรือ \"\"",
  "company_desc": "คำอธิบายสั้น 1 ประโยค",
  "confidence": "high|medium|low"
}
กฎ: คืนเฉพาะ JSON array ที่ valid. ถ้า field ไหนไม่รู้ใช้ "". ห้ามครอบด้วย markdown.
PROMPT;

    $userMsg = $channel === 'social'
        ? "ค้นหา leads แบบ social selling จากโปรไฟล์สาธารณะบนโซเชียล/LinkedIn/เว็บไซต์บริษัทที่เกี่ยวข้องกับ: {$query}. เน้นบริษัท/ผู้ตัดสินใจที่ active บนโซเชียล"
        : "ค้นหา leads ที่เกี่ยวข้องกับ: {$query}";
    $messages = [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user',   'content' => $userMsg],
    ];

    $content = leadAiChatFallback($ai, $messages, 3000);
    if ($content === null) jsonError('ไม่สามารถเชื่อมต่อ AI ได้: ' . ($GLOBALS['lead_ai_last_error'] ?? '') . ' [model: ' . $model . ']', 502);
    $items = leadParseJsonArray($content);
    if (!is_array($items)) jsonError('AI ตอบสนองไม่ถูกต้อง: ' . substr((string)$content, 0, 200), 502);

    $isWebSearch = str_contains($model, 'perplexity') || str_contains($model, 'sonar') || str_contains($model, 'search');
    $sourceNote  = $isWebSearch ? 'ข้อมูลจากการค้นหาอินเทอร์เน็ต' : 'ข้อมูลจาก AI (อาจไม่ใช่ข้อมูลปัจจุบัน)';

    $results = [];
    foreach ($items as $it) {
        if (!is_array($it) || empty(trim($it['name'] ?? ''))) continue;
        $results[] = [
            'name'          => trim($it['name']),
            'contact_name'  => trim($it['contact_name'] ?? ''),
            'email'         => trim($it['email'] ?? ''),
            'phone'         => trim($it['phone'] ?? ''),
            'website'       => trim($it['website'] ?? ''),
            'business_type' => trim($it['business_type'] ?? ''),
            'company_desc'  => trim($it['company_desc'] ?? ''),
            'ai_confidence' => trim($it['confidence'] ?? 'medium'),
            'source_note'   => $sourceNote,
            'source'        => 'ai_search',
        ];
    }
    jsonResponse(['results' => $results, 'model_used' => $model]);
}

// ── Convert lead → company / opportunity ──────────────────────────────────────
function convertLead(PDO $db, string $tenantId, string $userId, bool $isAdmin, array $body): void {
    $leadId = trim($body['id'] ?? '');
    $target = $body['target'] ?? '';
    if ($leadId === '') jsonError('ต้องระบุ id', 400);
    if (!in_array($target, ['company', 'opportunity'])) jsonError('target ต้องเป็น company หรือ opportunity', 400);

    $lead = loadLead($db, $tenantId, $leadId, $userId, $isAdmin);
    if (!$lead) jsonError('ไม่พบ lead', 404);
    if ($lead['status'] === 'converted') jsonError('lead นี้ถูกแปลงไปแล้ว', 409);

    $linkCompanyId = trim($body['company_id'] ?? ''); // ผู้ใช้เลือก company เดิมเพื่อ link

    // หา/สร้าง company
    $companyId = $linkCompanyId;
    if ($companyId === '') {
        // ชื่อตรงเป๊ะ = ซ้ำจริง (companies.name UNIQUE) → block แล้วให้ผู้ใช้เลือกเชื่อมของเดิม
        $exact = $db->prepare('SELECT id FROM companies WHERE tenant_id = ? AND name = ? LIMIT 1');
        $exact->execute([$tenantId, $lead['name']]);
        if ($exact->fetch()) {
            // รวมบริษัทที่ตรง + ใกล้เคียง เป็นตัวเลือกให้เชื่อม
            $chk = $db->prepare(
                'SELECT id, name, email, phone FROM companies
                 WHERE tenant_id = ? AND (name = ? OR name LIKE ?) ORDER BY (name = ?) DESC, name ASC LIMIT 10'
            );
            $chk->execute([$tenantId, $lead['name'], '%' . $lead['name'] . '%', $lead['name']]);
            $matches = $chk->fetchAll(PDO::FETCH_ASSOC);
            ob_end_clean();
            http_response_code(409);
            echo json_encode([
                'error'     => 'มีบริษัทชื่อนี้อยู่แล้ว กรุณาเลือกเชื่อมกับบริษัทเดิม',
                'duplicate' => true,
                'matches'   => $matches,
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $companyId = generateUUID();
        $ctype = in_array($lead['company_type'] ?? '', ['customer','partner','manufacturer'], true) ? $lead['company_type'] : 'customer';
        $ins = $db->prepare(
            'INSERT INTO companies (id, tenant_id, name, description, address, phone, email, website, business_type, company_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->execute([
            $companyId, $tenantId, $lead['name'], $lead['company_desc'] ?? '', $lead['address'] ?? '',
            $lead['phone'] ?? '', $lead['email'] ?? '', $lead['website'] ?? '', $lead['business_type'] ?? null, $ctype,
        ]);
    } else {
        // ตรวจว่า company ที่เลือกอยู่ใน tenant จริง
        $chk = $db->prepare('SELECT id FROM companies WHERE id = ? AND tenant_id = ?');
        $chk->execute([$companyId, $tenantId]);
        if (!$chk->fetch()) jsonError('ไม่พบบริษัทที่เลือก', 404);
    }

    // สร้างผู้ติดต่อ (customer) จากข้อมูล lead ถ้ามีชื่อผู้ติดต่อหรืออีเมล — กันซ้ำด้วยอีเมล
    $contactName  = trim($lead['contact_name'] ?? '');
    $contactEmail = trim($lead['email'] ?? '');
    $customerId   = null;
    if ($contactName !== '' || $contactEmail !== '') {
        $dup = false;
        if ($contactEmail !== '') {
            $d = $db->prepare('SELECT id FROM customers WHERE tenant_id = ? AND company_id = ? AND email = ? LIMIT 1');
            $d->execute([$tenantId, $companyId, $contactEmail]);
            $dup = $d->fetch();
        }
        if ($dup) {
            $customerId = $dup['id'];
        } else {
            // แยกชื่อ-นามสกุล (ถ้าไม่มีชื่อ ใช้ส่วนหน้าของอีเมล)
            if ($contactName !== '') {
                $parts = preg_split('/\s+/', $contactName, 2);
                $first = $parts[0];
                $last  = $parts[1] ?? '';
            } else {
                $first = strstr($contactEmail, '@', true) ?: $contactEmail;
                $last  = '';
            }
            $customerId = generateUUID();
            $cins = $db->prepare(
                'INSERT INTO customers (id, tenant_id, company_id, first_name, last_name, email, phone, position, is_primary_contact, is_active, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)'
            );
            $cins->execute([
                $customerId, $tenantId, $companyId, $first, $last, $contactEmail,
                $lead['phone'] ?? '', $lead['department'] ?? '', $lead['notes'] ?? '',
            ]);
        }
    }

    $opportunityId = null;
    if ($target === 'opportunity') {
        $opportunityId = generateUUID();
        $ins = $db->prepare(
            'INSERT INTO sales_opportunities (id, tenant_id, company_id, name, description, stage, value, probability, assigned_to, created_by, lead_source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $ins->execute([
            $opportunityId, $tenantId, $companyId, $lead['name'],
            $lead['company_desc'] ?? '', 'lead', 0, 0, $userId, $userId, $lead['source'],
        ]);
    }

    $upd = $db->prepare(
        'UPDATE leads SET status = :s, converted_company_id = :cid, converted_opportunity_id = :oid
         WHERE id = :id AND tenant_id = :tid'
    );
    $upd->execute([
        ':s'   => 'converted',
        ':cid' => $companyId,
        ':oid' => $opportunityId,
        ':id'  => $leadId,
        ':tid' => $tenantId,
    ]);

    jsonResponse([
        'success'         => true,
        'company_id'      => $companyId,
        'customer_id'     => $customerId,
        'opportunity_id'  => $opportunityId,
        'lead'            => loadLead($db, $tenantId, $leadId, $userId, $isAdmin),
    ]);
}

// ── Bulk insert (CSV/Excel import) ────────────────────────────────────────────
function bulkInsertLeads(PDO $db, string $tenantId, string $userId, array $body): void {
    $rows   = $body['leads'] ?? [];
    $source = in_array(($body['source'] ?? 'csv'), ['manual','ai_search','business_card','csv','email']) ? $body['source'] : 'csv';
    if (!is_array($rows) || count($rows) === 0) jsonError('ไม่มีข้อมูลให้นำเข้า', 400);
    if (count($rows) > 1000) jsonError('นำเข้าได้สูงสุด 1000 รายการต่อครั้ง', 400);

    // company_type ระดับ body ใช้เป็นค่าตั้งต้นของทุกแถว (ถ้าแถวไม่ระบุเอง)
    $defaultCtype = in_array($body['company_type'] ?? '', ['customer','partner','manufacturer'], true) ? $body['company_type'] : 'customer';

    $stmt = $db->prepare(
        'INSERT INTO leads (id, tenant_id, name, contact_name, email, phone, website, company_desc,
            business_type, company_type, source, status, source_note, notes, assigned_to, created_by)
         VALUES (:id, :tid, :name, :contact, :email, :phone, :website, :desc,
            :btype, :ctype, :source, :status, :snote, :notes, :assigned, :creator)'
    );

    $inserted = 0; $skipped = 0;
    $db->beginTransaction();
    try {
        foreach ($rows as $r) {
            if (!is_array($r)) { $skipped++; continue; }
            $name = trim((string)($r['name'] ?? ''));
            if ($name === '') { $skipped++; continue; }
            $stmt->execute([
                ':id'       => generateUUID(),
                ':tid'      => $tenantId,
                ':name'     => $name,
                ':contact'  => trim((string)($r['contact_name'] ?? '')) ?: null,
                ':email'    => trim((string)($r['email'] ?? '')) ?: null,
                ':phone'    => trim((string)($r['phone'] ?? '')) ?: null,
                ':website'  => trim((string)($r['website'] ?? '')) ?: null,
                ':desc'     => trim((string)($r['company_desc'] ?? '')) ?: null,
                ':btype'    => trim((string)($r['business_type'] ?? '')) ?: null,
                ':ctype'    => in_array($r['company_type'] ?? '', ['customer','partner','manufacturer'], true) ? $r['company_type'] : $defaultCtype,
                ':source'   => $source,
                ':status'   => 'new',
                ':snote'    => trim((string)($r['source_note'] ?? '')) ?: null,
                ':notes'    => trim((string)($r['notes'] ?? '')) ?: null,
                ':assigned' => $userId,
                ':creator'  => $userId,
            ]);
            $inserted++;
        }
        $db->commit();
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('นำเข้าล้มเหลว: ' . $e->getMessage(), 500);
    }
    jsonResponse(['inserted' => $inserted, 'skipped' => $skipped]);
}

// ── Bulk update (เปลี่ยน status / assigned_to ของหลาย lead) ───────────────────
function bulkUpdateLeads(PDO $db, string $tenantId, string $userId, bool $isAdmin, array $body): void {
    $ids = $body['ids'] ?? [];
    if (!is_array($ids) || count($ids) === 0) jsonError('ไม่ได้เลือกรายการ', 400);
    $ids = array_values(array_filter(array_map('strval', $ids), fn($v) => $v !== ''));
    if (count($ids) === 0) jsonError('ไม่ได้เลือกรายการ', 400);
    if (count($ids) > 1000) jsonError('แก้ไขได้สูงสุด 1000 รายการต่อครั้ง', 400);

    $fields = [];
    $setParams = [];
    if (array_key_exists('status', $body)) {
        if (!in_array($body['status'], ['new','contacted','qualified','converted','rejected'], true)) {
            jsonError('สถานะไม่ถูกต้อง', 400);
        }
        $fields[] = 'status = :status';
        $setParams[':status'] = $body['status'];
    }
    if (array_key_exists('assigned_to', $body)) {
        $fields[] = 'assigned_to = :assigned';
        $setParams[':assigned'] = trim((string)$body['assigned_to']) ?: null;
    }
    if (!$fields) jsonError('ไม่มีข้อมูลให้แก้ไข', 400);

    // placeholder สำหรับ IN (...) — กัน SQL injection
    $ph = [];
    $params = $setParams + [':tid' => $tenantId];
    foreach ($ids as $i => $v) { $ph[] = ":id$i"; $params[":id$i"] = $v; }
    $sql = 'UPDATE leads SET ' . implode(', ', $fields)
         . ' WHERE tenant_id = :tid AND id IN (' . implode(',', $ph) . ')'
         . leadOwnershipSql($isAdmin);
    if (!$isAdmin) $params[':uid'] = $userId;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['updated' => $stmt->rowCount()]);
}

// ── Bulk delete (ลบหลาย lead) ─────────────────────────────────────────────────
function bulkDeleteLeads(PDO $db, string $tenantId, string $userId, bool $isAdmin, array $body): void {
    $ids = $body['ids'] ?? [];
    if (!is_array($ids) || count($ids) === 0) jsonError('ไม่ได้เลือกรายการ', 400);
    $ids = array_values(array_filter(array_map('strval', $ids), fn($v) => $v !== ''));
    if (count($ids) === 0) jsonError('ไม่ได้เลือกรายการ', 400);
    if (count($ids) > 1000) jsonError('ลบได้สูงสุด 1000 รายการต่อครั้ง', 400);

    $ph = [];
    $params = [':tid' => $tenantId];
    foreach ($ids as $i => $v) { $ph[] = ":id$i"; $params[":id$i"] = $v; }
    $sql = 'DELETE FROM leads WHERE tenant_id = :tid AND id IN (' . implode(',', $ph) . ')'
         . leadOwnershipSql($isAdmin);
    if (!$isAdmin) $params[':uid'] = $userId;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(['deleted' => $stmt->rowCount()]);
}

// ── Fetch leads from an IMAP mailbox + AI-extract ─────────────────────────────
// ไม่ต้องพึ่ง PHP imap extension — ใช้ raw socket ผ่าน openssl stream (เปิดใน XAMPP อยู่แล้ว)
// ตั้งค่า imap_* ในตาราง settings ก่อนใช้งานจริง
function imapFetchLeads(PDO $db, string $tenantId, array $body): void {
    // โหลดการตั้งค่า IMAP จากตาราง settings
    $cfg = [];
    try {
        $stmt = $db->query("SELECT `key`, `value` FROM settings WHERE `key` LIKE 'imap_%'");
        foreach ($stmt->fetchAll(PDO::FETCH_KEY_PAIR) as $k => $v) $cfg[$k] = $v;
    } catch (Exception $e) {}

    $host = $cfg['imap_host'] ?? '';
    $port = (int)($cfg['imap_port'] ?? 993);
    $enc  = $cfg['imap_encryption'] ?? 'ssl';
    $user = $cfg['imap_user'] ?? '';
    $pass = $cfg['imap_password'] ?? '';
    if ($host === '' || $user === '' || $pass === '') {
        jsonError('ยังไม่ได้ตั้งค่า IMAP (host/user/password) ในการตั้งค่าระบบ', 400);
    }
    if (!function_exists('stream_socket_client')) {
        jsonError('เซิร์ฟเวอร์ไม่รองรับ socket — ติดต่อผู้ดูแลระบบ', 501);
    }

    // ปีเจาะจงที่ต้องการดึง (0 = ทั้งหมด) — ดึงทั้งปีให้ครบ มี cap กันค้างที่ 2000
    $year  = (int)($body['year'] ?? 0);
    $limit = min(max((int)($body['limit'] ?? 2000), 1), 2000);

    // โหลด email ของ lead ที่มีอยู่แล้ว (ทั้ง tenant) ไว้กันซ้ำ
    $existing = [];
    try {
        $st = $db->prepare("SELECT LOWER(email) FROM leads WHERE tenant_id = :tid AND email IS NOT NULL AND email <> ''");
        $st->execute([':tid' => $tenantId]);
        foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $e) $existing[$e] = true;
    } catch (Exception $e) {}

    try {
        $imap = new SocketImapClient($host, $port, $enc);
        $imap->login($user, $pass);
        $imap->select('INBOX');
        if ($year > 0) {
            // ทั้งปี: ตั้งแต่ 1 ม.ค. ปีนั้น ถึงก่อน 1 ม.ค. ปีถัดไป
            $criteria = 'SINCE 01-Jan-' . $year . ' BEFORE 01-Jan-' . ($year + 1);
        } else {
            $criteria = 'ALL';
        }
        $ids = $imap->search($criteria);
        rsort($ids);

        // รวมหลายอีเมลของผู้ส่งคนเดียวกัน เพื่อเก็บข้อมูลให้ครบที่สุด (ไม่ซ้ำ)
        $maxPerSender = 3;   // อ่าน body สูงสุด 3 ฉบับล่าสุดต่อผู้ส่ง
        $senders = [];       // key => ['name','email','subjects'=>[],'texts'=>[],'fields'=>[]]
        foreach ($ids as $num) {
            $raw = $imap->fetchHeader($num);
            $headers = SocketImapClient::parseHeaders($raw);
            $fromRaw = $headers['from'] ?? '';
            if ($fromRaw === '') continue;
            [$name, $email] = SocketImapClient::parseAddress($fromRaw);
            if ($email === '') continue;
            if (SocketImapClient::isNonCustomerEmail($email)) continue; // ข้ามเมลอัตโนมัติ/แจ้งเตือน/จดหมายข่าว
            $key = strtolower($email);
            if (isset($existing[$key])) continue;                       // เป็น lead อยู่แล้ว
            if (!isset($senders[$key])) {
                if (count($senders) >= $limit) continue;                // เต็มจำนวนผู้ส่งแล้ว
                $senders[$key] = [
                    'name' => $name ?: '', 'email' => $email,
                    'subjects' => [], 'texts' => [],
                    'fields' => ['phone' => '', 'website' => '', 'address' => '', 'department' => '', 'notes' => ''],
                ];
            }
            $S = &$senders[$key];
            if (!$S['name'] && $name) $S['name'] = $name;
            $subject = SocketImapClient::decodeMime($headers['subject'] ?? '');
            if ($subject !== '' && count($S['subjects']) < 5) $S['subjects'][] = $subject;
            if (count($S['texts']) < $maxPerSender) {
                try {
                    $bodyText = $imap->fetchBody($num);
                    if (trim($bodyText) !== '') {
                        $S['texts'][] = $bodyText;
                        // สกัดด้วย regex เป็น baseline แล้วเติมเฉพาะ field ที่ยังว่าง
                        $f = SocketImapClient::extractContactFields($bodyText, $email);
                        foreach ($f as $fk => $fv) {
                            if (empty($S['fields'][$fk]) && !empty($fv)) $S['fields'][$fk] = $fv;
                        }
                    }
                } catch (Exception $e) { /* ดึง body ไม่ได้ → ใช้ regex baseline ว่าง */ }
            }
            unset($S);
        }
        $imap->logout();
    } catch (Exception $e) {
        jsonError('เชื่อมต่อ IMAP ไม่สำเร็จ: ' . $e->getMessage(), 502);
    }

    // ใช้ AI สกัดฟิลด์ให้ครบ + สรุปเนื้อความ (ถ้าตั้งค่า AI ไว้)
    $ai = leadResolveAi($db, $tenantId);
    $aiMap = [];
    if ($ai && $senders) {
        $forAi = [];
        foreach ($senders as $S) {
            $forAi[] = [
                'email'    => $S['email'],
                'name'     => $S['name'],
                'subjects' => $S['subjects'],
                'text'     => implode("\n---\n", $S['texts']),
            ];
        }
        try { $aiMap = leadAiEnrichSenders($ai, $forAi); } catch (Exception $e) { $aiMap = []; }
    }

    // ประกอบผลลัพธ์: ใช้ค่า AI ก่อน, ตกไป regex baseline, สุดท้ายค่าจาก header
    $results = [];
    foreach ($senders as $key => $S) {
        $ax = $aiMap[$key] ?? [];
        $pick = function (string $aiKey, string $fallback) use ($ax): string {
            $v = trim((string)($ax[$aiKey] ?? ''));
            return $v !== '' ? $v : $fallback;
        };
        $arr = function (string $aiKey) use ($ax): array {
            $v = $ax[$aiKey] ?? null;
            if (!is_array($v)) return [];
            return array_values(array_filter(array_map(fn($x) => trim((string)$x), $v), fn($x) => $x !== ''));
        };
        $companyName = trim((string)($ax['company_name'] ?? '')) ?: ($S['name'] ?: $S['email']);
        $desc        = trim((string)($ax['company_desc'] ?? '')) ?: implode(' · ', array_slice($S['subjects'], 0, 2));

        // ค่าหลัก
        $phones    = $arr('phones');
        $addresses = $arr('addresses');
        $primaryPhone   = $pick('phone',   $phones[0]    ?? $S['fields']['phone']);
        $primaryAddress = $pick('address', $addresses[0] ?? $S['fields']['address']);

        // รวมข้อมูลติดต่อที่เกินมา 1 รายการ ไว้ใน notes (เบอร์/ที่อยู่/อีเมลหลายรายการจากในเมล)
        $noteParts = [];
        $base = $pick('notes', $S['fields']['notes']);
        if ($base !== '') $noteParts[] = $base;
        $morePhones = array_values(array_filter($phones, fn($p) => $p !== $primaryPhone));
        if ($morePhones) $noteParts[] = 'เบอร์อื่น: ' . implode(', ', $morePhones);
        $moreAddr = array_values(array_filter($addresses, fn($a) => $a !== $primaryAddress));
        if ($moreAddr) $noteParts[] = 'ที่อยู่อื่น: ' . implode(' | ', $moreAddr);
        $otherEmails = array_values(array_filter($arr('other_emails'), fn($e) => strtolower($e) !== strtolower($S['email'])));
        if ($otherEmails) $noteParts[] = 'อีเมลอื่น: ' . implode(', ', $otherEmails);

        $results[] = [
            'name'          => $companyName,
            'contact_name'  => $pick('contact_name', $S['name']),
            'email'         => $S['email'],
            'phone'         => $primaryPhone,
            'website'       => $pick('website', $S['fields']['website']),
            'address'       => $primaryAddress,
            'department'    => $pick('department', $S['fields']['department']),
            'business_type' => trim((string)($ax['business_type'] ?? '')),
            'company_desc'  => $desc,
            'notes'         => implode("\n", $noteParts),
            'source'        => 'email',
            'source_note'   => $aiMap ? 'จากกล่องอีเมล IMAP + สรุปด้วย AI' : 'จากกล่องอีเมล IMAP',
        ];
    }

    jsonResponse(['results' => $results, 'ai_used' => (bool)$aiMap]);
}
