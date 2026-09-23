<?php
/**
 * kie-video-adapter — ทดสอบ build/parse ของ api/lib/kie-video.php ด้วย fixture
 * ที่มาจาก response จริงของ kie.ai (ทดสอบ 2026-09-23) — ไม่ยิง API จริง ไม่ใช้ credit
 *
 * รัน: php api/tests/kie-video-adapter-test.php
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/kie-video.php';

$RESULTS = [];
function record(string $tc, string $name, string $expected, string $actual, bool $pass): void {
    global $RESULTS;
    $RESULTS[] = [$tc, $name, $expected, $actual, $pass];
}
$PASS = 0; $FAIL = 0;
function tally(bool $pass): void { global $PASS, $FAIL; $pass ? $PASS++ : $FAIL++; }

// ── fixtures: model (ตรงกับ features.video ใน migration) ─────────────────────
function model(string $modelId, array $video): array {
    return ['id' => 'm-' . $modelId, 'model_id' => $modelId, 'name' => $modelId, 'video' => $video,
            'base_url' => 'https://api.kie.ai', 'api_key' => 'test'];
}
$veoLite = model('veo3_lite', ['api' => 'veo', 'durations' => [4, 6, 8], 'resolutions' => ['720p', '1080p'], 'price_unit' => 'per_clip']);
$sd15    = model('bytedance/seedance-1.5-pro', ['api' => 'market', 'durations' => ['min' => 4, 'max' => 12], 'resolutions' => ['720p', '1080p'], 'price_unit' => 'per_second', 'image_field' => 'input_urls']);
$sd25    = model('bytedance/seedance-2-5', ['api' => 'market', 'durations' => ['min' => 4, 'max' => 30], 'resolutions' => ['720p', '1080p'], 'price_unit' => 'per_second', 'image_field' => 'first_frame_url']);
$IMG = 'https://example.ngrok.app/uploads/content/scene0.jpg';

// ═══════════════════ Submit: veo ══════════════════════════════════════════
$r = kieVideoBuildSubmit($veoLite, ['prompt' => 'p', 'aspect_ratio' => '16:9', 'resolution' => '1080p', 'image_url' => $IMG]);
$pass = $r['path'] === '/api/v1/veo/generate' && $r['body']['imageUrls'] === [$IMG]
    && !isset($r['body']['generationType']) && $r['body']['duration'] === 8
    && $r['body']['resolution'] === '1080p' && $r['body']['aspect_ratio'] === '16:9' && $r['body']['model'] === 'veo3_lite';
record('TC01', 'Veo image-to-video payload', '/veo/generate + imageUrls + duration 8, ไม่มี generationType', json_encode($r), $pass); tally($pass);

$r = kieVideoBuildSubmit($veoLite, ['prompt' => 'p', 'aspect_ratio' => '9:16', 'resolution' => '720p', 'image_url' => null]);
$pass = ($r['body']['generationType'] ?? '') === 'TEXT_2_VIDEO' && !isset($r['body']['imageUrls']);
record('TC02', 'Veo text-to-video payload', 'generationType=TEXT_2_VIDEO, ไม่มี imageUrls', json_encode($r['body']), $pass); tally($pass);

// ═══════════════════ Submit: market ═══════════════════════════════════════
$r = kieVideoBuildSubmit($sd15, ['prompt' => 'p', 'aspect_ratio' => '9:16', 'resolution' => '720p', 'image_url' => $IMG]);
$in = $r['body']['input'];
$pass = $r['path'] === '/api/v1/jobs/createTask' && $r['body']['model'] === 'bytedance/seedance-1.5-pro'
    && $in['input_urls'] === [$IMG] && !isset($in['first_frame_url']) && $in['generate_audio'] === true && $in['duration'] === 8;
record('TC03', 'Seedance 1.5 Pro ใช้ input_urls (array) + generate_audio=true', 'input_urls=[url], generate_audio=true', json_encode($in), $pass); tally($pass);

$r = kieVideoBuildSubmit($sd25, ['prompt' => 'p', 'aspect_ratio' => '16:9', 'resolution' => '1080p', 'image_url' => $IMG]);
$in = $r['body']['input'];
$pass = $in['first_frame_url'] === $IMG && !isset($in['input_urls']) && $in['resolution'] === '1080p';
record('TC04', 'Seedance 2.5 ใช้ first_frame_url (string)', 'first_frame_url=url', json_encode($in), $pass); tally($pass);

$r = kieVideoBuildSubmit($sd25, ['prompt' => 'p', 'aspect_ratio' => '9:16', 'resolution' => '720p', 'image_url' => null]);
$in = $r['body']['input'];
$pass = !isset($in['first_frame_url']) && !isset($in['input_urls']) && $in['generate_audio'] === true;
record('TC05', 'Seedance text-to-video ไม่ส่งฟิลด์ภาพ', 'ไม่มีฟิลด์ภาพ', json_encode($in), $pass); tally($pass);

// ═══════════════════ Normalize ════════════════════════════════════════════
$r = kieVideoBuildSubmit($veoLite, ['prompt' => 'p', 'aspect_ratio' => 'Auto', 'resolution' => '4k']);
$pass = $r['body']['aspect_ratio'] === '9:16' && $r['body']['resolution'] === '720p';
record('TC06', 'Auto → 9:16, resolution ไม่รองรับ → 720p', '9:16 / 720p', $r['body']['aspect_ratio'] . ' / ' . $r['body']['resolution'], $pass); tally($pass);

$d1 = kieVideoClipDuration(['durations' => ['min' => 10, 'max' => 15]]);
$d2 = kieVideoClipDuration(['durations' => [5, 10]]);
$d3 = kieVideoClipDuration(['durations' => ['min' => 4, 'max' => 6]]);
$pass = $d1 === 10 && $d2 === 10 && $d3 === 6;
record('TC07', 'duration นอกช่วง → ค่าใกล้ 8 ที่สุด', '10 / 10 / 6', "{$d1} / {$d2} / {$d3}", $pass); tally($pass);
// หมายเหตุ TC07: [5,10] → |5-8|=3, |10-8|=2 → 10

// ═══════════════════ Parse submit ═════════════════════════════════════════
$pass = kieVideoParseSubmit(['code' => 200, 'msg' => 'success', 'data' => ['taskId' => '7ab79625a617606dea1b1ebead34d06a']]) === '7ab79625a617606dea1b1ebead34d06a';
record('TC08', 'อ่าน data.taskId', 'taskId', '', $pass); tally($pass);

$msg = '';
try { kieVideoParseSubmit(['code' => 402, 'msg' => 'Credits insufficient', 'data' => null]); } catch (RuntimeException $e) { $msg = $e->getMessage(); }
$pass = str_contains($msg, 'Credits insufficient');
record('TC09', 'ไม่มี taskId → error มีข้อความจาก msg', 'มี "Credits insufficient"', $msg, $pass); tally($pass);

// ═══════════════════ Poll: veo (fixture จาก response จริง 1080p) ══════════
$veoDone = ['code' => 200, 'msg' => 'success', 'data' => [
    'taskId' => 'a5a8281b06d423b2c52af0d931bb59d0', 'successFlag' => 1, 'errorMessage' => '',
    'response' => [
        'resolution' => '1080p',
        'originUrls' => ['https://tempfile.aiquickdraw.com/v/a5a8281b06d423b2c52af0d931bb59d0_0_1790133923.mp4'],
        'resultUrls' => ['https://tempfile.aiquickdraw.com/v/214d221f334399a68f8f81346b8d49fb_0_1790133965.mp4'],
    ],
]];
$p = kieVideoParsePoll('veo', $veoDone);
$pass = $p['status'] === 'success' && str_contains((string)$p['url'], '214d221f334399a68f8f81346b8d49fb');
record('TC10', 'Veo success ใช้ resultUrls (1080) ไม่ใช่ originUrls (720)', 'url = resultUrls[0]', (string)$p['url'], $pass); tally($pass);

$p = kieVideoParsePoll('veo', ['code' => 200, 'data' => ['successFlag' => 0, 'response' => null]]);
$pass = $p['status'] === 'generating';
record('TC11', 'Veo successFlag 0 → generating', 'generating', $p['status'], $pass); tally($pass);

$p = kieVideoParsePoll('veo', ['code' => 200, 'data' => ['successFlag' => 3, 'errorMessage' => 'content policy']]);
$pass = $p['status'] === 'failed' && $p['error'] === 'content policy';
record('TC12', 'Veo successFlag 3 → failed + errorMessage', 'failed / content policy', $p['status'] . ' / ' . $p['error'], $pass); tally($pass);

// ═══════════════════ Poll: market (fixture จาก response จริง Seedance 1.5 Pro) ═
$mDone = ['code' => 200, 'msg' => 'success', 'data' => [
    'taskId' => '077735cf657767d04efe14960a465909', 'state' => 'success',
    'resultJson' => '{"resultUrls":["https://tempfile.aiquickdraw.com/seedance/1790134190906-a36lw9qbz1i.mp4"]}',
    'failMsg' => null, 'creditsConsumed' => 28,
]];
$p = kieVideoParsePoll('market', $mDone);
$pass = $p['status'] === 'success' && str_ends_with((string)$p['url'], '1790134190906-a36lw9qbz1i.mp4');
record('TC13', 'market success decode resultJson', 'url = resultUrls[0]', (string)$p['url'], $pass); tally($pass);

$p = kieVideoParsePoll('market', ['code' => 200, 'data' => ['state' => 'waiting']]);
$pass = $p['status'] === 'generating';
record('TC14', 'market waiting → generating', 'generating', $p['status'], $pass); tally($pass);

$p = kieVideoParsePoll('market', ['code' => 200, 'data' => ['state' => 'fail', 'failMsg' => 'nsfw']]);
$pass = $p['status'] === 'failed' && $p['error'] === 'nsfw';
record('TC15', 'market fail → failed + failMsg', 'failed / nsfw', $p['status'] . ' / ' . $p['error'], $pass); tally($pass);

// ═══════════════════ Poll: error codes ════════════════════════════════════
$p1 = kieVideoParsePoll('market', ['code' => 500, 'msg' => 'server error']);
$p2 = kieVideoParsePoll('veo', ['code' => 404, 'msg' => 'task not found']);
$p3 = kieVideoParsePoll('veo', null);
$pass = $p1['status'] === 'generating' && $p2['status'] === 'failed' && $p2['error'] === 'task not found' && $p3['status'] === 'generating';
record('TC16', '5xx/อ่านไม่ได้ → generating, 4xx → failed', 'generating / failed / generating', "{$p1['status']} / {$p2['status']} / {$p3['status']}", $pass); tally($pass);

$p = kieVideoPollPath($veoLite, 'a b');
$q = kieVideoPollPath($sd15, 'x');
$pass = $p === '/api/v1/veo/record-info?taskId=a+b' && $q === '/api/v1/jobs/recordInfo?taskId=x';
record('TC17', 'poll path ตามตระกูล', 'veo/record-info / jobs/recordInfo', "{$p} / {$q}", $pass); tally($pass);

// ═══════════════════ Download: URL ใช้ไม่ได้ → null (ไม่มีไฟล์ค้าง) ══════
$tmpDir = sys_get_temp_dir() . '/kie-video-test-' . bin2hex(random_bytes(4));
$res = kieVideoDownload('http://127.0.0.1:9/nope.mp4', 'item1', 'task1', $tmpDir);
$left = is_dir($tmpDir) ? array_diff(scandir($tmpDir), ['.', '..']) : [];
$pass = $res === null && $left === [];
record('TC18', 'ดาวน์โหลดไม่สำเร็จ → null และไม่เหลือไฟล์ .part', 'null, โฟลเดอร์ว่าง', var_export($res, true) . ', files=' . count($left), $pass); tally($pass);

// ไฟล์ปลายทางมีอยู่แล้ว → คืน path ทันทีโดยไม่โหลดใหม่ (URL ที่ใช้ไม่ได้ก็ไม่เป็นไร)
file_put_contents($tmpDir . '/item2_task2.mp4', 'x');
$res = kieVideoDownload('http://127.0.0.1:9/nope.mp4', 'item2', 'task2', $tmpDir);
$pass = $res === '/uploads/content/videos/item2_task2.mp4';
record('TC21', 'ไฟล์ที่โหลดเสร็จแล้ว → คืน path ไม่โหลดซ้ำ', '/uploads/content/videos/item2_task2.mp4', var_export($res, true), $pass); tally($pass);

// มี request อื่นถือ lock อยู่ → คืน null ทันที ไม่เริ่มโหลดซ้อน (ไม่สร้าง .part)
$held = fopen($tmpDir . '/item3_task3.mp4.lock', 'c');
flock($held, LOCK_EX);
$t = microtime(true);
$res = kieVideoDownload('http://127.0.0.1:9/nope.mp4', 'item3', 'task3', $tmpDir);
$elapsed = microtime(true) - $t;
$pass = $res === null && !is_file($tmpDir . '/item3_task3.mp4.part') && $elapsed < 1;
record('TC22', 'กำลังโหลดอยู่ใน request อื่น → null ทันที', 'null, ไม่มี .part, < 1 วิ', var_export($res, true) . sprintf(', %.2fs', $elapsed), $pass); tally($pass);
flock($held, LOCK_UN); fclose($held);

array_map('unlink', glob($tmpDir . '/*'));
if (is_dir($tmpDir)) @rmdir($tmpDir);

// ═══════════════════ ความยาว / จำนวนฉาก (video-creation-options) ═════════
$counts = array_map('videoSceneCount', [30, 45, 60, 90]);
$pass = $counts === [4, 6, 7, 11];
record('TC23', 'videoSceneCount 30/45/60/90', '4/6/7/11', implode('/', $counts), $pass); tally($pass);

$norm = [normalizeVideoDuration(30), normalizeVideoDuration('45'), normalizeVideoDuration(90), normalizeVideoDuration(180), normalizeVideoDuration(15), normalizeVideoDuration(null)];
$pass = $norm === [30, 45, 90, 60, 60, 60];
record('TC24', 'normalizeVideoDuration รับแค่ 30/45/60/90', '30/45/90/60/60/60', implode('/', $norm), $pass); tally($pass);

// ═══════════════════ prompt + บทพากย์ (video-creation-options) ═══════════
$p1 = kieVideoComposePrompt('slow push-in on a laptop.', 'คุณกำลังจ่ายค่า AI ซ้ำซ้อนอยู่หรือเปล่า?');
$pass = $p1 === 'slow push-in on a laptop. A Thai narrator speaks in Thai, clearly and naturally: "คุณกำลังจ่ายค่า AI ซ้ำซ้อนอยู่หรือเปล่า?"';
record('TC25', 'มีบทพากย์ → ต่อท้ายคำสั่งพูดไทย + บทตรงตัว', 'video_prompt. A Thai narrator … "บท"', $p1, $pass); tally($pass);

// multi-clip-video: ฉากไม่มีบทพากย์ขอแค่เสียงบรรยากาศ ห้ามมีเสียงพูด (กัน model แต่งบทพูดเอง)
$p2 = kieVideoComposePrompt('pan left to right.', '   ');
$pass = $p2 === 'pan left to right. Ambient sound and natural background audio only — no speech, no dialogue, no narration.';
record('TC26', 'บทพากย์ว่าง → video_prompt + คำสั่งเสียงบรรยากาศ ไม่มีเสียงพูด', 'pan left to right. Ambient sound … no narration.', $p2, $pass); tally($pass);

$p3 = kieVideoComposePrompt('zoom in', 'เขาบอกว่า "ลองเลย" สิ');
$pass = str_ends_with($p3, ': "เขาบอกว่า "ลองเลย" สิ"');
record('TC27', 'บทพากย์มีเครื่องหมายคำพูด → คงไว้ตรงตัว ไม่แปลง/ไม่ตัด', 'ลงท้ายด้วยบทเดิมครบ', $p3, $pass); tally($pass);

// ═══════════════════ Submit: error ระดับบัญชี vs ระดับฉาก (multi-clip-video) ═
$kind = function (mixed $decoded, int $http = 200): string {
    try { kieVideoParseSubmit($decoded, '', $http); return 'ok'; }
    catch (KieVideoAccountException $e) { return 'account:' . $e->getCode(); }
    catch (RuntimeException $e) { return 'scene'; }
};
$k = [
    $kind(['code' => 402, 'msg' => 'Credits insufficient']),
    $kind(['code' => 401, 'msg' => 'Unauthorized']),
    $kind(null, 429),
    $kind(['code' => 422, 'msg' => 'prompt flagged']),
    $kind(['code' => 500, 'msg' => 'Internal Error']),
    $kind(['code' => 200, 'data' => ['taskId' => 't1']]),
];
$pass = $k === ['account:402', 'account:401', 'account:429', 'scene', 'scene', 'ok'];
record('TC28', 'แยก error ระดับบัญชี (401/402/429 body หรือ HTTP) กับระดับฉาก (422/500)', 'account:402/account:401/account:429/scene/scene/ok', implode('/', $k), $pass); tally($pass);

$p = kieVideoParsePoll('market', $mDone);
$pv = kieVideoParsePoll('veo', ['code' => 200, 'data' => ['successFlag' => 1, 'response' => ['resultUrls' => ['https://x/a.mp4']]]]);
$pass = ($p['credits'] ?? null) === 28 && !isset($pv['credits']);
record('TC29', 'market success อ่าน creditsConsumed / veo ไม่มี', '28 / ไม่มี', var_export($p['credits'] ?? null, true) . ' / ' . (isset($pv['credits']) ? 'มี' : 'ไม่มี'), $pass); tally($pass);

// ═══════════════════ Download: ต่อจาก .part ด้วย Range (multi-clip-video) ══
$srcDir = sys_get_temp_dir() . '/kie-range-src-' . bin2hex(random_bytes(4));
$dlDir  = sys_get_temp_dir() . '/kie-range-dl-' . bin2hex(random_bytes(4));
mkdir($srcDir); mkdir($dlDir);
$src = $srcDir . '/clip.mp4';
file_put_contents($src, random_bytes(300 * 1024));
$srcHash = md5_file($src);
$port = 8700 + random_int(0, 200);
$server = proc_open([PHP_BINARY, '-S', '127.0.0.1:' . $port, __DIR__ . '/fixtures/range-server.php'],
    [0 => ['pipe', 'r'], 1 => ['file', 'NUL', 'w'], 2 => ['file', 'NUL', 'w']], $pipes);
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $port, $en, $es, 0.1); $i++) usleep(100000);
$url = fn(string $mode) => 'http://127.0.0.1:' . $port . '/?mode=' . $mode . '&f=' . rawurlencode($src);

// slow + งบ 1 วิ → ได้บางส่วน, .part ค้างไว้; รอบสองต่อจนครบ
$r1 = kieVideoDownload($url('slow'), 'itemR', 'taskR', $dlDir, 1);
$partSize = is_file($dlDir . '/itemR_taskR.mp4.part') ? filesize($dlDir . '/itemR_taskR.mp4.part') : 0;
$r2 = kieVideoDownload($url('range'), 'itemR', 'taskR', $dlDir);
$okHash = is_file($dlDir . '/itemR_taskR.mp4') && md5_file($dlDir . '/itemR_taskR.mp4') === $srcHash;
$pass = $r1 === null && $partSize > 0 && $partSize < 300 * 1024 && $r2 === '/uploads/content/videos/itemR_taskR.mp4' && $okHash;
record('TC30', 'หมดงบเวลากลางทาง → เก็บ .part แล้วรอบถัดไปโหลดต่อจนไฟล์ตรงต้นฉบับ', "null + part>0 / path + md5 ตรง", var_export($r1, true) . " part={$partSize} / " . var_export($r2, true) . ' md5=' . ($okHash ? 'ตรง' : 'ไม่ตรง'), $pass); tally($pass);

// เซิร์ฟเวอร์ไม่รองรับ Range (ตอบ 200) → เริ่มใหม่ ไม่ต่อท้ายซ้ำ
file_put_contents($dlDir . '/itemN_taskN.mp4.part', substr(file_get_contents($src), 0, 100 * 1024));
$r = kieVideoDownload($url('norange'), 'itemN', 'taskN', $dlDir);
$okHash = is_file($dlDir . '/itemN_taskN.mp4') && md5_file($dlDir . '/itemN_taskN.mp4') === $srcHash;
$pass = $r === '/uploads/content/videos/itemN_taskN.mp4' && $okHash;
record('TC31', 'มี .part แต่เซิร์ฟเวอร์ไม่รองรับ Range → เริ่มใหม่ ไฟล์ตรงต้นฉบับ', 'path + md5 ตรง', var_export($r, true) . ' md5=' . ($okHash ? 'ตรง' : 'ไม่ตรง'), $pass); tally($pass);

// .part ครบแล้ว (รอบก่อนโหลดครบแต่ rename ไม่ทัน) → 416 → rename เป็นไฟล์จริง
copy($src, $dlDir . '/itemF_taskF.mp4.part');
$r = kieVideoDownload($url('range'), 'itemF', 'taskF', $dlDir);
$okHash = is_file($dlDir . '/itemF_taskF.mp4') && md5_file($dlDir . '/itemF_taskF.mp4') === $srcHash;
$pass = $r === '/uploads/content/videos/itemF_taskF.mp4' && $okHash;
record('TC32', '.part ครบแล้ว → 416 → ถือว่าเสร็จ', 'path + md5 ตรง', var_export($r, true) . ' md5=' . ($okHash ? 'ตรง' : 'ไม่ตรง'), $pass); tally($pass);

proc_terminate($server); proc_close($server);
array_map('unlink', glob($dlDir . '/*')); @rmdir($dlDir);
array_map('unlink', glob($srcDir . '/*')); @rmdir($srcDir);

// ═══════════════════ Load model จาก DB local (ต้องรัน migration แล้ว) ═════
$db = getDB();
$liteId = $db->query("SELECT id FROM ai_models WHERE provider_id='provider-kieai' AND model_id='veo3_lite'")->fetchColumn();
$m = $liteId ? kieVideoLoadModel($db, $liteId) : null;
$pass = $m !== null && $m['video']['api'] === 'veo' && $m['base_url'] === 'https://api.kie.ai' && $m['api_key'] !== '';
record('TC19', 'โหลด veo3_lite จาก DB (ตัด /api/v1 จาก base_url)', 'api=veo, base_url=https://api.kie.ai', $m ? ($m['video']['api'] . ', ' . $m['base_url']) : 'ไม่พบแถว', $pass); tally($pass);

$nonVideoId = $db->query("SELECT id FROM ai_models WHERE provider_id='provider-kieai' AND model_id='suno-v5'")->fetchColumn();
$msg = '';
try { kieVideoLoadModel($db, (string)$nonVideoId); } catch (RuntimeException $e) { $msg = $e->getMessage(); }
$pass = $nonVideoId && str_contains($msg, 'ใช้สร้างวิดีโอไม่ได้');
record('TC20', 'model ไม่มี features.video → error ภาษาไทย', 'ใช้สร้างวิดีโอไม่ได้', $msg, $pass); tally($pass);

// ═══════════════════ Output ════════════════════════════════════════════════
echo "\n";
echo "| TC | Test Case | Expected | Actual | PASS/FAIL |\n";
echo "|----|-----------|----------|--------|-----------|\n";
foreach ($RESULTS as [$tc, $name, $expected, $actual, $pass]) {
    $mark = $pass ? 'PASS' : 'FAIL';
    echo "| {$tc} | {$name} | {$expected} | " . mb_substr($actual, 0, 120) . " | {$mark} |\n";
}
echo "\nผ่าน: {$PASS} / " . count($RESULTS) . "\n";
echo "ไม่ผ่าน: {$FAIL} / " . count($RESULTS) . "\n";
if ($FAIL > 0) { echo "\nRESULT: FAIL\n"; exit(1); }
echo "\nRESULT: PASS\n";
