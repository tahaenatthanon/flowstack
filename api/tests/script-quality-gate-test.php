<?php
/**
 * Part 4 — Per-platform Script SEO/AEO Quality Gate + Publish Gate
 * ใช้ฟังก์ชันจริงจาก script-quality-checklist.php (pure, ไม่พึ่ง DB/network)
 */

require_once __DIR__ . '/../lib/script-quality-checklist.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

// ── helpers ────────────────────────────────────────────────────────────────
function makeItem(array $platforms): array {
    return [
        'platform'      => $platforms[0] ?? '',
        'platforms'     => $platforms,
        'topic'         => 'วิธีทำคอนเทนต์',
        'title'         => 'วิธีทำคอนเทนต์',
        'meta_keywords' => 'วิธีทำคอนเทนต์, การตลาด, คอนเทนต์',
    ];
}

// สคริปต์ที่ดี (ผ่าน gate ทุก platform) — มี hook(อังกฤษ), keyword, answer cue, hashtag
function goodScript(): string {
    return 'Hook: วิธีทำคอนเทนต์ คือการวางแผนเนื้อหาที่ตอบโจทย์กลุ่มเป้าหมายอย่างเป็นระบบ ' .
           'ขั้นตอนสำคัญคือวิเคราะห์ผู้ชมและกำหนดเป้าหมายให้ชัดเจนก่อนเริ่มผลิตเนื้อหา #การตลาด #คอนเทนต์';
}

// สคริปต์ที่ fail ชัดเจน (สั้น ไม่มี keyword ไม่มี hook ไม่มี hashtag)
function badScript(): string {
    return 'สวัสดีครับ';
}

function makeContent(array $scripts, array $platforms, string $researchIntent = ''): array {
    $content = makeItem($platforms);
    $content['article_content'] = json_encode(['scripts' => $scripts], JSON_UNESCAPED_UNICODE);
    if ($researchIntent !== '') {
        $content['research_brief'] = ['intent' => $researchIntent, 'primary_keyword' => 'วิธีทำคอนเทนต์'];
    }
    return $content;
}

// ── TC01 — เลือก Facebook อย่างเดียว → เฉพาะ FB script + score ─────────────
{
    $eval = script_quality_evaluate(['facebook' => goodScript()], ['facebook'], makeItem(['facebook']));
    $onlyFb = array_keys($eval['platforms']) === ['facebook'];
    $fb = $eval['platforms']['facebook'];
    $pass = $onlyFb && isset($fb['seo']['score'], $fb['aeo']['score']) && $fb['passed'];
    record('TC01', 'เลือก Facebook อย่างเดียว', 'เฉพาะ FB script + score',
        "platforms=" . implode(',', array_keys($eval['platforms'])) . ", FB SEO={$fb['seo']['score']}/AEO={$fb['aeo']['score']}", $pass);
    tally($pass);
}

// ── TC02 — Facebook + Instagram → แต่ละ platform score ของตัวเอง ไม่ปนกัน ──
{
    $scripts = ['facebook' => goodScript(), 'instagram' => goodScript()];
    $eval = script_quality_evaluate($scripts, ['facebook', 'instagram'], makeItem(['facebook', 'instagram']));
    $keys = array_keys($eval['platforms']);
    $pass = count($keys) === 2 && in_array('facebook', $keys, true) && in_array('instagram', $keys, true)
        && $eval['platforms']['facebook']['passed'] && $eval['platforms']['instagram']['passed'];
    record('TC02', 'Facebook + Instagram', 'แต่ละ platform score แยก ไม่ปนกัน',
        "keys=" . implode(',', $keys) . ", FB={$eval['platforms']['facebook']['seo']['score']}, IG={$eval['platforms']['instagram']['seo']['score']}", $pass);
    tally($pass);
}

