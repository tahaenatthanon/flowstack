<?php
/**
 * Part 5 — Final Publish Gate (Approval gate + Article SEO/AEO gate + Platform gate)
 * ทดสอบ final_publish_gate_check() ตัวจริง (brand-content.php?action=publish และ cron ใช้ตัวเดียวกัน)
 * + publish-once logic
 *
 * หมายเหตุ: Script SEO/AEO Quality Gate ถูกลบออกจากระบบแล้ว (ดู
 * openspec/changes/archive/.../remove-script-seo-aeo) — Section C ด้านล่างคือ
 * regression test ที่ยืนยันว่า Platform Script ไม่ถูก publish gate บล็อกด้วย
 * คุณภาพของ script อีกต่อไป ไม่ว่า script จะสั้น/ยาว/มี keyword หรือไม่ก็ตาม
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

// Script fixture ที่ "ครบเครื่อง" (มี hook/keyword/hashtag) — ใช้เป็น script ทั่วไป
// เดิมเคยใช้พิสูจน์ว่า Script SEO/AEO "ผ่าน" gate แต่ตอนนี้ gate นั้นถูกลบแล้ว
// จึงเหลือไว้เป็นแค่ fixture เนื้อหาปกติ ไม่มีความหมายเชิง gate อีกต่อไป
function goodScript(): string {
    return 'Hook: วิธีทำคอนเทนต์ให้ปังในปี 2026 คือการวางแผนเนื้อหาที่ตอบโจทย์กลุ่มเป้าหมายอย่างเป็นระบบ ' .
           'ขั้นตอนสำคัญคือการวิเคราะห์ผู้ชมและกำหนดเป้าหมายให้ชัดเจนก่อนเริ่มผลิตเนื้อหา #การตลาด #คอนเทนต์';
}
// Script fixture ที่ "แย่ที่สุด" (สั้น ไม่มี keyword/hashtag/entity) — เดิมเคยถูก
// Script SEO/AEO gate บล็อก ตอนนี้ต้อง publish ได้ปกติ (regression coverage Section C)
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
        'article_content'  => json_encode(array_merge($article, [
            // Simulate the persisted Quality snapshot produced by generate-article.
            // Final publish is only allowed when this marker belongs to the current version.
            'quality_checked_at' => '2026-09-08 10:00:00',
        ]), JSON_UNESCAPED_UNICODE),
    ];
    return array_merge($base, $seoOverrides);
}

function gate(PDO $db, string $tenant, array $content, string $platform, ?array $brief = null): array {
    return final_publish_gate_check($db, $tenant, $content, $platform, $brief);
}

// ═══════════════════ Section A — Approval + Platform gate (ไม่เปลี่ยน) ═══════
// ── TC01 — Content ยังไม่ Approved → block ─────────────────────────────────
{
    $content = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml(), false);
    $r = gate($db, $TENANT, $content, 'facebook');
    $pass = $r['blocked'] === true && str_contains($r['reason'] ?? '', 'อนุมัติ');
    record('TC01', 'Content ยังไม่ Approved', 'block (approval gate)',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ── TC02 — พยายาม publish platform ที่ไม่ได้เลือก → block ──────────────────
{
    $content = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $r = gate($db, $TENANT, $content, 'instagram'); // IG ไม่ได้เลือก
    $pass = $r['blocked'] === true && str_contains($r['reason'] ?? '', 'ไม่ได้ถูกเลือก');
    record('TC02', 'Publish platform ที่ไม่ได้เลือก', 'ถูก block',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ── TC03 — Send Now กับ Schedule/Cron ใช้ gate เดียวกัน (deterministic) ────
{
    $content = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $r1 = gate($db, $TENANT, $content, 'facebook');
    $r2 = gate($db, $TENANT, $content, 'facebook');
    $pass = $r1['blocked'] === $r2['blocked'] && $r1['blocked'] === false;
    record('TC03', 'Send Now กับ Schedule gate เดียวกัน', 'ผล gate เหมือนกัน',
        "r1=" . var_export($r1['blocked'], true) . ", r2=" . var_export($r2['blocked'], true), $pass); tally($pass);
}

// ═══════════════════ Section B — Article SEO/AEO gate (Web/CMS เท่านั้น ไม่เปลี่ยน) ═══
// ── TC04 — Article SEO+AEO ผ่าน + FB (script ใดก็ได้) → FB publish ได้ ─────
{
    $content = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $r = gate($db, $TENANT, $content, 'facebook');
    $pass = $r['blocked'] === false;
    record('TC04', 'Article SEO+AEO ผ่าน + FB', 'FB publish ได้',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ── TC05 — Article SEO ไม่ผ่าน → Web/CMS block แต่ Social ยัง publish ได้ ──
{
    $content = makeContent(['wordpress', 'facebook'], ['facebook' => goodScript()], passingHtml(), true, ['structured_data' => '']);
    $wp = gate($db, $TENANT, $content, 'wordpress');
    $fb = gate($db, $TENANT, $content, 'facebook');
    $pass = $wp['blocked'] === true && $fb['blocked'] === false;
    record('TC05', 'Article SEO ไม่ผ่าน', 'Web/CMS block แต่ Social ยัง publish ได้',
        'WP blocked=' . var_export($wp['blocked'], true) . ', FB blocked=' . var_export($fb['blocked'], true), $pass); tally($pass);
}

// ── TC06 — Article AEO ไม่ผ่าน → Web/CMS block แต่ Social ยัง publish ได้ ──
{
    $content = makeContent(['wordpress', 'facebook'], ['facebook' => goodScript()], aeoFailHtml());
    $wp = gate($db, $TENANT, $content, 'wordpress');
    $fb = gate($db, $TENANT, $content, 'facebook');
    $pass = $wp['blocked'] === true && $fb['blocked'] === false;
    record('TC06', 'Article AEO ไม่ผ่าน', 'Web/CMS block แต่ Social ยัง publish ได้',
        'WP blocked=' . var_export($wp['blocked'], true) . ', FB blocked=' . var_export($fb['blocked'], true), $pass); tally($pass);
}

// ── TC07 — Approved แล้วแก้ Article จน SEO/AEO ไม่ผ่าน → publish block (ผลล่าสุด) ──
{
    $good = makeContent(['wordpress'], [], passingHtml());
    $before = gate($db, $TENANT, $good, 'wordpress')['blocked'];
    $bad = makeContent(['wordpress'], [], passingHtml(), true, ['structured_data' => '']);
    $after = gate($db, $TENANT, $bad, 'wordpress')['blocked'];
    $pass = $before === false && $after === true;
    record('TC07', 'Approved แล้วแก้ Article จน SEO/AEO fail', 'publish ตรวจผลล่าสุดและ block',
        "before blocked={$before}, after blocked={$after}", $pass); tally($pass);
}

// ── TC08 — Schedule ผ่าน แต่ก่อนถึงเวลาแก้ Article ให้ fail → cron block ────
{
    $bad = makeContent(['wordpress'], [], passingHtml(), true, ['structured_data' => '']);
    $r = gate($db, $TENANT, $bad, 'wordpress');
    $pass = $r['blocked'] === true;
    record('TC08', 'Schedule ผ่าน แต่แก้ Article ให้ fail → cron', 'cron block (evaluate ล่าสุด)',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ═══════════════════ Section C — Platform Script: ไม่มี Script SEO/AEO Gate อีกต่อไป ═══
// Regression coverage สำหรับ remove-script-seo-aeo: ก่อนหน้านี้ script สั้น/ไม่มี
// keyword/entity จะถูก final_publish_gate_check บล็อก ตอนนี้ต้อง "publish ได้เสมอ"
// ไม่ว่าเนื้อหา script จะเป็นอย่างไร (ยังต้องผ่าน Approval + Platform gate ตามปกติ)

// ── TC09 — FB script สั้นมาก ไม่มี keyword/hashtag → ไม่ถูก block อีกต่อไป ──
{
    $content = makeContent(['facebook'], ['facebook' => 'x'], passingHtml());
    $r = gate($db, $TENANT, $content, 'facebook');
    $pass = $r['blocked'] === false;
    record('TC09', 'FB script สั้นมาก ไม่มี keyword', 'FB publish ได้ (Script SEO gate ถูกลบแล้ว)',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ── TC10 — FB script ไม่มี entity/answer cue → ไม่ถูก block อีกต่อไป ───────
{
    $content = makeContent(['facebook'], ['facebook' => 'วิธีทำคอนเทนต์'], passingHtml());
    $r = gate($db, $TENANT, $content, 'facebook');
    $pass = $r['blocked'] === false;
    record('TC10', 'FB script ไม่มี entity/answer cue', 'FB publish ได้ (Script AEO gate ถูกลบแล้ว)',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ── TC11 — FB + YT script แย่ทั้งคู่ → publish ได้ทั้งคู่ (ไม่มี per-platform gate) ──
{
    $content = makeContent(['facebook', 'youtube'], ['facebook' => badScript(), 'youtube' => badScript()], passingHtml());
    $fb = gate($db, $TENANT, $content, 'facebook')['blocked'];
    $yt = gate($db, $TENANT, $content, 'youtube')['blocked'];
    $pass = $fb === false && $yt === false;
    record('TC11', 'FB+YT script แย่ทั้งคู่', 'publish ได้ทั้งคู่',
        "FB={$fb}, YT={$yt}", $pass); tally($pass);
}

// ── TC12 — Platform ที่เลือกไม่มี script เลย → publish ยังทำได้ ────────────
// (เดิม "ไม่มี script" เป็น required-fail ของ Script SEO/AEO gate; ตอนนี้ gate
// นั้นถูกลบ ระบบไม่ตรวจสอบการมีอยู่ของ script ในชั้น publish gate อีกต่อไป —
// เป็น trade-off ที่ยอมรับแล้วใน design.md ของ remove-script-seo-aeo)
{
    $content = makeContent(['facebook', 'instagram'], ['facebook' => goodScript()], passingHtml()); // IG ไม่มี script
    $r = gate($db, $TENANT, $content, 'instagram');
    $pass = $r['blocked'] === false;
    record('TC12', 'Platform ที่เลือกไม่มี script เลย', 'publish ยังทำได้ (ไม่มี Script Presence gate อีกต่อไป)',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ── TC13 — แก้ script จาก "แย่" เป็น "ดี" (หรือกลับกัน) → ผล publish เหมือนเดิมเสมอ ──
{
    $bad = makeContent(['facebook'], ['facebook' => badScript()], passingHtml());
    $before = gate($db, $TENANT, $bad, 'facebook')['blocked'];
    $good = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml());
    $after = gate($db, $TENANT, $good, 'facebook')['blocked'];
    $pass = $before === false && $after === false;
    record('TC13', 'แก้เนื้อหา script (แย่↔ดี)', 'publish ได้เสมอ ไม่ผูกกับเนื้อหา script',
        "before blocked={$before}, after blocked={$after}", $pass); tally($pass);
}

// ── TC14 — FB+IG+YT script คุณภาพต่ำหมด → publish ได้ทุก platform ──────────
{
    $platforms = ['facebook', 'instagram', 'youtube'];
    $scripts = ['facebook' => badScript(), 'instagram' => badScript(), 'youtube' => badScript()];
    $content = makeContent($platforms, $scripts, passingHtml());
    $allOk = true;
    foreach ($platforms as $p) { if (gate($db, $TENANT, $content, $p)['blocked']) $allOk = false; }
    $pass = $allOk;
    record('TC14', 'FB+IG+YT script คุณภาพต่ำหมด', 'ทุก platform publish ได้ (ไม่มี Script Gate ขวาง)',
        'allOk=' . var_export($allOk, true), $pass); tally($pass);
}

// ── TC15 — Cron: schedule ที่ script เป้าหมายถูกแก้ให้แย่ก่อนถึงเวลา → ไม่ block ──
{
    $bad = makeContent(['facebook', 'youtube'], ['facebook' => goodScript(), 'youtube' => badScript()], passingHtml());
    $fb = gate($db, $TENANT, $bad, 'facebook')['blocked'];
    $yt = gate($db, $TENANT, $bad, 'youtube')['blocked'];
    $pass = $fb === false && $yt === false;
    record('TC15', 'Cron: script เป้าหมายถูกแก้ให้แย่', 'cron ไม่ block ด้วย Script SEO/AEO อีกต่อไป',
        "FB={$fb}, YT={$yt}", $pass); tally($pass);
}

// ═══════════════════ Section D — publish-once + status sync (ไม่เปลี่ยน) ═══════
// ── TC16 — publish-once แยก platform (FB สำเร็จแล้ว → FB ซ้ำไม่ได้ / YT ยังได้) ──
{
    $content = makeContent(['facebook', 'youtube'], ['facebook' => goodScript(), 'youtube' => goodScript()], passingHtml());
    $contentId = $content['id'];

    $fbBefore = gate($db, $TENANT, $content, 'facebook')['blocked'];
    $ytBefore = gate($db, $TENANT, $content, 'youtube')['blocked'];

    $chId = 'p5-test-ch-' . substr(md5(uniqid('', true)), 0, 8);
    $db->prepare("INSERT INTO publish_channels (id, tenant_id, name, platform, endpoint_url, is_active) VALUES (?,?,?,?,?,1)")
       ->execute([$chId, $TENANT, 'Test FB', 'facebook', 'https://example.test']);
    $qId = 'p5-test-q-' . substr(md5(uniqid('', true)), 0, 8);
    $db->prepare("INSERT INTO content_publish_queue (id, tenant_id, content_id, channel_id, scheduled_at, status) VALUES (?,?,?,?,NOW(),'sent')")
       ->execute([$qId, $TENANT, $contentId, $chId]);

    $published = get_published_content_platforms($db, $TENANT, $contentId);
    $fbPublished = in_array('facebook', $published, true);
    $ytPublished = in_array('youtube', $published, true);

    $db->prepare("DELETE FROM content_publish_queue WHERE id=?")->execute([$qId]);
    $db->prepare("DELETE FROM publish_channels WHERE id=?")->execute([$chId]);

    $pass = $fbBefore === false && $ytBefore === false && $fbPublished === true && $ytPublished === false;
    record('TC16', 'FB เผยแพร่แล้ว + YT ยังไม่', 'publish-once แยก platform (FB ซ้ำไม่ได้/YT ได้)',
        "FB published={$fbPublished}, YT published={$ytPublished}", $pass); tally($pass);
}

// ── TC17 — ทุก platform (script คุณภาพต่างกัน) → publish ได้หมด + sync status ถูกต้อง ──
{
    $platforms = ['facebook', 'instagram', 'youtube'];
    $scripts = ['facebook' => goodScript(), 'instagram' => badScript(), 'youtube' => goodScript()];
    $content = makeContent($platforms, $scripts, passingHtml());
    $allOk = true;
    foreach ($platforms as $p) { if (gate($db, $TENANT, $content, $p)['blocked']) $allOk = false; }
    $selected = publish_content_platforms($content);
    $published = get_published_content_platforms($db, $TENANT, $content['id']);
    $allPublished = count(array_diff($selected, $published)) === 0;
    $expectedStatus = $allPublished ? 'published' : 'approved';
    $pass = $allOk && $expectedStatus === 'approved'; // ยังไม่มีเผยแพร่จริง → approved
    record('TC17', 'FB+IG+YT (คุณภาพ script ต่างกัน) → publish', 'ทุก platform ได้ + status ถูกต้อง',
        "allOk={$allOk}, expectedStatus={$expectedStatus}", $pass); tally($pass);
}

// ═══════════════════ Section E — Central publish executor (ไม่เปลี่ยน) ═════════
// ── TC18 — Central publish executor ต้อง block ก่อน dispatch เมื่อยังไม่ Approved ──
{
    $content = makeContent(['facebook'], ['facebook' => goodScript()], passingHtml(), false);
    $channel = [
        'id' => 'central-test-channel',
        'name' => 'Central Test',
        'platform' => 'facebook',
        'endpoint_url' => 'https://example.test',
        'credentials_encrypted' => '',
        'is_active' => 1,
    ];
    $r = publish_via_central_flow($db, $TENANT, $content, $channel, 'test-user');
    $pass = ($r['success'] ?? true) === false
        && ($r['status'] ?? '') === 'blocked'
        && str_contains($r['error'] ?? '', 'อนุมัติ');
    record('TC18', 'Central publish executor + content ยังไม่ Approved', 'block ก่อน dispatch',
        'status=' . ($r['status'] ?? '') . ', success=' . var_export($r['success'] ?? null, true), $pass); tally($pass);
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
