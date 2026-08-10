<?php
// api/quotation-templates.php
//
// Quotation template registry — sources for AI-driven quotation generation.
//
// GET                      — list templates
// GET    ?id=X             — get single
// POST                     — upload Excel/CSV (multipart: name, file)
//                             or clone from existing quotation (json: name, source_quotation_id)
// PUT    ?id=X             — update (name, description, default_*, is_active)
// DELETE ?id=X             — delete
//
// Uploaded files are stored under uploads/quotation-templates/{tenant_id}/{uuid}.{ext}

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/../vendor/autoload.php';

$tokenData = requireAuth();
$userId    = $tokenData['user_id'];
$tenantId  = $tokenData['tenant_id'];
$db        = getDB();
$method    = getMethod();

$UPLOAD_DIR = __DIR__ . '/../uploads/quotation-templates';
if (!is_dir($UPLOAD_DIR)) @mkdir($UPLOAD_DIR, 0775, true);

// ── Helpers: parse CSV / XLSX → {headers, sample_rows, items} ───────────────

function parseCsvFile(string $path): array {
    $headers = []; $rows = []; $items = [];
    $fh = @fopen($path, 'r');
    if (!$fh) return ['headers' => [], 'sample_rows' => [], 'items' => []];
    // Try UTF-8 BOM strip on first line
    $first = fgets($fh);
    if ($first !== false) {
        $first = preg_replace('/^\xEF\xBB\xBF/', '', $first);
        $headers = str_getcsv($first);
        $headers = array_map('trim', $headers);
    }
    while (($r = fgetcsv($fh)) !== false) {
        $rows[] = array_map('trim', $r);
        if (count($rows) >= 50) break;
    }
    fclose($fh);
    $items = csvRowsToItems($headers, $rows);
    return [
        'headers'     => $headers,
        'sample_rows' => array_slice($rows, 0, 10),
        'items'       => $items,
    ];
}

/**
 * Minimal XLSX reader: opens the .xlsx ZIP, extracts the first sheet + sharedStrings,
 * returns headers (first row) + sample data rows. Good enough for simple price sheets.
 * Returns empty arrays on failure (caller should suggest user re-save as .csv).
 */
function findHeaderRowIndex(array $rows, int $scanLimit = 30): array {
    $scan = min(count($rows), $scanLimit);
    $bestIdx = 0;
    $bestScore = 0;
    for ($i = 0; $i < $scan; $i++) {
        $rowText = implode(' ', array_map(fn($v) => trim((string)($v ?? '')), $rows[$i]));
        $score = 0;
        if (preg_match('/(รายการ|สินค้า|item|product|description|รายละเอียด)/iu', $rowText)) $score++;
        if (preg_match('/(จำนวน|qty|quantity)/iu', $rowText)) $score++;
        if (preg_match('/(ราคา|price|unit.?price)/iu', $rowText)) $score++;
        if (preg_match('/(รวม|total|amount)/iu', $rowText)) $score++;
        if ($score > $bestScore) { $bestScore = $score; $bestIdx = $i; }
    }
    return [$bestScore >= 2 ? $bestIdx : 0, $bestScore];
}