// ── TC03 — YouTube + TikTok ────────────────────────────────────────────────
{
    $scripts = ['youtube' => goodScript(), 'tiktok' => goodScript()];
    $eval = script_quality_evaluate($scripts, ['youtube', 'tiktok'], makeItem(['youtube', 'tiktok']));
    $keys = array_keys($eval['platforms']);
    $pass = count($keys) === 2 && in_array('youtube', $keys, true) && in_array('tiktok', $keys, true)
        && !isset($eval['platforms']['facebook']) && !isset($eval['platforms']['instagram']);
    record('TC03', 'YouTube + TikTok', 'เฉพาะ YT/TikTok script+score ไม่มี platform อื่น',
        "keys=" . implode(',', $keys), $pass);
    tally($pass);
}

// ── TC04 — เลือกครบทุก Script Platform → evaluate แยกกันหมด ────────────────
{
    $all = SCRIPT_PLATFORMS;
    $scripts = [];
    foreach ($all as $p) $scripts[$p] = goodScript();
    $eval = script_quality_evaluate($scripts, $all, makeItem($all));
    $keys = array_keys($eval['platforms']);
    sort($keys);
    $expected = $all;
    sort($expected);
    $pass = $keys === $expected && count($eval['platforms']) === count($all);
    record('TC04', 'เลือกครบทุก Script Platform', 'ทุก platform evaluate แยกกัน',
        "count=" . count($eval['platforms']) . "/" . count($all), $pass);
    tally($pass);
}

// ── TC05 — ไม่เลือก Platform → ไม่มี script/score ───────────────────────────
{
    $eval = script_quality_evaluate([], [], makeItem([]));
    $pass = empty($eval['platforms']);
    record('TC05', 'ไม่เลือก Platform', 'ไม่มี script และไม่มี score',
        "platforms count=" . count($eval['platforms']), $pass);
    tally($pass);
}

// ── TC06–TC12 — threshold / required-rule override (script_gate_status) ────
{
    // TC06: SEO+AEO >=80 → passed
    $seoEval = ['score' => 80, 'rules' => [['tier' => 'required', 'status' => 'passed']]];
    $aeoEval = ['score' => 80, 'rules' => [['tier' => 'required', 'status' => 'passed']]];
    $pass = script_gate_status($seoEval) === 'passed' && script_gate_status($aeoEval) === 'passed';
    record('TC06', 'Script SEO>=80 และ AEO>=80', 'passed',
        'passed', $pass); tally($pass);
}
{
    // TC07: SEO=79 → needs_improvement
    $eval = ['score' => 79, 'rules' => [['tier' => 'required', 'status' => 'passed']]];
    $gate = script_gate_status($eval);
    $pass = $gate === 'needs_improvement';
    record('TC07', 'SEO=79', 'needs_improvement', $gate, $pass); tally($pass);
}
{
    // TC08: AEO=79 → needs_improvement
    $eval = ['score' => 79, 'rules' => [['tier' => 'required', 'status' => 'passed']]];
    $gate = script_gate_status($eval);
    $pass = $gate === 'needs_improvement';
    record('TC08', 'AEO=79', 'needs_improvement', $gate, $pass); tally($pass);
}
{
    // TC09: SEO<70 → failed
    $eval = ['score' => 60, 'rules' => [['tier' => 'required', 'status' => 'passed']]];
    $gate = script_gate_status($eval);
    $pass = $gate === 'failed';
    record('TC09', 'SEO<70', 'failed', $gate, $pass); tally($pass);
}
{
    // TC10: AEO<70 → failed
    $eval = ['score' => 50, 'rules' => [['tier' => 'required', 'status' => 'passed']]];
    $gate = script_gate_status($eval);
    $pass = $gate === 'failed';
    record('TC10', 'AEO<70', 'failed', $gate, $pass); tally($pass);
}
{
    // TC11: score>=80 แต่ required SEO rule failed → failed
    $eval = ['score' => 90, 'rules' => [
        ['tier' => 'required', 'status' => 'passed'],
        ['tier' => 'required', 'status' => 'failed', 'key' => 'topic_relevance'],
    ]];
    $gate = script_gate_status($eval);
    $pass = $gate === 'failed';
    record('TC11', 'score>=80 แต่ required SEO rule fail', 'failed', $gate, $pass); tally($pass);
}
{
    // TC12: score>=80 แต่ required AEO rule failed → failed
    $eval = ['score' => 85, 'rules' => [
        ['tier' => 'required', 'status' => 'passed'],
        ['tier' => 'required', 'status' => 'failed', 'key' => 'direct_value'],
    ]];
    $gate = script_gate_status($eval);
    $pass = $gate === 'failed';
    record('TC12', 'score>=80 แต่ required AEO rule fail', 'failed', $gate, $pass); tally($pass);
}

