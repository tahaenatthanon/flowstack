<?php
/**
 * EC01–EC06 — entity_clarity ใช้ primary keyword/topic ไม่ใช่ title เต็ม
 * ตรวจว่า script ที่มีแค่ primary keyword (ไม่มี title เต็ม) ไม่ถูก block
 */

require_once __DIR__ . '/../lib/script-quality-checklist.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/publish-dispatch.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

function ruleStatus(array $rules, string $key): string {
    foreach ($rules as $r) if ($r['key'] === $key) return $r['status'] ?? '';
    return '(missing)';
}

// Content Item: title ยาว, primary keyword สั้น, topic สั้น
function makeItem(): array {
    return [
        'topic'          => 'วิธีทำคอนเทนต์',
        'title'          => 'วิธีทำคอนเทนต์ให้ปังในปี 2026 สำหรับธุรกิจยุคดิจิทัลอย่างยั่งยืน',
        'primary_keyword' => 'วิธีทำคอนเทนต์',
        'meta_keywords'  => 'วิธีทำคอนเทนต์, การตลาด, คอนเทนต์',
        'platform'       => 'facebook',
        'platforms'      => ['facebook'],
    ];
}

// script ที่มี primary keyword แต่ไม่มี title เต็ม
function scriptWithPrimaryOnly(): string {
    return 'Hook: วิธีทำคอนเทนต์ คือการวางแผนเนื้อหาที่ตอบโจทย์กลุ่มเป้าหมายอย่างเป็นระบบ ' .
           'ขั้นตอนสำคัญคือการวิเคราะห์ผู้ชมและกำหนดเป้าหมายให้ชัดเจนก่อนเริ่มผลิตเนื้อหา #การตลาด #คอนเทนต์';
}

// script ที่มี topic แต่ไม่มี primary keyword (จำลองกรณีไม่มี keyword)
function scriptWithTopicOnly(): string {
    return 'Hook: วิธีทำคอนเทนต์ คือการวางแผนเนื้อหาที่ตอบโจทย์กลุ่มเป้าหมายอย่างเป็นระบบ ' .
           'ขั้นตอนสำคัญคือการวิเคราะห์ผู้ชมก่อนเริ่มผลิต #การตลาด #คอนเทนต์';
}

// script ที่ไม่มีทั้ง primary keyword และ topic
function scriptWithNoEntity(): string {
    return 'Hook: สวัสดีครับ วันนี้เรามีเคล็ดลับดี ๆ มาฝากทุกท่านเกี่ยวกับการตลาดออนไลน์ #การตลาด';
}