function parseExcelFile(string $path): array {
    if (!class_exists('\PhpOffice\PhpSpreadsheet\IOFactory')) {
        return parseXlsxFile($path);
    }
    try {
        $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($path);
        $worksheet = $spreadsheet->getActiveSheet();
        $rows = $worksheet->toArray(null, true, true, false);
        // Remove completely empty trailing rows
        while (!empty($rows) && empty(array_filter(end($rows), fn($v) => $v !== null && $v !== ''))) {
            array_pop($rows);
        }
        if (empty($rows)) return ['headers' => [], 'sample_rows' => [], 'items' => []];
        // Find the header row (skip letterhead / company info rows)
        [$headerIdx, $bestScore] = findHeaderRowIndex($rows);
        if ($headerIdx > 0) {
            // Discard rows before the header row
            $rows = array_slice($rows, $headerIdx);
        }
        $headers = array_map(fn($v) => trim((string)($v ?? '')), array_shift($rows));
        // Remove rows that look like secondary headers (English column names after Thai, etc.)
        $filteredRows = [];
        foreach ($rows as $row) {
            $rowText = implode(' ', array_map(fn($v) => trim((string)($v ?? '')), $row));
            $hits = 0;
            if (preg_match('/(รายการ|สินค้า|item|product|part\s*no)/iu', $rowText)) $hits++;
            if (preg_match('/(จำนวน|qty|quantity)/iu', $rowText)) $hits++;
            if (preg_match('/(ราคา|price|unit.?price)/iu', $rowText)) $hits++;
            if (preg_match('/(รวม|total|amount)/iu', $rowText)) $hits++;
            if ($hits < 2) {
                $filteredRows[] = $row;
            }
        }
        $items = csvRowsToItems($headers, $filteredRows);
        return [
            'headers'     => $headers,
            'sample_rows' => array_slice($filteredRows, 0, 10),
            'items'       => $items,
        ];
    } catch (\Throwable $e) {
        return parseXlsxFile($path);
    }
}

function parseXlsxFile(string $path): array {
    if (!class_exists('ZipArchive')) return ['headers'=>[],'sample_rows'=>[],'items'=>[]];
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) return ['headers'=>[],'sample_rows'=>[],'items'=>[]];

    // shared strings
    $strings = [];
    $ss = $zip->getFromName('xl/sharedStrings.xml');
    if ($ss) {
        $xml = @simplexml_load_string($ss);
        if ($xml) {
            foreach ($xml->si as $si) {
                $txt = '';
                if (isset($si->t)) $txt = (string)$si->t;
                elseif (isset($si->r)) {
                    foreach ($si->r as $r) $txt .= (string)$r->t;
                }
                $strings[] = $txt;
            }
        }
    }

    // first sheet (sheet1.xml — most common name)
    $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
    if ($sheetXml === false) {
        // try iterating
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $n = $zip->getNameIndex($i);
            if (preg_match('#^xl/worksheets/sheet\d+\.xml$#', $n)) {
                $sheetXml = $zip->getFromName($n);
                break;
            }
        }
    }
    $zip->close();
    if (!$sheetXml) return ['headers'=>[],'sample_rows'=>[],'items'=>[]];

    $xml = @simplexml_load_string($sheetXml);
    if (!$xml) return ['headers'=>[],'sample_rows'=>[],'items'=>[]];

    $rows = [];
    foreach ($xml->sheetData->row as $row) {
        $cells = [];
        foreach ($row->c as $c) {
            $ref = (string)$c['r'];                       // e.g. "B3"
            $colLetters = preg_replace('/[0-9]/', '', $ref);
            $colIdx = 0;
            foreach (str_split(strtoupper($colLetters)) as $ch) {
                $colIdx = $colIdx * 26 + (ord($ch) - 64);
            }
            $colIdx--; // 0-based
            $type = (string)$c['t'];
            $v    = isset($c->v) ? (string)$c->v : '';
            if ($type === 's') {
                $v = $strings[(int)$v] ?? '';
            } elseif ($type === 'inlineStr' && isset($c->is->t)) {
                $v = (string)$c->is->t;
            }
            $cells[$colIdx] = trim((string)$v);
        }
        if (empty($cells)) continue;
        // Fill gaps so columns align
        $maxIdx = max(array_keys($cells));
        $rowArr = [];
        for ($i = 0; $i <= $maxIdx; $i++) {
            $rowArr[] = $cells[$i] ?? '';
        }
        $rows[] = $rowArr;
        if (count($rows) >= 50) break;
    }

    // Find header row (skip letterhead rows)
    [$headerIdx] = findHeaderRowIndex($rows);
    if ($headerIdx > 0) {
        $rows = array_slice($rows, $headerIdx);
    }
    $headers = !empty($rows) ? array_shift($rows) : [];
    $headers = array_map('trim', $headers);
    $items   = csvRowsToItems($headers, $rows);
    return [
        'headers'     => $headers,
        'sample_rows' => array_slice($rows, 0, 10),
        'items'       => $items,
    ];
}

