<?php
/**
 * Part 7 — content-generation-research (delta: content-plan-prompt-topic-guard,
 * ขั้นที่ 6 — สกัด validation guard ของ generate-plan)
 *
 * ทดสอบ content_plan_has_any_topic_source() และ content_plan_direct_requires_topic()
 * โดยตรง (pure, ไม่พึ่ง DB/network) — สองฟังก์ชันนี้สกัดออกมาจาก inline condition
 * เดิมที่ brand-content.php?action=generate-plan บรรทัด 634 และ 671 ทุกตัวอักษร
 * (ห้ามเปลี่ยน semantics — refactor เพื่อให้ทดสอบได้เท่านั้น)
 *
 * บริบท: guard แรก (has_any_topic_source) ครอบคลุมทั้ง Direct mode และ legacy
 * Content Plan mode — ต้องมีอย่างน้อยหนึ่งใน trigger_ids/trigger_command/
 * source_topic เสมอ guard ที่สอง (direct_requires_topic) บังคับเฉพาะ Direct
 * mode ให้ต้องมี source_topic — legacy mode ไม่ถูกบังคับซ้ำ (นี่คือจุดที่เคย
 * live-broken มาก่อนในขั้น 1: legacy/trigger-only request เคยโดน reject
 * เพราะ guard ที่สองไม่แยกเช็ค $isDirect)
 */

require_once __DIR__ . '/../lib/content-plan-prompt.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

// ═══════════════ content_plan_has_any_topic_source() ═══════════════════════

// ── TC01 — Legacy mode: มีแค่ trigger_ids → ผ่าน (ไม่ error) ─────────────────
{
    $result = content_plan_has_any_topic_source(['trig-1'], '', '');
    $pass = $result === true;
    record('TC01', 'Legacy: มีแค่ trigger_ids', 'true (ผ่าน — ไม่ error)', var_export($result, true), $pass); tally($pass);
}

// ── TC02 — Legacy mode: มีแค่ trigger_command (พิมพ์เอง ไม่ผ่าน trigger_ids) ──
{
    $result = content_plan_has_any_topic_source([], 'วางแผนคอนเทนต์ประจำสัปดาห์', '');
    $pass = $result === true;
    record('TC02', 'Legacy: มีแค่ trigger_command', 'true (ผ่าน — ไม่ error)', var_export($result, true), $pass); tally($pass);
}

// ── TC03 — Direct mode: มีแค่ source_topic (ไม่มี trigger เลย) ───────────────
{
    $result = content_plan_has_any_topic_source([], '', 'YouTube');
    $pass = $result === true;
    record('TC03', 'Direct: มีแค่ source_topic', 'true (ผ่าน — ไม่ error)', var_export($result, true), $pass); tally($pass);
}

// ── TC04 — ไม่มีอะไรเลยทั้งสามอย่าง → ไม่ผ่าน (error) ─────────────────────────
{
    $result = content_plan_has_any_topic_source([], '', '');
    $pass = $result === false;
    record('TC04', 'ไม่มีทั้ง trigger_ids/trigger_command/source_topic', 'false (ไม่ผ่าน — ต้อง error)', var_export($result, true), $pass); tally($pass);
}

// ── TC05 — มีครบทั้งสามอย่าง → ผ่าน ──────────────────────────────────────────
{
    $result = content_plan_has_any_topic_source(['trig-1'], 'คำสั่ง', 'หัวข้อ');
    $pass = $result === true;
    record('TC05', 'มีครบทั้งสามอย่าง', 'true (ผ่าน)', var_export($result, true), $pass); tally($pass);
}

// ═══════════════ content_plan_direct_requires_topic() ═══════════════════════

// ── TC06 — Legacy mode (isDirect=false) ไม่มี source_topic → ไม่ถูกบังคับซ้ำ ──
// นี่คือจุดที่เคย live-broken: legacy/trigger-only request ไม่มี source_topic
// เลย ต้องไม่ถูก reject จาก guard นี้ (guard แรกคุมไปแล้วว่ามี trigger)
{
    $result = content_plan_direct_requires_topic(false, '');
    $pass = $result === false;
    record('TC06', 'Legacy mode ไม่มี source_topic', 'false (ไม่ error — legacy ไม่ถูกบังคับ)', var_export($result, true), $pass); tally($pass);
}

// ── TC07 — Direct mode ไม่มี source_topic → ต้อง error ───────────────────────
{
    $result = content_plan_direct_requires_topic(true, '');
    $pass = $result === true;
    record('TC07', 'Direct mode ไม่มี source_topic', 'true (ต้อง error)', var_export($result, true), $pass); tally($pass);
}

// ── TC08 — Direct mode มี source_topic → ผ่าน ────────────────────────────────
{
    $result = content_plan_direct_requires_topic(true, 'YouTube');
    $pass = $result === false;
    record('TC08', 'Direct mode มี source_topic', 'false (ผ่าน)', var_export($result, true), $pass); tally($pass);
}