// ═══════════════════════════════════════════════════════════════════════════
// EC01 — Primary keyword มีใน Script แต่ไม่มีชื่อบทความเต็ม → entity_clarity passed
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeItem();
    $aeo = script_evaluate_aeo('facebook', scriptWithPrimaryOnly(), $item);
    $status = ruleStatus($aeo['rules'], 'entity_clarity');
    $pass = $status === 'passed';
    record('EC01', 'Primary keyword มี แต่ไม่มี title เต็ม', 'entity_clarity = passed', $status, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// EC02 — ไม่มี primary keyword แต่มี topic → entity_clarity passed
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeItem();
    unset($item['primary_keyword']);
    $item['meta_keywords'] = ''; // ไม่มี primary keyword
    $aeo = script_evaluate_aeo('facebook', scriptWithTopicOnly(), $item);
    $status = ruleStatus($aeo['rules'], 'entity_clarity');
    $pass = $status === 'passed';
    record('EC02', 'ไม่มี primary keyword แต่มี topic', 'entity_clarity = passed', $status, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// EC03 — ไม่มีทั้ง primary keyword และ topic → entity_clarity failed
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeItem();
    unset($item['primary_keyword']);
    $item['meta_keywords'] = '';
    $item['topic'] = '';
    $aeo = script_evaluate_aeo('facebook', scriptWithNoEntity(), $item);
    $status = ruleStatus($aeo['rules'], 'entity_clarity');
    $pass = $status === 'failed';
    record('EC03', 'ไม่มีทั้ง primary keyword และ topic', 'entity_clarity = failed', $status, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// EC04 — title ยาว แต่ script มีเฉพาะ primary keyword → ไม่ถูก block เพราะขาด title เต็ม
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeItem();
    $seo = script_evaluate_seo('facebook', scriptWithPrimaryOnly(), $item);
    $aeo = script_evaluate_aeo('facebook', scriptWithPrimaryOnly(), $item);
    $entityStatus = ruleStatus($aeo['rules'], 'entity_clarity');
    $seoGate = script_gate_status($seo);
    $aeoGate = script_gate_status($aeo);
    $notBlockedByTitle = $entityStatus === 'passed'; // ไม่ fail เพราะไม่มี title เต็ม
    $pass = $notBlockedByTitle && $seoGate === 'passed' && $aeoGate === 'passed';
    record('EC04', 'title ยาว แต่ script มีเฉพาะ primary keyword', 'ไม่ถูก block',
        "entity={$entityStatus}, SEO={$seoGate}({$seo['score']}), AEO={$aeoGate}({$aeo['score']})", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// EC05 — Publish Platform ที่ script ผ่านจาก EC01 → publish ได้
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeItem();
    $content = array_merge($item, [
        'id' => 'ec-test-1',
        'status' => 'approved',
        'approved_at' => '2026-09-04 10:00:00',
        'seo_title' => 'วิธีทำคอนเทนต์',
        'slug' => 'how-to-content',
        'meta_description' => mb_substr(str_repeat('วิธีทำคอนเทนต์ให้ประสบความสำเร็จอย่างยั่งยืน ', 8), 0, 140),
        'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
        'article_content' => json_encode([
            'title' => 'วิธีทำคอนเทนต์ให้ปังในปี 2026',
            'html' => '<p>วิธีทำคอนเทนต์ คือกระบวนการวางแผนและสร้างสรรค์เนื้อหาอย่างเป็นระบบ ' .
                       implode(' ', array_fill(0, 100, 'content marketing strategy planning execution optimization growth research analysis')) . '</p>' .
                       '<h2>วิธีทำคอนเทนต์คืออะไร</h2><p>วิธีทำคอนเทนต์ คือการวางแผนเนื้อหา ' .
                       implode(' ', array_fill(0, 100, 'content marketing strategy planning execution optimization growth research analysis')) . '</p>',
            'scripts' => ['facebook' => scriptWithPrimaryOnly()],
        ], JSON_UNESCAPED_UNICODE),
    ]);
    $db = getDB();
    $db->exec("UPDATE content_global_settings SET seo_gate_enabled=1, seo_gate_min_score=0 WHERE tenant_id='tenant-default'");
    $r = final_publish_gate_check($db, 'tenant-default', $content, 'facebook');
    $pass = $r['blocked'] === false;
    record('EC05', 'Publish Platform ที่ script ผ่านจาก EC01', 'publish ได้',
        'blocked=' . var_export($r['blocked'], true) . ', reason=' . ($r['reason'] ?? 'null'), $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// EC06 — Platform อื่นผ่าน แต่ target script ไม่มี entity → block เฉพาะ platform นั้น
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = makeItem();
    $item['platforms'] = ['facebook', 'instagram'];
    $content = array_merge($item, [
        'id' => 'ec-test-2',
        'status' => 'approved',
        'approved_at' => '2026-09-04 10:00:00',
        'seo_title' => 'วิธีทำคอนเทนต์',
        'slug' => 'how-to-content',
        'meta_description' => mb_substr(str_repeat('วิธีทำคอนเทนต์ให้ประสบความสำเร็จอย่างยั่งยืน ', 8), 0, 140),
        'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
        'article_content' => json_encode([
            'title' => 'วิธีทำคอนเทนต์ให้ปังในปี 2026',
            'html' => '<p>วิธีทำคอนเทนต์ คือกระบวนการวางแผนและสร้างสรรค์เนื้อหาอย่างเป็นระบบ ' .
                       implode(' ', array_fill(0, 100, 'content marketing strategy planning execution optimization growth research analysis')) . '</p>' .
                       '<h2>วิธีทำคอนเทนต์คืออะไร</h2><p>วิธีทำคอนเทนต์ คือการวางแผนเนื้อหา ' .
                       implode(' ', array_fill(0, 100, 'content marketing strategy planning execution optimization growth research analysis')) . '</p>',
            // facebook ผ่าน (มี primary keyword), instagram ไม่มี entity
            'scripts' => ['facebook' => scriptWithPrimaryOnly(), 'instagram' => 'Hook: สวัสดีครับ วันนี้มีเคล็ดลับดี ๆ มาฝาก'],
        ], JSON_UNESCAPED_UNICODE),
    ]);
    $db = getDB();
    $db->exec("UPDATE content_global_settings SET seo_gate_enabled=1, seo_gate_min_score=0 WHERE tenant_id='tenant-default'");
    $fb = final_publish_gate_check($db, 'tenant-default', $content, 'facebook');
    $ig = final_publish_gate_check($db, 'tenant-default', $content, 'instagram');
    $pass = $fb['blocked'] === false && $ig['blocked'] === true;
    record('EC06', 'Platform อื่นผ่าน แต่ target ไม่มี entity', 'block เฉพาะ platform นั้น',
        "FB blocked={$fb['blocked']}, IG blocked={$ig['blocked']}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// Output
// ═══════════════════════════════════════════════════════════════════════════
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