/**
 * Try to map header columns to standard quotation_item fields.
 * Headers in Thai/English are both supported via keyword match.
 */
function csvRowsToItems(array $headers, array $rows): array {
    $map = [
        'item_name'   => null,
        'description' => null,
        'quantity'    => null,
        'unit'        => null,
        'unit_price'  => null,
        'total_price' => null,
    ];
    foreach ($headers as $i => $h) {
        $low = mb_strtolower(trim((string)$h));
        if ($map['item_name']  === null && preg_match('/(item|product|รายการ|สินค้า|ชื่อ)/u', $low))       $map['item_name']  = $i;
        if ($map['description']=== null && preg_match('/(desc|detail|รายละเอียด|คำอธิบาย)/u', $low))        $map['description']= $i;
        if ($map['quantity']   === null && preg_match('/(qty|quantity|จำนวน)/u', $low))                    $map['quantity']   = $i;
        if ($map['unit']       === null && preg_match('/^(unit|หน่วย)$/u', $low))                          $map['unit']       = $i;
        if ($map['unit_price'] === null && preg_match('/(price|ราคา\/?(หน่วย)?|unit.?price)/u', $low))     $map['unit_price'] = $i;
        if ($map['total_price']=== null && preg_match('/(total|รวม|amount)/u', $low))                       $map['total_price']= $i;
    }
    $items = [];
    foreach ($rows as $r) {
        if (empty(array_filter($r, fn($x) => $x !== '' && $x !== null))) continue;
        $itemName = $map['item_name'] !== null ? (string)($r[$map['item_name']] ?? '') : '';
        // skip rows that look like headers/section labels
        if ($itemName === '' && empty(array_filter([
            $r[$map['quantity']  ?? -1] ?? null,
            $r[$map['unit_price']?? -1] ?? null,
        ]))) continue;
        $qty = $map['quantity']   !== null ? floatval(str_replace(',', '', (string)($r[$map['quantity']] ?? 0))) : 0;
        $up  = $map['unit_price'] !== null ? floatval(str_replace(',', '', (string)($r[$map['unit_price']] ?? 0))) : 0;
        $tp  = $map['total_price']!== null ? floatval(str_replace(',', '', (string)($r[$map['total_price']] ?? 0))) : ($qty * $up);
        // skip rows that have no pricing data at all (section headers, text blocks)
        if ($qty == 0 && $up == 0 && $tp == 0) continue;
        // skip summary/total rows (have total value but no item name, qty, or unit price)
        if ($itemName === '' && $qty == 0 && $up == 0) continue;
        $items[] = [
            'item_name'   => $itemName,
            'description' => $map['description'] !== null ? (string)($r[$map['description']] ?? '') : '',
            'quantity'    => $qty,
            'unit'        => $map['unit']        !== null ? (string)($r[$map['unit']] ?? 'รายการ') : 'รายการ',
            'unit_price'  => $up,
            'total_price' => $tp,
        ];
        if (count($items) >= 20) break;
    }
    return $items;
}