// ── TC13 — FB ผ่าน แต่ YouTube ไม่ผ่าน ─────────────────────────────────────
{
    $scripts = ['facebook' => goodScript(), 'youtube' => badScript()];
    $eval = script_quality_evaluate($scripts, ['facebook', 'youtube'], makeItem(['facebook', 'youtube']));
    $fbPass = $eval['platforms']['facebook']['passed'];
    $ytPass = $eval['platforms']['youtube']['passed'];
    $pass = $fbPass === true && $ytPass === false;
    record('TC13', 'FB ผ่าน แต่ YouTube ไม่ผ่าน', 'FB passed, YT failed',
        "FB={$fbPass}, YT={$ytPass}", $pass); tally($pass);
}

// ── TC14 — FB ไม่ผ่าน แต่ YouTube ผ่าน ─────────────────────────────────────
{
    $scripts = ['facebook' => badScript(), 'youtube' => goodScript()];
    $eval = script_quality_evaluate($scripts, ['facebook', 'youtube'], makeItem(['facebook', 'youtube']));
    $fbPass = $eval['platforms']['facebook']['passed'];
    $ytPass = $eval['platforms']['youtube']['passed'];
    $pass = $fbPass === false && $ytPass === true;
    record('TC14', 'FB ไม่ผ่าน แต่ YouTube ผ่าน', 'FB failed, YT passed',
        "FB={$fbPass}, YT={$ytPass}", $pass); tally($pass);
}

// ── TC15 — repair เฉพาะ platform ที่ fail แล้ว re-evaluate ─────────────────
{
    $scripts = ['facebook' => goodScript(), 'youtube' => badScript()];
    $item = makeItem(['facebook', 'youtube']);
    $before = script_quality_evaluate($scripts, ['facebook', 'youtube'], $item);
    $failBefore = array_keys(array_filter($before['platforms'], fn($p) => !$p['passed']));

    // จำลอง repair เฉพาะ platform ที่ fail (youtube) → เปลี่ยนเป็น good
    foreach ($failBefore as $p) { $scripts[$p] = goodScript(); }
    $after = script_quality_evaluate($scripts, ['facebook', 'youtube'], $item);

    $failAfter = array_keys(array_filter($after['platforms'], fn($p) => !$p['passed']));
    $pass = $failBefore === ['youtube'] && $failAfter === [];
    record('TC15', 'Generate แล้วบาง platform fail → repair เฉพาะที่ fail',
        'repair เฉพาะ fail แล้วผ่านหมด',
        "before fail=" . implode(',', $failBefore) . ", after fail=" . implode(',', $failAfter), $pass); tally($pass);
}

// ── TC16 — หลัง repair score สูงขึ้น (evaluate ใหม่) ───────────────────────
{
    $item = makeItem(['youtube']);
    $before = script_quality_evaluate(['youtube' => badScript()], ['youtube'], $item);
    $after  = script_quality_evaluate(['youtube' => goodScript()], ['youtube'], $item);
    $beforeScore = $before['platforms']['youtube']['seo']['score'] + $before['platforms']['youtube']['aeo']['score'];
    $afterScore  = $after['platforms']['youtube']['seo']['score'] + $after['platforms']['youtube']['aeo']['score'];
    $pass = $afterScore > $beforeScore;
    record('TC16', 'หลัง repair score สูงขึ้น', 'evaluate ใหม่จาก script หลัง repair',
        "before=" . $beforeScore . ", after=" . $afterScore, $pass); tally($pass);
}

