# Quotation — AI Generate + Excel Import ✅ DONE (2026-05-18)

> **Goal:** (1) เพิ่ม `?action=ai-fill` ใน `api/quotations.php` สำหรับ AI generate quotation items จาก template + opportunity data (2) เพิ่ม Excel parsing ใน `api/quotation-templates.php` เพื่อ extract line items จากไฟล์ที่อัปโหลด

---

## Root Cause Analysis

### สถานะปัจจุบัน

| Feature | สถานะ |
|---------|--------|
| `quotation_templates` table | ✅ มี (ใน quotation-templates.php) |
| File upload (PDF/docx/image) | ✅ มี |
| Excel/XLSX parsing เพื่อ extract items | ❌ ไม่มี — upload แบบ opaque file ไม่ได้ parse |
| AI generate quotation items | ❌ ไม่มี endpoint |
| Frontend AI fill button | ❌ ไม่มี |

### ที่ต้องสร้าง

1. **Excel parser** — อ่าน `.xlsx` ที่ upload แล้ว extract rows เป็น quotation items
2. **AI fill action** — รับ `opportunity_id` + optional `template_id` → call AI → return `items[]` ที่พร้อม insert

---

## File Map

**Modified:**
- `api/quotation-templates.php` — เพิ่ม `?action=parse-excel` + Excel row extraction
- `api/quotations.php` — เพิ่ม `?action=ai-fill`
- `src/components/CreateQuotationDialog.tsx` — เพิ่มปุ่ม "สร้างด้วย AI" และ Excel import

**No new files needed** (reuse existing upload infrastructure)

---

## Task 1: Excel Parser ใน `api/quotation-templates.php`

- [ ] **Step 1: Install PhpSpreadsheet (ถ้ายังไม่มี)**

```bash
cd c:\xampp\htdocs\flowstack
composer require phpoffice/phpspreadsheet
```

หรือตรวจสอบว่ามีใน vendor แล้ว:
```bash
ls vendor/phpoffice/
```

- [ ] **Step 2: เพิ่ม `action=parse-excel` endpoint**

หา section GET ของ `api/quotation-templates.php` และเพิ่ม action handler:

```php
// GET ?action=parse-excel&id=UUID — parse uploaded Excel template → return items[]
if ($method === 'GET' && ($action ?? '') === 'parse-excel') {
    $id = $_GET['id'] ?? '';
    if (!$id) jsonError('Missing id', 400);

    $stmt = $db->prepare('SELECT source_file_path FROM quotation_templates WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    $row = $stmt->fetch();
    if (!$row) jsonError('Template not found', 404);

    $filePath = __DIR__ . '/../' . $row['source_file_path'];
    if (!file_exists($filePath)) jsonError('Template file not found on disk', 404);

    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    if (!in_array($ext, ['xlsx', 'xls', 'csv'], true)) {
        jsonError('File is not Excel/CSV — cannot parse items', 422);
    }

    // Load PhpSpreadsheet
    if (!file_exists(__DIR__ . '/../vendor/autoload.php')) {
        jsonError('PhpSpreadsheet not installed — run composer require phpoffice/phpspreadsheet', 500);
    }
    require_once __DIR__ . '/../vendor/autoload.php';

    try {
        $reader    = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($filePath);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($filePath);
        $sheet       = $spreadsheet->getActiveSheet();
        $rows        = $sheet->toArray(null, true, true, false);
    } catch (\Throwable $e) {
        jsonError('Excel parse error: ' . $e->getMessage(), 500);
    }

    // Detect header row — look for columns with keywords: ชื่อ/description/qty/unit/price/amount
    $headerIdx = 0;
    $headers   = [];
    foreach ($rows as $i => $row) {
        $joined = implode(' ', array_map('strtolower', array_filter($row)));
        if (preg_match('/description|รายการ|ชื่อ|qty|จำนวน|unit|ราคา|price|amount/', $joined)) {
            $headerIdx = $i;
            $headers   = $row;
            break;
        }
    }

    // Map column positions
    $colMap = [];
    foreach ($headers as $ci => $h) {
        $hl = strtolower((string)$h);
        if (preg_match('/description|รายการ|ชื่อ|item|detail/', $hl)) $colMap['description'] = $ci;
        if (preg_match('/qty|จำนวน|quantity/', $hl))                   $colMap['qty']         = $ci;
        if (preg_match('/unit|หน่วย/', $hl))                            $colMap['unit']        = $ci;
        if (preg_match('/unit.*price|ราคา.*หน่วย|price.*unit/', $hl))  $colMap['unit_price']  = $ci;
        if (preg_match('/amount|รวม|total/', $hl))                      $colMap['amount']      = $ci;
    }

    $items = [];
    for ($i = $headerIdx + 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        $desc = trim((string)($row[$colMap['description'] ?? -1] ?? ''));
        if ($desc === '' || $desc === null) continue; // skip blank rows

        $qty       = (float)($row[$colMap['qty']        ?? -1] ?? 1);
        $unit      = (string)($row[$colMap['unit']       ?? -1] ?? 'ชิ้น');
        $unitPrice = (float)($row[$colMap['unit_price']  ?? -1] ?? 0);
        $amount    = $qty * $unitPrice;

        $items[] = [
            'description' => $desc,
            'quantity'    => $qty ?: 1,
            'unit'        => $unit ?: 'ชิ้น',
            'unit_price'  => $unitPrice,
            'amount'      => $amount,
        ];
    }

    jsonResponse(['items' => $items, 'rows_found' => count($items)]);
}
```