// ── GET ──────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    // ?action=parse-excel&id=UUID — extract rows from uploaded Excel template
    if (($_GET['action'] ?? '') === 'parse-excel') {
        $templateId = $_GET['id'] ?? '';
        if (!$templateId) jsonError('Missing id', 400);

        $stmt = $db->prepare('SELECT source_file_path FROM quotation_templates WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$templateId, $tenantId]);
        $row = $stmt->fetch();
        if (!$row || empty($row['source_file_path'])) jsonError('Template or file not found', 404);

        $filePath = __DIR__ . '/../' . $row['source_file_path'];
        if (!file_exists($filePath)) jsonError('Template file not found on disk', 404);

        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        if (!in_array($ext, ['xlsx', 'xls', 'csv'], true)) {
            jsonError('File is not Excel/CSV', 422);
        }

        try {
            $reader      = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($filePath);
            $reader->setReadDataOnly(true);
            $spreadsheet = $reader->load($filePath);
            $sheet       = $spreadsheet->getActiveSheet();
            $rows        = $sheet->toArray(null, true, true, false);
        } catch (\Throwable $e) {
            jsonError('Excel parse error: ' . $e->getMessage(), 500);
        }

        // Detect header row
        $headerIdx = 0;
        $headers   = [];
        foreach ($rows as $i => $r) {
            $joined = implode(' ', array_map('strtolower', array_filter(array_map('strval', $r))));
            if (preg_match('/description|รายการ|ชื่อ|qty|จำนวน|unit|ราคา|price|amount|รวม/', $joined)) {
                $headerIdx = $i;
                $headers   = $r;
                break;
            }
        }

        // Map columns
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
            $r    = $rows[$i];
            $desc = trim((string)($r[$colMap['description'] ?? -1] ?? ''));
            if ($desc === '' || $desc === null) continue;

            $qty       = (float)($r[$colMap['qty']        ?? -1] ?? 1);
            $unit      = (string)($r[$colMap['unit']       ?? -1] ?? 'ชิ้น');
            $unitPrice = (float)($r[$colMap['unit_price']  ?? -1] ?? 0);
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

    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM quotation_templates WHERE id = ? AND tenant_id = ?');
        $stmt->execute([$id, $tenantId]);
        $row = $stmt->fetch();
        if (!$row) jsonError('ไม่พบ template', 404);
        // decode JSON columns for FE
        $row['parsed_schema']      = $row['parsed_schema']      ? json_decode($row['parsed_schema'], true)      : null;
        $row['example_items_json'] = $row['example_items_json'] ? json_decode($row['example_items_json'], true) : null;
        jsonResponse($row);
    }
    $stmt = $db->prepare("
        SELECT id, name, description, source, is_active, created_at, updated_at
        FROM quotation_templates
        WHERE tenant_id = ? AND is_active = 1
        ORDER BY name ASC
    ");
    $stmt->execute([$tenantId]);
    jsonResponse($stmt->fetchAll());
}

// ── POST ─────────────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $action = $_GET['action'] ?? 'upload';

    // Clone from existing quotation
    if ($action === 'from-quotation') {
        $b = getRequestBody();
        $name        = trim((string)($b['name'] ?? ''));
        $qid         = (string)($b['source_quotation_id'] ?? '');
        $description = (string)($b['description'] ?? '');
        if (!$name || !$qid) jsonError('ต้องระบุ name + source_quotation_id', 400);

        $q = $db->prepare("SELECT * FROM quotations WHERE id = ? AND tenant_id = ?");
        $q->execute([$qid, $tenantId]);
        $quot = $q->fetch();
        if (!$quot) jsonError('ไม่พบใบเสนอราคา', 404);

        $itemsStmt = $db->prepare('SELECT item_name, description, quantity, unit, unit_price, total_price FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC');
        $itemsStmt->execute([$qid]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);

        $id = generateUUID();
        $now = date('Y-m-d H:i:s');
        $db->prepare("
            INSERT INTO quotation_templates
              (id, tenant_id, name, description, source, source_quotation_id,
               parsed_schema, example_items_json, default_payment_terms, default_notes,
               is_active, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'existing_quotation', ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ")->execute([
            $id, $tenantId, $name, $description, $qid,
            json_encode(['headers' => ['item_name','description','quantity','unit','unit_price','total_price'],
                         'sample_rows' => array_map(fn($it) => array_values($it), $items)], JSON_UNESCAPED_UNICODE),
            json_encode($items, JSON_UNESCAPED_UNICODE),
            $quot['payment_terms'] ?? '',
            $quot['notes'] ?? '',
            $userId, $now, $now,
        ]);
        jsonResponse(['id' => $id, 'message' => 'สร้าง template จากใบเสนอราคาสำเร็จ'], 201);
    }

    // Upload file (multipart)
    if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        jsonError('ต้องอัปโหลดไฟล์ (field: file)', 400);
    }
    $name        = trim((string)($_POST['name'] ?? ''));
    $description = (string)($_POST['description'] ?? '');
    if (!$name) jsonError('ต้องระบุชื่อ template', 400);

    $orig = $_FILES['file']['name'];
    $ext  = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
    if (!in_array($ext, ['csv','xlsx','xls'], true)) jsonError('รองรับเฉพาะ .csv และ .xlsx', 400);
    if ($_FILES['file']['size'] > 5 * 1024 * 1024) jsonError('ไฟล์ใหญ่เกิน 5MB', 400);

    $tenantDir = $UPLOAD_DIR . '/' . $tenantId;
    if (!is_dir($tenantDir)) @mkdir($tenantDir, 0775, true);

    $id     = generateUUID();
    $stored = $tenantDir . '/' . $id . '.' . $ext;
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $stored)) {
        jsonError('บันทึกไฟล์ไม่สำเร็จ', 500);
    }
    $relPath = 'uploads/quotation-templates/' . $tenantId . '/' . $id . '.' . $ext;

    // Parse
    $parsed = ($ext === 'csv') ? parseCsvFile($stored) : parseExcelFile($stored);
    $sourceKind = $ext === 'csv' ? 'csv' : 'excel';

    $now = date('Y-m-d H:i:s');
    $db->prepare("
        INSERT INTO quotation_templates
          (id, tenant_id, name, description, source, source_file_path, source_mime,
           parsed_schema, example_items_json, is_active, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    ")->execute([
        $id, $tenantId, $name, $description, $sourceKind, $relPath, $_FILES['file']['type'] ?? '',
        json_encode(['headers' => $parsed['headers'], 'sample_rows' => $parsed['sample_rows']], JSON_UNESCAPED_UNICODE),
        json_encode($parsed['items'], JSON_UNESCAPED_UNICODE),
        $userId, $now, $now,
    ]);

    jsonResponse([
        'id'      => $id,
        'parsed'  => $parsed,
        'message' => count($parsed['items']) > 0
            ? 'อัปโหลดสำเร็จ พบ ' . count($parsed['items']) . ' รายการในไฟล์'
            : 'อัปโหลดสำเร็จ แต่ระบบไม่พบรายการ — ตรวจ header column (item/qty/price)',
    ], 201);
}

