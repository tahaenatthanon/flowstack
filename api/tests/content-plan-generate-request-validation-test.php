<?php
/**
 * Part 7 — content-generation-research (delta: content-plan-prompt-topic-guard,
 * ขั้นที่ 6 — สกัด validation guard ของ generate-plan)
 *
 * ทดสอบ content_plan_has_any_topic_source() (content_plan_direct_requires_topic() ถูกลบใน
 * change content-campaign-optional-topic-sources — ประวัติด้านล่างเก็บไว้เป็นบริบท)
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

// ═══════════════ Skill / Knowledge Base นับเป็นแหล่งข้อมูล (change content-campaign-optional-topic-sources) ═══
// content_plan_direct_requires_topic() ถูกลบแล้ว — Direct mode ไม่บังคับหัวข้ออีกต่อไป
// guard เดียวที่เหลือคือ content_plan_has_any_topic_source() ซึ่งนับ หัวข้อ/Trigger/Skill/KB เท่ากัน

// ── TC06 — มีแค่ skill_ids → ผ่าน ─────────────────────────────────────────────
{
    $result = content_plan_has_any_topic_source([], '', '', ['skill-1'], []);
    $pass = $result === true;
    record('TC06', 'มีแค่ skill_ids', 'true (ผ่าน)', var_export($result, true), $pass); tally($pass);
}

// ── TC07 — มีแค่ brand_context_ids (Knowledge Base) → ผ่าน ───────────────────
{
    $result = content_plan_has_any_topic_source([], '', '', [], ['ctx-1']);
    $pass = $result === true;
    record('TC07', 'มีแค่ brand_context_ids', 'true (ผ่าน)', var_export($result, true), $pass); tally($pass);
}

// ── TC08 — ทุกแหล่งว่าง (รวม skill/KB) → ไม่ผ่าน ─────────────────────────────
{
    $result = content_plan_has_any_topic_source([], '', '', [], []);
    $pass = $result === false;
    record('TC08', 'ทุกแหล่งว่างรวม skill/KB', 'false (ต้อง error)', var_export($result, true), $pass); tally($pass);
}

// ── TC09 — มีครบทั้ง 5 → ผ่าน ────────────────────────────────────────────────
{
    $result = content_plan_has_any_topic_source(['trig-1'], 'คำสั่ง', 'หัวข้อ', ['skill-1'], ['ctx-1']);
    $pass = $result === true;
    record('TC09', 'มีครบทุกแหล่ง', 'true (ผ่าน)', var_export($result, true), $pass); tally($pass);
}

// ═══════════════ จำลอง flow เต็มของ generate-plan (guard เดียว) ══════════════

// ── TC10 — Legacy trigger-only (trigger_ids) → ผ่าน ─────────────────────────
{
    $fails = !content_plan_has_any_topic_source(['trig-1'], '', '', [], []);
    $pass = $fails === false;
    record('TC10', 'Legacy trigger-only (trigger_ids)', 'ผ่าน — สร้างแผนได้', 'fails=' . var_export($fails, true), $pass); tally($pass);
}

// ── TC11 — Legacy trigger-only (trigger_command พิมพ์เอง, ContentPlannerAI.tsx) → ผ่าน ─
{
    $fails = !content_plan_has_any_topic_source([], 'วางแผนคอนเทนต์ประจำสัปดาห์', '', [], []);
    $pass = $fails === false;
    record('TC11', 'Legacy trigger-only (trigger_command)', 'ผ่าน — regression ของขั้น 1', 'fails=' . var_export($fails, true), $pass); tally($pass);
}

// ── TC12 — Direct มีหัวข้อ (QuickCreateDialog เดิม) → ผ่าน ─────────────────────
{
    $fails = !content_plan_has_any_topic_source([], 'YouTube', 'YouTube', [], []);
    $pass = $fails === false;
    record('TC12', 'Direct มีหัวข้อ', 'ผ่าน', 'fails=' . var_export($fails, true), $pass); tally($pass);
}

// ── TC13 — Direct มี trigger_ids ไม่มีหัวข้อ → ผ่านแล้ว (เดิมถูกบล็อก) ─────────
{
    $fails = !content_plan_has_any_topic_source(['trig-1'], '', '', [], []);
    $pass = $fails === false;
    record('TC13', 'Direct มี Trigger ไม่มีหัวข้อ', 'ผ่าน (เดิมถูกบล็อกโดย guard ที่สองซึ่งลบแล้ว)', 'fails=' . var_export($fails, true), $pass); tally($pass);
}

// ── TC14 — ไม่มีอะไรเลย → ต้อง error ─────────────────────────────────────────
{
    $fails = !content_plan_has_any_topic_source([], '', '', [], []);
    $pass = $fails === true;
    record('TC14', 'ไม่มีแหล่งข้อมูลเลย', 'error', 'fails=' . var_export($fails, true), $pass); tally($pass);
}

// ── TC15 — content_plan_direct_requires_topic() ถูกลบแล้ว ─────────────────────
{
    $pass = !function_exists('content_plan_direct_requires_topic');
    record('TC15', 'guard ที่สองถูกลบ', 'function ไม่มีอยู่', var_export(!$pass, true), $pass); tally($pass);
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