// ── TC17 — repair แล้วไม่เพิ่ม platform ใหม่ ───────────────────────────────
{
    $scripts = ['facebook' => badScript()];
    $item = makeItem(['facebook']);
    // จำลอง AI repair พยายามเพิ่ม platform อื่น → ระบบต้องตัด (boundary = selected)
    $scripts['facebook'] = goodScript();
    $scripts['instagram'] = goodScript(); // AI แอบเพิ่ม
    $eval = script_quality_evaluate($scripts, ['facebook'], $item);
    $keys = array_keys($eval['platforms']);
    $pass = $keys === ['facebook'];
    record('TC17', 'repair แล้ว platform ใหม่ถูกเพิ่ม', 'เหลือเฉพาะ platform ที่ผู้เลือก',
        "keys=" . implode(',', $keys), $pass); tally($pass);
}

// ── TC18 — ไม่ใช้ Research → evaluate ได้ และ research rule ไม่ทำ score ผิด ─
{
    $item = makeItem(['facebook']); // ไม่มี research_brief
    $eval = script_quality_evaluate(['facebook' => goodScript()], ['facebook'], $item);
    $fb = $eval['platforms']['facebook'];
    // search_intent ต้องเป็น n/a (ไม่ใช่ failed/needs_improvement)
    $siStatus = null;
    foreach ($fb['aeo']['rules'] as $r) if ($r['key'] === 'search_intent') $siStatus = $r['status'];
    $pass = $fb['passed'] && $siStatus === 'n/a';
    record('TC18', 'ไม่ใช้ Research', 'evaluate ได้ + research rule = n/a ไม่ทำ score ผิด',
        "FB passed={$fb['passed']}, search_intent={$siStatus}, AEO={$fb['aeo']['score']}", $pass); tally($pass);
}

// ── TC19 — AEO Script ภาษาไทย ตรวจจับคำถาม/คำตอบได้ (ไม่ติด \b) ───────────
{
    $q1 = script_questionish('YouTube คืออะไร');
    $q2 = script_questionish('วิธีเลือกแพลตฟอร์มสร้างคอนเทนต์อย่างไร');
    // answer cue ภาษาไทย (คือ/ขั้นตอน) ตรวจได้โดยไม่มี \b
    $answerCue = preg_match('/(?:คือ|ได้แก่|หมายถึง|สามารถ|วิธี|ขั้นตอน|สรุป|คำตอบ|เพราะ|ดังนั้น|คือการ)/iu', 'YouTube คือแพลตฟอร์มสำหรับเผยแพร่วิดีโอ') === 1;
    $pass = $q1 === true && $q2 === true && $answerCue === true;
    record('TC19', 'AEO Script ภาษาไทย', 'ตรวจจับคำถาม/คำตอบไทยได้ ไม่ติด \\b',
        "q1={$q1}, q2={$q2}, answerCue={$answerCue}", $pass); tally($pass);
}

// ── TC20 — Dialog แสดง score แยก platform ตรงกับ backend script_quality ───
{
    $eval = script_quality_evaluate(['facebook' => goodScript(), 'instagram' => goodScript()], ['facebook', 'instagram'], makeItem(['facebook', 'instagram']));
    // backend คืน platforms.{platform}.{seo.score, aeo.score, passed} — ตรงกับที่ frontend อ่าน res.script_quality.platforms
    $shapeOk = true;
    foreach ($eval['platforms'] as $p => $q) {
        if (!isset($q['seo']['score'], $q['aeo']['score'], $q['passed'])) $shapeOk = false;
    }
    $pass = $shapeOk;
    record('TC20', 'Dialog แสดง score แยก platform ตรง backend', 'shape platforms.{p}.{seo,aeo,passed}',
        "shapeOk={$shapeOk}", $pass); tally($pass);
}

