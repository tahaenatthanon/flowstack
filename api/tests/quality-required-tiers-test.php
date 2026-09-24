<?php
/**
 * quality-required-tiers — Required/Recommended tiers, เพดานแข็ง, gate ตัดสินจาก Required failed,
 * Quality Gate กลาง (quality_required_gate) และการตัดสินใจ repair 1 รอบ
 *
 * Section A/C = pure function (ไม่แตะ DB/AI) · Section B = ใช้ DB local
 * (สลับ content_global_settings ของ tenant-default ชั่วคราว แล้วคืนค่าเดิมตอนจบ)
 *
 * รัน: php api/tests/quality-required-tiers-test.php
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

function filler(int $repeat = 100): string {
    return implode(' ', array_fill(0, $repeat, 'content marketing strategy planning execution optimization growth research analysis'));
}
function goodArticle(array $overrides = [], ?string $html = null): array {
    $primary = 'วิธีทำคอนเทนต์';
    $html ??= '<p>' . $primary . ' คือกระบวนการวางแผนและสร้างสรรค์เนื้อหาอย่างเป็นระบบเพื่อให้เข้าถึงกลุ่มเป้าหมายได้ตรงจุด ' . filler() . '</p>' .
        '<h2>' . $primary . 'คืออะไร ทำไมสำคัญ</h2><p>' . $primary . ' คือการวางแผนเนื้อหาที่ตอบโจทย์ผู้ชม ' . filler() . '</p>' .
        '<h2>วิธีวางแผนคอนเทนต์อย่างไร</h2><p>วิธีวางแผนเริ่มจากขั้นตอนการกำหนดเป้าหมาย ' . filler() . '</p>';
    return array_merge([
        'id' => 'qrt-test-1',
        'type' => 'article',
        'status' => 'approved',
        'approved_at' => '2026-09-24 10:00:00',
        'platforms' => ['wordpress'],
        'title' => 'วิธีทำคอนเทนต์ให้ปังในปี 2026',
        'seo_title' => 'วิธีทำคอนเทนต์ให้ปังในปี 2026',
        'slug' => 'how-to-create-great-content',
        'meta_description' => mb_substr(str_repeat('วิธีทำคอนเทนต์ให้ประสบความสำเร็จอย่างยั่งยืน ', 8), 0, 140),
        'meta_keywords' => $primary . ', การตลาด, คอนเทนต์',
        'structured_data' => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
        'article_content' => json_encode(['title' => 'วิธีทำคอนเทนต์ให้ปังในปี 2026', 'html' => $html, 'quality_checked_at' => '2026-09-24 10:00:00'], JSON_UNESCAPED_UNICODE),
    ], $overrides);
}
function ruleOf(array $eval, string $key): array {
    foreach ($eval['rules'] as $r) if ($r['key'] === $key) return $r;
    return [];
}
function rule(string $key, string $status, string $tier): array {
    return ['key' => $key, 'status' => $status, 'tier' => $tier, 'weight' => 10, 'score' => 0, 'message' => "{$key} {$status}"];
}

// ═══════════════════ Section A — tier catalog + เพดานแข็ง + gate status (pure) ═══
{
    $seoReq = array_keys(array_filter(SEO_WEIGHTS, fn($m) => $m['tier'] === 'required'));
    $seoRec = array_keys(array_filter(SEO_WEIGHTS, fn($m) => $m['tier'] === 'recommended'));
    $aeoReq = array_keys(array_filter(AEO_WEIGHTS, fn($m) => $m['tier'] === 'required'));
    $noOptional = !in_array('optional', array_merge(array_column(SEO_WEIGHTS, 'tier'), array_column(AEO_WEIGHTS, 'tier')), true);
    $expectSeoReq = ['seo_title', 'meta_description', 'slug', 'h1', 'content_length', 'primary_keyword_placement', 'keyword_stuffing', 'structured_data'];
    sort($seoReq); sort($expectSeoReq); sort($aeoReq);
    $pass = $seoReq === $expectSeoReq && count($seoRec) === 7 && $aeoReq === ['direct_answer', 'structured_data'] && $noOptional
        && in_array('content_gap', $seoRec, true) && in_array('topic_coverage', $seoRec, true) && in_array('paa_questions', $seoRec, true);
    record('QA01', 'tier catalog: SEO required 8 / recommended 7, AEO required 2, ไม่มี optional', 'ตรงตาม D1',
        'SEO req=' . count($seoReq) . ' rec=' . count($seoRec) . ' AEO req=' . implode(',', $aeoReq) . ' noOptional=' . var_export($noOptional, true), $pass); tally($pass);
}

$metaCases = [
    ['QA02', 'meta 108 ตัวอักษร', mb_substr(str_repeat('ก', 200), 0, 108), 'needs_improvement'],
    ['QA03', 'meta 160 ตัวอักษร (เพดานพอดี)', mb_substr(str_repeat('ก', 200), 0, 160), 'passed'],
    ['QA04', 'meta 162 ตัวอักษร', mb_substr(str_repeat('ก', 200), 0, 162), 'failed'],
    ['QA05', 'meta ว่าง', '', 'failed'],
];
foreach ($metaCases as [$tc, $name, $meta, $expect]) {
    $st = ruleOf(seo_evaluate(goodArticle(['meta_description' => $meta])), 'meta_description')['status'] ?? '?';
    $pass = $st === $expect;
    record($tc, $name, $expect, $st, $pass); tally($pass);
}

$wordsHtml = fn(int $n) => '<p>วิธีทำคอนเทนต์ ' . implode(' ', array_fill(0, $n, 'word')) . '</p><h2>วิธีทำคอนเทนต์</h2>';
foreach ([['QA06', 450, 'needs_improvement'], ['QA07', 250, 'failed'], ['QA08', 520, 'passed']] as [$tc, $n, $expect]) {
    $r = ruleOf(seo_evaluate(goodArticle([], $wordsHtml($n))), 'content_length');
    $pass = ($r['status'] ?? '') === $expect;
    record($tc, "เนื้อหา ~{$n} คำ", $expect, ($r['status'] ?? '?') . ' — ' . ($r['message'] ?? ''), $pass); tally($pass);
}

{
    // keyword อยู่แค่ใน title (1/3) → needs_improvement; ไม่อยู่เลย (0/3) → failed
    $html1 = '<p>ย่อหน้าแรกเกี่ยวกับการตลาด ' . filler() . '</p><h2>หัวข้อทั่วไป</h2><p>' . filler() . '</p>';
    $r1 = ruleOf(seo_evaluate(goodArticle([], $html1)), 'primary_keyword_placement');
    $r0 = ruleOf(seo_evaluate(goodArticle(['seo_title' => 'บทความการตลาด', 'title' => 'บทความการตลาด'], $html1)), 'primary_keyword_placement');
    $pass = ($r1['status'] ?? '') === 'needs_improvement' && ($r0['status'] ?? '') === 'failed';
    record('QA09', 'keyword 1/3 = needs_improvement, 0/3 = failed', 'needs_improvement / failed', ($r1['status'] ?? '?') . ' / ' . ($r0['status'] ?? '?'), $pass); tally($pass);
}
{
    $r = ruleOf(seo_evaluate(goodArticle(['seo_title' => mb_substr(str_repeat('ข', 80), 0, 61)])), 'seo_title');
    $pass = ($r['status'] ?? '') === 'failed';
    record('QA10', 'seo_title 61 ตัวอักษร', 'failed', $r['status'] ?? '?', $pass); tally($pass);
}
{
    $low = ['score' => 40, 'rules' => [rule('seo_title', 'passed', 'required'), rule('content_gap', 'failed', 'recommended'), rule('meta_description', 'needs_improvement', 'required')]];
    $g = seo_gate_status($low);
    $pass = $g === 'passed';
    record('QA11', 'SEO คะแนน 40 + recommended failed + required needs_improvement', 'passed', $g, $pass); tally($pass);
}
{
    $seo = ['score' => 95, 'rules' => [rule('seo_title', 'passed', 'required')]];
    $aeo = ['score' => 90, 'rules' => [rule('direct_answer', 'failed', 'required'), rule('qa_structure', 'failed', 'recommended')]];
    $st = quality_required_status($seo, $aeo);
    $f = $st['failed_required'];
    $pass = $st['status'] === 'failed' && count($f) === 1 && $f[0]['quality'] === 'AEO' && $f[0]['key'] === 'direct_answer';
    record('QA12', 'AEO direct_answer (required) failed → quality failed', 'failed, failed_required=[AEO:direct_answer]',
        $st['status'] . ', ' . implode(',', array_map(fn($x) => $x['quality'] . ':' . $x['key'], $f)), $pass); tally($pass);
}
{
    $req = [];
    foreach (seo_generation_requirements('article') as $r) $req[$r['key']] = $r;
    $pass = str_contains($req['meta_description']['pass_condition'], '160') && str_contains($req['meta_description']['recommended'] ?? '', '120')
        && str_contains($req['content_length']['pass_condition'], '300') && str_contains($req['content_length']['recommended'] ?? '', '500')
        && $req['content_gap']['tier'] === 'recommended' && $req['seo_title']['tier'] === 'required';
    record('QA13', 'generation contract: pass_condition = Required, recommended = ช่วงแนะนำ, tier จาก SEO_WEIGHTS', 'ตรงเกณฑ์',
        'meta=' . $req['meta_description']['pass_condition'] . ' | content=' . $req['content_length']['pass_condition'], $pass); tally($pass);
}

// ═══════════════════ Section C — การตัดสินใจ repair (pure) ═══════════════════
{
    $seo = ['score' => 70, 'rules' => [rule('seo_title', 'failed', 'required'), rule('content_gap', 'failed', 'recommended'), rule('internal_linking', 'needs_improvement', 'recommended')]];
    $aeo = ['score' => 80, 'rules' => [rule('direct_answer', 'passed', 'required')]];
    $fb = quality_repair_feedback($seo, $aeo);
    $pass = quality_should_repair($seo, $aeo, false) && str_contains($fb, 'SEO:seo_title') && !str_contains($fb, 'content_gap') && !str_contains($fb, 'internal_linking');
    record('QC01', 'required failed → repair, feedback มีเฉพาะ Required', 'repair=true, feedback=seo_title เท่านั้น', str_replace("\n", ' ⏎ ', $fb), $pass); tally($pass);
}
{
    $seo = ['score' => 50, 'rules' => [rule('content_gap', 'failed', 'recommended'), rule('meta_description', 'needs_improvement', 'required')]];
    $aeo = ['score' => 40, 'rules' => [rule('qa_structure', 'failed', 'recommended')]];
    $pass = !quality_should_repair($seo, $aeo, false);
    record('QC02', 'มีแค่ recommended/needs_improvement → ไม่ repair', 'false', var_export(quality_should_repair($seo, $aeo, false), true), $pass); tally($pass);
}
{
    $seo = ['score' => 20, 'rules' => [rule('seo_title', 'failed', 'required')]];
    $pass = !quality_should_repair($seo, ['rules' => []], true);
    record('QC03', 'วิดีโอ + required failed → ไม่ repair', 'false', var_export(quality_should_repair($seo, ['rules' => []], true), true), $pass); tally($pass);
}
{
    // จำลองลูปเดียวกับ brand-content.php: repair ที่แก้ไม่สำเร็จต้องเรียก AI แค่ 1 ครั้ง
    $seo = ['score' => 20, 'rules' => [rule('seo_title', 'failed', 'required')]];
    $aeo = ['rules' => [rule('direct_answer', 'failed', 'required')]];
    $calls = 0;
    for ($round = 0; $round < QUALITY_REPAIR_MAX_ROUNDS && quality_should_repair($seo, $aeo, false); $round++) $calls++;
    $src = file_get_contents(__DIR__ . '/../brand-content.php');
    $wired = str_contains($src, '$repairRound < QUALITY_REPAIR_MAX_ROUNDS && quality_should_repair($seoEval, $aeoEval, $isVideo)')
        && !str_contains($src, 'SEO_GEN_MAX_ATTEMPTS') && !str_contains($src, '$aeoAttempt');
    $pass = $calls === 1 && QUALITY_REPAIR_MAX_ROUNDS === 1 && $wired;
    record('QC04', 'repair รวม SEO+AEO ไม่เกิน 1 รอบ (brand-content ใช้ลูปนี้)', 'AI 1 ครั้ง, ไม่มีลูปเดิม',
        "calls={$calls}, wired=" . var_export($wired, true), $pass); tally($pass);
}

// ═══════════════════ Section B — Quality Gate กลาง (DB local) ════════════════
$db = getDB();
$TENANT = 'tenant-default';
$origCfg = $db->query("SELECT seo_gate_enabled, seo_gate_min_score FROM content_global_settings WHERE tenant_id='{$TENANT}'")->fetch(PDO::FETCH_ASSOC);
$origEnabled = (int)($origCfg['seo_gate_enabled'] ?? 0);
$origMin = (int)($origCfg['seo_gate_min_score'] ?? 0);
register_shutdown_function(function () use ($db, $TENANT, $origEnabled, $origMin) {
    $db->exec("UPDATE content_global_settings SET seo_gate_enabled={$origEnabled}, seo_gate_min_score={$origMin} WHERE tenant_id='{$TENANT}'");
});
$setGate = fn(int $on, int $min = 0) => $db->exec("UPDATE content_global_settings SET seo_gate_enabled={$on}, seo_gate_min_score={$min} WHERE tenant_id='{$TENANT}'");
$noMarker = fn(array $c) => array_merge($c, ['article_content' => json_encode(array_diff_key(json_decode($c['article_content'], true), ['quality_checked_at' => 1]), JSON_UNESCAPED_UNICODE)]);
$longTitle = ['seo_title' => mb_substr(str_repeat('ค', 90), 0, 72)];

$setGate(1);
{
    $c = $noMarker(goodArticle(['type' => 'video', 'status' => 'draft', 'approved_at' => null] + $longTitle));
    $r = content_quality_gate_check($db, $TENANT, $c);
    $pass = $r['blocked'] === false;
    record('QB01', 'วิดีโอไม่มี marker + required failed → ขออนุมัติไม่ถูกบล็อก', 'blocked=false', 'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}
{
    $c = $noMarker(goodArticle());
    $r = content_quality_gate_check($db, $TENANT, $c);
    $pass = $r['blocked'] === true && str_contains((string)$r['reason'], 'ตรวจ SEO/AEO ใหม่');
    record('QB02', 'ไม่มี marker → บล็อกพร้อมบอกให้กด "ตรวจ SEO/AEO ใหม่"', 'blocked + ข้อความ', (string)$r['reason'], $pass); tally($pass);
}
{
    $c = goodArticle($longTitle);
    $ra = content_quality_gate_check($db, $TENANT, $c);
    $rp = final_publish_gate_check($db, $TENANT, $c, 'wordpress');
    $pass = $ra['blocked'] === true && $rp['blocked'] === true && str_contains((string)$ra['reason'], 'SEO title') && ($ra['failed_required'][0]['key'] ?? '') === 'seo_title';
    record('QB03', 'มี marker แต่ประเมินใหม่ seo_title 72 ตัวอักษร → ขออนุมัติและเผยแพร่ถูกบล็อก', 'blocked ทั้งสอง + ระบุ seo_title',
        str_replace("\n", ' ⏎ ', (string)$ra['reason']), $pass); tally($pass);
}
{
    // ไม่มี H2 (heading_structure/qa เป็น recommended) คะแนนต่ำลงแต่ required ผ่าน + min_score 90 ไม่มีผล
    $setGate(1, 90);
    $html = '<p>วิธีทำคอนเทนต์ คือกระบวนการวางแผนและสร้างสรรค์เนื้อหาอย่างเป็นระบบเพื่อให้เข้าถึงกลุ่มเป้าหมายได้ตรงจุด ' . filler() . '</p><p>' . filler() . '</p>';
    $c = goodArticle([], $html);
    $seo = seo_evaluate($c);
    $ra = content_quality_gate_check($db, $TENANT, $c);
    $rp = final_publish_gate_check($db, $TENANT, $c, 'wordpress');
    $pass = $ra['blocked'] === false && $rp['blocked'] === false && $seo['score'] < 90;
    record('QB04', 'คะแนนต่ำกว่า min_score 90 แต่ required ผ่าน → ขออนุมัติ/เผยแพร่ได้ผลเดียวกัน (ไม่บล็อก)', 'blocked=false ทั้งสอง',
        "score={$seo['score']}, approval=" . var_export($ra['blocked'], true) . ', publish=' . var_export($rp['blocked'], true), $pass); tally($pass);
    $setGate(1);
}
{
    $setGate(0);
    $c = goodArticle($longTitle);
    $ra = content_quality_gate_check($db, $TENANT, $c);
    $rp = final_publish_gate_check($db, $TENANT, $c, 'wordpress');
    $rm = content_quality_gate_check($db, $TENANT, $noMarker($c));
    $pass = $ra['blocked'] === false && $rp['blocked'] === false && $rm['blocked'] === true;
    record('QB05', 'seo_gate_enabled=0: required failed ไม่บล็อก แต่ยังเช็ค marker', 'ไม่บล็อก / ไม่บล็อก / marker บล็อก',
        var_export($ra['blocked'], true) . ' / ' . var_export($rp['blocked'], true) . ' / ' . var_export($rm['blocked'], true), $pass); tally($pass);
    $setGate(1);
}
{
    $c = goodArticle(['platforms' => ['facebook']] + $longTitle);
    $ra = content_quality_gate_check($db, $TENANT, $c);
    $rp = final_publish_gate_check($db, $TENANT, $c, 'facebook');
    $pass = $ra['blocked'] === false && $rp['blocked'] === false;
    record('QB06', 'เลือกแต่ Facebook + required failed → ไม่ถูก SEO/AEO บล็อก (โซเชียลไม่มี Quality gate)', 'blocked=false ทั้งสอง',
        var_export($ra['blocked'], true) . ' / ' . var_export($rp['blocked'], true), $pass); tally($pass);
}
{
    $c = goodArticle(['type' => 'video'] + $longTitle);
    $rp = final_publish_gate_check($db, $TENANT, $noMarker(array_merge($c, ['status' => 'draft', 'approved_at' => null])), 'wordpress');
    $pass = $rp['blocked'] === true && str_contains((string)$rp['reason'], 'Approval gate');
    record('QB07', 'วิดีโอยังไม่อนุมัติ → ยังถูก Approval gate บล็อกตามเดิม', 'Approval gate', (string)$rp['reason'], $pass); tally($pass);
}

// ═══════════════════ Output ════════════════════════════════════════════════
echo "\n| TC | Test Case | Expected | Actual | PASS/FAIL |\n|----|-----------|----------|--------|-----------|\n";
foreach ($RESULTS as [$tc, $name, $expected, $actual, $pass]) {
    echo "| {$tc} | {$name} | {$expected} | " . mb_substr($actual, 0, 160) . ' | ' . ($pass ? 'PASS' : 'FAIL') . " |\n";
}
echo "\nผ่าน: {$PASS} / " . count($RESULTS) . "\nไม่ผ่าน: {$FAIL} / " . count($RESULTS) . "\n";
if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