- [ ] **Step 3: ทดสอบ**

อัปโหลด Excel template → เรียก `GET /api/quotation-templates.php?action=parse-excel&id=<UUID>` → ได้ `items[]` กลับมา

---

## Task 2: AI Fill Action ใน `api/quotations.php`

- [ ] **Step 1: เพิ่ม `action=ai-fill` handler**

เปิด `api/quotations.php` หาส่วน POST handlers และเพิ่ม:

```php
// POST ?action=ai-fill — AI generate quotation items from opportunity context
if ($method === 'POST' && ($action ?? '') === 'ai-fill') {
    $body          = getRequestBody();
    $opportunityId = $body['opportunity_id'] ?? '';
    $templateId    = $body['template_id']    ?? '';
    $notes         = $body['notes']          ?? '';

    if (!$opportunityId) jsonError('opportunity_id required', 400);

    // Load opportunity data
    $oppStmt = $db->prepare('
        SELECT o.name, o.value, o.description, o.stage,
               c.name AS company_name, c.industry
        FROM sales_opportunities o
        LEFT JOIN companies c ON c.id = o.company_id
        WHERE o.id = ? AND o.tenant_id = ?
    ');
    $oppStmt->execute([$opportunityId, $tenantId]);
    $opp = $oppStmt->fetch();
    if (!$opp) jsonError('Opportunity not found', 404);

    // Optionally load template items as context
    $templateContext = '';
    if ($templateId) {
        $tStmt = $db->prepare('SELECT name, description FROM quotation_templates WHERE id = ? AND tenant_id = ?');
        $tStmt->execute([$templateId, $tenantId]);
        $tmpl = $tStmt->fetch();
        if ($tmpl) {
            $templateContext = "\n\nTemplate ที่ใช้อ้างอิง: {$tmpl['name']}\n{$tmpl['description']}";
        }
    }

    // Resolve AI
    $ai = resolveQuotationAI($db);
    if (!$ai) jsonError('AI provider not configured', 503);

    $prompt = <<<PROMPT
สร้างรายการใบเสนอราคาสำหรับ:
- บริษัทลูกค้า: {$opp['company_name']} (อุตสาหกรรม: {$opp['industry']})
- ชื่อโอกาส: {$opp['name']}
- มูลค่าโดยประมาณ: ฿{$opp['value']}
- รายละเอียด: {$opp['description']}
{$templateContext}
หมายเหตุเพิ่มเติม: {$notes}

ส่งกลับเป็น JSON array เท่านั้น (ไม่มี markdown):
[
  {"description": "ชื่อรายการ", "quantity": 1, "unit": "ชิ้น", "unit_price": 0, "amount": 0},
  ...
]
สร้าง 3-8 รายการที่เหมาะสมกับธุรกิจนี้
PROMPT;

    $payload = json_encode([
        'model'    => $ai['model'],
        'messages' => [['role' => 'user', 'content' => $prompt]],
        'stream'   => false,
    ]);

    $ch = curl_init($ai['base_url'] . '/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $ai['api_key'],
        ],
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200) jsonError('AI API error: ' . $raw, 502);

    $resp    = json_decode($raw, true);
    $content = $resp['choices'][0]['message']['content'] ?? '';

    // Extract JSON from response
    if (preg_match('/\[[\s\S]*\]/', $content, $m)) {
        $items = json_decode($m[0], true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($items)) {
            jsonResponse(['items' => $items]);
        }
    }
    jsonError('AI returned invalid JSON: ' . substr($content, 0, 200), 502);
}

// Helper — resolve AI creds for quotation (reuse text model)
function resolveQuotationAI(PDO $db): ?array {
    try {
        $row = $db->query("
            SELECT ap.api_base_url, ap.api_key_encrypted,
                   COALESCE(am_t.model_id, am_d.model_id, 'openai/gpt-4o-mini') AS model_id
            FROM company_settings cs
            LEFT JOIN ai_models am_t ON am_t.id = cs.ai_content_text_model_id
            LEFT JOIN ai_models am_d ON am_d.id = cs.ai_default_model_id
            JOIN ai_providers ap ON ap.id = COALESCE(am_t.provider_id, am_d.provider_id, cs.ai_active_provider_id)
            WHERE cs.id = 1 AND ap.api_key_encrypted IS NOT NULL AND ap.api_key_encrypted != ''
            LIMIT 1
        ")->fetch();
        if (!$row) return null;
        $encKey  = hash('sha256', JWT_SECRET, true);
        $rawData = base64_decode($row['api_key_encrypted']);
        if (strlen($rawData) <= 16) return null;
        $plain = openssl_decrypt(substr($rawData, 16), 'AES-256-CBC', $encKey, OPENSSL_RAW_DATA, substr($rawData, 0, 16));
        if (!$plain || !trim($plain)) return null;
        return [
            'api_key'  => trim($plain),
            'base_url' => rtrim($row['api_base_url'] ?: 'https://api.kilo.ai/api/gateway', '/'),
            'model'    => $row['model_id'],
        ];
    } catch (\Throwable $e) { return null; }
}
```