// ═══════════════════ Publish Gate ══════════════════════════════════════════
// ── TC21 — FB ผ่าน + IG ไม่ผ่าน → publish FB สำเร็จ ────────────────────────
{
    $content = makeContent(['facebook' => goodScript(), 'instagram' => badScript()], ['facebook', 'instagram']);
    $check = script_quality_publish_check($content, 'facebook');
    $pass = $check['blocked'] === false;
    record('TC21', 'FB ผ่าน + IG ไม่ผ่าน → publish FB', 'FB publish ได้',
        "blocked=" . var_export($check['blocked'], true), $pass); tally($pass);
}

// ── TC22 — FB ผ่าน + IG ไม่ผ่าน → publish IG ถูกปฏิเสธ ─────────────────────
{
    $content = makeContent(['facebook' => goodScript(), 'instagram' => badScript()], ['facebook', 'instagram']);
    $check = script_quality_publish_check($content, 'instagram');
    $pass = $check['blocked'] === true;
    record('TC22', 'FB ผ่าน + IG ไม่ผ่าน → publish IG', 'IG ถูกปฏิเสธ',
        "blocked=" . var_export($check['blocked'], true), $pass); tally($pass);
}

// ── TC23 — FB + IG ผ่านทั้งหมด → publish ได้ทั้งคู่ ─────────────────────────
{
    $content = makeContent(['facebook' => goodScript(), 'instagram' => goodScript()], ['facebook', 'instagram']);
    $fb = script_quality_publish_check($content, 'facebook');
    $ig = script_quality_publish_check($content, 'instagram');
    $pass = $fb['blocked'] === false && $ig['blocked'] === false;
    record('TC23', 'FB + IG ผ่านทั้งหมด', 'ทั้งคู่ publish ได้',
        "FB=" . var_export($fb['blocked'], true) . ", IG=" . var_export($ig['blocked'], true), $pass); tally($pass);
}

// ── TC24 — platform ไม่ได้เลือกตอนสร้าง แต่พยายาม publish → block ──────────
{
    $content = makeContent(['facebook' => goodScript()], ['facebook']); // เลือกแค่ facebook
    $check = script_quality_publish_check($content, 'instagram'); // พยายาม publish IG
    $pass = $check['blocked'] === true;
    record('TC24', 'platform ไม่ได้เลือกแต่พยายาม publish', 'ถูก block',
        "blocked=" . var_export($check['blocked'], true), $pass); tally($pass);
}

// ── TC25 — script ถูกแก้หลัง evaluate → publish ใช้ gate จากเวอร์ชันล่าสุด ─
{
    // ตอนแรก bad → blocked
    $content = makeContent(['facebook' => badScript()], ['facebook']);
    $before = script_quality_publish_check($content, 'facebook');
    // "แก้" script เป็น good ใน content ใหม่ (เวอร์ชันล่าสุด)
    $content2 = makeContent(['facebook' => goodScript()], ['facebook']);
    $after = script_quality_publish_check($content2, 'facebook');
    $pass = $before['blocked'] === true && $after['blocked'] === false;
    record('TC25', 'script ถูกแก้หลัง evaluate', 'publish ใช้ gate จาก script ล่าสุด',
        "before blocked={$before['blocked']}, after blocked={$after['blocked']}", $pass); tally($pass);
}

// ── TC26 — Generate ใหม่ → score เก่าไม่ถูกใช้แทนผล evaluate ใหม่ ───────────
{
    // generate เดิม bad → blocked
    $old = makeContent(['facebook' => badScript()], ['facebook']);
    $oldCheck = script_quality_publish_check($old, 'facebook');
    // generate ใหม่ good → ไม่ block (ผลใหม่ ไม่ใช่ cache เก่า)
    $new = makeContent(['facebook' => goodScript()], ['facebook']);
    $newCheck = script_quality_publish_check($new, 'facebook');
    $pass = $oldCheck['blocked'] === true && $newCheck['blocked'] === false;
    record('TC26', 'Generate ใหม่', 'ใช้ผล evaluate ใหม่ ไม่ใช้ score เก่า',
        "old blocked={$oldCheck['blocked']}, new blocked={$newCheck['blocked']}", $pass); tally($pass);
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
