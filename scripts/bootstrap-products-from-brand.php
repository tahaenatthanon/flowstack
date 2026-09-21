<?php
/**
 * One-time bootstrap: parse the "รายละเอียด สินค้า/บริการ" list out of the
 * tenant's brand.md (brand_contexts.file_type='brand_md') and insert one row
 * per product into the new `products` table — auto-linking an image from
 * content_global_settings.product_refs when the name matches exactly.
 *
 * รัน: php scripts/bootstrap-products-from-brand.php
 *
 * Idempotent: skips a tenant if `products` already has rows for it, so
 * running twice does not create duplicates.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

require_once __DIR__ . '/../api/config.php';

$db = getDB();

// รายการสินค้าใน brand.md เขียนเป็น list แบบ "N.  **ชื่อ:** คำอธิบาย" (มีทั้ง "1." และ "1 .")
// ต่อบรรทัด ใต้หัวข้อ "รายละเอียด สินค้า / บริการ" จนถึงหัวข้อถัดไป (บรรทัดที่ขึ้นต้นด้วย **N.)
function parseProductsFromBrandMd(string $content): array {
    // ตัดมาเฉพาะช่วงตั้งแต่ "รายละเอียด สินค้า" ถึงหัวข้อ "**2." (Key Messages) ที่ตามมา
    if (!preg_match('/รายละเอียด\s*สินค้า.*?:(.*?)\n\*\*2\./us', $content, $section)) {
        return [];
    }
    $block = $section[1];
    $products = [];
    // แต่ละบรรทัด: "    1.  **AI Portal (Duckkit):** แพลตฟอร์ม..."
    if (preg_match_all('/^\s*\d+\.\s*\*\*(.+?):\*\*\s*(.+)$/mu', $block, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $m) {
            $name = trim($m[1]);
            $description = trim($m[2]);
            if ($name !== '') {
                $products[] = ['name' => $name, 'description' => $description];
            }
        }
    }
    return $products;
}

function normalizeProductName(string $name): string {
    return mb_strtolower(trim($name));
}

$stmt = $db->query("SELECT id, tenant_id, content FROM brand_contexts WHERE file_type='brand_md'");
$brandDocs = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (!$brandDocs) {
    echo "ไม่พบ brand_contexts (file_type='brand_md') — ไม่มีอะไรให้ bootstrap\n";
    exit(0);
}

$totalInserted = 0;

foreach ($brandDocs as $doc) {
    $tenantId = $doc['tenant_id'];

    $existing = $db->prepare('SELECT COUNT(*) FROM products WHERE tenant_id = ?');
    $existing->execute([$tenantId]);
    if ((int)$existing->fetchColumn() > 0) {
        echo "[{$tenantId}] มี products อยู่แล้ว — ข้าม (idempotent)\n";
        continue;
    }

    $products = parseProductsFromBrandMd((string)$doc['content']);
    if (!$products) {
        echo "[{$tenantId}] ไม่พบรายการสินค้าใน brand.md ให้ parse\n";
        continue;
    }

    // โหลด product_refs เพื่อจับคู่รูปตามชื่อ
    $refsByName = [];
    $gsStmt = $db->prepare('SELECT product_refs FROM content_global_settings WHERE tenant_id = ?');
    $gsStmt->execute([$tenantId]);
    $gsRow = $gsStmt->fetch(PDO::FETCH_ASSOC);
    if ($gsRow && !empty($gsRow['product_refs'])) {
        $decoded = json_decode($gsRow['product_refs'], true);
        if (is_array($decoded)) {
            foreach ($decoded as $ref) {
                if (!empty($ref['name']) && !empty($ref['url'])) {
                    $refsByName[normalizeProductName($ref['name'])] = $ref['url'];
                }
            }
        }
    }

    // created_by: ใช้ผู้สร้าง brand context เอกสารนี้เป็นเจ้าของ record ที่ bootstrap มา
    $createdByStmt = $db->prepare('SELECT created_by FROM brand_contexts WHERE id = ?');
    $createdByStmt->execute([$doc['id']]);
    $createdBy = (string)$createdByStmt->fetchColumn();

    $insertStmt = $db->prepare(
        'INSERT INTO products (id, tenant_id, name, description, usp, price, image_url, status, created_by, created_at)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, \'active\', ?, NOW())'
    );

    foreach ($products as $p) {
        $imageUrl = $refsByName[normalizeProductName($p['name'])] ?? null;
        // ชื่อสินค้าใน brand.md บางตัวมีวงเล็บ เช่น "AI Portal (Duckkit)" — ลองจับคู่แบบไม่มีวงเล็บด้วยถ้ายังไม่เจอ
        if ($imageUrl === null && preg_match('/^(.+?)\s*\(/', $p['name'], $mm)) {
            $imageUrl = $refsByName[normalizeProductName(trim($mm[1]))] ?? null;
        }
        $insertStmt->execute([generateUUID(), $tenantId, $p['name'], $p['description'], $imageUrl, $createdBy]);
        $totalInserted++;
        echo "[{$tenantId}] + {$p['name']}" . ($imageUrl ? ' (มีรูป)' : '') . "\n";
    }
}

echo "เสร็จสิ้น — insert ทั้งหมด {$totalInserted} รายการ\n";
