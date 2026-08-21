<?php
/**
 * รัน cron ซิงก์ metrics โดยชี้ GRAPH_API_BASE ไปที่ mock — เครื่องมือทดสอบเท่านั้น
 *
 * รัน: php scripts/dev-mocks/run-metrics-sync-with-mock.php <base-url-ของ-mock>
 *
 * ทำไมต้องเป็นไฟล์แยกและรันเป็นโปรเซสใหม่:
 *   api/cron/content-metrics-sync.php ประกาศ function/const ที่ระดับไฟล์ — include
 *   ซ้ำในโปรเซสเดียวจะ fatal (redeclare) การรันซ้ำหลายรอบเพื่อทดสอบ time-series
 *   จึงต้องแยกโปรเซส และ define GRAPH_API_BASE ก่อน require เพื่อไม่ให้แตะโค้ด production
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

$base = $argv[1] ?? '';
if ($base === '') exit("ต้องระบุ base URL ของ mock เป็น argument แรก\n");

define('GRAPH_API_BASE', $base);
require __DIR__ . '/../../api/cron/content-metrics-sync.php';
