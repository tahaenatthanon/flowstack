<?php
/**
 * platform-post-text — ทดสอบการประกอบข้อความโพสต์โซเชียลใน api/lib/publish-dispatch.php
 * (ตัดคำกำกับ, ลำดับแหล่งข้อความ, หัวข้อ, dedupe h1, gate บทวิดีโอปน) และ prompt ของ scripts
 * pure function — ไม่ยิง API ไม่แตะ DB
 *
 * รัน: php api/tests/platform-post-text-test.php
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/publish-dispatch.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }
$show = fn(string $s) => str_replace("\n", '⏎', $s);

// ═══════════════════ ตัดคำกำกับ — fixture ชุดเดียวกับ Vitest ════════════════
$fixtures = json_decode(file_get_contents(__DIR__ . '/fixtures/post-text-directions.json'), true);
foreach ($fixtures as $i => $f) {
    $got = publish_strip_directions($f['input']);
    $pass = $got === $f['expected'];
    record('PT' . str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT), 'ตัดคำกำกับ: ' . $f['name'], $show($f['expected']), $show($got), $pass); tally($pass);
}

// ═══════════════════ ลำดับแหล่งข้อความ ══════════════════════════════════════
$art = fn(array $a) => json_encode($a, JSON_UNESCAPED_UNICODE);
$base = [
    'title' => 'AI ช่วยร้านกาแฟ',
    'caption' => 'ข้อความสำรอง',
    'article_content' => $art(['title' => 'ชื่อบทความที่ AI ตั้ง', 'html' => '<h1>ชื่อบทความที่ AI ตั้ง</h1><p>เนื้อหาบทความ</p>',
                               'scripts' => ['facebook' => "Post caption: ลูกค้าทักแชทเยอะ?\nCTA: ลองให้ AI ช่วยตอบ"]]),
];
$cases = [
    ['override', $base + ['content_override' => 'ข้อความคิวเดิม'], 'facebook', 'ข้อความคิวเดิม'],
    ['script',   $base, 'facebook', "ลูกค้าทักแชทเยอะ?\nลองให้ AI ช่วยตอบ"],
    ['caption',  $base, 'linkedin', 'ข้อความสำรอง'],
    ['article',  array_merge($base, ['caption' => '   ']), 'linkedin', 'เนื้อหาบทความ'],
    ['empty',    ['title' => 'T', 'caption' => '', 'article_content' => $art([])], 'twitter', ''],
];
foreach ($cases as $i => [$src, $content, $platform, $body]) {
    $p = publish_social_post_text($content, $platform);
    $pass = $p['source'] === $src && $p['body'] === $body;
    record('PS0' . ($i + 1), "ลำดับแหล่งข้อความ → {$src}", "{$src}: " . $show($body), "{$p['source']}: " . $show($p['body']), $pass); tally($pass);
}

// หัวข้อ = content_items.title ไม่ใช่ชื่อที่ AI ตั้ง; และ h1 ของบทความ (article_content.title) ถูกตัดเมื่อ fallback ไปบทความ
$p = publish_social_post_text(array_merge($base, ['caption' => '']), 'linkedin');
$final = publish_social_final_text($p);
$pass = $p['title'] === 'AI ช่วยร้านกาแฟ' && $final === "AI ช่วยร้านกาแฟ\n\nเนื้อหาบทความ" && !str_contains($final, 'ชื่อบทความที่ AI ตั้ง');
record('PS06', 'หัวข้อจากช่องในฟอร์ม + ตัด h1 ที่เป็นชื่อบทความของ AI', 'AI ช่วยร้านกาแฟ⏎⏎เนื้อหาบทความ', $show($final), $pass); tally($pass);

$p = publish_social_post_text(['title' => 'หัวข้อเดียวกัน', 'caption' => '', 'article_content' => $art(['title' => 'อื่น', 'html' => '<h1>หัวข้อเดียวกัน</h1><p>x</p><h1>หัวข้อเดียวกัน</h1>'])], 'facebook');
$pass = $p['body'] === "x\n\nหัวข้อเดียวกัน";
record('PS07', 'dedupe h1 ตรง content_items.title และตัดเฉพาะตัวแรก', 'x⏎⏎หัวข้อเดียวกัน', $show($p['body']), $pass); tally($pass);

$p = publish_social_post_text(['title' => '', 'caption' => 'แค่ข้อความ', 'article_content' => null], 'facebook');
$pass = publish_social_final_text($p) === 'แค่ข้อความ';
record('PS08', 'ไม่มีหัวข้อ → ไม่มีบรรทัดหัวข้อ', 'แค่ข้อความ', $show(publish_social_final_text($p)), $pass); tally($pass);

// ═══════════════════ gate บทวิดีโอปน ════════════════════════════════════════
$gate = [
    ["Visual: บาริสต้ายิ้ม\nVoiceover: สวัสดีค่ะ", true],
    ["voice over : พูดเบาๆ", true],
    ["[0:00 - 0:03] เปิดเรื่อง", true],
    ["[Hook: 0-10s] แจกสูตร", true],
    ["(0:15) ตัดภาพ", true],
    ["แนะนำร้าน\n- Visual: บาริสต้ายุ่ง\n- Voiceover: \"ลูกค้าทัก\"", true],
    ["• Voiceover: สวัสดี", true],
    ["ข้อดี\n ฉากที่ 1 (8 วินาที)\nเนื้อหา", true],
    ["[สคริปต์วิดีโอสั้น 32 วินาที]\nข้อความ", true],
    ["- ข้อดี: ตอบไว\n- ราคาเริ่มต้น 990 บาท", false],
    ["ทุกฉากในชีวิตของคุณ", false],
    ["ลูกค้าทักแชทเยอะ?\nลองให้ AI ช่วยตอบ #AI", false],
    ["เปิด 9:00 ถึง 18:00 ทุกวัน", false],
    ["บทความนี้พูดถึง visual design ที่ดี", false],
];
foreach ($gate as $i => [$text, $blocked]) {
    $r = publish_screenplay_check($text, 'facebook');
    $pass = ($r !== null) === $blocked && (!$blocked || str_contains((string)$r, 'บทวิดีโอปน'));
    record('PG0' . ($i + 1), 'gate บทวิดีโอ: ' . mb_substr($show($text), 0, 30), $blocked ? 'บล็อก' : 'ผ่าน', $r ?? 'ผ่าน', $pass); tally($pass);
}

// ═══════════════════ prompt ของ scripts ไม่มีคำกำกับ ══════════════════════════
require_once __DIR__ . '/../lib/content-plan-prompt.php';
$all = ['tiktok', 'youtube', 'instagram', 'facebook', 'linkedin', 'twitter', 'lineoa'];
$examples = platform_post_text_examples($all);
$labelFound = array_filter($examples, fn($v) => publish_strip_directions($v) !== trim($v) || publish_screenplay_check($v) !== null);
$pass = array_keys($examples) === $all && $labelFound === [];
record('PP01', 'ตัวอย่าง scripts ใน schema ไม่มีคำกำกับ/บทวิดีโอ (ครบ 7 platform)', '7 platform ไม่มีคำกำกับ', count($examples) . ' platform, คำกำกับ: ' . ($labelFound ? implode(',', array_keys($labelFound)) : 'ไม่มี'), $pass); tally($pass);

$bc = file_get_contents(__DIR__ . '/../brand-content.php');
$usesExamples = substr_count($bc, 'platform_post_text_examples($scriptPlatforms)');
$usesRule = substr_count($bc, '$platformScriptGuidanceLines[] = SCRIPTS_POST_READY_RULE');
$oldLabels = preg_match("/'Hook 3 วิ: \.\.\.|'Post caption: \.\.\./u", $bc);
$pass = $usesExamples === 2 && $usesRule === 1 && $oldLabels === 0 && str_contains(SCRIPTS_POST_READY_RULE, 'ห้ามมีคำกำกับ');
record('PP02', 'prompt วิดีโอ/บทความใช้ตัวอย่างกลาง 2 จุด + กฎข้อความพร้อมโพสต์ (guidance ใช้ร่วมทั้งสอง prompt) + ไม่มีตัวอย่างเดิม', 'ตัวอย่าง 2 จุด, กฎ 1 จุด, ไม่มีของเดิม', "ตัวอย่าง {$usesExamples}, กฎ {$usesRule}, ของเดิม {$oldLabels}", $pass); tally($pass);

// ═══════════════════ Output ════════════════════════════════════════════════
echo "\n| TC | Test Case | Expected | Actual | PASS/FAIL |\n|----|-----------|----------|--------|-----------|\n";
foreach ($RESULTS as [$tc, $name, $expected, $actual, $pass]) {
    echo "| {$tc} | {$name} | {$expected} | " . mb_substr($actual, 0, 140) . ' | ' . ($pass ? 'PASS' : 'FAIL') . " |\n";
}
echo "\nผ่าน: {$PASS} / " . count($RESULTS) . "\nไม่ผ่าน: {$FAIL} / " . count($RESULTS) . "\n";
if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
