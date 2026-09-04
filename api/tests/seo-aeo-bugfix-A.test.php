<?php
/**
 * ชุด A — ทดสอบ Bug ที่แก้แล้วโดยตรง (aeo_structured_types / aeo_questionish / aeo_answer_blocks)
 * ใช้ฟังก์ชันจริงจาก aeo-checklist.php
 */

require_once __DIR__ . '/../lib/aeo-checklist.php';

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

function filler(int $repeat = 100): string {
    return implode(' ', array_fill(0, $repeat, 'content marketing strategy planning execution optimization growth research analysis'));
}

// ═══════════════════════════════════════════════════════════════════════════
// A01 — structured_data {"@type":"Article"} → passed
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = [
        'type' => 'article',
        'title' => 'บทความทดสอบ',
        'seo_title' => 'บทความทดสอบ',
        'meta_keywords' => 'บทความทดสอบ',
        'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
        'article_content' => json_encode(['html' => '<p>' . filler() . '</p>']),
    ];
    $aeo = aeo_evaluate($item);
    $status = ruleStatus($aeo['rules'], 'structured_data');
    $pass = $status === 'passed';
    record('A01', 'structured_data {"@type":"Article"}', 'passed', $status, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// A02 — @type "BlogPosting" → passed
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = [
        'type' => 'article',
        'title' => 'บทความทดสอบ',
        'seo_title' => 'บทความทดสอบ',
        'meta_keywords' => 'บทความทดสอบ',
        'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'BlogPosting']),
        'article_content' => json_encode(['html' => '<p>' . filler() . '</p>']),
    ];
    $aeo = aeo_evaluate($item);
    $status = ruleStatus($aeo['rules'], 'structured_data');
    $pass = $status === 'passed';
    record('A02', 'structured_data {"@type":"BlogPosting"}', 'passed', $status, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// A03 — Video @type "VideoObject" → passed
// ═══════════════════════════════════════════════════════════════════════════
{
    $item = [
        'type' => 'video',
        'title' => 'วิดีโอทดสอบ',
        'seo_title' => 'วิดีโอทดสอบ',
        'meta_keywords' => 'วิดีโอทดสอบ',
        'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'VideoObject']),
        'article_content' => json_encode(['html' => '<p>' . filler() . '</p>']),
    ];
    $aeo = aeo_evaluate($item);
    $status = ruleStatus($aeo['rules'], 'structured_data');
    $pass = $status === 'passed';
    record('A03', 'structured_data {"@type":"VideoObject"}', 'passed', $status, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// A04 — Thai H2 "วิธีเลือกแพลตฟอร์มสร้างคอนเทนต์อย่างไร" → questionish = true
// ═══════════════════════════════════════════════════════════════════════════
{
    $ok = aeo_questionish('วิธีเลือกแพลตฟอร์มสร้างคอนเทนต์อย่างไร');
    $pass = $ok === true;
    record('A04', 'Thai H2 "วิธีเลือกแพลตฟอร์ม...อย่างไร"', 'questionish = true', var_export($ok, true), $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// A05 — Thai H2 "YouTube คืออะไร" → questionish = true
// ═══════════════════════════════════════════════════════════════════════════
{
    $ok = aeo_questionish('YouTube คืออะไร');
    $pass = $ok === true;
    record('A05', 'Thai H2 "YouTube คืออะไร"', 'questionish = true', var_export($ok, true), $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// A06 — Thai answer "YouTube คือแพลตฟอร์มสำหรับเผยแพร่วิดีโอ..." ≥40 chars → answer block
// ═══════════════════════════════════════════════════════════════════════════
{
    $html = '<p>YouTube คือแพลตฟอร์มสำหรับเผยแพร่วิดีโอออนไลน์ที่ผู้ใช้งานสามารถอัปโหลดและแชร์วิดีโอได้</p>';
    $count = aeo_answer_blocks($html);
    $pass = $count >= 1;
    record('A06', 'Thai answer "...คือแพลตฟอร์ม..." ≥40 chars', 'answer block ≥ 1', "count={$count}", $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// A07 — Thai Q&A 2 ชุด → qa_structure = passed
// ═══════════════════════════════════════════════════════════════════════════
{
    $html =
        '<h2>YouTube คืออะไร</h2>' .
        '<p>YouTube คือแพลตฟอร์มสำหรับเผยแพร่วิดีโอออนไลน์ที่ผู้ใช้สามารถอัปโหลด แชร์ และรับชมวิดีโอได้อย่างอิสระ</p>' .
        '<h2>วิธีเริ่มสร้างคอนเทนต์อย่างไร</h2>' .
        '<p>วิธีเริ่มสร้างคอนเทนต์คือการกำหนดกลุ่มเป้าหมายและวางแผนหัวข้อให้ชัดเจนก่อนเริ่มผลิตเนื้อหา</p>';
    $item = [
        'type' => 'article',
        'title' => 'บทความทดสอบ',
        'seo_title' => 'บทความทดสอบ',
        'meta_keywords' => 'บทความทดสอบ',
        'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
        'article_content' => json_encode(['html' => $html]),
    ];
    $aeo = aeo_evaluate($item);
    $status = ruleStatus($aeo['rules'], 'qa_structure');
    $pass = $status === 'passed';
    record('A07', 'Thai Q&A 2 ชุด', 'qa_structure = passed', $status, $pass);
    tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// A08 — Thai Article + Article schema + Q&A 2 ชุด → structured_data ไม่ fail
// ═══════════════════════════════════════════════════════════════════════════
{
    $html =
        '<h2>YouTube คืออะไร</h2>' .
        '<p>YouTube คือแพลตฟอร์มสำหรับเผยแพร่วิดีโอออนไลน์ที่ผู้ใช้สามารถอัปโหลด แชร์ และรับชมวิดีโอได้อย่างอิสระ</p>' .
        '<h2>วิธีเริ่มสร้างคอนเทนต์อย่างไร</h2>' .
        '<p>วิธีเริ่มสร้างคอนเทนต์คือการกำหนดกลุ่มเป้าหมายและวางแผนหัวข้อให้ชัดเจนก่อนเริ่มผลิตเนื้อหา</p>';
    $item = [
        'type' => 'article',
        'title' => 'บทความทดสอบ',
        'seo_title' => 'บทความทดสอบ',
        'meta_keywords' => 'บทความทดสอบ',
        'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
        'article_content' => json_encode(['html' => $html]),
    ];
    $aeo = aeo_evaluate($item);
    $status = ruleStatus($aeo['rules'], 'structured_data');
    $pass = $status !== 'failed';
    record('A08', 'Thai Article + Article schema + Q&A 2 ชุด', 'structured_data ไม่ fail', $status, $pass);
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
