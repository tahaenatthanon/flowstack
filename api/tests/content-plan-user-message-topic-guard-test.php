<?php
/**
 * Part 7 — content-generation-research (delta: content-plan-prompt-topic-guard)
 * ทดสอบ content_plan_user_message() โดยตรง (pure, ไม่พึ่ง DB/network)
 *
 * บริบท: branch non-direct (legacy Content Plan) ต้องไม่พึ่งว่า caller เตรียม
 * source_topic ที่ไม่ว่างมาให้เสมอ — ฟังก์ชันต้อง resolve เอง (source_topic →
 * trigger command ตัวแรกที่ไม่ว่าง) และตัดบรรทัด "Original User Topic/Seed"
 * ทิ้งทั้งบรรทัดถ้าทุกแหล่งว่างสนิท (ไม่มี placeholder ใดมาแทน)
 */

require_once __DIR__ . '/../lib/content-plan-prompt.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

const TOPIC_LABEL = 'Original User Topic/Seed (SOURCE OF TRUTH): ';

$baseArgs = [
    'week_start'    => '2026-09-07',
    'day_label'     => 'จันทร์',
    'day_order'     => 1,
    'platforms_str' => '',
];

// ── TC01 — มี source_topic → พิมพ์บรรทัดปกติด้วยค่านั้น ─────────────────────
{
    $msg = content_plan_user_message(false, $baseArgs + ['source_topic' => 'YouTube', 'trigger_command' => '']);
    $pass = str_contains($msg, TOPIC_LABEL . 'YouTube');
    record('TC01', 'มี source_topic', 'พิมพ์บรรทัด Topic ด้วยค่า source_topic ตรงตัว', $msg, $pass); tally($pass);
}

// ── TC02 — ไม่มี source_topic แต่มี trigger_commands → fallback ไปตัวแรกที่ไม่ว่าง ─
{
    $msg = content_plan_user_message(false, $baseArgs + [
        'source_topic' => '', 'trigger_command' => '',
        'trigger_commands' => ['เขียนบทความ SEO', 'อีกคำสั่งหนึ่ง'],
    ]);
    $pass = str_contains($msg, TOPIC_LABEL . 'เขียนบทความ SEO');
    record('TC02', 'ไม่มี source_topic มี trigger_commands', 'fallback ไป trigger command ตัวแรกที่ไม่ว่าง', $msg, $pass); tally($pass);
}

// ── TC03 — ไม่มี source_topic ไม่มี trigger_commands แต่มี trigger_command เดี่ยว → ใช้ค่านั้น ─
{
    $msg = content_plan_user_message(false, $baseArgs + ['source_topic' => '', 'trigger_command' => 'แผนคอนเทนต์รายเดือน']);
    $pass = str_contains($msg, TOPIC_LABEL . 'แผนคอนเทนต์รายเดือน');
    record('TC03', 'ไม่มี source_topic มี trigger_command เดี่ยว', 'fallback ไป trigger_command', $msg, $pass); tally($pass);
}

// ── TC04 — ทุกแหล่งว่างสนิท → ไม่มีบรรทัด Topic เลย ─────────────────────────
{
    $msg = content_plan_user_message(false, $baseArgs + ['source_topic' => '', 'trigger_command' => '', 'trigger_commands' => []]);
    $pass = !str_contains($msg, TOPIC_LABEL) && !str_contains($msg, 'Original User Topic/Seed');
    record('TC04', 'ทุกแหล่งว่างสนิท', 'ไม่มีบรรทัด Original User Topic/Seed เลย ไม่มี placeholder', $msg, $pass); tally($pass);
}

// ── TC05 — ทุกแหล่งมีแต่ whitespace → ถือว่าว่าง ไม่มีบรรทัด Topic ────────────
{
    $msg = content_plan_user_message(false, $baseArgs + ['source_topic' => '   ', 'trigger_command' => "\t", 'trigger_commands' => ['   ', '']]);
    $pass = !str_contains($msg, TOPIC_LABEL);
    record('TC05', 'ทุกแหล่งเป็น whitespace ล้วน', 'trim แล้วถือว่าว่าง ไม่มีบรรทัด Topic', $msg, $pass); tally($pass);
}

// ── TC06 — ทุกแหล่งว่าง แต่บรรทัดอื่นยังพิมพ์ปกติ (สัปดาห์เริ่มต้น/วันที่/reminder) ─
{
    $msg = content_plan_user_message(false, $baseArgs + ['source_topic' => '', 'trigger_command' => '']);
    $pass = str_contains($msg, 'สัปดาห์เริ่มต้น: 2026-09-07')
        && str_contains($msg, 'สร้างโพสต์สำหรับวันจันทร์ (วันที่ 1 ของสัปดาห์)')
        && str_contains($msg, 'REMINDER: Output ONLY the JSON object');
    record('TC06', 'บรรทัดอื่นยังพิมพ์ปกติเมื่อตัด Topic ทิ้ง', 'สัปดาห์เริ่มต้น/วันที่/reminder ยังอยู่ครบ', $msg, $pass); tally($pass);
}

// ── TC07 — Direct mode ไม่เปลี่ยนพฤติกรรม: source_topic ว่างยังพิมพ์บรรทัดว่างตามเดิม (ไม่ตัด) ─
{
    $msg = content_plan_user_message(true, $baseArgs + ['source_topic' => '', 'trigger_command' => '']);
    $pass = str_contains($msg, TOPIC_LABEL);
    record('TC07', 'Direct mode ไม่ได้รับผลกระทบจากการตัดบรรทัด', 'Direct mode ยังพิมพ์บรรทัด Topic ตามพฤติกรรมเดิมเสมอ (validate ไม่ว่างอยู่แล้วที่ caller)', $msg, $pass); tally($pass);
}

// ═══════════════════ Output ════════════════════════════════════════════════
echo "\n";
echo "| TC | Test Case | Expected | Actual | PASS/FAIL |\n";
echo "|----|-----------|----------|--------|-----------|\n";
foreach ($RESULTS as [$tc, $name, $expected, $actual, $pass]) {
    $mark = $pass ? 'PASS' : 'FAIL';
    $actualShort = strlen($actual) > 80 ? substr($actual, 0, 80) . '...' : $actual;
    echo "| {$tc} | {$name} | {$expected} | " . str_replace("\n", ' \\n ', $actualShort) . " | {$mark} |\n";
}
echo "\nผ่าน: {$PASS} / " . count($RESULTS) . "\n";
echo "ไม่ผ่าน: {$FAIL} / " . count($RESULTS) . "\n";
if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
