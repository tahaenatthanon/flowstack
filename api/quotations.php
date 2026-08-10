<?php
// CRUD /api/quotations.php
// GET    - list quotations (?id= single, ?opportunity_id= filter, ?company_id= filter, ?status= filter)
// POST   - create quotation with items
// PUT    - update quotation (?id=)
// DELETE - delete quotation (?id=)
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

$tokenData = requireAuth();
$userId = $tokenData['user_id'];
$tenantId = $tokenData['tenant_id'];
$db = getDB();
$method = getMethod();

// DECIMAL fields that need casting to float for correct JSON output
$quotFloatFields = ['total_amount', 'discount', 'tax', 'grand_total', 'item_count'];
$quotStringFields = ['subject', 'payment_terms', 'notes', 'company_name', 'customer_name', 'opportunity_name'];
$itemFloatFields = ['quantity', 'unit_price', 'total_price'];

function castQuotation(array $q, array $qFields, array $iFields): array {
    $q = castNumericFields($q, $qFields);
    if (!empty($q['items'])) {
        $q['items'] = castNumericFieldsAll($q['items'], $iFields);
    }
    return $q;
}

function resolveQuotationAI(PDO $db, string $tenantId = ''): ?array {
    try {
        $whereClause = $tenantId ? 'cs.tenant_id = ' . $db->quote($tenantId) : 'cs.id = 1';
        $stmt = $db->query("
            SELECT ap.api_base_url, ap.api_key_encrypted,
                   COALESCE(am_t.model_id, am_d.model_id, 'openai/gpt-4o-mini') AS model_id
            FROM company_settings cs
            LEFT JOIN ai_models am_t ON am_t.id = cs.ai_content_text_model_id
            LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
            JOIN ai_providers ap ON ap.id = COALESCE(am_t.provider_id, am_d.provider_id, cs.ai_active_provider_id)
            WHERE $whereClause AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
            LIMIT 1
        ");
        $row = $stmt ? $stmt->fetch() : null;
        if (!$row || empty($row['api_key_encrypted'])) return null;

        $plain = decryptApiKey($row['api_key_encrypted']);
        if ($plain === '' || $plain === false) return null;
        return [
            'api_key'  => trim($plain),
            'base_url' => rtrim($row['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/'),
            'model'    => $row['model_id'],
        ];
    } catch (\Throwable $e) { return null; }
}

// --- GET ---
if ($method === 'GET') {
    $id = $_GET['id'] ?? null;

    // Get single quotation with items
    if ($id) {
        $stmt = $db->prepare("
            SELECT
                q.id,
                q.id AS quotation_id,
                q.opportunity_id,
                q.company_id,
                q.customer_id,
                q.quotation_number,
                q.issue_date,
                q.valid_until,
                q.total_amount,
                q.discount,
                q.tax,
                q.grand_total,
                q.status,
                q.payment_terms,
                q.notes,
                q.created_by,
                q.created_at,
                q.updated_at,
                c.name AS company_name,
                CONCAT(cus.first_name, ' ', cus.last_name) AS customer_name,
                cus.email AS customer_email,
                o.name AS opportunity_name,
                o.stage AS opportunity_stage,
                u.display_name AS created_by_name,
                (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) AS item_count
            FROM quotations q
            LEFT JOIN companies c ON q.company_id = c.id
            LEFT JOIN customers cus ON q.customer_id = cus.id
            LEFT JOIN sales_opportunities o ON q.opportunity_id = o.id
            LEFT JOIN users u ON q.created_by = u.id
            WHERE q.id = ? AND q.tenant_id = ?
        ");
        $stmt->execute([$id, $tenantId]);
        $quotation = $stmt->fetch();
        if (!$quotation) jsonError('ไม่พบใบเสนอราคา', 404);

        // Get quotation items — JOIN ensures only items belonging to this tenant's quotation are returned
        $stmt = $db->prepare('
            SELECT qi.* FROM quotation_items qi
            JOIN quotations q ON q.id = qi.quotation_id AND q.tenant_id = ?
            WHERE qi.quotation_id = ?
            ORDER BY qi.sort_order ASC
        ');
        $stmt->execute([$tenantId, $id]);
        $quotation['items'] = $stmt->fetchAll();

        jsonResponse(castQuotation($quotation, $quotFloatFields, $itemFloatFields));
    }

    // List quotations with optional filters
    $sql = 'SELECT *, quotation_id AS id FROM quotation_summary WHERE tenant_id = ?';
    $params = [$tenantId];

    if (isset($_GET['opportunity_id'])) {
        $sql .= ' AND opportunity_id = ?';
        $params[] = $_GET['opportunity_id'];
    }

    if (isset($_GET['company_id'])) {
        $sql .= ' AND company_id = ?';
        $params[] = $_GET['company_id'];
    }

    if (isset($_GET['status'])) {
        $sql .= ' AND status = ?';
        $params[] = $_GET['status'];
    }

    $sql .= ' ORDER BY created_at DESC';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse(castNumericFieldsAll($stmt->fetchAll(), $quotFloatFields));
}

// --- POST ---
if ($method === 'POST') {
    $action = $_GET['action'] ?? '';

    // ── action=ai-generate ────────────────────────────────────────────────────
    // Body: { template_id, brief, customer_id?, company_id? }
    // Returns: { items: [...], discount, tax, notes, payment_terms } — does NOT persist
    if ($action === 'ai-generate') {
        $b          = getRequestBody();
        $templateId = (string)($b['template_id'] ?? '');
        $brief      = trim((string)($b['brief'] ?? ''));
        if (!$templateId) jsonError('ต้องระบุ template_id', 400);
        if ($brief === '') jsonError('กรุณากรอก brief เช่น ลูกค้าต้องการอะไร, ปริมาณ, ระยะเวลา', 400);

        // Load template
        $tplStmt = $db->prepare('SELECT * FROM quotation_templates WHERE id = ? AND tenant_id = ?');
        $tplStmt->execute([$templateId, $tenantId]);
        $tpl = $tplStmt->fetch();
        if (!$tpl) jsonError('ไม่พบ template', 404);

        // Resolve AI credentials (text model preferred)
        $credStmt = $db->prepare("
            SELECT ap.api_base_url, ap.api_key_encrypted, COALESCE(am_t.model_id, am_d.model_id) AS model_id
            FROM company_settings cs
            LEFT JOIN ai_models am_t ON am_t.id = cs.ai_content_text_model_id
            LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
            JOIN ai_providers ap ON ap.id = COALESCE(am_t.provider_id, am_d.provider_id, cs.ai_active_provider_id)
            WHERE cs.tenant_id = ? AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
            LIMIT 1
        ");
        $credStmt->execute([$tenantId]);
        $cred = $credStmt->fetch();
        if (!$cred) jsonError('AI provider ยังไม่ตั้งค่า — ไปที่ Admin > AI Settings', 503);

        $plain = decryptApiKey($cred['api_key_encrypted']);
        if ($plain === '' || $plain === false) jsonError('Failed to decrypt API key', 500);

        $baseUrl = rtrim($cred['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/');
        $model   = $cred['model_id'] ?: 'kilo-auto/free';

        $schema  = $tpl['parsed_schema']      ? (string)$tpl['parsed_schema']      : '{}';
        $items   = $tpl['example_items_json'] ? (string)$tpl['example_items_json'] : '[]';

        $sys = "คุณคือผู้ช่วยสร้างใบเสนอราคา ตอบเป็นภาษาไทยเท่านั้น ตอบเป็น JSON เท่านั้น ไม่มี markdown fence";
        $user = <<<PROMPT
Template ใช้รูปแบบนี้ (header columns + sample rows):
{$schema}

ตัวอย่างรายการจาก template:
{$items}

Brief จากลูกค้า:
{$brief}

สร้างใบเสนอราคาตาม brief โดยอ้างอิงโครงสร้างและช่วงราคาจาก template ด้านบน
ตอบเป็น JSON object เท่านั้น:
{
  "items": [
    {"item_name":"...","description":"...","quantity":1,"unit":"รายการ","unit_price":0,"total_price":0}
  ],
  "discount": 0,
  "tax": 0,
  "notes": "ภาษาไทย ≤ 200 ตัวอักษร",
  "payment_terms": "เงื่อนไขการชำระเงิน ภาษาไทย"
}
PROMPT;

        $payload = [
            'model'      => $model,
            'messages'   => [
                ['role' => 'system', 'content' => $sys],
                ['role' => 'user',   'content' => $user],
            ],
            'stream'     => false,
            'max_tokens' => 4096,
        ];
        $ch = curl_init($baseUrl . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . trim($plain), 'Content-Type: application/json'],
            CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
            CURLOPT_TIMEOUT        => 90,
            CURLOPT_CONNECTTIMEOUT => 15,
        ]);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) jsonError('AI request failed: ' . $err, 500);

        $resp    = json_decode($raw, true);
        $content = $resp['choices'][0]['message']['content'] ?? '';
        $content = trim(preg_replace(['/^```(?:json)?\s*/im','/\s*```$/m'], '', (string)$content));
        if (!str_starts_with($content, '{') && preg_match('/\{.*\}/s', $content, $m)) {
            $content = $m[0];
        }
        $parsed = json_decode($content, true);
        if (!is_array($parsed)) jsonError('AI returned non-JSON: ' . substr($content, 0, 300), 500);

        // Normalize items and recompute totals for safety
        if (!empty($parsed['items']) && is_array($parsed['items'])) {
            $subtotal = 0;
            foreach ($parsed['items'] as &$it) {
                $it['quantity']    = isset($it['quantity'])    ? floatval($it['quantity'])    : 1;
                $it['unit_price']  = isset($it['unit_price'])  ? floatval($it['unit_price'])  : 0;
                $it['total_price'] = isset($it['total_price']) ? floatval($it['total_price']) : ($it['quantity'] * $it['unit_price']);
                $it['unit']        = $it['unit'] ?? 'รายการ';
                $subtotal += $it['total_price'];
            }
            unset($it);
            $parsed['subtotal']    = $subtotal;
            $parsed['grand_total'] = $subtotal - floatval($parsed['discount'] ?? 0) + floatval($parsed['tax'] ?? 0);
        }

        jsonResponse($parsed);
    }

    // ── action=ai-fill ────────────────────────────────────────────────────────
    // Body: { opportunity_id, template_id? }
    // Returns: { items: [...] } — AI-generated line items from opportunity context
    if ($action === 'ai-fill') {
        $b             = getRequestBody();
        $opportunityId = $b['opportunity_id'] ?? '';
        $templateId    = $b['template_id']    ?? '';

        if (!$opportunityId) jsonError('opportunity_id required', 400);

        // Load opportunity
        $oppStmt = $db->prepare("
            SELECT o.name, o.value, o.description, o.stage,
                   c.name AS company_name, c.industry
            FROM sales_opportunities o
            LEFT JOIN companies c ON c.id = o.company_id
            WHERE o.id = ? AND o.tenant_id = ?
        ");
        $oppStmt->execute([$opportunityId, $tenantId]);
        $opp = $oppStmt->fetch();
        if (!$opp) jsonError('Opportunity not found', 404);

        // Optionally load template context
        $templateContext = '';
        if ($templateId) {
            $tStmt = $db->prepare('SELECT name, description FROM quotation_templates WHERE id = ? AND tenant_id = ?');
            $tStmt->execute([$templateId, $tenantId]);
            $tmpl = $tStmt->fetch();
            if ($tmpl) {
                $templateContext = "\n\nTemplate: {$tmpl['name']}\n{$tmpl['description']}";
            }
        }

        // Resolve AI (reuse text model)
        $ai = resolveQuotationAI($db, $tenantId);
        if (!$ai) jsonError('AI provider not configured', 503);

        $prompt = <<<PROMPT
สร้างรายการใบเสนอราคาสำหรับ:
- บริษัทลูกค้า: {$opp['company_name']} (อุตสาหกรรม: {$opp['industry']})
- ชื่อโอกาส: {$opp['name']}
- มูลค่าโดยประมาณ: ฿{$opp['value']}
- รายละเอียด: {$opp['description']}
{$templateContext}

ตอบเป็นภาษาไทยเท่านั้น ส่งกลับเป็น JSON array เท่านั้น (ไม่มี markdown):
[
  {"item_name":"ชื่อรายการ","description":"...","quantity":1,"unit":"รายการ","unit_price":0,"total_price":0},
  ...
]
สร้าง 3-8 รายการที่เหมาะสมกับธุรกิจนี้
PROMPT;

        $payload = json_encode([
            'model'      => $ai['model'],
            'messages'   => [['role' => 'user', 'content' => $prompt]],
            'stream'     => false,
            'max_tokens' => 4096,
        ], JSON_UNESCAPED_UNICODE);

        $ch = curl_init($ai['base_url'] . '/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => defined('AI_SSL_VERIFY') ? AI_SSL_VERIFY : true,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $ai['api_key'],
            ],
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        $raw  = curl_exec($ch);
        $curlErr = curl_error($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($curlErr) jsonError('เชื่อมต่อ AI ไม่สำเร็จ: ' . $curlErr, 502);
        if ($code !== 200) jsonError('AI API error: ' . ($raw ?: 'unknown'), 502);

        $resp    = json_decode($raw, true);
        $content = $resp['choices'][0]['message']['content'] ?? '';
        if (preg_match('/\[[\s\S]*\]/', $content, $m)) {
            $items = json_decode($m[0], true);
            if (is_array($items)) {
                // Normalize item fields
                foreach ($items as &$it) {
                    $it['quantity']    = floatval($it['quantity'] ?? 1);
                    $it['unit_price']  = floatval($it['unit_price'] ?? 0);
                    $it['total_price'] = floatval($it['total_price'] ?? ($it['quantity'] * $it['unit_price']));
                    $it['unit']        = $it['unit'] ?? 'รายการ';
                }
                unset($it);
                jsonResponse(['items' => $items]);
            }
        }
        jsonError('AI returned invalid JSON: ' . substr($content, 0, 200), 502);
    }

    $body = getRequestBody();
    $id = generateUUID();

    // Validate required fields
    if (empty($body['company_id'])) jsonError('กรุณาระบุบริษัท', 400);
    if (empty($body['quotation_number'])) jsonError('กรุณาระบุเลขที่ใบเสนอราคา', 400);
    if (empty($body['valid_until'])) jsonError('กรุณาระบุวันหมดอายุ', 400);

    // Validate and normalize customer_id - must be valid UUID or null
    $customerId = $body['customer_id'] ?? null;
    if ($customerId && !isValidUUID($customerId)) {
        $customerId = null; // Invalid UUID, treat as null
    }
    
    // Validate and normalize opportunity_id - must be valid UUID or null
    $opportunityId = $body['opportunity_id'] ?? null;
    if ($opportunityId && !isValidUUID($opportunityId)) {
        $opportunityId = null; // Invalid UUID, treat as null
    }
    
    // Validate company_id - must be valid UUID
    $companyId = $body['company_id'] ?? '';
    if (!isValidUUID($companyId)) jsonError('กรุณาระบุบริษัทที่ถูกต้อง', 400);
    
    // Check if company exists
    $stmtCheck = $db->prepare('SELECT id FROM companies WHERE id = ?');
    $stmtCheck->execute([$companyId]);
    if (!$stmtCheck->fetch()) jsonError('ไม่พบบริษัทที่ระบุ', 400);

    try {
        $db->beginTransaction();

        // Insert quotation
        $stmt = $db->prepare('
            INSERT INTO quotations (
                id, tenant_id, opportunity_id, company_id, customer_id, quotation_number, subject, issue_date,
                valid_until, total_amount, discount, tax, grand_total, status, payment_terms, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $id,
            $tenantId,
            $opportunityId,
            $companyId,
            $customerId,
            $body['quotation_number'],
            $body['subject'] ?? '',
            $body['issue_date'] ?? date('Y-m-d'),
            $body['valid_until'],
            $body['total_amount'] ?? 0.00,
            $body['discount'] ?? 0.00,
            $body['tax'] ?? 0.00,
            $body['grand_total'] ?? 0.00,
            $body['status'] ?? 'draft',
            $body['payment_terms'] ?? '',
            $body['notes'] ?? '',
            $userId
        ]);

        // Insert quotation items if provided
        if (!empty($body['items']) && is_array($body['items'])) {
            $stmt = $db->prepare('
                INSERT INTO quotation_items (
                    id, quotation_id, item_name, description, quantity, unit, unit_price, total_price, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');

            foreach ($body['items'] as $index => $item) {
                // Normalize field names - AI might send different names
                $itemName = $item['item_name'] ?? $item['name'] ?? $item['itemName'] ?? $item['product_name'] ?? $item['productName'] ?? '';
                $description = $item['description'] ?? $item['desc'] ?? $item['item_description'] ?? $item['itemDescription'] ?? '';
                $quantity = isset($item['quantity']) ? floatval($item['quantity']) : (isset($item['qty']) ? floatval($item['qty']) : 1);
                $unit = $item['unit'] ?? $item['item_unit'] ?? $item['itemUnit'] ?? 'รายการ';
                $unitPrice = isset($item['unit_price']) ? floatval($item['unit_price']) : (isset($item['price']) ? floatval($item['price']) : (isset($item['unitPrice']) ? floatval($item['unitPrice']) : 0));
                $totalPrice = isset($item['total_price']) ? floatval($item['total_price']) : (isset($item['total']) ? floatval($item['total']) : (isset($item['totalPrice']) ? floatval($item['totalPrice']) : ($quantity * $unitPrice)));
                
                $itemId = generateUUID();
                $stmt->execute([
                    $itemId,
                    $id,
                    $itemName,
                    $description,
                    $quantity,
                    $unit,
                    $unitPrice,
                    $totalPrice,
                    $item['sort_order'] ?? $index
                ]);
            }
        }

        // Increment quotation sequence (use global for continuous numbering)
        $db->prepare("INSERT INTO quotation_sequences (period_key, last_number) VALUES ('global', 1)
            ON DUPLICATE KEY UPDATE last_number = last_number + 1")->execute();

        $db->commit();

        // Fetch created quotation with items (tenant-scoped via JOIN)
        $stmt = $db->prepare('SELECT * FROM quotation_summary WHERE quotation_id = ?');
        $stmt->execute([$id]);
        $quotation = $stmt->fetch();

        $stmt = $db->prepare('
            SELECT qi.* FROM quotation_items qi
            JOIN quotations q ON q.id = qi.quotation_id AND q.tenant_id = ?
            WHERE qi.quotation_id = ? ORDER BY qi.sort_order ASC
        ');
        $stmt->execute([$tenantId, $id]);
        $quotation['items'] = $stmt->fetchAll();

        jsonResponse(castQuotation($quotation, $quotFloatFields, $itemFloatFields), 201);
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('เกิดข้อผิดพลาดในการสร้างใบเสนอราคา: ' . $e->getMessage(), 500);
    }
}

// --- PUT ---
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('กรุณาระบุ ID', 400);

    $body = getRequestBody();

    $fields = [];
    $values = [];
    $allowed = [
        'opportunity_id', 'company_id', 'customer_id', 'quotation_number', 'subject',
        'issue_date', 'valid_until', 'total_amount', 'discount', 'tax',
        'grand_total', 'status', 'payment_terms', 'notes'
    ];

    foreach ($allowed as $field) {
        if (array_key_exists($field, $body)) {
            $fields[] = "`$field` = ?";
            $values[] = $body[$field];
        }
    }

    $hasItemUpdates = array_key_exists('items', $body) && is_array($body['items']);
    if (empty($fields) && !$hasItemUpdates) jsonError('No fields to update');

    try {
        $db->beginTransaction();

        if (!empty($fields)) {
            $values[] = $id;
            $values[] = $tenantId;
            $sql = 'UPDATE quotations SET ' . implode(', ', $fields) . ' WHERE id = ? AND tenant_id = ?';
            $db->prepare($sql)->execute($values);
        }

        // Update items if provided
        if ($hasItemUpdates) {
            // Delete existing items
            $stmt = $db->prepare('DELETE FROM quotation_items WHERE quotation_id = ?');
            $stmt->execute([$id]);

            // Insert new items
            $stmt = $db->prepare('
                INSERT INTO quotation_items (
                    id, quotation_id, item_name, description, quantity, unit, unit_price, total_price, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ');

            foreach ($body['items'] as $index => $item) {
                $itemId = generateUUID();
                $stmt->execute([
                    $itemId,
                    $id,
                    $item['item_name'] ?? '',
                    $item['description'] ?? '',
                    $item['quantity'] ?? 1.00,
                    $item['unit'] ?? 'รายการ',
                    $item['unit_price'] ?? 0.00,
                    $item['total_price'] ?? 0.00,
                    $item['sort_order'] ?? $index
                ]);
            }
        }

        $db->commit();

        // Fetch updated quotation with items (tenant-scoped via JOIN)
        $stmt = $db->prepare('SELECT * FROM quotation_summary WHERE quotation_id = ?');
        $stmt->execute([$id]);
        $quotation = $stmt->fetch();
        if (!$quotation) jsonError('ไม่พบใบเสนอราคา', 404);

        $stmt = $db->prepare('
            SELECT qi.* FROM quotation_items qi
            JOIN quotations q ON q.id = qi.quotation_id AND q.tenant_id = ?
            WHERE qi.quotation_id = ? ORDER BY qi.sort_order ASC
        ');
        $stmt->execute([$tenantId, $id]);
        $quotation['items'] = $stmt->fetchAll();

        jsonResponse(castQuotation($quotation, $quotFloatFields, $itemFloatFields));
    } catch (Exception $e) {
        $db->rollBack();
        jsonError('เกิดข้อผิดพลาดในการแก้ไขใบเสนอราคา: ' . $e->getMessage(), 500);
    }
}

// --- DELETE ---
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('กรุณาระบุ ID', 400);

    // Items will be auto-deleted due to CASCADE constraint
    $stmt = $db->prepare('DELETE FROM quotations WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);

    if ($stmt->rowCount() === 0) jsonError('ไม่พบใบเสนอราคา', 404);
    jsonResponse(['message' => 'ลบใบเสนอราคาสำเร็จ']);
}