- [ ] **Step 2: เพิ่มปุ่ม AI Fill + Excel Import ใน `CreateQuotationDialog.tsx`**

หา section ที่แสดง items list ใน `CreateQuotationDialog.tsx` และเพิ่ม:

```tsx
// State
const [aiFilling, setAiFilling] = useState(false);
const [excelParsing, setExcelParsing] = useState(false);

// AI fill handler
const handleAiFill = async () => {
  if (!opportunityId) { toast({ title: 'เลือก Opportunity ก่อน', variant: 'destructive' }); return; }
  setAiFilling(true);
  try {
    const res = await apiFetch('/quotations.php?action=ai-fill', {
      method: 'POST',
      body: JSON.stringify({ opportunity_id: opportunityId, template_id: selectedTemplate }),
    });
    if (res?.items?.length) {
      setItems(prev => [...prev, ...res.items]);
      toast({ title: `AI เพิ่ม ${res.items.length} รายการ` });
    }
  } catch (e: any) {
    toast({ title: 'AI fill ไม่สำเร็จ', description: e.message, variant: 'destructive' });
  } finally { setAiFilling(false); }
};

// Excel parse handler — from uploaded template
const handleExcelParse = async (templateId: string) => {
  setExcelParsing(true);
  try {
    const res = await apiFetch(`/quotation-templates.php?action=parse-excel&id=${templateId}`);
    if (res?.items?.length) {
      setItems(prev => [...prev, ...res.items]);
      toast({ title: `นำเข้า ${res.items.length} รายการจาก Excel` });
    }
  } catch (e: any) {
    toast({ title: 'Excel parse ไม่สำเร็จ', description: e.message, variant: 'destructive' });
  } finally { setExcelParsing(false); }
};

// JSX — เพิ่มปุ่มข้างๆ "เพิ่มรายการ"
<div className="flex gap-2">
  <Button type="button" variant="outline" size="sm" onClick={handleAiFill} disabled={aiFilling}>
    {aiFilling ? 'กำลังสร้าง...' : '✨ สร้างด้วย AI'}
  </Button>
  {selectedTemplate && (
    <Button type="button" variant="outline" size="sm" onClick={() => handleExcelParse(selectedTemplate)} disabled={excelParsing}>
      {excelParsing ? 'กำลังอ่าน...' : '📊 นำเข้าจาก Excel'}
    </Button>
  )}
</div>
```

- [ ] **Step 3: Build + TypeScript check**

```bash
pnpm build 2>&1 | grep -i error
```

- [ ] **Step 4: ทดสอบ end-to-end**

1. ไปที่หน้า Quotations > สร้างใบเสนอราคาใหม่
2. เลือก Opportunity → กด "สร้างด้วย AI" → รายการควรปรากฏ
3. อัปโหลด template Excel → กด "นำเข้าจาก Excel" → รายการจาก Excel ปรากฏ

---

## Final Verification

- [ ] `php -l api/quotations.php && php -l api/quotation-templates.php`
- [ ] `pnpm build` — TypeScript clean
- [ ] AI fill สร้างรายการ 3-8 รายการที่สมเหตุสมผล
- [ ] Excel parse อ่าน header แล้ว map columns ได้ถูกต้อง