// ── PUT ──────────────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id', 400);
    $b = getRequestBody();
    $allowed = ['name','description','default_payment_terms','default_notes','is_active'];
    $sets = []; $vals = [];
    foreach ($allowed as $f) {
        if (array_key_exists($f, $b)) { $sets[] = "`$f` = ?"; $vals[] = $b[$f]; }
    }
    if (empty($sets)) jsonError('ไม่มี field ที่จะอัปเดต', 400);
    $vals[] = $id; $vals[] = $tenantId;
    $db->prepare('UPDATE quotation_templates SET ' . implode(', ', $sets) . ' WHERE id = ? AND tenant_id = ?')->execute($vals);
    jsonResponse(['message' => 'อัปเดตสำเร็จ']);
}

// ── DELETE ───────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) jsonError('Missing id', 400);
    // Best-effort: remove the stored file
    $stmt = $db->prepare('SELECT source_file_path FROM quotation_templates WHERE id = ? AND tenant_id = ?');
    $stmt->execute([$id, $tenantId]);
    $row = $stmt->fetch();
    if ($row && $row['source_file_path']) {
        $abs = __DIR__ . '/../' . $row['source_file_path'];
        if (is_file($abs)) @unlink($abs);
    }
    $db->prepare('DELETE FROM quotation_templates WHERE id = ? AND tenant_id = ?')->execute([$id, $tenantId]);
    jsonResponse(['deleted' => true]);
}

jsonError('Method not allowed', 405);