// ── TC09 — Legacy mode มี source_topic ด้วย (เช่น edge case อนาคต) → ผ่านอยู่แล้ว ─
{
    $result = content_plan_direct_requires_topic(false, 'YouTube');
    $pass = $result === false;
    record('TC09', 'Legacy mode มี source_topic', 'false (ผ่าน — ไม่เกี่ยวกับ guard นี้)', var_export($result, true), $pass); tally($pass);
}

// ═══════════════ ผสาน 2 guard เข้าด้วยกัน จำลอง flow เต็มของ generate-plan ══

// ── TC10 — Legacy/trigger-only เต็มรูปแบบ: มี trigger_ids, ไม่มี trigger_command/source_topic ──
// เคสจริงจาก ContentPlannerAI.tsx ("AI สร้างแผน" ด้วย trigger_command พิมพ์เอง
// ไม่ใช่ trigger_ids — แต่จำลองเผื่อ path ที่เลือก trigger จาก dropdown แทน)
{
    $isDirect = false;
    $triggerIds = ['trig-1'];
    $triggerCommand = '';
    $sourceTopic = '';
    $guard1Fails = !content_plan_has_any_topic_source($triggerIds, $triggerCommand, $sourceTopic);
    $guard2Fails = content_plan_direct_requires_topic($isDirect, $sourceTopic);
    $pass = $guard1Fails === false && $guard2Fails === false;
    record('TC10', 'Legacy trigger-only เต็มรูปแบบ (trigger_ids)', 'ผ่านทั้งสอง guard — สร้างแผนได้', 'guard1Fails=' . var_export($guard1Fails, true) . ' guard2Fails=' . var_export($guard2Fails, true), $pass); tally($pass);
}

// ── TC11 — Legacy/trigger-only เต็มรูปแบบ: มี trigger_command พิมพ์เอง (เคสจริงจาก ContentPlannerAI.tsx) ──
{
    $isDirect = false;
    $triggerIds = [];
    $triggerCommand = 'วางแผนคอนเทนต์ประจำสัปดาห์';
    $sourceTopic = '';
    $guard1Fails = !content_plan_has_any_topic_source($triggerIds, $triggerCommand, $sourceTopic);
    $guard2Fails = content_plan_direct_requires_topic($isDirect, $sourceTopic);
    $pass = $guard1Fails === false && $guard2Fails === false;
    record('TC11', 'Legacy trigger-only เต็มรูปแบบ (trigger_command)', 'ผ่านทั้งสอง guard — สร้างแผนได้ (regression ของขั้น 1)', 'guard1Fails=' . var_export($guard1Fails, true) . ' guard2Fails=' . var_export($guard2Fails, true), $pass); tally($pass);
}

// ── TC12 — Direct mode เต็มรูปแบบ: มี source_topic ไม่มี trigger เลย (เคสจริงจาก QuickCreateDialog.tsx) ──
{
    $isDirect = true;
    $triggerIds = [];
    $triggerCommand = 'YouTube';
    $sourceTopic = 'YouTube';
    $guard1Fails = !content_plan_has_any_topic_source($triggerIds, $triggerCommand, $sourceTopic);
    $guard2Fails = content_plan_direct_requires_topic($isDirect, $sourceTopic);
    $pass = $guard1Fails === false && $guard2Fails === false;
    record('TC12', 'Direct mode เต็มรูปแบบ (QuickCreateDialog)', 'ผ่านทั้งสอง guard — สร้างได้', 'guard1Fails=' . var_export($guard1Fails, true) . ' guard2Fails=' . var_export($guard2Fails, true), $pass); tally($pass);
}

// ── TC13 — Direct mode ไม่มี source_topic เลย (ผิดปกติ — UI ต้อง validate ไว้ก่อนแล้ว) ──
{
    $isDirect = true;
    $triggerIds = ['trig-1'];
    $triggerCommand = '';
    $sourceTopic = '';
    $guard1Fails = !content_plan_has_any_topic_source($triggerIds, $triggerCommand, $sourceTopic);
    $guard2Fails = content_plan_direct_requires_topic($isDirect, $sourceTopic);
    // guard1 ผ่าน (มี trigger_ids) แต่ guard2 ต้อง fail เพราะ Direct mode บังคับ source_topic เสมอ
    $pass = $guard1Fails === false && $guard2Fails === true;
    record('TC13', 'Direct mode มี trigger_ids แต่ไม่มี source_topic', 'guard1 ผ่าน, guard2 ต้อง error', 'guard1Fails=' . var_export($guard1Fails, true) . ' guard2Fails=' . var_export($guard2Fails, true), $pass); tally($pass);
}

// ── TC14 — ไม่มีอะไรเลยทั้งหมด (legacy หรือ direct ก็ตาม) → guard แรกต้อง fail ──
{
    foreach ([false, true] as $isDirect) {
        $guard1Fails = !content_plan_has_any_topic_source([], '', '');
        $pass = $guard1Fails === true;
        $label = $isDirect ? 'Direct' : 'Legacy';
        record('TC14', "ไม่มีอะไรเลย ({$label} mode)", 'guard1 ต้อง error ก่อนถึง guard2', 'guard1Fails=' . var_export($guard1Fails, true), $pass); tally($pass);
    }
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
