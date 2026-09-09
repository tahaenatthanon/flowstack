<?php
/**
 * Part 6 — core-content-platform-output-shape
 * ทดสอบ content_needs_script_sections() (pure, ไม่พึ่ง DB/network) — ยืนยันว่า
 * การขอ/แสดง Script Sections ถูก derive จาก platform ที่เลือก ไม่ใช่จาก Content Type
 */

require_once __DIR__ . '/../lib/content-plan-prompt.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

// ── TC01 — เลือก TikTok เท่านั้น → true ─────────────────────────────────────
{
    $result = content_needs_script_sections(['tiktok']);
    $pass = $result === true;
    record('TC01', 'เลือก TikTok เท่านั้น', 'true', var_export($result, true), $pass); tally($pass);
}

// ── TC02 — เลือก YouTube เท่านั้น → true ────────────────────────────────────
{
    $result = content_needs_script_sections(['youtube']);
    $pass = $result === true;
    record('TC02', 'เลือก YouTube เท่านั้น', 'true', var_export($result, true), $pass); tally($pass);
}

// ── TC03 — เลือก Facebook เท่านั้น → false ──────────────────────────────────
{
    $result = content_needs_script_sections(['facebook']);
    $pass = $result === false;
    record('TC03', 'เลือก Facebook เท่านั้น', 'false', var_export($result, true), $pass); tally($pass);
}

// ── TC04 — เลือก Website + Facebook (ไม่มี video platform) → false ─────────
{
    $result = content_needs_script_sections(['wordpress', 'facebook']);
    $pass = $result === false;
    record('TC04', 'Website + Facebook (ไม่มี video platform)', 'false', var_export($result, true), $pass); tally($pass);
}

// ── TC05 — Website + Facebook + TikTok (ปนกัน) → true ───────────────────────
{
    $result = content_needs_script_sections(['wordpress', 'facebook', 'tiktok']);
    $pass = $result === true;
    record('TC05', 'Website + Facebook + TikTok (ปนกัน)', 'true — มี TikTok ปนอยู่ก็พอ', var_export($result, true), $pass); tally($pass);
}

// ── TC06 — ไม่เลือก platform เลย → false ────────────────────────────────────
{
    $result = content_needs_script_sections([]);
    $pass = $result === false;
    record('TC06', 'ไม่เลือก platform เลย', 'false', var_export($result, true), $pass); tally($pass);
}

// ── TC07 — case-insensitive: "TikTok" (ตัวพิมพ์ใหญ่ปน) → true ──────────────
{
    $result = content_needs_script_sections(['TikTok', 'Facebook']);
    $pass = $result === true;
    record('TC07', 'platform ตัวพิมพ์ใหญ่ปน (TikTok)', 'true', var_export($result, true), $pass); tally($pass);
}

// ── TC08 — LinkedIn + Twitter + LineOA (ทุกตัวเป็น post-only) → false ──────
{
    $result = content_needs_script_sections(['linkedin', 'twitter', 'lineoa', 'instagram']);
    $pass = $result === false;
    record('TC08', 'LinkedIn+Twitter+LineOA+Instagram (post-only ทั้งหมด)', 'false', var_export($result, true), $pass); tally($pass);
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
