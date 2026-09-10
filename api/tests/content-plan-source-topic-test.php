<?php
/**
 * Part 7 — content-generation-research (delta: legacy Content Plan source_topic)
 * ทดสอบ content_plan_item_source_topic() โดยตรง (pure, ไม่พึ่ง DB/network)
 *
 * บริบท: generate-plan บังคับ source_topic เฉพาะ Direct mode แล้ว (ดู
 * openspec/changes/archive/.../fix-content-plan-source-topic) — legacy/trigger-only
 * Content Plan mode ไม่มี Topic ที่ผู้ใช้พิมพ์เอง ต้องแช่แข็ง topic ที่ AI สร้างให้
 * item นั้นเป็น source_topic แทน ฟังก์ชันนี้คือจุดตัดสินใจนั้น
 */

require_once __DIR__ . '/../lib/content-plan-prompt.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

// ── TC01 — Direct mode: มี request source_topic → ใช้ค่านั้นตรงตัว ─────────
{
    $result = content_plan_item_source_topic('YouTube', 'วิธีใช้ YouTube ให้ปัง 2026');
    $pass = $result === 'YouTube';
    record('TC01', 'Direct mode มี source_topic', 'ใช้ request source_topic ตรงตัว (ไม่ใช่ AI topic)',
        $result, $pass); tally($pass);
}

// ── TC02 — Legacy mode: ไม่มี request source_topic → ใช้ topic ของ item เอง ─
{
    $result = content_plan_item_source_topic('', 'เทคนิคปิดการขายวันจันทร์');
    $pass = $result === 'เทคนิคปิดการขายวันจันทร์';
    record('TC02', 'Legacy mode ไม่มี source_topic', 'ใช้ topic ของ item เองที่ AI สร้างให้',
        $result, $pass); tally($pass);
}

// ── TC03 — Legacy mode: item คนละตัวได้ source_topic ต่างกันตามหัวข้อของตัวเอง ─
{
    $mon = content_plan_item_source_topic('', 'หัวข้อวันจันทร์: 5 เทคนิค X');
    $tue = content_plan_item_source_topic('', 'หัวข้อวันอังคาร: วิธีทำ Y');
    $pass = $mon !== $tue && $mon === 'หัวข้อวันจันทร์: 5 เทคนิค X' && $tue === 'หัวข้อวันอังคาร: วิธีทำ Y';
    record('TC03', 'item คนละตัวในแผนเดียวกัน', 'source_topic ต่างกันตามหัวข้อของตัวเอง ไม่ใช่ค่าเดียวกันซ้ำ',
        "mon={$mon}, tue={$tue}", $pass); tally($pass);
}

// ── TC04 — Legacy mode: request source_topic ว่าง + item topic ก็ว่าง → คืนค่าว่าง (ไม่ throw) ─
{
    $result = content_plan_item_source_topic('', null);
    $pass = $result === '';
    record('TC04', 'ไม่มีทั้ง source_topic และ item topic', 'คืนค่าว่างเปล่า ไม่ error',
        var_export($result, true), $pass); tally($pass);
}

// ── TC05 — request source_topic มีแต่เว้นวรรค → ถือว่าว่าง แล้ว fallback ไป item topic ─
{
    $result = content_plan_item_source_topic('   ', 'หัวข้อจาก AI');
    $pass = $result === 'หัวข้อจาก AI';
    record('TC05', 'request source_topic เป็นช่องว่างล้วน', 'trim แล้วถือว่าว่าง → fallback ไป item topic',
        $result, $pass); tally($pass);
}

// ── TC06 — item topic มีแต่เว้นวรรค + ไม่มี source_topic → trim แล้วคืนค่าว่าง ─
{
    $result = content_plan_item_source_topic('', '   ');
    $pass = $result === '';
    record('TC06', 'item topic เป็นช่องว่างล้วน', 'trim แล้วคืนค่าว่างเปล่า',
        var_export($result, true), $pass); tally($pass);
}

// ═══════════════════ Output ════════════════════════════════════════════════
echo "\n";
echo "| TC | Test Case | Expected | Actual | PASS/FAIL |\n";
echo "|----|-----------|----------|--------|-----------|\n";
foreach ($RESULTS as [$tc, $name, $expected, $actual, $pass]) {
    $mark = $pass ? 'PASS' : 'FAIL';
    echo "| {$tc} | {$name} | {$expected} | {$actual} | {$mark} |\n";
}
echo "\nผ่าน: {$PASS} / " . count($RESULTS) . "\n";
echo "ไม่ผ่าน: {$FAIL} / " . count($RESULTS) . "\n";
if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
