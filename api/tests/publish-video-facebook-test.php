<?php
/**
 * change publish-video-facebook — resolve_local_upload() core (regression ของรูป + วิดีโอใหม่),
 * video_readiness_gate_check(), และ dispatch_facebook()/dispatch_content() branch วิดีโอ
 * (เฉพาะส่วนที่ไม่ต้องยิงเครือข่ายจริง — การโพสต์จริงกับ Facebook อยู่ใน tasks.md กลุ่ม 6)
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

// ── fixture files ใต้ uploads/content/ (ลบทิ้งตอนจบ) ─────────────────────────
$uploadsContentDir = realpath(__DIR__ . '/../../uploads/content');
$fixtureImage = $uploadsContentDir . DIRECTORY_SEPARATOR . '_tmp_pvf_test_image.jpg';
$fixtureVideo = $uploadsContentDir . DIRECTORY_SEPARATOR . '_tmp_pvf_test_video.mp4';
file_put_contents($fixtureImage, 'not a real jpeg, just fixture bytes');
file_put_contents($fixtureVideo, 'not a real mp4, just fixture bytes');
register_shutdown_function(function () use ($fixtureImage, $fixtureVideo) {
    @unlink($fixtureImage);
    @unlink($fixtureVideo);
});

// ═══════════════════ Section A — resolve_local_image() regression (1.3) ═══════
// ── TC01 — ไฟล์รูปที่มีอยู่จริง resolve สำเร็จพร้อม mime ถูกต้อง ─────────────
{
    $r = resolve_local_image('/uploads/content/_tmp_pvf_test_image.jpg');
    $pass = $r['ok'] === true && $r['mime'] === 'image/jpeg';
    record('TC01', 'resolve_local_image() ไฟล์มีอยู่จริง', 'ok=true, mime=image/jpeg',
        'ok=' . var_export($r['ok'], true) . ', mime=' . ($r['mime'] ?? '-'), $pass); tally($pass);
}

// ── TC02 — path ที่หลุดออกนอก uploads/ ถูกปฏิเสธ ────────────────────────────
{
    $r = resolve_local_image('/../../.env');
    $pass = $r['ok'] === false;
    record('TC02', 'resolve_local_image() path หลุดนอก uploads/', 'ok=false',
        'ok=' . var_export($r['ok'], true) . ', error=' . ($r['error'] ?? '-'), $pass); tally($pass);
}

// ── TC03 — ไฟล์รูปไม่มีอยู่จริง ────────────────────────────────────────────
{
    $r = resolve_local_image('/uploads/content/_tmp_pvf_does_not_exist.jpg');
    $pass = $r['ok'] === false;
    record('TC03', 'resolve_local_image() ไฟล์ไม่มีอยู่จริง', 'ok=false',
        'ok=' . var_export($r['ok'], true), $pass); tally($pass);
}

// ═══════════════════ Section B — resolve_local_video() ใหม่ (1.4) ═════════════
// ── TC04 — ไฟล์วิดีโอที่มีอยู่จริง resolve สำเร็จพร้อม mime ถูกต้อง ──────────
{
    $r = resolve_local_video('/uploads/content/_tmp_pvf_test_video.mp4');
    $pass = $r['ok'] === true && $r['mime'] === 'video/mp4';
    record('TC04', 'resolve_local_video() ไฟล์มีอยู่จริง', 'ok=true, mime=video/mp4',
        'ok=' . var_export($r['ok'], true) . ', mime=' . ($r['mime'] ?? '-'), $pass); tally($pass);
}

// ── TC05 — path ที่หลุดออกนอก uploads/ ถูกปฏิเสธ ────────────────────────────
{
    $r = resolve_local_video('/../../.env');
    $pass = $r['ok'] === false;
    record('TC05', 'resolve_local_video() path หลุดนอก uploads/', 'ok=false',
        'ok=' . var_export($r['ok'], true) . ', error=' . ($r['error'] ?? '-'), $pass); tally($pass);
}

// ── TC06 — ไฟล์วิดีโอไม่มีอยู่จริง ─────────────────────────────────────────
{
    $r = resolve_local_video('/uploads/content/videos/_tmp_pvf_does_not_exist.mp4');
    $pass = $r['ok'] === false;
    record('TC06', 'resolve_local_video() ไฟล์ไม่มีอยู่จริง', 'ok=false',
        'ok=' . var_export($r['ok'], true), $pass); tally($pass);
}

// ═══════════════════ Section C — video_readiness_gate_check() (4.3-4.6) ═══════
// ── TC07 — คอนเทนต์ type='article' ไม่ถูกเช็คไฟล์วิดีโอเลย ─────────────────
{
    $r = video_readiness_gate_check(['type' => 'article', 'video_gen_status' => 'none', 'video_url' => null]);
    $pass = $r['blocked'] === false;
    record('TC07', 'type=article ไม่ถูกเช็ควิดีโอ', 'blocked=false',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ── TC08 — video_gen_status ไม่ใช่ done → block ────────────────────────────
{
    $r = video_readiness_gate_check(['type' => 'video', 'video_gen_status' => 'none', 'video_url' => null]);
    $pass = $r['blocked'] === true && str_contains($r['reason'] ?? '', 'ยังสร้างไม่เสร็จ');
    record('TC08', 'type=video, video_gen_status=none', 'blocked=true (ยังสร้างไม่เสร็จ)',
        'blocked=' . var_export($r['blocked'], true) . ', reason=' . ($r['reason'] ?? '-'), $pass); tally($pass);
}

// ── TC09 — video_gen_status=done แต่ไฟล์ไม่มีอยู่จริง → block ──────────────
{
    $r = video_readiness_gate_check([
        'type' => 'video', 'video_gen_status' => 'done',
        'video_url' => '/uploads/content/videos/_tmp_pvf_does_not_exist.mp4',
    ]);
    $pass = $r['blocked'] === true && str_contains($r['reason'] ?? '', 'ไม่พบไฟล์วิดีโอ');
    record('TC09', 'video_gen_status=done, ไฟล์ไม่มีอยู่จริง', 'blocked=true (ไม่พบไฟล์วิดีโอ)',
        'blocked=' . var_export($r['blocked'], true) . ', reason=' . ($r['reason'] ?? '-'), $pass); tally($pass);
}

// ── TC10 — video_gen_status=done และไฟล์มีอยู่จริง → ผ่าน ──────────────────
{
    $r = video_readiness_gate_check([
        'type' => 'video', 'video_gen_status' => 'done',
        'video_url' => '/uploads/content/_tmp_pvf_test_video.mp4',
    ]);
    $pass = $r['blocked'] === false;
    record('TC10', 'video_gen_status=done, ไฟล์มีอยู่จริง', 'blocked=false',
        'blocked=' . var_export($r['blocked'], true), $pass); tally($pass);
}

// ═══════════════════ Section D — dispatch_facebook() branch วิดีโอ (2.x, 5.1-5.2) ═
// หมายเหตุ: ทดสอบเฉพาะ path ที่ return ก่อนยิง cURL จริง (creds/ไฟล์) — การโพสต์จริง
// อยู่ใน tasks.md กลุ่ม 6 (ทดสอบจริงกับ Facebook)

// ── TC11 — creds ไม่ครบ ยัง error เดิมแม้มี videoUrl ────────────────────────
{
    $r = dispatch_facebook([], [], 'title', 'body', '', '/uploads/content/_tmp_pvf_test_video.mp4');
    $pass = $r['success'] === false && $r['error'] === 'Missing page_id or access_token';
    record('TC11', 'dispatch_facebook() creds ไม่ครบ + มี videoUrl', 'success=false, error เดิม',
        'success=' . var_export($r['success'], true) . ', error=' . ($r['error'] ?? '-'), $pass); tally($pass);
}

// ── TC12 — videoUrl ชี้ไฟล์ที่ไม่มีอยู่จริง → fail ก่อนยิง cURL ไม่ถอยไปโพสต์ข้อความ ──
{
    $creds = ['page_id' => 'fake-page', 'access_token' => 'fake-token'];
    $r = dispatch_facebook([], $creds, 'title', 'body', '', '/uploads/content/videos/_tmp_pvf_does_not_exist.mp4');
    $pass = $r['success'] === false && str_contains($r['error'] ?? '', 'วิดีโอ');
    record('TC12', 'dispatch_facebook() videoUrl ไฟล์ไม่มีอยู่จริง', 'success=false, error พูดถึงวิดีโอ',
        'success=' . var_export($r['success'], true) . ', error=' . ($r['error'] ?? '-'), $pass); tally($pass);
}

// ── TC13 — มีทั้ง videoUrl (ไฟล์ไม่มีอยู่จริง) และ imgUrl (ไฟล์มีอยู่จริง) → เข้า branch วิดีโอก่อนเสมอ
{
    $creds = ['page_id' => 'fake-page', 'access_token' => 'fake-token'];
    $r = dispatch_facebook(
        [], $creds, 'title', 'body',
        '/uploads/content/_tmp_pvf_test_image.jpg',
        '/uploads/content/videos/_tmp_pvf_does_not_exist.mp4'
    );
    // ถ้าตกไป branch รูป (ไฟล์มีอยู่จริง) จะไม่ error เลยแล้วพยายามยิง cURL จริง (fail เพราะ token ปลอม
    // แต่ error message จะไม่พูดถึงวิดีโอ) — ต้องได้ error ของ branch วิดีโอเท่านั้น
    $pass = $r['success'] === false && str_contains($r['error'] ?? '', 'วิดีโอ');
    record('TC13', 'มีทั้ง videoUrl และ imgUrl', 'เข้า branch วิดีโอก่อนเสมอ',
        'success=' . var_export($r['success'], true) . ', error=' . ($r['error'] ?? '-'), $pass); tally($pass);
}

// ── TC14 — dispatch_content() ส่ง video_url เข้า dispatch_facebook() ────────
{
    $channel = [
        'id' => 'test-fb-video-channel',
        'name' => 'Test FB Video',
        'platform' => 'facebook',
        'credentials_encrypted' => encryptApiKey(json_encode(['page_id' => 'fake-page', 'access_token' => 'fake-token'])),
        'is_active' => 1,
    ];
    $content = [
        'id' => 'test-video-content-1',
        'type' => 'video',
        'title' => 'ทดสอบวิดีโอ',
        'platform' => 'facebook',
        'platforms' => ['facebook'],
        'video_url' => '/uploads/content/videos/_tmp_pvf_does_not_exist.mp4',
        'article_content' => json_encode(['scripts' => ['facebook' => 'ข้อความทดสอบ']], JSON_UNESCAPED_UNICODE),
    ];
    $r = dispatch_content('facebook', $channel, $content);
    $pass = $r['success'] === false && str_contains($r['error'] ?? '', 'วิดีโอ');
    record('TC14', 'dispatch_content() ส่ง video_url ถึง dispatch_facebook()', 'ผ่านไปถึง branch วิดีโอ',
        'success=' . var_export($r['success'], true) . ', error=' . ($r['error'] ?? '-'), $pass); tally($pass);
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
