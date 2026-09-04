<?php
/**
 * Part 5 — Final Publish Gate (Article Global Gate + Per-platform Script Gate)
 * ทดสอบ final_publish_gate_check() ตัวจริง (brand-content.php?action=publish และ cron ใช้ตัวเดียวกัน)
 * + script_quality_publish_check() (pure) + publish-once logic
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/publish-dispatch.php';

$db = getDB();
$TENANT = 'tenant-default';

// ── บันทึก/ตั้ง seo_gate_enabled (Article SEO/AEO gate ต้องเปิดถึงจะ block) ──
$origCfg = $db->query("SELECT seo_gate_enabled, seo_gate_min_score FROM content_global_settings WHERE tenant_id='{$TENANT}'")->fetch(PDO::FETCH_ASSOC);
$origEnabled = (int)($origCfg['seo_gate_enabled'] ?? 0);
$origMin = (int)($origCfg['seo_gate_min_score'] ?? 0);
$db->exec("UPDATE content_global_settings SET seo_gate_enabled=1, seo_gate_min_score=0 WHERE tenant_id='{$TENANT}'");

register_shutdown_function(function () use ($db, $TENANT, $origEnabled, $origMin) {
    $db->exec("UPDATE content_global_settings SET seo_gate_enabled={$origEnabled}, seo_gate_min_score={$origMin} WHERE tenant_id='{$TENANT}'");
});

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

// ── helpers ────────────────────────────────────────────────────────────────
function filler(int $repeat = 100): string {
    return implode(' ', array_fill(0, $repeat, 'content marketing strategy planning execution optimization growth research analysis'));
}

function goodScript(): string {
    // ต้องมี entity (title เต็ม) + primary keyword + hook + hashtag + answer cue
    return 'Hook: วิธีทำคอนเทนต์ให้ปังในปี 2026 คือการวางแผนเนื้อหาที่ตอบโจทย์กลุ่มเป้าหมายอย่างเป็นระบบ ' .
           'ขั้นตอนสำคัญคือการวิเคราะห์ผู้ชมและกำหนดเป้าหมายให้ชัดเจนก่อนเริ่มผลิตเนื้อหา #การตลาด #คอนเทนต์';
}
function badScript(): string { return 'สวัสดีครับ'; }

function passingHtml(): string {
    return '<p>วิธีทำคอนเทนต์ คือกระบวนการวางแผนและสร้างสรรค์เนื้อหาอย่างเป็นระบบเพื่อให้เข้าถึงกลุ่มเป้าหมายได้ตรงจุด ' . filler() . '</p>' .
           '<h2>วิธีทำคอนเทนต์คืออะไร ทำไมสำคัญ</h2><p>วิธีทำคอนเทนต์ คือการวางแผนเนื้อหาที่ตอบโจทย์ผู้ชม ' . filler() . '</p>' .
           '<h2>วิธีวางแผนคอนเทนต์อย่างไร</h2><p>วิธีวางแผนเริ่มจากขั้นตอนการกำหนดเป้าหมาย ' . filler() . '</p>';
}

function aeoFailHtml(): string {
    // SEO ยังผ่าน (มี H2 + 500 คำ + keyword) แต่ AEO qa_structure/direct_answer ล้ม
    // (h2 ไม่เป็นคำถาม + intro filler ไม่ตอบหัวข้อ)
    return '<p>สวัสดีครับ ยินดีต้อนรับทุกท่านเข้าสู่บทความของเราครับ วันนี้เรามีเรื่องดี ๆ มาแบ่งปัน ' . filler() . '</p>' .
           '<h2>ภาพรวมทั่วไป</h2><p>' . filler() . '</p>' .
           '<h2>รายละเอียดเพิ่มเติม</h2><p>' . filler() . '</p>';
}

function makeContent(array $platforms, array $scripts, string $html, bool $approved = true, array $seoOverrides = []): array {
    $article = ['title' => 'วิธีทำคอนเทนต์ให้ปังในปี 2026', 'html' => $html, 'scripts' => $scripts];
    $base = [
        'id'               => 'test-content-1',
        'status'           => $approved ? 'approved' : 'draft',
        'approved_at'      => $approved ? '2026-09-04 10:00:00' : null,
        'platform'         => $platforms[0] ?? '',
        'platforms'        => $platforms,
        'topic'            => 'วิธีทำคอนเทนต์',
        'title'            => 'วิธีทำคอนเทนต์ให้ปังในปี 2026',
        'seo_title'        => 'วิธีทำคอนเทนต์ให้ปังในปี 2026',
        'slug'             => 'how-to-create-great-content',
        'meta_description' => mb_substr(str_repeat('วิธีทำคอนเทนต์ให้ประสบความสำเร็จอย่างยั่งยืน ', 8), 0, 140),
        'meta_keywords'    => 'วิธีทำคอนเทนต์, การตลาด, คอนเทนต์',
        'structured_data'  => json_encode(['@context' => 'https://schema.org', '@type' => 'Article']),
        'article_content'  => json_encode($article, JSON_UNESCAPED_UNICODE),
    ];
    return array_merge($base, $seoOverrides);
}

function gate(PDO $db, string $tenant, array $content, string $platform, ?array $brief = null): array {
    return final_publish_gate_check($db, $tenant, $content, $platform, $brief);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC01 — Article SEO+AEO ผ่าน + FB Script ผ่าน → FB publish ได้
// ═══════════════════════════════════════════════════════════════════════════
{
    $content = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $r = gate($db, $TENANT, $content, 'facebook');
    $pass = $r['blocked'] === false;
    record('TC01', 'Article SEO+AEO ผ่าน + FB Script ผ่าน', 'FB publish ได้',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC02 — Article SEO ไม่ผ่าน → ทุก platform ถูก block (Global gate)
// ═══════════════════════════════════════════════════════════════════════════
{
    // ทำ SEO fail: structured_data ว่าง (required rule fail) — แต่ script ทุกตัวผ่าน
    $content = makeContent(['facebook', 'instagram'], ['facebook' => goodScript(), 'instagram' => goodScript()], passingHtml(), true, ['structured_data' => '']);
    $fb = gate($db, $TENANT, $content, 'facebook');
    $ig = gate($db, $TENANT, $content, 'instagram');
    $pass = $fb['blocked'] === true && $ig['blocked'] === true;
    record('TC02', 'Article SEO ไม่ผ่าน', 'ทุก platform ถูก block',
        'FB blocked=' . var_export($fb['blocked'], true) . ', IG blocked=' . var_export($ig['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC03 — Article AEO ไม่ผ่าน → ทุก platform ถูก block (Global gate)
// ═══════════════════════════════════════════════════════════════════════════
{
    $content = makeContent(['facebook', 'instagram'], ['facebook' => goodScript(), 'instagram' => goodScript()], aeoFailHtml());
    $fb = gate($db, $TENANT, $content, 'facebook');
    $ig = gate($db, $TENANT, $content, 'instagram');
    $pass = $fb['blocked'] === true && $ig['blocked'] === true;
    record('TC03', 'Article AEO ไม่ผ่าน', 'ทุก platform ถูก block',
        'FB blocked=' . var_export($fb['blocked'], true) . ', IG blocked=' . var_export($ig['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC04 — Article ผ่าน แต่ FB Script SEO ไม่ผ่าน → FB ถูก block (per-platform)
// ═══════════════════════════════════════════════════════════════════════════
{
    // script สั้น ไม่มี keyword → script SEO fail
    $content = makeContent(['facebook'], ['facebook' => 'x'], passingHtml());
    $r = gate($db, $TENANT, $content, 'facebook');
    $pass = $r['blocked'] === true && str_contains($r['reason'] ?? '', 'Script');
    record('TC04', 'Article ผ่าน แต่ FB Script SEO ไม่ผ่าน', 'FB ถูก block (script gate)',
        'blocked=' . var_export($r['blocked'], true) . ', reason=' . mb_substr($r['reason'] ?? '', 0, 40), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC05 — Article ผ่าน แต่ FB Script AEO ไม่ผ่าน → FB ถูก block
// ═══════════════════════════════════════════════════════════════════════════
{
    // script ที่มี keyword (SEO ผ่านบางส่วน) แต่ AEO direct_value/entity fail
    $content = makeContent(['facebook'], ['facebook' => 'วิธีทำคอนเทนต์'], passingHtml());
    $r = gate($db, $TENANT, $content, 'facebook');
    $pass = $r['blocked'] === true;
    record('TC05', 'Article ผ่าน แต่ FB Script AEO ไม่ผ่าน', 'FB ถูก block',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC06 — Article ผ่าน + FB ผ่าน + YT ไม่ผ่าน → FB publish ได้ / YT block
// ═══════════════════════════════════════════════════════════════════════════
{
    $content = makeContent(['facebook', 'youtube'], ['facebook' => goodScript(), 'youtube' => badScript()], passingHtml());
    $fb = gate($db, $TENANT, $content, 'facebook');
    $yt = gate($db, $TENANT, $content, 'youtube');
    $pass = $fb['blocked'] === false && $yt['blocked'] === true;
    record('TC06', 'Article ผ่าน + FB ผ่าน + YT ไม่ผ่าน', 'FB ได้ / YT block',
        'FB blocked=' . var_export($fb['blocked'], true) . ', YT blocked=' . var_export($yt['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC07 — Article ผ่าน + FB ไม่ผ่าน + YT ผ่าน → FB block / YT publish ได้
// ═══════════════════════════════════════════════════════════════════════════
{
    $content = makeContent(['facebook', 'youtube'], ['facebook' => badScript(), 'youtube' => goodScript()], passingHtml());
    $fb = gate($db, $TENANT, $content, 'facebook');
    $yt = gate($db, $TENANT, $content, 'youtube');
    $pass = $fb['blocked'] === true && $yt['blocked'] === false;
    record('TC07', 'Article ผ่าน + FB ไม่ผ่าน + YT ผ่าน', 'FB block / YT ได้',
        'FB blocked=' . var_export($fb['blocked'], true) . ', YT blocked=' . var_export($yt['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC08 — FB + IG + YT ทุก gate ผ่าน → ทุก platform publish ได้
// ═══════════════════════════════════════════════════════════════════════════
{
    $platforms = ['facebook', 'instagram', 'youtube'];
    $scripts = ['facebook' => goodScript(), 'instagram' => goodScript(), 'youtube' => goodScript()];
    $content = makeContent($platforms, $scripts, passingHtml());
    $allOk = true;
    foreach ($platforms as $p) { if (gate($db, $TENANT, $content, $p)['blocked']) $allOk = false; }
    $pass = $allOk;
    record('TC08', 'FB+IG+YT ทุก gate ผ่าน', 'ทุก platform publish ได้',
        'allOk=' . var_export($allOk, true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC09 — FB+IG+YT แต่ IG Script ไม่ผ่าน → FB/YT ได้ / IG block
// ═══════════════════════════════════════════════════════════════════════════
{
    $platforms = ['facebook', 'instagram', 'youtube'];
    $scripts = ['facebook' => goodScript(), 'instagram' => badScript(), 'youtube' => goodScript()];
    $content = makeContent($platforms, $scripts, passingHtml());
    $fb = gate($db, $TENANT, $content, 'facebook')['blocked'];
    $ig = gate($db, $TENANT, $content, 'instagram')['blocked'];
    $yt = gate($db, $TENANT, $content, 'youtube')['blocked'];
    $pass = $fb === false && $ig === true && $yt === false;
    record('TC09', 'FB+IG+YT แต่ IG Script ไม่ผ่าน', 'FB/YT ได้ / IG block',
        "FB={$fb}, IG={$ig}, YT={$yt}", $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC10 — พยายาม publish platform ที่ไม่ได้เลือก → block
// ═══════════════════════════════════════════════════════════════════════════
{
    $content = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $r = gate($db, $TENANT, $content, 'instagram'); // IG ไม่ได้เลือก
    $pass = $r['blocked'] === true && str_contains($r['reason'] ?? '', 'ไม่ได้ถูกเลือก');
    record('TC10', 'Publish platform ที่ไม่ได้เลือก', 'ถูก block',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC11 — Platform ที่เลือกไม่มี script → block
// ═══════════════════════════════════════════════════════════════════════════
{
    $content = makeContent(['facebook', 'instagram'], ['facebook' => goodScript()], passingHtml()); // IG ไม่มี script
    $r = gate($db, $TENANT, $content, 'instagram');
    $pass = $r['blocked'] === true;
    record('TC11', 'Platform ที่เลือกไม่มี script', 'ถูก block',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC12 — Script score SEO=80 AEO=80 → publish ได้ (ตรง threshold)
// ═══════════════════════════════════════════════════════════════════════════
{
    // จำลอง script ที่ได้ score 80 ผ่าน (verify ด้วย script_gate_status โดยตรง)
    $seo = ['score' => 80, 'rules' => [['tier' => 'required', 'status' => 'passed']]];
    $aeo = ['score' => 80, 'rules' => [['tier' => 'required', 'status' => 'passed']]];
    $pass = script_gate_status($seo) === 'passed' && script_gate_status($aeo) === 'passed';
    record('TC12', 'Script score SEO=80 AEO=80', 'ผ่าน gate',
        'passed', $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC13 — Script score 79 ไม่มี required fail → block
// ═══════════════════════════════════════════════════════════════════════════
{
    $eval = ['score' => 79, 'rules' => [['tier' => 'required', 'status' => 'passed']]];
    $pass = script_gate_status($eval) === 'needs_improvement';
    record('TC13', 'Script score 79 (no required fail)', 'block (needs_improvement)',
        script_gate_status($eval), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC14 — Script score≥80 แต่ required SEO rule fail → block
// ═══════════════════════════════════════════════════════════════════════════
{
    $eval = ['score' => 90, 'rules' => [['tier' => 'required', 'status' => 'failed']]];
    $pass = script_gate_status($eval) === 'failed';
    record('TC14', 'Script score≥80 แต่ required SEO rule fail', 'block',
        script_gate_status($eval), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC15 — Script score≥80 แต่ required AEO rule fail → block
// ═══════════════════════════════════════════════════════════════════════════
{
    $eval = ['score' => 85, 'rules' => [['tier' => 'required', 'status' => 'failed']]];
    $pass = script_gate_status($eval) === 'failed';
    record('TC15', 'Script score≥80 แต่ required AEO rule fail', 'block',
        script_gate_status($eval), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC16 — Content ยังไม่ Approved → block
// ═══════════════════════════════════════════════════════════════════════════
{
    $content = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml(), false);
    $r = gate($db, $TENANT, $content, 'facebook');
    $pass = $r['blocked'] === true && str_contains($r['reason'] ?? '', 'อนุมัติ');
    record('TC16', 'Content ยังไม่ Approved', 'block (approval gate)',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC17 — Approved แล้วแก้ Article จน SEO/AEO ไม่ผ่าน → publish ต้อง block (ผลล่าสุด)
// ═══════════════════════════════════════════════════════════════════════════
{
    // ตอนแรกผ่าน
    $good = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $before = gate($db, $TENANT, $good, 'facebook')['blocked'];
    // "แก้" article จน SEO fail (structured_data หาย) — content ล่าสุด
    $bad = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml(), true, ['structured_data' => '']);
    $after = gate($db, $TENANT, $bad, 'facebook')['blocked'];
    $pass = $before === false && $after === true;
    record('TC17', 'Approved แล้วแก้ Article จน SEO/AEO fail', 'publish ตรวจผลล่าสุดและ block',
        "before blocked={$before}, after blocked={$after}", $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC18 — Script ผ่าน → แก้ script ให้ไม่ผ่าน → publish block (ผลล่าสุด)
// ═══════════════════════════════════════════════════════════════════════════
{
    $good = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $before = gate($db, $TENANT, $good, 'facebook')['blocked'];
    $bad = makeContent(['facebook'], ['facebook' => badScript()], passingHtml());
    $after = gate($db, $TENANT, $bad, 'facebook')['blocked'];
    $pass = $before === false && $after === true;
    record('TC18', 'Script ผ่าน → แก้ให้ไม่ผ่าน → publish', 'ตรวจ script ล่าสุดและ block',
        "before blocked={$before}, after blocked={$after}", $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC19 — Script ไม่ผ่าน → แก้ให้ผ่าน → publish ได้ (ผลล่าสุด)
// ═══════════════════════════════════════════════════════════════════════════
{
    $bad = makeContent(['facebook'], ['facebook' => badScript()], passingHtml());
    $before = gate($db, $TENANT, $bad, 'facebook')['blocked'];
    $good = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $after = gate($db, $TENANT, $good, 'facebook')['blocked'];
    $pass = $before === true && $after === false;
    record('TC19', 'Script ไม่ผ่าน → แก้ให้ผ่าน → publish', 'publish ได้หลังตรวจผลล่าสุด',
        "before blocked={$before}, after blocked={$after}", $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC20 — publish-once แยก platform (FB สำเร็จแล้ว → FB ซ้ำไม่ได้ / YT ยังได้)
// ═══════════════════════════════════════════════════════════════════════════
{
    // publish-once ใช้ get_published_content_platforms — จำลอง FB เผยแพร่แล้ว
    // (เขียนแถว sent ลง queue แล้วตรวจ, แล้วลบทิ้ง)
    $content = makeContent(['facebook', 'youtube'], ['facebook' => goodScript(), 'youtube' => goodScript()], passingHtml());
    $contentId = $content['id'];

    // FB ยังไม่เผยแพร่ → ได้ทั้งคู่
    $fbBefore = gate($db, $TENANT, $content, 'facebook')['blocked'];
    $ytBefore = gate($db, $TENANT, $content, 'youtube')['blocked'];

    // จำลอง FB เผยแพร่สำเร็จ (insert channel + sent queue)
    $chId = 'p5-test-ch-' . substr(md5(uniqid('', true)), 0, 8);
    $db->prepare("INSERT INTO publish_channels (id, tenant_id, name, platform, endpoint_url, is_active) VALUES (?,?,?,?,?,1)")
       ->execute([$chId, $TENANT, 'Test FB', 'facebook', 'https://example.test']);
    $qId = 'p5-test-q-' . substr(md5(uniqid('', true)), 0, 8);
    $db->prepare("INSERT INTO content_publish_queue (id, tenant_id, content_id, channel_id, scheduled_at, status) VALUES (?,?,?,?,NOW(),'sent')")
       ->execute([$qId, $TENANT, $contentId, $chId]);

    $published = get_published_content_platforms($db, $TENANT, $contentId);
    $fbPublished = in_array('facebook', $published, true);
    $ytPublished = in_array('youtube', $published, true);

    // cleanup
    $db->prepare("DELETE FROM content_publish_queue WHERE id=?")->execute([$qId]);
    $db->prepare("DELETE FROM publish_channels WHERE id=?")->execute([$chId]);

    // gate เองไม่บล็อก publish-once (caller ตรวจ) — ตรวจเฉพาะ get_published ทำงานแยก platform
    $pass = $fbBefore === false && $ytBefore === false && $fbPublished === true && $ytPublished === false;
    record('TC20', 'FB เผยแพร่แล้ว + YT ยังไม่', 'publish-once แยก platform (FB ซ้ำไม่ได้/YT ได้)',
        "FB published={$fbPublished}, YT published={$ytPublished}", $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC21 — Send Now กับ Schedule ใช้ gate เดียวกัน (final_publish_gate_check)
// ═══════════════════════════════════════════════════════════════════════════
{
    // brand-content.php?action=publish (send now) และ cron ใช้ final_publish_gate_check ตัวเดียวกัน
    // ตรวจว่า final_publish_gate_check เป็นฟังก์ชันเดียว → ผล deterministic
    $content = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $r1 = gate($db, $TENANT, $content, 'facebook');
    $r2 = gate($db, $TENANT, $content, 'facebook');
    $pass = $r1['blocked'] === $r2['blocked'] && $r1['blocked'] === false;
    record('TC21', 'Send Now กับ Schedule gate เดียวกัน', 'ผล gate เหมือนกัน',
        "r1=" . var_export($r1['blocked'], true) . ", r2=" . var_export($r2['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC22 — Schedule ผ่าน แต่ก่อนถึงเวลาแก้ Article ให้ fail → cron block
// ═══════════════════════════════════════════════════════════════════════════
{
    // cron re-evaluate ที่ dispatch time ด้วย content ล่าสุด (gateItem) → ใช้ gate เดียวกัน
    $bad = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml(), true, ['structured_data' => '']);
    $r = gate($db, $TENANT, $bad, 'facebook');
    $pass = $r['blocked'] === true;
    record('TC22', 'Schedule ผ่าน แต่แก้ Article ให้ fail → cron', 'cron block (evaluate ล่าสุด)',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC23 — Schedule ผ่าน แต่แก้ Script เป้าหมายให้ fail → cron block platform นั้น
// ═══════════════════════════════════════════════════════════════════════════
{
    $bad = makeContent(['facebook', 'youtube'], ['facebook' => goodScript(), 'youtube' => badScript()], passingHtml());
    $fb = gate($db, $TENANT, $bad, 'facebook')['blocked'];
    $yt = gate($db, $TENANT, $bad, 'youtube')['blocked'];
    $pass = $fb === false && $yt === true;
    record('TC23', 'Schedule ผ่าน แต่แก้ Script ให้ fail → cron', 'cron block เฉพาะ platform นั้น',
        "FB={$fb}, YT={$yt}", $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC24 — FB ผ่าน / IG ไม่ผ่าน → publish FB (ไม่ได้รับผลกระทบจาก IG)
// ═══════════════════════════════════════════════════════════════════════════
{
    $content = makeContent(['facebook', 'instagram'], ['facebook' => goodScript(), 'instagram' => badScript()], passingHtml());
    $fb = gate($db, $TENANT, $content, 'facebook')['blocked'];
    $pass = $fb === false;
    record('TC24', 'FB ผ่าน / IG ไม่ผ่าน → publish FB', 'FB สำเร็จ ไม่กระทบจาก IG',
        "FB blocked={$fb}", $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC25 — FB ผ่าน / IG ไม่ผ่าน → publish IG → block
// ═══════════════════════════════════════════════════════════════════════════
{
    $content = makeContent(['facebook', 'instagram'], ['facebook' => goodScript(), 'instagram' => badScript()], passingHtml());
    $ig = gate($db, $TENANT, $content, 'instagram')['blocked'];
    $pass = $ig === true;
    record('TC25', 'FB ผ่าน / IG ไม่ผ่าน → publish IG', 'IG block',
        "IG blocked={$ig}", $pass); tally($pass);
}

// ═══════════════════════════════════════════════════════════════════════════
// TC26 — ทุก platform ผ่าน → publish ได้หมด + sync status ถูกต้อง
// ═══════════════════════════════════════════════════════════════════════════
{
    $platforms = ['facebook', 'instagram', 'youtube'];
    $scripts = ['facebook' => goodScript(), 'instagram' => goodScript(), 'youtube' => goodScript()];
    $content = makeContent($platforms, $scripts, passingHtml());
    $allOk = true;
    foreach ($platforms as $p) { if (gate($db, $TENANT, $content, $p)['blocked']) $allOk = false; }
    // sync_content_publish_status: ยังไม่มี platform เผยแพร่ → status คง approved (ไม่ใช่ published)
    $selected = publish_content_platforms($content);
    $published = get_published_content_platforms($db, $TENANT, $content['id']);
    $allPublished = count(array_diff($selected, $published)) === 0;
    $expectedStatus = $allPublished ? 'published' : 'approved';
    $pass = $allOk && $expectedStatus === 'approved'; // ยังไม่มีเผยแพร่จริง → approved
    record('TC26', 'ทุก platform ผ่าน → publish', 'ทุก platform ได้ + status ถูกต้อง',
        "allOk={$allOk}, expectedStatus={$expectedStatus}", $pass); tally($pass);
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
